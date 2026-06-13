import {
    runBatch,
    type BatchProgress,
    type BatchRangeTask,
    type BatchRangeTaskResult,
    type BatchResult,
    type EncounterConfig,
    type FightSeed,
    type RunBatchOptions,
    type WorkerTask,
    type WorkerTaskProgress,
} from '@wfrp/shared/combat';
import type {
    PoolWorkerRequest,
    PoolWorkerResponse,
} from './fight-batch.protocol';

export interface WorkerHostScope<
    TTask extends WorkerTask = WorkerTask,
    TResult = unknown,
    TProgress = unknown,
> {
    postMessage(message: PoolWorkerResponse<TResult, TProgress>): void;
    onmessage: ((event: { data: PoolWorkerRequest<TTask> }) => void) | null;
}

export type BatchWorkerHostScope = WorkerHostScope<
    BatchRangeTask,
    BatchRangeTaskResult,
    BatchProgress
>;

export type WorkerTaskHandler<
    TTask extends WorkerTask,
    TResult,
    TProgress,
> = (
    task: TTask,
    context: {
        isCancelled: () => boolean;
        onProgress: (progress: WorkerTaskProgress<TProgress>) => void;
    }
) => Promise<TResult>;

export type WorkerBatchRunner = (
    config: EncounterConfig,
    masterSeed: FightSeed,
    range: readonly [number, number],
    options?: RunBatchOptions
) => Promise<BatchResult>;

export function installWorkerHost<
    TTask extends WorkerTask,
    TResult,
    TProgress,
>(
    scope: WorkerHostScope<TTask, TResult, TProgress>,
    handlers: Record<string, WorkerTaskHandler<TTask, TResult, TProgress>>
): () => void {
    const cancelledTasks = new Set<string>();
    let disposed = false;

    scope.onmessage = event => {
        const message = event.data;
        if (message.type === 'cancel') {
            if (message.taskId) cancelledTasks.add(`${message.runId}:${message.taskId}`);
            return;
        }
        void execute(message.runId, message.task);
    };

    async function execute(runId: string, task: TTask): Promise<void> {
        const cancellationKey = `${runId}:${task.id}`;
        try {
            const handler = handlers[task.type];
            if (!handler) throw new Error(`Unsupported worker task type: ${task.type}`);
            const result = await handler(task, {
                isCancelled: () => cancelledTasks.has(cancellationKey),
                onProgress: progress => {
                    if (!disposed) scope.postMessage({ type: 'progress', runId, progress });
                },
            });
            if (!disposed) {
                scope.postMessage({ type: 'complete', runId, taskId: task.id, result });
            }
        } catch (error) {
            if (!disposed) {
                scope.postMessage({
                    type: 'error',
                    runId,
                    taskId: task.id,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        } finally {
            cancelledTasks.delete(cancellationKey);
        }
    }

    return () => {
        disposed = true;
        scope.onmessage = null;
        cancelledTasks.clear();
    };
}

export function installBatchWorkerHost(
    scope: BatchWorkerHostScope,
    batchRunner: WorkerBatchRunner = runBatch
): () => void {
    return installWorkerHost(scope, {
        'batch-range': async (task, context) => ({
            result: await batchRunner(
                task.payload.config,
                task.payload.masterSeed,
                task.payload.range,
                {
                    isCancelled: context.isCancelled,
                    progressEvery: 10,
                    yieldEvery: 5,
                    onProgress: detail => context.onProgress({
                        taskId: task.id,
                        completedCount: detail.completedCount,
                        totalCount: detail.totalCount,
                        detail,
                    }),
                }
            ),
        }),
    });
}
