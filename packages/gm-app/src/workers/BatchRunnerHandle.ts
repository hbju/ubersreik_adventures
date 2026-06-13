import {
    aggregateBatchProgress,
    aggregateBatchResult,
    deriveWorkerTaskSeed,
    mergeBatchResults,
    splitBatchRange,
    type BatchProgress,
    type BatchRangeTask,
    type BatchRangeTaskResult,
    type EncounterConfig,
    type FightSeed,
} from '@wfrp/shared/combat';
import type { BatchWorkerResult } from './fight-batch.protocol';
import {
    WorkerPool,
    defaultWorkerCount,
    type PoolWorkerFactory,
    type PoolWorkerLike,
} from './WorkerPool';

export type BatchWorkerLike = PoolWorkerLike<
    BatchRangeTask,
    BatchRangeTaskResult,
    BatchProgress
>;
export type BatchWorkerFactory = PoolWorkerFactory<
    BatchRangeTask,
    BatchRangeTaskResult,
    BatchProgress
>;
export type BatchProgressListener = (progress: BatchProgress) => void;
export type BatchCompleteListener = (result: BatchWorkerResult) => void;
export type BatchErrorListener = (error: Error) => void;

export interface BatchRunnerHandleOptions {
    workerCount?: number;
    chunkSize?: number;
}

export class BatchRunnerHandle {
    private readonly pool: WorkerPool<BatchRangeTask, BatchRangeTaskResult, BatchProgress>;
    private readonly chunkSize?: number;
    private runCounter = 0;
    private running = false;
    private readonly progressListeners = new Set<BatchProgressListener>();
    private readonly completeListeners = new Set<BatchCompleteListener>();
    private readonly errorListeners = new Set<BatchErrorListener>();

    constructor(
        workerFactory: BatchWorkerFactory = defaultWorkerFactory,
        options: BatchRunnerHandleOptions = {}
    ) {
        this.pool = new WorkerPool(workerFactory, options.workerCount ?? configuredWorkerCount());
        this.chunkSize = options.chunkSize;
    }

    start(config: EncounterConfig, masterSeed: FightSeed, iterations: number): this {
        if (!Number.isSafeInteger(iterations) || iterations < 0) {
            throw new RangeError(`Iterations must be a non-negative safe integer: ${iterations}`);
        }
        if (this.running) throw new Error('Batch runner already has an active run');
        this.running = true;

        const range = [0, iterations] as const;
        const chunkSize = this.chunkSize
            ?? Math.max(1, Math.ceil(iterations / Math.max(1, this.pool.size * 4)));
        const runKey = this.runCounter++;
        const tasks: BatchRangeTask[] = splitBatchRange(range, chunkSize).map((taskRange, index) => ({
            id: `batch-${runKey}-${index}`,
            type: 'batch-range',
            seed: deriveWorkerTaskSeed(masterSeed, taskRange[0]),
            totalCount: taskRange[1] - taskRange[0],
            payload: { config, masterSeed, range: taskRange },
        }));

        void this.pool.run(tasks, {
            onProgress: update => {
                const progress = aggregateBatchProgress(
                    update.tasks.filter(task => task.detail !== undefined),
                    iterations,
                    update.cancelled
                );
                for (const listener of this.progressListeners) listener(progress);
            },
        }).then(poolResult => {
            const result = mergeBatchResults(
                config,
                masterSeed,
                range,
                poolResult.results.map(entry => entry.result),
                poolResult.cancelled
            );
            const payload = { result, report: aggregateBatchResult(result) };
            this.running = false;
            for (const listener of this.completeListeners) listener(payload);
        }).catch(error => {
            this.running = false;
            this.notifyError(error instanceof Error ? error : new Error(String(error)));
        });
        return this;
    }

    cancel(): void {
        this.pool.cancel();
    }

    onProgress(listener: BatchProgressListener): () => void {
        this.progressListeners.add(listener);
        return () => this.progressListeners.delete(listener);
    }

    onComplete(listener: BatchCompleteListener): () => void {
        this.completeListeners.add(listener);
        return () => this.completeListeners.delete(listener);
    }

    onError(listener: BatchErrorListener): () => void {
        this.errorListeners.add(listener);
        return () => this.errorListeners.delete(listener);
    }

    dispose(): void {
        this.pool.dispose();
        this.running = false;
        this.progressListeners.clear();
        this.completeListeners.clear();
        this.errorListeners.clear();
    }

    private notifyError(error: Error): void {
        for (const listener of this.errorListeners) listener(error);
    }
}

function defaultWorkerFactory(): BatchWorkerLike {
    const injectedFactory = (globalThis as typeof globalThis & {
        __fightLabWorkerFactory?: BatchWorkerFactory;
    }).__fightLabWorkerFactory;
    if (injectedFactory) return injectedFactory();
    return new Worker(new URL('./fight-batch.worker.ts', import.meta.url), { type: 'module' }) as unknown as BatchWorkerLike;
}

function configuredWorkerCount(): number {
    const injectedCount = (globalThis as typeof globalThis & {
        __fightLabWorkerCount?: number;
    }).__fightLabWorkerCount;
    return injectedCount ?? defaultWorkerCount();
}
