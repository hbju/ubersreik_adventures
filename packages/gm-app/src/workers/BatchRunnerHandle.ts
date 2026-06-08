import type {
    BatchProgress,
    EncounterConfig,
    FightSeed,
} from '@wfrp/shared/combat';
import type {
    BatchWorkerRequest,
    BatchWorkerResponse,
    BatchWorkerResult,
} from './fight-batch.protocol';

export interface BatchWorkerLike {
    postMessage(message: BatchWorkerRequest): void;
    terminate(): void;
    onmessage: ((event: { data: BatchWorkerResponse }) => void) | null;
    onerror: ((event: { message?: string; error?: unknown }) => void) | null;
}

export type BatchWorkerFactory = () => BatchWorkerLike;
export type BatchProgressListener = (progress: BatchProgress) => void;
export type BatchCompleteListener = (result: BatchWorkerResult) => void;
export type BatchErrorListener = (error: Error) => void;

export class BatchRunnerHandle {
    private worker?: BatchWorkerLike;
    private requestId?: string;
    private requestCounter = 0;
    private readonly progressListeners = new Set<BatchProgressListener>();
    private readonly completeListeners = new Set<BatchCompleteListener>();
    private readonly errorListeners = new Set<BatchErrorListener>();

    constructor(private readonly workerFactory: BatchWorkerFactory = defaultWorkerFactory) {}

    start(config: EncounterConfig, masterSeed: FightSeed, iterations: number): this {
        if (!Number.isSafeInteger(iterations) || iterations < 0) {
            throw new RangeError(`Iterations must be a non-negative safe integer: ${iterations}`);
        }
        this.disposeWorker();
        const worker = this.workerFactory();
        const requestId = `batch-${Date.now()}-${this.requestCounter++}`;
        this.worker = worker;
        this.requestId = requestId;

        worker.onmessage = event => this.handleMessage(event.data);
        worker.onerror = event => {
            this.notifyError(toError(event.error ?? event.message ?? 'Batch worker failed'));
            this.disposeWorker();
        };
        worker.postMessage({ type: 'start', requestId, config, masterSeed, iterations });
        return this;
    }

    cancel(): void {
        if (!this.worker || !this.requestId) return;
        this.worker.postMessage({ type: 'cancel', requestId: this.requestId });
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
        this.disposeWorker();
        this.progressListeners.clear();
        this.completeListeners.clear();
        this.errorListeners.clear();
    }

    private handleMessage(message: BatchWorkerResponse): void {
        if (message.requestId !== this.requestId) return;
        if (message.type === 'progress') {
            for (const listener of this.progressListeners) listener(message.progress);
            return;
        }
        if (message.type === 'complete') {
            for (const listener of this.completeListeners) listener(message.payload);
            this.disposeWorker();
            return;
        }
        this.notifyError(new Error(message.error));
        this.disposeWorker();
    }

    private notifyError(error: Error): void {
        for (const listener of this.errorListeners) listener(error);
    }

    private disposeWorker(): void {
        this.worker?.terminate();
        this.worker = undefined;
        this.requestId = undefined;
    }
}

function defaultWorkerFactory(): BatchWorkerLike {
    const injectedFactory = (globalThis as typeof globalThis & {
        __fightLabWorkerFactory?: BatchWorkerFactory;
    }).__fightLabWorkerFactory;
    if (injectedFactory) return injectedFactory();
    return new Worker(new URL('./fight-batch.worker.ts', import.meta.url), { type: 'module' }) as unknown as BatchWorkerLike;
}

function toError(value: unknown): Error {
    return value instanceof Error ? value : new Error(String(value));
}
