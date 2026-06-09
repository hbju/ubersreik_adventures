import React, { useMemo, useState } from 'react';
import type {
    ConfidenceInterval,
    ProportionComparison,
    SideId,
} from '@wfrp/shared';
import { useTranslation } from 'react-i18next';
import {
    compareAverages,
    compareDistributionMeans,
    compareFightLabScenarios,
    type ContinuousComparison,
} from '../../fight-lab/comparison';
import type { FightLabScenario } from '../../fight-lab/types';
import styles from './FightLabComparison.module.css';

interface FightLabComparisonProps {
    scenarios: FightLabScenario[];
    currentScenarioId?: string;
    onRerun: (scenario: FightLabScenario) => void;
}

export const FightLabComparison: React.FC<FightLabComparisonProps> = ({
    scenarios,
    currentScenarioId,
    onRerun,
}) => {
    const { t } = useTranslation();
    const reportScenarios = scenarios.filter(scenario => !!scenario.cachedReport);
    const defaultA = reportScenarios.find(scenario => scenario.id === currentScenarioId)?.id
        ?? reportScenarios[0]?.id
        ?? '';
    const defaultB = reportScenarios.find(scenario => scenario.id !== defaultA)?.id
        ?? reportScenarios[0]?.id
        ?? '';
    const [scenarioAId, setScenarioAId] = useState(defaultA);
    const [scenarioBId, setScenarioBId] = useState(defaultB);
    const scenarioA = reportScenarios.find(scenario => scenario.id === scenarioAId);
    const scenarioB = reportScenarios.find(scenario => scenario.id === scenarioBId);
    const comparison = useMemo(
        () => scenarioA && scenarioB ? compareFightLabScenarios(scenarioA, scenarioB) : undefined,
        [scenarioA, scenarioB]
    );

    if (reportScenarios.length < 2) {
        return (
            <div className={styles.empty}>
                <strong>{t('fightLab.compare.emptyTitle')}</strong>
                <span>{t('fightLab.compare.emptyBody')}</span>
            </div>
        );
    }

    return (
        <div className={styles.comparison} aria-label={t('fightLab.compare.title')}>
            <header className={styles.header}>
                <div>
                    <h2>{t('fightLab.compare.title')}</h2>
                    <p>{t('fightLab.compare.description')}</p>
                </div>
            </header>

            <section className={styles.selectors}>
                <ScenarioSelector
                    label={t('fightLab.compare.scenarioA')}
                    scenarios={reportScenarios}
                    value={scenarioAId}
                    onChange={setScenarioAId}
                />
                <span className={styles.versus}>A/B</span>
                <ScenarioSelector
                    label={t('fightLab.compare.scenarioB')}
                    scenarios={reportScenarios}
                    value={scenarioBId}
                    onChange={setScenarioBId}
                />
            </section>

            {scenarioAId === scenarioBId && (
                <div className={styles.notice}>{t('fightLab.compare.sameScenario')}</div>
            )}

            {comparison && (
                <>
                    {(comparison.staleA || comparison.staleB) && (
                        <section className={styles.staleWarning}>
                            <strong>{t('fightLab.compare.staleTitle')}</strong>
                            <span>{t('fightLab.compare.staleBody')}</span>
                            <div>
                                {comparison.staleA && (
                                    <button onClick={() => onRerun(comparison.scenarioA)}>
                                        {t('fightLab.compare.rerunScenario', { name: comparison.scenarioA.name })}
                                    </button>
                                )}
                                {comparison.staleB && (
                                    <button onClick={() => onRerun(comparison.scenarioB)}>
                                        {t('fightLab.compare.rerunScenario', { name: comparison.scenarioB.name })}
                                    </button>
                                )}
                            </div>
                        </section>
                    )}

                    {comparison.lowN && (
                        <div className={styles.lowN}>
                            <strong>{t('fightLab.compare.lowNTitle')}</strong>
                            <span>{t('fightLab.compare.lowNBody')}</span>
                        </div>
                    )}

                    <ComparisonLegend />

                    {(['ally', 'adversary'] as SideId[]).map(side => (
                        <section key={side}>
                            <h3>{t('fightLab.compare.outcomesFor', { side: t(`fightLab.side.${side}`) })}</h3>
                            <ComparisonTable>
                                <ProportionRow label={t('combat.encounter.metrics.winRate')} metric={comparison.reportComparison.winRate[side]} />
                                <ProportionRow label={t('combat.encounter.metrics.lossRate')} metric={comparison.reportComparison.lossRate[side]} />
                                <ProportionRow label={t('combat.encounter.metrics.drawRate')} metric={comparison.reportComparison.drawRate[side]} />
                                <ProportionRow label={t('combat.encounter.metrics.partyDefeatedRate')} metric={comparison.reportComparison.partyDefeatedRate[side]} />
                                <ProportionRow label={t('combat.encounter.metrics.allDeadRate')} metric={comparison.reportComparison.allDeadRate[side]} />
                            </ComparisonTable>
                        </section>
                    ))}

                    <section>
                        <h3>{t('fightLab.compare.continuous')}</h3>
                        <ComparisonTable>
                            <ContinuousRow
                                label={t('combat.encounter.metrics.rounds')}
                                metric={compareDistributionMeans(
                                    comparison.scenarioA.cachedReport!.report.rounds,
                                    comparison.scenarioB.cachedReport!.report.rounds
                                )}
                            />
                            <ContinuousRow
                                label={t('combat.encounter.metrics.averageWinningSideSurvivors')}
                                metric={compareAverages(
                                    comparison.scenarioA.cachedReport!.report.decisiveness.averageWinningSideSurvivors,
                                    comparison.scenarioB.cachedReport!.report.decisiveness.averageWinningSideSurvivors
                                )}
                            />
                        </ComparisonTable>
                        <p className={styles.methodNote}>{t('fightLab.compare.continuousMethod')}</p>
                    </section>

                    <section>
                        <h3>{t('fightLab.compare.combatants')}</h3>
                        {!comparison.rostersMatch ? (
                            <div className={styles.rosterWarning}>{t('fightLab.compare.rostersDiffer')}</div>
                        ) : (
                            <div className={styles.combatantComparisons}>
                                {comparison.alignedCombatantIds.map(combatantId => {
                                    const left = comparison.scenarioA.cachedReport!.report.combatants[combatantId];
                                    const right = comparison.scenarioB.cachedReport!.report.combatants[combatantId];
                                    if (!left || !right) return null;
                                    return (
                                        <article key={combatantId}>
                                            <header>
                                                <strong>{left.name}</strong>
                                                <span>{t(`fightLab.side.${left.side}`)}</span>
                                            </header>
                                            <ComparisonTable>
                                                <ProportionRow
                                                    label={t('combat.encounter.metrics.survivalRate')}
                                                    metric={comparison.reportComparison.survivalRate[combatantId]}
                                                />
                                                <ContinuousRow
                                                    label={t('fightLab.dashboard.survivorWounds')}
                                                    metric={compareDistributionMeans(
                                                        left.finalWoundsAmongSurvivors,
                                                        right.finalWoundsAmongSurvivors
                                                    )}
                                                />
                                                <ContinuousRow
                                                    label={t('combat.encounter.metrics.fateSpent')}
                                                    metric={compareAverages(left.fateSpent, right.fateSpent)}
                                                />
                                            </ComparisonTable>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
};

const ScenarioSelector: React.FC<{
    label: string;
    scenarios: FightLabScenario[];
    value: string;
    onChange: (value: string) => void;
}> = ({ label, scenarios, value, onChange }) => (
    <label>
        <span>{label}</span>
        <select value={value} onChange={event => onChange(event.target.value)}>
            {scenarios.map(scenario => (
                <option key={scenario.id} value={scenario.id}>{scenario.name}</option>
            ))}
        </select>
    </label>
);

const ComparisonLegend: React.FC = () => {
    const { t } = useTranslation();
    return (
        <div className={styles.legend}>
            <span className={styles.significant}>{t('fightLab.compare.significant')}</span>
            <span className={styles.notSignificant}>{t('fightLab.compare.notSignificant')}</span>
            <span className={styles.hint}>{t('fightLab.compare.ciHint')}</span>
        </div>
    );
};

const ComparisonTable: React.FC<React.PropsWithChildren> = ({ children }) => {
    const { t } = useTranslation();
    return (
        <div className={styles.table} role="table">
            <div className={styles.tableHeader} role="row">
                <span>{t('fightLab.compare.metric')}</span>
                <span>A</span>
                <span>B</span>
                <span>{t('fightLab.compare.delta')}</span>
                <span>{t('fightLab.compare.signal')}</span>
            </div>
            {children}
        </div>
    );
};

const ProportionRow: React.FC<{ label: string; metric: ProportionComparison }> = ({ label, metric }) => {
    const { t } = useTranslation();
    return (
        <div
            className={`${styles.tableRow} ${metric.significant95 ? styles.significantRow : styles.mutedRow}`}
            role="row"
            data-signal={metric.significant95 ? 'significant' : 'noise'}
        >
            <strong>{label}</strong>
            <MetricValue value={metric.a.rate} ci={metric.a.ci} percent />
            <MetricValue value={metric.b.rate} ci={metric.b.ci} percent />
            <span className={deltaClass(metric.delta)}>{formatDelta(metric.delta, true)}</span>
            <span className={metric.significant95 ? styles.significant : styles.notSignificant}>
                {metric.significant95
                    ? t('fightLab.compare.significant')
                    : t('fightLab.compare.notSignificant')}
            </span>
        </div>
    );
};

const ContinuousRow: React.FC<{ label: string; metric: ContinuousComparison }> = ({ label, metric }) => {
    const { t } = useTranslation();
    return (
        <div
            className={`${styles.tableRow} ${metric.ciOverlap ? styles.mutedRow : styles.hintRow}`}
            role="row"
            data-signal={metric.ciOverlap ? 'overlap' : 'separate'}
        >
            <strong>{label}</strong>
            <MetricValue value={metric.a} ci={metric.aCi} />
            <MetricValue value={metric.b} ci={metric.bCi} />
            <span className={deltaClass(metric.delta)}>{formatDelta(metric.delta)}</span>
            <span className={metric.ciOverlap ? styles.notSignificant : styles.hint}>
                {metric.ciOverlap ? t('fightLab.compare.ciOverlap') : t('fightLab.compare.ciSeparate')}
            </span>
        </div>
    );
};

const MetricValue: React.FC<{
    value: number;
    ci: ConfidenceInterval;
    percent?: boolean;
}> = ({ value, ci, percent }) => (
    <span className={styles.metricValue}>
        <strong>{percent ? formatPercent(value) : formatNumber(value)}</strong>
        <small>{formatInterval(ci, percent)}</small>
    </span>
);

function formatPercent(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatInterval(ci: ConfidenceInterval, percent = false): string {
    return `95% CI ${percent ? formatPercent(ci.lower) : formatNumber(ci.lower)}-${percent ? formatPercent(ci.upper) : formatNumber(ci.upper)}`;
}

function formatDelta(delta: number, percent = false): string {
    const value = percent ? delta * 100 : delta;
    return `${value > 0 ? '+' : ''}${value.toFixed(percent ? 1 : 2)}${percent ? ' pp' : ''}`;
}

function deltaClass(delta: number): string {
    return delta > 0 ? styles.positive : delta < 0 ? styles.negative : styles.neutral;
}

export default FightLabComparison;
