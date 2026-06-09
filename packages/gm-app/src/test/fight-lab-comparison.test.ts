import { describe, expect, it } from 'vitest';
import {
    aggregateBatchResult,
    type BatchResult,
    type Character,
    type EncounterConfig,
    type FightOutcome,
    type SideId,
} from '@wfrp/shared';
import {
    compareAverages,
    compareFightLabScenarios,
} from '../fight-lab/comparison';
import {
    cacheScenarioReport,
    configFingerprint,
    isCachedReportStale,
} from '../fight-lab/model';
import type { FightLabScenario } from '../fight-lab/types';

describe('Fight Lab comparison', () => {
    it('wires significant report deltas distinctly from noise-level changes', () => {
        const baseline = scenarioWithReport('baseline', 320, 400);
        const changed = scenarioWithReport('changed', 80, 400);
        const noise = scenarioWithReport('noise', 316, 400);

        const realChange = compareFightLabScenarios(baseline, changed)!;
        const smallChange = compareFightLabScenarios(baseline, noise)!;

        expect(realChange.reportComparison.winRate.ally).toMatchObject({
            significant95: true,
            ciOverlap: false,
        });
        expect(realChange.reportComparison.winRate.ally.delta).toBeCloseTo(-0.6);
        expect(smallChange.reportComparison.winRate.ally.significant95).toBe(false);
        expect(smallChange.reportComparison.winRate.ally.ciOverlap).toBe(true);
        expect(realChange.lowN).toBe(false);
    });

    it('detects stale reports using a deterministic config fingerprint', () => {
        const scenario = scenarioWithReport('stale', 200, 400);
        const reordered = {
            ...scenario.config,
            toggles: { ...scenario.config.toggles },
            sides: {
                adversary: scenario.config.sides.adversary,
                ally: scenario.config.sides.ally,
            },
        } as EncounterConfig;

        expect(configFingerprint(reordered)).toBe(configFingerprint(scenario.config));
        expect(isCachedReportStale(scenario)).toBe(false);

        const edited = {
            ...scenario,
            config: {
                ...scenario.config,
                toggles: { ...scenario.config.toggles, maxRounds: 99 },
            },
        };
        expect(isCachedReportStale(edited)).toBe(true);
        expect(compareFightLabScenarios(scenario, edited)?.staleB).toBe(true);
    });

    it('aligns matching combatants by identity and falls back when rosters differ', () => {
        const baseline = scenarioWithReport('baseline', 240, 400, ['hero'], ['foe']);
        const sameRoster = scenarioWithReport('same', 220, 400, ['hero'], ['foe']);
        const differentRoster = scenarioWithReport('different', 220, 400, ['hero', 'hireling'], ['foe']);

        expect(compareFightLabScenarios(baseline, sameRoster)).toMatchObject({
            rostersMatch: true,
            alignedCombatantIds: ['foe', 'hero'],
        });
        expect(compareFightLabScenarios(baseline, differentRoster)).toMatchObject({
            rostersMatch: false,
            alignedCombatantIds: [],
        });
    });

    it('uses mean confidence interval overlap as a continuous-metric hint', () => {
        const baseline = scenarioWithReport('baseline', 200, 400);
        const changed = scenarioWithReport('changed', 200, 400, ['hero'], ['foe'], 12);
        const comparison = compareAverages(
            baseline.cachedReport!.report.combatants.hero.fateSpent,
            changed.cachedReport!.report.combatants.hero.fateSpent
        );

        expect(comparison.delta).toBe(0);
        expect(comparison.ciOverlap).toBe(true);
    });
});

function scenarioWithReport(
    id: string,
    allyWins: number,
    sampleSize: number,
    allyIds = ['hero'],
    adversaryIds = ['foe'],
    roundOffset = 0
): FightLabScenario {
    const config: EncounterConfig = {
        sides: {
            ally: allyIds.map(combatantId => ({ id: combatantId, character: { name: combatantId } as Character })),
            adversary: adversaryIds.map(combatantId => ({ id: combatantId, character: { name: combatantId } as Character })),
        },
        toggles: { maxRounds: 50 },
    };
    const outcomes = Array.from({ length: sampleSize }, (_, index) => {
        const winner = index < allyWins ? 'ally' : 'adversary';
        return {
            index,
            seed: `${id}:${index}`,
            outcome: outcome(config, winner, 3 + roundOffset + index % 2),
        };
    });
    const batch: BatchResult = {
        outcomes,
        failures: [],
        completedCount: sampleSize,
        masterSeed: id,
        range: [0, sampleSize],
        config,
        cancelled: false,
    };
    const now = new Date(0).toISOString();
    return cacheScenarioReport({
        id,
        name: id,
        config,
        batch: { iterations: sampleSize, masterSeed: id, seedLocked: true },
        layout: { sidePositions: { ally: 0, adversary: 10 }, offsets: {} },
        createdAt: now,
        updatedAt: now,
    }, {
        report: aggregateBatchResult(batch),
        masterSeed: id,
        iterations: sampleSize,
        failures: [],
        partial: false,
        completedAt: now,
    });
}

function outcome(
    config: EncounterConfig,
    winner: SideId,
    rounds: number
): FightOutcome {
    const combatants = Object.fromEntries((['ally', 'adversary'] as SideId[]).flatMap(side =>
        config.sides[side].map(member => {
            const survived = side === winner;
            return [member.id, {
                id: member.id,
                name: member.id,
                side,
                survived,
                finalWounds: survived ? 5 : 0,
                died: !survived,
                critsDealt: 0,
                critsTaken: 0,
                conditionsInflicted: 0,
                fateSpent: 0,
                fortuneSpent: 0,
                advantageGenerated: 0,
            }];
        })
    ));
    return {
        seed: `${winner}:${rounds}`,
        winner,
        rounds,
        terminalReason: 'sideDown',
        combatants,
        sideResources: {
            ally: { fateSpent: 0, fortuneSpent: 0, advantageGenerated: 0, advantageSpent: 0 },
            adversary: { fateSpent: 0, fortuneSpent: 0, advantageGenerated: 0, advantageSpent: 0 },
        },
    };
}
