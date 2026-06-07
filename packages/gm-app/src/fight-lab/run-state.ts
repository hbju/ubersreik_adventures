import type {
    BatchFailure,
    BatchProgress,
    BatchResult,
    FightSeed,
    MetricReport,
} from '@wfrp/shared';
import type { BatchWorkerResult } from '../workers';

export type FightLabRunStatus = 'idle' | 'running' | 'complete' | 'cancelled' | 'error';

export interface FightLabRunState {
    status: FightLabRunStatus;
    progress?: BatchProgress;
    report?: MetricReport;
    result?: BatchResult;
    error?: string;
    startedAt?: number;
    elapsedMs: number;
    etaMs?: number;
}

export interface ReplayHandoff {
    index: number;
    seed: FightSeed;
}

export const IDLE_RUN_STATE: FightLabRunState = {
    status: 'idle',
    elapsedMs: 0,
};

export function startRunState(now: number, totalCount: number): FightLabRunState {
    return {
        status: 'running',
        startedAt: now,
        elapsedMs: 0,
        progress: {
            completedCount: 0,
            totalCount,
            successfulCount: 0,
            failureCount: 0,
            cancelled: false,
            winRates: { ally: 0, adversary: 0, draw: 0 },
        },
    };
}

export function progressRunState(
    state: FightLabRunState,
    progress: BatchProgress,
    now: number
): FightLabRunState {
    const elapsedMs = state.startedAt === undefined ? state.elapsedMs : Math.max(0, now - state.startedAt);
    const etaMs = progress.completedCount > 0 && progress.completedCount < progress.totalCount
        ? elapsedMs / progress.completedCount * (progress.totalCount - progress.completedCount)
        : progress.completedCount >= progress.totalCount ? 0 : undefined;
    return { ...state, status: 'running', progress, elapsedMs, etaMs };
}

export function completeRunState(
    state: FightLabRunState,
    payload: BatchWorkerResult,
    now: number
): FightLabRunState {
    const elapsedMs = state.startedAt === undefined ? state.elapsedMs : Math.max(0, now - state.startedAt);
    return {
        ...state,
        status: payload.result.cancelled ? 'cancelled' : 'complete',
        result: payload.result,
        report: payload.report,
        progress: {
            completedCount: payload.result.completedCount,
            totalCount: payload.result.range[1] - payload.result.range[0],
            successfulCount: payload.result.outcomes.length,
            failureCount: payload.result.failures.length,
            cancelled: payload.result.cancelled,
            winRates: winRates(payload.result),
        },
        elapsedMs,
        etaMs: 0,
        error: undefined,
    };
}

export function failRunState(
    state: FightLabRunState,
    error: Error,
    now: number
): FightLabRunState {
    return {
        ...state,
        status: 'error',
        error: error.message,
        elapsedMs: state.startedAt === undefined ? state.elapsedMs : Math.max(0, now - state.startedAt),
        etaMs: undefined,
    };
}

export function replayHandoffForFailure(failure: BatchFailure): ReplayHandoff {
    return { index: failure.index, seed: failure.seed };
}

export function suggestedIterations(report: MetricReport, currentIterations: number): number {
    if (report.sufficientSample) return currentIterations;
    const halfWidths = [
        report.sideOutcomes.ally.winRate.ci.halfWidth,
        report.sideOutcomes.adversary.winRate.ci.halfWidth,
        report.sideOutcomes.ally.drawRate.ci.halfWidth,
    ];
    const widest = Math.max(...halfWidths);
    const currentN = Math.max(1, report.successfulCount || currentIterations);
    const estimate = currentN * Math.pow(widest / report.sufficientNHalfWidth, 2);
    return Math.max(currentIterations + 1, Math.ceil(estimate / 100) * 100);
}

function winRates(result: BatchResult): BatchProgress['winRates'] {
    const counts = { ally: 0, adversary: 0, draw: 0 };
    for (const entry of result.outcomes) counts[entry.outcome.winner] += 1;
    const denominator = result.outcomes.length || 1;
    return {
        ally: counts.ally / denominator,
        adversary: counts.adversary / denominator,
        draw: counts.draw / denominator,
    };
}
