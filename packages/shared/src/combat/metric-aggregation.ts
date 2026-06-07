import type { BatchFailure, BatchResult } from './batch-runner';
import type { FightCombatantOutcome, FightOutcome } from './fight-runner';
import type { SideId } from './types';

const SIDES: SideId[] = ['ally', 'adversary'];
const OUTCOMES: FightOutcome['winner'][] = ['ally', 'adversary', 'draw'];
const Z_95 = 1.959963984540054;

export interface ConfidenceInterval {
    lower: number;
    upper: number;
    halfWidth: number;
    confidence: 0.95;
}

export interface RateMetric {
    i18nKey: string;
    count: number;
    sampleSize: number;
    rate: number;
    ci: ConfidenceInterval;
}

export interface AverageMetric {
    i18nKey: string;
    total: number;
    average: number;
    sampleSize: number;
}

export interface DistributionPercentiles {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
}

export interface HistogramBin {
    min: number;
    maxExclusive: number;
    count: number;
}

export interface NumericDistribution {
    i18nKey: string;
    count: number;
    mean: number;
    median: number;
    percentiles: DistributionPercentiles;
    min: number;
    max: number;
    histogram: HistogramBin[];
}

export interface SideOutcomeMetrics {
    i18nKey: string;
    winRate: RateMetric;
    lossRate: RateMetric;
    drawRate: RateMetric;
}

export interface CombatantMetrics {
    i18nKey: string;
    id: string;
    name: string;
    side: SideId;
    survivalRate: RateMetric;
    deathRate: RateMetric;
    finalWoundsAmongSurvivors: NumericDistribution;
    critsDealt: AverageMetric;
    critsTaken: AverageMetric;
    conditionsInflicted: AverageMetric;
    fateSpent: AverageMetric;
    fateBurnRate: RateMetric;
    fortuneSpent: AverageMetric;
    advantageGenerated: AverageMetric;
    damageDealt: AverageMetric;
    damageTaken: AverageMetric;
}

export interface SideRiskMetrics {
    i18nKey: string;
    partyDefeatedRate: RateMetric;
    atLeastOneDeathRate: RateMetric;
    allDeadRate: RateMetric;
}

export interface DecisivenessMetrics {
    i18nKey: string;
    averageWinningSideSurvivors: AverageMetric;
    roundsByOutcome: Record<FightOutcome['winner'], NumericDistribution>;
}

export interface MetricReport {
    i18nKey: string;
    completedCount: number;
    successfulCount: number;
    failureCount: number;
    failures: BatchFailure[];
    sufficientSample: boolean;
    sufficientNHalfWidth: number;
    sideOutcomes: Record<SideId, SideOutcomeMetrics>;
    rounds: NumericDistribution;
    combatants: Record<string, CombatantMetrics>;
    sideRisk: Record<SideId, SideRiskMetrics>;
    decisiveness: DecisivenessMetrics;
}

export interface AggregateMetricOptions {
    sufficientNHalfWidth?: number;
    histogramBinSize?: number;
}

export interface ProportionComparison {
    i18nKey: string;
    a: RateMetric;
    b: RateMetric;
    delta: number;
    zScore: number;
    pValue: number;
    significant95: boolean;
    ciOverlap: boolean;
}

export interface ReportComparison {
    i18nKey: string;
    winRate: Record<SideId, ProportionComparison>;
    partyDefeatedRate: Record<SideId, ProportionComparison>;
    survivalRate: Record<string, ProportionComparison>;
}

export function aggregateBatchResult(
    batch: BatchResult,
    options: AggregateMetricOptions = {}
): MetricReport {
    const outcomes = batch.outcomes.map(entry => entry.outcome);
    const sampleSize = outcomes.length;
    const sufficientNHalfWidth = options.sufficientNHalfWidth ?? 0.05;
    const histogramBinSize = positiveBinSize(options.histogramBinSize);
    const sideOutcomes = Object.fromEntries(SIDES.map(side => {
        const wins = countWhere(outcomes, outcome => outcome.winner === side);
        const losses = countWhere(outcomes, outcome => outcome.winner !== side && outcome.winner !== 'draw');
        const draws = countWhere(outcomes, outcome => outcome.winner === 'draw');
        return [side, {
            i18nKey: 'combat.encounter.metrics.sideOutcome',
            winRate: rateMetric('combat.encounter.metrics.winRate', wins, sampleSize),
            lossRate: rateMetric('combat.encounter.metrics.lossRate', losses, sampleSize),
            drawRate: rateMetric('combat.encounter.metrics.drawRate', draws, sampleSize),
        }];
    })) as Record<SideId, SideOutcomeMetrics>;

    const combatants = aggregateCombatants(batch, outcomes, histogramBinSize);
    const sideRisk = Object.fromEntries(SIDES.map(side => {
        const sideIds = batch.config.sides[side].map(member => member.id);
        const partyDefeated = countWhere(outcomes, outcome => {
            const members = sideMembers(outcome, sideIds);
            return members.length === sideIds.length
                && members.every(member => member.incapacitated ?? (member.died || member.finalWounds <= 0));
        });
        const atLeastOneDeath = countWhere(outcomes, outcome => sideMembers(outcome, sideIds)
            .some(member => member.died));
        const allDead = countWhere(outcomes, outcome => {
            const members = sideMembers(outcome, sideIds);
            return members.length === sideIds.length && members.every(member => member.died);
        });
        return [side, {
            i18nKey: 'combat.encounter.metrics.sideRisk',
            partyDefeatedRate: rateMetric('combat.encounter.metrics.partyDefeatedRate', partyDefeated, sampleSize),
            atLeastOneDeathRate: rateMetric('combat.encounter.metrics.atLeastOneDeathRate', atLeastOneDeath, sampleSize),
            allDeadRate: rateMetric('combat.encounter.metrics.allDeadRate', allDead, sampleSize),
        }];
    })) as Record<SideId, SideRiskMetrics>;

    const outcomeRates = SIDES.flatMap(side => [
        sideOutcomes[side].winRate,
        sideOutcomes[side].lossRate,
        sideOutcomes[side].drawRate,
    ]);
    return {
        i18nKey: 'combat.encounter.metrics.report',
        completedCount: batch.completedCount,
        successfulCount: sampleSize,
        failureCount: batch.failures.length,
        failures: [...batch.failures],
        sufficientSample: sampleSize > 0 && outcomeRates.every(metric => metric.ci.halfWidth <= sufficientNHalfWidth),
        sufficientNHalfWidth,
        sideOutcomes,
        rounds: distributionMetric(
            'combat.encounter.metrics.rounds',
            outcomes.map(outcome => outcome.rounds),
            histogramBinSize
        ),
        combatants,
        sideRisk,
        decisiveness: aggregateDecisiveness(outcomes, histogramBinSize),
    };
}

export function wilsonInterval(successes: number, sampleSize: number): ConfidenceInterval {
    if (sampleSize <= 0) return { lower: 0, upper: 1, halfWidth: 0.5, confidence: 0.95 };
    const proportion = successes / sampleSize;
    const zSquared = Z_95 * Z_95;
    const denominator = 1 + zSquared / sampleSize;
    const center = (proportion + zSquared / (2 * sampleSize)) / denominator;
    const margin = Z_95 * Math.sqrt(
        proportion * (1 - proportion) / sampleSize + zSquared / (4 * sampleSize * sampleSize)
    ) / denominator;
    return {
        lower: successes === 0 ? 0 : clamp01(center - margin),
        upper: successes === sampleSize ? 1 : clamp01(center + margin),
        halfWidth: margin,
        confidence: 0.95,
    };
}

export function numericDistribution(
    values: number[],
    binSize = 1
): Omit<NumericDistribution, 'i18nKey'> {
    const sorted = [...values].sort((a, b) => a - b);
    if (sorted.length === 0) {
        return {
            count: 0,
            mean: 0,
            median: 0,
            percentiles: { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 },
            min: 0,
            max: 0,
            histogram: [],
        };
    }
    const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
    const histogram = makeHistogram(sorted, positiveBinSize(binSize));
    return {
        count: sorted.length,
        mean,
        median: percentile(sorted, 0.5),
        percentiles: {
            p10: percentile(sorted, 0.1),
            p25: percentile(sorted, 0.25),
            p50: percentile(sorted, 0.5),
            p75: percentile(sorted, 0.75),
            p90: percentile(sorted, 0.9),
        },
        min: sorted[0],
        max: sorted[sorted.length - 1],
        histogram,
    };
}

export function compareReports(a: MetricReport, b: MetricReport): ReportComparison {
    const winRate = Object.fromEntries(SIDES.map(side => [
        side,
        compareProportions('combat.encounter.metrics.comparison.winRate', a.sideOutcomes[side].winRate, b.sideOutcomes[side].winRate),
    ])) as Record<SideId, ProportionComparison>;
    const partyDefeatedRate = Object.fromEntries(SIDES.map(side => [
        side,
        compareProportions(
            'combat.encounter.metrics.comparison.partyDefeatedRate',
            a.sideRisk[side].partyDefeatedRate,
            b.sideRisk[side].partyDefeatedRate
        ),
    ])) as Record<SideId, ProportionComparison>;
    const ids = [...new Set([...Object.keys(a.combatants), ...Object.keys(b.combatants)])].sort();
    const survivalRate = Object.fromEntries(ids.flatMap(id => {
        const left = a.combatants[id]?.survivalRate;
        const right = b.combatants[id]?.survivalRate;
        return left && right
            ? [[id, compareProportions('combat.encounter.metrics.comparison.survivalRate', left, right)]]
            : [];
    })) as Record<string, ProportionComparison>;
    return {
        i18nKey: 'combat.encounter.metrics.comparison.report',
        winRate,
        partyDefeatedRate,
        survivalRate,
    };
}

function aggregateCombatants(
    batch: BatchResult,
    outcomes: FightOutcome[],
    histogramBinSize: number
): Record<string, CombatantMetrics> {
    const configs = SIDES.flatMap(side => batch.config.sides[side].map(member => ({ side, member })));
    return Object.fromEntries(configs.map(({ side, member }) => {
        const samples = outcomes
            .map(outcome => outcome.combatants[member.id])
            .filter((sample): sample is FightCombatantOutcome => !!sample);
        const survived = samples.filter(sample => sample.survived);
        return [member.id, {
            i18nKey: 'combat.encounter.metrics.combatant',
            id: member.id,
            name: samples[0]?.name ?? ('name' in member.character ? member.character.name : member.id),
            side,
            survivalRate: rateMetric('combat.encounter.metrics.survivalRate', survived.length, samples.length),
            deathRate: rateMetric('combat.encounter.metrics.deathRate', countWhere(samples, sample => sample.died), samples.length),
            finalWoundsAmongSurvivors: distributionMetric(
                'combat.encounter.metrics.finalWoundsAmongSurvivors',
                survived.map(sample => sample.finalWounds),
                histogramBinSize
            ),
            critsDealt: averageMetric('combat.encounter.metrics.critsDealt', samples.map(sample => sample.critsDealt)),
            critsTaken: averageMetric('combat.encounter.metrics.critsTaken', samples.map(sample => sample.critsTaken)),
            conditionsInflicted: averageMetric('combat.encounter.metrics.conditionsInflicted', samples.map(sample => sample.conditionsInflicted)),
            fateSpent: averageMetric('combat.encounter.metrics.fateSpent', samples.map(sample => sample.fateSpent)),
            fateBurnRate: rateMetric('combat.encounter.metrics.fateBurnRate', countWhere(samples, sample => sample.fateSpent > 0), samples.length),
            fortuneSpent: averageMetric('combat.encounter.metrics.fortuneSpent', samples.map(sample => sample.fortuneSpent)),
            advantageGenerated: averageMetric('combat.encounter.metrics.advantageGenerated', samples.map(sample => sample.advantageGenerated)),
            damageDealt: averageMetric('combat.encounter.metrics.damageDealt', samples.map(sample => sample.damageDealt ?? 0)),
            damageTaken: averageMetric('combat.encounter.metrics.damageTaken', samples.map(sample => sample.damageTaken ?? 0)),
        }];
    }));
}

function aggregateDecisiveness(outcomes: FightOutcome[], histogramBinSize: number): DecisivenessMetrics {
    const decisive = outcomes.filter(outcome => outcome.winner !== 'draw');
    const winningSurvivors = decisive.map(outcome => Object.values(outcome.combatants)
        .filter(combatant => combatant.side === outcome.winner && combatant.survived).length);
    return {
        i18nKey: 'combat.encounter.metrics.decisiveness',
        averageWinningSideSurvivors: averageMetric(
            'combat.encounter.metrics.averageWinningSideSurvivors',
            winningSurvivors
        ),
        roundsByOutcome: Object.fromEntries(OUTCOMES.map(outcome => [
            outcome,
            distributionMetric(
                'combat.encounter.metrics.roundsByOutcome',
                outcomes.filter(fight => fight.winner === outcome).map(fight => fight.rounds),
                histogramBinSize
            ),
        ])) as Record<FightOutcome['winner'], NumericDistribution>,
    };
}

function compareProportions(i18nKey: string, a: RateMetric, b: RateMetric): ProportionComparison {
    const pooledDenominator = a.sampleSize + b.sampleSize;
    const pooled = pooledDenominator > 0 ? (a.count + b.count) / pooledDenominator : 0;
    const standardError = a.sampleSize > 0 && b.sampleSize > 0
        ? Math.sqrt(pooled * (1 - pooled) * (1 / a.sampleSize + 1 / b.sampleSize))
        : 0;
    const delta = b.rate - a.rate;
    const zScore = standardError > 0 ? delta / standardError : 0;
    const pValue = standardError > 0 ? 2 * (1 - normalCdf(Math.abs(zScore))) : 1;
    return {
        i18nKey,
        a,
        b,
        delta,
        zScore,
        pValue,
        significant95: pValue < 0.05,
        ciOverlap: a.ci.lower <= b.ci.upper && b.ci.lower <= a.ci.upper,
    };
}

function rateMetric(i18nKey: string, count: number, sampleSize: number): RateMetric {
    return {
        i18nKey,
        count,
        sampleSize,
        rate: sampleSize > 0 ? count / sampleSize : 0,
        ci: wilsonInterval(count, sampleSize),
    };
}

function averageMetric(i18nKey: string, values: number[]): AverageMetric {
    const total = values.reduce((sum, value) => sum + value, 0);
    return { i18nKey, total, average: values.length > 0 ? total / values.length : 0, sampleSize: values.length };
}

function distributionMetric(i18nKey: string, values: number[], binSize: number): NumericDistribution {
    return { i18nKey, ...numericDistribution(values, binSize) };
}

function sideMembers(outcome: FightOutcome, sideIds: string[]): FightCombatantOutcome[] {
    return sideIds.map(id => outcome.combatants[id]).filter((member): member is FightCombatantOutcome => !!member);
}

function percentile(sorted: number[], probability: number): number {
    const rank = (sorted.length - 1) * probability;
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    if (lower === upper) return sorted[lower];
    const weight = rank - lower;
    return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

function makeHistogram(sorted: number[], binSize: number): HistogramBin[] {
    const start = Math.floor(sorted[0] / binSize) * binSize;
    const end = Math.floor(sorted[sorted.length - 1] / binSize) * binSize;
    const bins: HistogramBin[] = [];
    for (let min = start; min <= end; min += binSize) {
        bins.push({ min, maxExclusive: min + binSize, count: 0 });
    }
    for (const value of sorted) {
        const index = Math.min(bins.length - 1, Math.floor((value - start) / binSize));
        bins[index].count += 1;
    }
    return bins;
}

function positiveBinSize(value?: number): number {
    return Number.isFinite(value) && (value ?? 0) > 0 ? value! : 1;
}

function countWhere<T>(values: T[], predicate: (value: T) => boolean): number {
    return values.reduce((count, value) => count + (predicate(value) ? 1 : 0), 0);
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

function normalCdf(value: number): number {
    return 0.5 * (1 + erf(value / Math.sqrt(2)));
}

function erf(value: number): number {
    const sign = value < 0 ? -1 : 1;
    const x = Math.abs(value);
    const t = 1 / (1 + 0.3275911 * x);
    const polynomial = (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
    return sign * (1 - polynomial * Math.exp(-x * x));
}
