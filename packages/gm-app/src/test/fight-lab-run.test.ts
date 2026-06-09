import { describe, expect, it } from 'vitest';
import {
    aggregateBatchResult,
    type BatchResult,
    type EncounterConfig,
} from '@wfrp/shared';
import {
    completeRunState,
    progressRunState,
    replayHandoffForFailure,
    startRunState,
    suggestedIterations,
} from '../fight-lab/run-state';

describe('Fight Lab run state', () => {
    it('tracks progress, elapsed time, and ETA before completing', () => {
        const running = startRunState(1_000, 100);
        const progressed = progressRunState(running, {
            completedCount: 25,
            totalCount: 100,
            successfulCount: 24,
            failureCount: 1,
            cancelled: false,
            winRates: { ally: 0.5, adversary: 0.4, draw: 0.1 },
        }, 2_000);

        expect(progressed.status).toBe('running');
        expect(progressed.elapsedMs).toBe(1_000);
        expect(progressed.etaMs).toBe(3_000);

        const batch = batchResult(false);
        const completed = completeRunState(progressed, {
            result: batch,
            report: aggregateBatchResult(batch),
        }, 2_500);

        expect(completed.status).toBe('complete');
        expect(completed.progress?.completedCount).toBe(2);
        expect(completed.elapsedMs).toBe(1_500);
        expect(completed.etaMs).toBe(0);
    });

    it('marks a cancelled completion as a partial report', () => {
        const batch = batchResult(true);
        const completed = completeRunState(startRunState(0, 2), {
            result: batch,
            report: aggregateBatchResult(batch),
        }, 10);

        expect(completed.status).toBe('cancelled');
        expect(completed.result?.cancelled).toBe(true);
        expect(completed.report?.completedCount).toBe(2);
    });

    it('passes the exact failing fight index and seed to replay', () => {
        expect(replayHandoffForFailure({
            index: 13,
            seed: 'master:13:deadbeef',
            error: 'boom',
        })).toEqual({
            index: 13,
            seed: 'master:13:deadbeef',
            error: 'boom',
        });
    });

    it('suggests a larger sample for an inconclusive report', () => {
        const batch = batchResult(false);
        const report = aggregateBatchResult(batch);

        expect(report.sufficientSample).toBe(false);
        expect(suggestedIterations(report, 2)).toBeGreaterThan(2);
    });
});

function batchResult(cancelled: boolean): BatchResult {
    return {
        outcomes: [],
        failures: [
            { index: 0, seed: 'seed-0', error: 'fixture failure' },
            { index: 1, seed: 'seed-1', error: 'fixture failure' },
        ],
        completedCount: 2,
        masterSeed: 'master',
        range: [0, 2],
        config: {
            sides: { ally: [], adversary: [] },
        } as EncounterConfig,
        cancelled,
    };
}
