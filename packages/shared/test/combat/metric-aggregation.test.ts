import { describe, expect, it } from 'vitest';
import type { Character } from '../../src/types/wfrp.types';
import {
    aggregateBatchResult,
    compareReports,
    numericDistribution,
    wilsonInterval,
    type BatchResult,
    type EncounterConfig,
    type FightCombatantOutcome,
    type FightOutcome,
    type SideId,
} from '../../src/combat';

const config: EncounterConfig = {
    sides: {
        ally: [{ id: 'hero', character: { name: 'Hero' } as Character }],
        adversary: [{ id: 'foe', character: { name: 'Foe' } as Character }],
    },
};

describe('metric aggregation', () => {
    it('computes hand-checked rates, Wilson intervals, distributions, and histograms', () => {
        const report = aggregateBatchResult(batch([
            outcome('ally', 1, combatant('hero', 'ally', true, 8), combatant('foe', 'adversary', false, 0, true)),
            outcome('ally', 2, combatant('hero', 'ally', true, 6), combatant('foe', 'adversary', false, 0, true)),
            outcome('adversary', 3, combatant('hero', 'ally', false, 0, true), combatant('foe', 'adversary', true, 4)),
            outcome('draw', 4, combatant('hero', 'ally', true, 2), combatant('foe', 'adversary', true, 3)),
        ]));

        expect(report.sideOutcomes.ally.winRate).toMatchObject({ count: 2, sampleSize: 4, rate: 0.5 });
        expect(report.sideOutcomes.ally.winRate.ci.lower).toBeCloseTo(0.1500, 3);
        expect(report.sideOutcomes.ally.winRate.ci.upper).toBeCloseTo(0.8500, 3);
        expect(report.rounds).toMatchObject({ count: 4, mean: 2.5, median: 2.5, min: 1, max: 4 });
        expect(report.rounds.standardDeviation).toBeCloseTo(1.291, 3);
        expect(report.rounds.ci).toMatchObject({ confidence: 0.95 });
        expect(report.rounds.percentiles).toEqual({ p10: 1.3, p25: 1.75, p50: 2.5, p75: 3.25, p90: 3.7 });
        expect(report.rounds.histogram.map(bin => bin.count)).toEqual([1, 1, 1, 1]);
        expect(report.sufficientSample).toBe(false);
    });

    it('aggregates combatant survival, wounds, resources, damage, and side risk', () => {
        const heroA = combatant('hero', 'ally', true, 8);
        Object.assign(heroA, {
            critsDealt: 2,
            conditionsInflicted: 1,
            fateSpent: 1,
            fortuneSpent: 2,
            advantageGenerated: 3,
            damageDealt: 12,
            damageTaken: 4,
        });
        const heroB = combatant('hero', 'ally', false, 0, true);
        Object.assign(heroB, { fateSpent: 0, damageDealt: 5, damageTaken: 20 });
        const report = aggregateBatchResult(batch([
            outcome('ally', 2, heroA, combatant('foe', 'adversary', false, 0, true)),
            outcome('adversary', 5, heroB, combatant('foe', 'adversary', true, 6)),
        ]));
        const hero = report.combatants.hero;

        expect(hero.survivalRate.rate).toBe(0.5);
        expect(hero.deathRate.rate).toBe(0.5);
        expect(hero.finalWoundsAmongSurvivors).toMatchObject({ count: 1, mean: 8, median: 8 });
        expect(hero.critsDealt).toMatchObject({ total: 2, average: 1 });
        expect(hero.fateSpent).toMatchObject({ total: 1, average: 0.5 });
        expect(hero.fateSpent.ci).toMatchObject({ confidence: 0.95 });
        expect(hero.fateBurnRate.rate).toBe(0.5);
        expect(hero.damageDealt).toMatchObject({ total: 17, average: 8.5 });
        expect(hero.damageTaken).toMatchObject({ total: 24, average: 12 });
        expect(report.sideRisk.ally.partyDefeatedRate.rate).toBe(0.5);
        expect(report.sideRisk.ally.atLeastOneDeathRate.rate).toBe(0.5);
        expect(report.sideRisk.ally.allDeadRate.rate).toBe(0.5);
        expect(report.decisiveness.averageWinningSideSurvivors.average).toBe(1);
        expect(report.decisiveness.roundsByOutcome.ally.mean).toBe(2);
        expect(report.decisiveness.roundsByOutcome.adversary.mean).toBe(5);
    });

    it('handles Wilson extremes and empty samples', () => {
        expect(wilsonInterval(10, 10)).toMatchObject({ upper: 1 });
        expect(wilsonInterval(10, 10).lower).toBeCloseTo(0.7225, 3);
        expect(wilsonInterval(0, 10)).toMatchObject({ lower: 0 });
        expect(wilsonInterval(0, 10).upper).toBeCloseTo(0.2775, 3);
        expect(wilsonInterval(0, 0)).toEqual({ lower: 0, upper: 1, halfWidth: 0.5, confidence: 0.95 });
    });

    it('uses deterministic interpolated percentiles and configurable bins', () => {
        const distribution = numericDistribution([1, 2, 3, 4, 5], 2);
        expect(distribution.percentiles).toEqual({ p10: 1.4, p25: 2, p50: 3, p75: 4, p90: 4.6 });
        expect(distribution.histogram).toEqual([
            { min: 0, maxExclusive: 2, count: 1 },
            { min: 2, maxExclusive: 4, count: 2 },
            { min: 4, maxExclusive: 6, count: 2 },
        ]);
    });

    it('excludes failures from every rate while reporting attempted completions', () => {
        const result = batch([outcome('ally', 2, combatant('hero', 'ally', true, 5), combatant('foe', 'adversary', false, 0, true))]);
        result.failures = [{ index: 1, seed: 'failed', error: 'boom' }];
        result.completedCount = 2;
        const report = aggregateBatchResult(result);

        expect(report).toMatchObject({ completedCount: 2, successfulCount: 1, failureCount: 1 });
        expect(report.sideOutcomes.ally.winRate).toMatchObject({ count: 1, sampleSize: 1, rate: 1 });
    });

    it('flags clearly different proportions and leaves equal reports non-significant', () => {
        const allAlly = aggregateBatchResult(batch(repeatedOutcomes(100, 'ally', true)));
        const allAdversary = aggregateBatchResult(batch(repeatedOutcomes(100, 'adversary', false)));
        const different = compareReports(allAlly, allAdversary);
        const same = compareReports(allAlly, aggregateBatchResult(batch(repeatedOutcomes(100, 'ally', true))));

        expect(different.winRate.ally).toMatchObject({ delta: -1, significant95: true, ciOverlap: false });
        expect(different.lossRate.ally.significant95).toBe(true);
        expect(different.drawRate.ally.significant95).toBe(false);
        expect(different.allDeadRate.ally.significant95).toBe(true);
        expect(different.survivalRate.hero.significant95).toBe(true);
        expect(same.winRate.ally).toMatchObject({ delta: 0, significant95: false, ciOverlap: true });
    });

    it('is deterministic for the same batch result', () => {
        const result = batch(repeatedOutcomes(12, 'ally', true));
        expect(aggregateBatchResult(result)).toEqual(aggregateBatchResult(result));
    });
});

function batch(outcomes: FightOutcome[]): BatchResult {
    return {
        outcomes: outcomes.map((fight, index) => ({ index, seed: index, outcome: fight })),
        failures: [],
        completedCount: outcomes.length,
        masterSeed: 'metrics',
        range: [0, outcomes.length],
        config,
        cancelled: false,
    };
}

function outcome(
    winner: FightOutcome['winner'],
    rounds: number,
    hero: FightCombatantOutcome,
    foe: FightCombatantOutcome
): FightOutcome {
    return {
        seed: `${winner}:${rounds}`,
        winner,
        rounds,
        terminalReason: winner === 'draw' ? 'maxRounds' : 'sideDown',
        combatants: { hero, foe },
        sideResources: {
            ally: { fateSpent: 0, fortuneSpent: 0, advantageGenerated: 0, advantageSpent: 0 },
            adversary: { fateSpent: 0, fortuneSpent: 0, advantageGenerated: 0, advantageSpent: 0 },
        },
    };
}

function combatant(
    id: string,
    side: SideId,
    survived: boolean,
    finalWounds: number,
    died = false
): FightCombatantOutcome {
    return {
        id,
        name: id === 'hero' ? 'Hero' : 'Foe',
        side,
        survived,
        finalWounds,
        died,
        critsDealt: 0,
        critsTaken: 0,
        conditionsInflicted: 0,
        fateSpent: 0,
        fortuneSpent: 0,
        advantageGenerated: 0,
        damageDealt: 0,
        damageTaken: 0,
    };
}

function repeatedOutcomes(count: number, winner: FightOutcome['winner'], heroSurvives: boolean): FightOutcome[] {
    return Array.from({ length: count }, (_, index) => outcome(
        winner,
        2 + index % 3,
        combatant('hero', 'ally', heroSurvives, heroSurvives ? 5 : 0, !heroSurvives),
        combatant('foe', 'adversary', !heroSurvives, heroSurvives ? 0 : 5, heroSurvives)
    ));
}
