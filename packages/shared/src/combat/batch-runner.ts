import {
    runFight,
    type EncounterConfig,
    type FightOutcome,
    type FightRunnerOptions,
    type FightSeed,
} from './fight-runner';

export type BatchRange = readonly [startInclusive: number, endExclusive: number];

export interface IndexedFightOutcome {
    index: number;
    seed: FightSeed;
    outcome: FightOutcome;
}

export interface BatchFailure {
    index: number;
    seed: FightSeed;
    error: string;
}

export interface BatchWinRates {
    ally: number;
    adversary: number;
    draw: number;
}

export interface BatchProgress {
    completedCount: number;
    totalCount: number;
    successfulCount: number;
    failureCount: number;
    cancelled: boolean;
    winRates: BatchWinRates;
}

export interface BatchResult {
    outcomes: IndexedFightOutcome[];
    failures: BatchFailure[];
    completedCount: number;
    masterSeed: FightSeed;
    range: BatchRange;
    config: EncounterConfig;
    cancelled: boolean;
}

export type BatchFightRunner = (
    config: EncounterConfig,
    seed: FightSeed,
    options?: FightRunnerOptions
) => FightOutcome;

export interface RunBatchOptions {
    onProgress?: (progress: BatchProgress) => void;
    isCancelled?: () => boolean;
    progressEvery?: number;
    progressIntervalMs?: number;
    yieldEvery?: number;
    fightRunner?: BatchFightRunner;
    fightOptions?: FightRunnerOptions;
}

export function deriveFightSeed(masterSeed: FightSeed, index: number): string {
    if (!Number.isSafeInteger(index) || index < 0) {
        throw new RangeError(`Fight index must be a non-negative safe integer: ${index}`);
    }

    const input = `${typeof masterSeed}:${String(masterSeed)}:${index}`;
    let hash = 0x811c9dc5;
    for (let offset = 0; offset < input.length; offset += 1) {
        hash ^= input.charCodeAt(offset);
        hash = Math.imul(hash, 0x01000193);
        hash ^= hash >>> 13;
    }
    hash ^= index;
    hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
    hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
    hash ^= hash >>> 16;
    return `${String(masterSeed)}:${index}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export async function runBatch(
    config: EncounterConfig,
    masterSeed: FightSeed,
    range: BatchRange,
    options: RunBatchOptions = {}
): Promise<BatchResult> {
    const [start, end] = validateRange(range);
    const totalCount = end - start;
    const outcomes: IndexedFightOutcome[] = [];
    const failures: BatchFailure[] = [];
    const fightRunner = options.fightRunner ?? runFight;
    const progressEvery = Math.max(1, Math.floor(options.progressEvery ?? 25));
    const progressIntervalMs = Math.max(0, options.progressIntervalMs ?? 100);
    const yieldEvery = Math.max(1, Math.floor(options.yieldEvery ?? 10));
    let completedCount = 0;
    let cancelled = false;
    let lastProgressAt = 0;
    let lastProgressCount = -1;

    const emitProgress = (force = false) => {
        if (!options.onProgress) return;
        const now = Date.now();
        const byCount = completedCount === totalCount || completedCount % progressEvery === 0;
        const byTime = now - lastProgressAt >= progressIntervalMs;
        if (!force && !byCount && !byTime) return;
        if (!force && completedCount === lastProgressCount) return;
        lastProgressAt = now;
        lastProgressCount = completedCount;
        options.onProgress(progressSnapshot(outcomes, failures, completedCount, totalCount, cancelled));
    };

    emitProgress(true);
    for (let index = start; index < end; index += 1) {
        if (options.isCancelled?.()) {
            cancelled = true;
            break;
        }

        const seed = deriveFightSeed(masterSeed, index);
        try {
            outcomes.push({
                index,
                seed,
                outcome: fightRunner(config, seed, options.fightOptions),
            });
        } catch (error) {
            failures.push({ index, seed, error: errorMessage(error) });
        }
        completedCount += 1;
        emitProgress();

        if (completedCount % yieldEvery === 0 && index + 1 < end) {
            await yieldToHost();
        }
    }

    if (!cancelled && options.isCancelled?.()) cancelled = true;
    emitProgress(true);
    return {
        outcomes,
        failures,
        completedCount,
        masterSeed,
        range: [start, end],
        config,
        cancelled,
    };
}

function validateRange(range: BatchRange): BatchRange {
    const [start, end] = range;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) {
        throw new RangeError(`Invalid batch range [${start}, ${end})`);
    }
    return [start, end];
}

function progressSnapshot(
    outcomes: IndexedFightOutcome[],
    failures: BatchFailure[],
    completedCount: number,
    totalCount: number,
    cancelled: boolean
): BatchProgress {
    const wins = { ally: 0, adversary: 0, draw: 0 };
    for (const entry of outcomes) wins[entry.outcome.winner] += 1;
    const denominator = outcomes.length || 1;
    return {
        completedCount,
        totalCount,
        successfulCount: outcomes.length,
        failureCount: failures.length,
        cancelled,
        winRates: {
            ally: wins.ally / denominator,
            adversary: wins.adversary / denominator,
            draw: wins.draw / denominator,
        },
    };
}

function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

function yieldToHost(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
}
