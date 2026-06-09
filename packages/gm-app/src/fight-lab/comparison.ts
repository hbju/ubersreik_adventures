import {
    compareReports,
    type AverageMetric,
    type ConfidenceInterval,
    type NumericDistribution,
    type ReportComparison,
} from '@wfrp/shared';
import { isCachedReportStale } from './model';
import type { FightLabScenario } from './types';

export interface ContinuousComparison {
    a: number;
    b: number;
    delta: number;
    aCi: ConfidenceInterval;
    bCi: ConfidenceInterval;
    ciOverlap: boolean;
}

export interface FightLabComparison {
    scenarioA: FightLabScenario;
    scenarioB: FightLabScenario;
    reportComparison: ReportComparison;
    staleA: boolean;
    staleB: boolean;
    lowN: boolean;
    rostersMatch: boolean;
    alignedCombatantIds: string[];
}

export function compareFightLabScenarios(
    scenarioA: FightLabScenario,
    scenarioB: FightLabScenario
): FightLabComparison | undefined {
    if (!scenarioA.cachedReport || !scenarioB.cachedReport) return undefined;
    const rosterA = rosterIdentities(scenarioA);
    const rosterB = rosterIdentities(scenarioB);
    const rostersMatch = rosterA.length === rosterB.length
        && rosterA.every((identity, index) => identity === rosterB[index]);
    return {
        scenarioA,
        scenarioB,
        reportComparison: compareReports(scenarioA.cachedReport.report, scenarioB.cachedReport.report),
        staleA: isCachedReportStale(scenarioA),
        staleB: isCachedReportStale(scenarioB),
        lowN: !scenarioA.cachedReport.report.sufficientSample || !scenarioB.cachedReport.report.sufficientSample,
        rostersMatch,
        alignedCombatantIds: rostersMatch
            ? rosterA.map(identity => identity.slice(identity.indexOf(':') + 1))
            : [],
    };
}

export function compareDistributionMeans(
    a: NumericDistribution,
    b: NumericDistribution
): ContinuousComparison {
    return continuousComparison(a.mean, b.mean, meanCi(a), meanCi(b));
}

export function compareAverages(
    a: AverageMetric,
    b: AverageMetric
): ContinuousComparison {
    return continuousComparison(a.average, b.average, meanCi(a), meanCi(b));
}

function continuousComparison(
    a: number,
    b: number,
    aCi: ConfidenceInterval,
    bCi: ConfidenceInterval
): ContinuousComparison {
    return {
        a,
        b,
        delta: b - a,
        aCi,
        bCi,
        ciOverlap: aCi.lower <= bCi.upper && bCi.lower <= aCi.upper,
    };
}

function meanCi(metric: NumericDistribution | AverageMetric): ConfidenceInterval {
    return metric.ci ?? {
        lower: 'mean' in metric ? metric.mean : metric.average,
        upper: 'mean' in metric ? metric.mean : metric.average,
        halfWidth: 0,
        confidence: 0.95,
    };
}

function rosterIdentities(scenario: FightLabScenario): string[] {
    return (['ally', 'adversary'] as const)
        .flatMap(side => scenario.config.sides[side].map(member => `${side}:${member.id}`))
        .sort();
}
