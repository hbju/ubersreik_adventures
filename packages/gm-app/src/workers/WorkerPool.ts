import type {
    WorkerTask,
    WorkerTaskProgress,
} from '@wfrp/shared/combat';
import type {
    PoolWorkerRequest,
    PoolWorkerResponse,
} from './fight-batch.protocol';

export interface PoolWorkerLike<
    TTask extends WorkerTask = WorkerTask,
    TResult = unknown,
    TProgress = unknown,
> {
    postMessage(message: PoolWorkerRequest<TTask>): void;
    terminate(): void;
    onmessage: ((event: { data: PoolWorkerResponse<TResult, TProgress> }) => void) | null;
    onerror: ((event: { message?: string; error?: unknown }) => void) | null;
}

export type PoolWorkerFactory<
    TTask extends WorkerTask,
    TResult,
    TProgress,
> = () => PoolWorkerLike<TTask, TResult, TProgress>;

export interface WorkerPoolRunProgress<TProgress> {
    completedCount: number;
    totalCount: number;
    cancelled: boolean;
    tasks: readonly WorkerTaskProgress<TProgress>[];
}

export interface WorkerPoolRunResult<TResult> {
    results: TResult[];
    cancelled: boolean;
}

export interface WorkerPoolRunOptions<TProgress> {
    onProgress?: (progress: WorkerPoolRunProgress<TProgress>) => void;
}

interface WorkerSlot<TTask extends WorkerTask, TResult, TProgress> {
    worker: PoolWorkerLike<TTask, TResult, TProgress>;
    taskId?: string;
}

interface ActiveRun<TTask extends WorkerTask, TResult, TProgress> {
    id: string;
    queue: TTask[];
    results: TResult[];
    progress: Map<string, WorkerTaskProgress<TProgress>>;
    totalCount: number;
    cancelled: boolean;
    resolve: (result: WorkerPoolRunResult<TResult>) => void;
    reject: (error: Error) => void;
    onProgress?: (progress: WorkerPoolRunProgress<TProgress>) => void;
}

export class WorkerPool<
    TTask extends WorkerTask,
    TResult,
    TProgress = unknown,
> {
    private readonly slots: WorkerSlot<TTask, TResult, TProgress>[] = [];
    private activeRun?: ActiveRun<TTask, TResult, TProgress>;
    private runCounter = 0;
    readonly size: number;

    constructor(
        private readonly workerFactory: PoolWorkerFactory<TTask, TResult, TProgress>,
        size = defaultWorkerCount()
    ) {
        if (!Number.isSafeInteger(size) || size < 1) {
            throw new RangeError(`Worker count must be a positive safe integer: ${size}`);
        }
        this.size = size;
    }

    run(
        tasks: readonly TTask[],
        options: WorkerPoolRunOptions<TProgress> = {}
    ): Promise<WorkerPoolRunResult<TResult>> {
        if (this.activeRun) throw new Error('Worker pool already has an active run');

        return new Promise((resolve, reject) => {
            const run: ActiveRun<TTask, TResult, TProgress> = {
                id: `pool-${Date.now()}-${this.runCounter++}`,
                queue: [...tasks],
                results: [],
                progress: new Map(),
                totalCount: tasks.reduce((sum, task) => sum + task.totalCount, 0),
                cancelled: false,
                resolve,
                reject,
                onProgress: options.onProgress,
            };
            for (const task of tasks) {
                run.progress.set(task.id, {
                    taskId: task.id,
                    completedCount: 0,
                    totalCount: task.totalCount,
                    detail: undefined as TProgress,
                });
            }
            this.activeRun = run;
            this.emitProgress(run);

            if (tasks.length === 0) {
                this.finishRun(run);
                return;
            }
            this.ensureWorkers(Math.min(this.size, tasks.length));
            this.dispatch();
        });
    }

    cancel(): void {
        const run = this.activeRun;
        if (!run || run.cancelled) return;
        run.cancelled = true;
        run.queue.length = 0;
        for (const slot of this.slots) {
            if (slot.taskId) {
                slot.worker.postMessage({ type: 'cancel', runId: run.id, taskId: slot.taskId });
            }
        }
        this.emitProgress(run);
        this.finishIfIdle();
    }

    dispose(): void {
        const run = this.activeRun;
        if (run) {
            run.cancelled = true;
            run.resolve({ results: run.results, cancelled: true });
            this.activeRun = undefined;
        }
        for (const slot of this.slots) slot.worker.terminate();
        this.slots.length = 0;
    }

    private ensureWorkers(count: number): void {
        while (this.slots.length < count) {
            const slot: WorkerSlot<TTask, TResult, TProgress> = {
                worker: this.workerFactory(),
            };
            slot.worker.onmessage = event => this.handleMessage(slot, event.data);
            slot.worker.onerror = event => {
                const error = toError(event.error ?? event.message ?? 'Worker failed');
                this.failRun(error);
            };
            this.slots.push(slot);
        }
    }

    private dispatch(): void {
        const run = this.activeRun;
        if (!run) return;
        for (const slot of this.slots) {
            if (slot.taskId || run.cancelled) continue;
            const task = run.queue.shift();
            if (!task) break;
            slot.taskId = task.id;
            slot.worker.postMessage({ type: 'execute', runId: run.id, task });
        }
        this.finishIfIdle();
    }

    private handleMessage(
        slot: WorkerSlot<TTask, TResult, TProgress>,
        message: PoolWorkerResponse<TResult, TProgress>
    ): void {
        const run = this.activeRun;
        if (!run || message.runId !== run.id) return;
        if (message.type === 'progress') {
            run.progress.set(message.progress.taskId, message.progress);
            this.emitProgress(run);
            return;
        }
        if (message.type === 'error') {
            this.failRun(new Error(message.error));
            return;
        }

        run.results.push(message.result);
        const completed = run.progress.get(message.taskId);
        if (completed) {
            run.progress.set(message.taskId, {
                ...completed,
                completedCount: completed.totalCount,
            });
            this.emitProgress(run);
        }
        slot.taskId = undefined;
        this.dispatch();
    }

    private emitProgress(run: ActiveRun<TTask, TResult, TProgress>): void {
        if (!run.onProgress) return;
        const tasks = [...run.progress.values()];
        run.onProgress({
            completedCount: tasks.reduce((sum, task) => sum + task.completedCount, 0),
            totalCount: run.totalCount,
            cancelled: run.cancelled,
            tasks,
        });
    }

    private finishIfIdle(): void {
        const run = this.activeRun;
        if (!run || run.queue.length > 0 || this.slots.some(slot => slot.taskId)) return;
        this.finishRun(run);
    }

    private finishRun(run: ActiveRun<TTask, TResult, TProgress>): void {
        if (this.activeRun !== run) return;
        this.activeRun = undefined;
        run.resolve({ results: run.results, cancelled: run.cancelled });
    }

    private failRun(error: Error): void {
        const run = this.activeRun;
        if (!run) return;
        this.activeRun = undefined;
        for (const slot of this.slots) slot.worker.terminate();
        this.slots.length = 0;
        run.reject(error);
    }
}

export function defaultWorkerCount(): number {
    const concurrency = globalThis.navigator?.hardwareConcurrency ?? 2;
    return Math.max(1, Math.floor(concurrency) - 1);
}

function toError(value: unknown): Error {
    return value instanceof Error ? value : new Error(String(value));
}
