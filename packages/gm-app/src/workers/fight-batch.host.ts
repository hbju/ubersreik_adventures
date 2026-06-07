import {
    runBatch,
    type BatchResult,
    type EncounterConfig,
    type FightSeed,
    type RunBatchOptions,
} from '@wfrp/shared';
import type {
    BatchWorkerRequest,
    BatchWorkerResponse,
} from './fight-batch.protocol';

export interface BatchWorkerHostScope {
    postMessage(message: BatchWorkerResponse): void;
    onmessage: ((event: { data: BatchWorkerRequest }) => void) | null;
}

export type WorkerBatchRunner = (
    config: EncounterConfig,
    masterSeed: FightSeed,
    range: readonly [number, number],
    options?: RunBatchOptions
) => Promise<BatchResult>;

export function installBatchWorkerHost(
    scope: BatchWorkerHostScope,
    batchRunner: WorkerBatchRunner = runBatch
): () => void {
    const cancelledRequests = new Set<string>();
    let disposed = false;

    scope.onmessage = event => {
        const message = event.data;
        if (message.type === 'cancel') {
            cancelledRequests.add(message.requestId);
            return;
        }
        void execute(message.requestId, message.config, message.masterSeed, message.iterations);
    };

    async function execute(
        requestId: string,
        config: EncounterConfig,
        masterSeed: FightSeed,
        iterations: number
    ): Promise<void> {
        try {
            const result = await batchRunner(config, masterSeed, [0, iterations], {
                isCancelled: () => cancelledRequests.has(requestId),
                progressEvery: 10,
                yieldEvery: 5,
                onProgress: progress => {
                    if (!disposed) scope.postMessage({ type: 'progress', requestId, progress });
                },
            });
            if (!disposed) scope.postMessage({ type: 'complete', requestId, result });
        } catch (error) {
            if (!disposed) {
                scope.postMessage({
                    type: 'error',
                    requestId,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        } finally {
            cancelledRequests.delete(requestId);
        }
    }

    return () => {
        disposed = true;
        scope.onmessage = null;
        cancelledRequests.clear();
    };
}
