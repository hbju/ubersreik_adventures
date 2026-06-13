import type {
    BatchProgress,
    BatchRange,
    BatchResult,
} from './batch-runner';
import type { EncounterConfig, FightSeed } from './fight-runner';

export interface WorkerTask<
    TType extends string = string,
    TPayload = unknown,
> {
    id: string;
    type: TType;
    seed: FightSeed;
    totalCount: number;
    payload: TPayload;
}

export interface BatchRangeTaskPayload {
    config: EncounterConfig;
    masterSeed: FightSeed;
    range: BatchRange;
}

export type BatchRangeTask = WorkerTask<'batch-range', BatchRangeTaskPayload>;

export interface BatchRangeTaskResult {
    result: BatchResult;
}

export interface WorkerTaskProgress<TProgress = unknown> {
    taskId: string;
    completedCount: number;
    totalCount: number;
    detail: TProgress;
}

export function deriveWorkerTaskSeed(masterSeed: FightSeed, taskKey: string | number): string {
    const input = `${typeof masterSeed}:${String(masterSeed)}:task:${String(taskKey)}`;
    let hash = 0x811c9dc5;
    for (let offset = 0; offset < input.length; offset += 1) {
        hash ^= input.charCodeAt(offset);
        hash = Math.imul(hash, 0x01000193);
        hash ^= hash >>> 13;
    }
    hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
    hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
    hash ^= hash >>> 16;
    return `${String(masterSeed)}:task:${String(taskKey)}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function splitBatchRange(
    range: BatchRange,
    chunkSize: number
): BatchRange[] {
    const [start, end] = range;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) {
        throw new RangeError(`Invalid batch range [${start}, ${end})`);
    }
    if (!Number.isSafeInteger(chunkSize) || chunkSize < 1) {
        throw new RangeError(`Chunk size must be a positive safe integer: ${chunkSize}`);
    }

    const chunks: BatchRange[] = [];
    for (let chunkStart = start; chunkStart < end; chunkStart += chunkSize) {
        chunks.push([chunkStart, Math.min(end, chunkStart + chunkSize)]);
    }
    return chunks;
}

export function mergeBatchResults(
    config: EncounterConfig,
    masterSeed: FightSeed,
    range: BatchRange,
    chunks: readonly BatchResult[],
    cancelled = chunks.some(chunk => chunk.cancelled)
): BatchResult {
    const outcomes = chunks
        .flatMap(chunk => chunk.outcomes)
        .sort((left, right) => left.index - right.index);
    const failures = chunks
        .flatMap(chunk => chunk.failures)
        .sort((left, right) => left.index - right.index);

    return {
        outcomes,
        failures,
        completedCount: chunks.reduce((sum, chunk) => sum + chunk.completedCount, 0),
        masterSeed,
        range,
        config,
        cancelled,
    };
}

export function aggregateBatchProgress(
    progress: readonly WorkerTaskProgress<BatchProgress>[],
    totalCount: number,
    cancelled: boolean
): BatchProgress {
    let completedCount = 0;
    let successfulCount = 0;
    let failureCount = 0;
    const wins = { ally: 0, adversary: 0, draw: 0 };

    for (const update of progress) {
        completedCount += update.detail.completedCount;
        successfulCount += update.detail.successfulCount;
        failureCount += update.detail.failureCount;
        wins.ally += update.detail.winRates.ally * update.detail.successfulCount;
        wins.adversary += update.detail.winRates.adversary * update.detail.successfulCount;
        wins.draw += update.detail.winRates.draw * update.detail.successfulCount;
    }

    const denominator = successfulCount || 1;
    return {
        completedCount,
        totalCount,
        successfulCount,
        failureCount,
        cancelled,
        winRates: {
            ally: wins.ally / denominator,
            adversary: wins.adversary / denominator,
            draw: wins.draw / denominator,
        },
    };
}
