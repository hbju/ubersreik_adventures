import React, { useMemo, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type {
    BatchFailure,
    BatchProgress,
    BatchResult,
    MetricReport,
    RateMetric,
    ReplaySelectionKind,
    SideId,
} from '@wfrp/shared';
import { useTranslation } from 'react-i18next';
import { suggestedIterations, type FightLabRunStatus } from '../../fight-lab/run-state';
import styles from './FightLabResults.module.css';

interface RunControlsProps {
    status: FightLabRunStatus;
    progress?: BatchProgress;
    elapsedMs: number;
    etaMs?: number;
    valid: boolean;
    hasReport: boolean;
    error?: string;
    onRun: () => void;
    onCancel: () => void;
    onViewResults: () => void;
}

export const RunControls: React.FC<RunControlsProps> = ({
    status,
    progress,
    elapsedMs,
    etaMs,
    valid,
    hasReport,
    error,
    onRun,
    onCancel,
    onViewResults,
}) => {
    const { t } = useTranslation();
    const running = status === 'running';
    const completed = progress?.completedCount ?? 0;
    const total = progress?.totalCount ?? 0;
    const percent = total > 0 ? Math.min(100, completed / total * 100) : 0;

    return (
        <div className={styles.runWorkspace}>
            <section className={styles.runHeader}>
                <div>
                    <h2>{t('fightLab.run.title')}</h2>
                    <p>{t('fightLab.run.description')}</p>
                </div>
                <div className={styles.runActions}>
                    {running ? (
                        <button className={styles.cancelButton} onClick={onCancel}>{t('fightLab.run.cancel')}</button>
                    ) : (
                        <button className={styles.runButton} disabled={!valid} onClick={onRun}>
                            {hasReport ? t('fightLab.run.rerun') : t('fightLab.run.start')}
                        </button>
                    )}
                    {hasReport && !running && (
                        <button onClick={onViewResults}>{t('fightLab.run.viewResults')}</button>
                    )}
                </div>
            </section>

            {!valid && <div className={styles.noticeError}>{t('fightLab.run.invalidConfig')}</div>}
            {error && <div className={styles.noticeError}>{error}</div>}

            {running && progress && (
                <section className={styles.progressPanel}>
                    <div className={styles.progressLabels}>
                        <strong>{t('fightLab.run.running')}</strong>
                        <span>{completed.toLocaleString()} / {total.toLocaleString()}</span>
                    </div>
                    <div
                        className={styles.progressTrack}
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={total}
                        aria-valuenow={completed}
                    >
                        <span style={{ width: `${percent}%` }} />
                    </div>
                    <div className={styles.progressStats}>
                        <ProgressStat label={t('fightLab.run.allyWinRate')} value={formatPercent(progress.winRates.ally)} />
                        <ProgressStat label={t('fightLab.run.adversaryWinRate')} value={formatPercent(progress.winRates.adversary)} />
                        <ProgressStat label={t('fightLab.run.drawRate')} value={formatPercent(progress.winRates.draw)} />
                        <ProgressStat label={t('fightLab.run.elapsed')} value={formatDuration(elapsedMs)} />
                        <ProgressStat label={t('fightLab.run.eta')} value={etaMs === undefined ? '--' : formatDuration(etaMs)} />
                        <ProgressStat label={t('fightLab.run.failures')} value={String(progress.failureCount)} />
                    </div>
                </section>
            )}

            {!running && !hasReport && status !== 'error' && (
                <div className={styles.emptyState}>
                    <strong>{t('fightLab.run.emptyTitle')}</strong>
                    <span>{t('fightLab.run.emptyBody')}</span>
                </div>
            )}
        </div>
    );
};

interface DashboardProps {
    report?: MetricReport;
    partial: boolean;
    iterations: number;
    masterSeed?: string | number;
    failures: BatchFailure[];
    batchResult?: BatchResult;
    cached: boolean;
    onRun: () => void;
    onReplayFailure: (failure: BatchFailure) => void;
    onExportFailure: (failure: BatchFailure) => void;
    onExportOutcome: (kind: ReplaySelectionKind) => void;
}

type SortKey = 'name' | 'survival' | 'death' | 'wounds' | 'fateBurn' | 'damage';

export const ResultsDashboard: React.FC<DashboardProps> = ({
    report,
    partial,
    iterations,
    masterSeed,
    failures,
    batchResult,
    cached,
    onRun,
    onReplayFailure,
    onExportFailure,
    onExportOutcome,
}) => {
    const { t } = useTranslation();
    const [sort, setSort] = useState<{ key: SortKey; direction: 1 | -1 }>({ key: 'survival', direction: -1 });
    const combatants = useMemo(() => {
        if (!report) return [];
        return Object.values(report.combatants).sort((a, b) => {
            const values: Record<SortKey, [string | number, string | number]> = {
                name: [a.name, b.name],
                survival: [a.survivalRate.rate, b.survivalRate.rate],
                death: [a.deathRate.rate, b.deathRate.rate],
                wounds: [a.finalWoundsAmongSurvivors.mean, b.finalWoundsAmongSurvivors.mean],
                fateBurn: [a.fateBurnRate.rate, b.fateBurnRate.rate],
                damage: [a.damageDealt.average, b.damageDealt.average],
            };
            const [left, right] = values[sort.key];
            return typeof left === 'string'
                ? left.localeCompare(String(right)) * sort.direction
                : (left - Number(right)) * sort.direction;
        });
    }, [report, sort]);

    if (!report) {
        return (
            <div className={styles.emptyState}>
                <strong>{t('fightLab.dashboard.emptyTitle')}</strong>
                <span>{t('fightLab.dashboard.emptyBody')}</span>
                <button className={styles.runButton} onClick={onRun}>{t('fightLab.run.start')}</button>
            </div>
        );
    }

    const outcomeData = [
        { name: t('fightLab.side.ally'), value: report.sideOutcomes.ally.winRate.rate * 100, fill: '#67a4c4' },
        { name: t('fightLab.side.adversary'), value: report.sideOutcomes.adversary.winRate.rate * 100, fill: '#c66d70' },
        { name: t('combat.encounter.metrics.drawRate'), value: report.sideOutcomes.ally.drawRate.rate * 100, fill: '#a5a9aa' },
    ];
    const roundsData = report.rounds.histogram.map(bin => ({
        round: `${bin.min}-${bin.maxExclusive}`,
        fights: bin.count,
    }));
    const suggestedN = suggestedIterations(report, iterations);

    const toggleSort = (key: SortKey) => {
        setSort(current => current.key === key
            ? { key, direction: current.direction === 1 ? -1 : 1 }
            : { key, direction: key === 'name' ? 1 : -1 });
    };

    return (
        <div className={styles.dashboard}>
            <header className={styles.dashboardHeader}>
                <div>
                    <div className={styles.badges}>
                        {partial && <span className={styles.partialBadge}>{t('fightLab.dashboard.partial')}</span>}
                        {cached && <span className={styles.cachedBadge}>{t('fightLab.dashboard.cached')}</span>}
                    </div>
                    <h2>{t('fightLab.dashboard.title')}</h2>
                    <p>
                        {report.successfulCount.toLocaleString()} {t('fightLab.dashboard.successfulFights')}
                        {masterSeed !== undefined ? ` / ${t('fightLab.masterSeed')}: ${String(masterSeed)}` : ''}
                    </p>
                </div>
                <button className={styles.runButton} onClick={onRun}>{t('fightLab.run.rerun')}</button>
            </header>

            {!report.sufficientSample && (
                <div className={styles.noticeWarning}>
                    <strong>{t('fightLab.dashboard.inconclusive')}</strong>
                    <span>{t('fightLab.dashboard.suggestMore', { count: suggestedN })}</span>
                </div>
            )}

            <section className={styles.outcomeSection}>
                <div className={styles.sectionHeading}>
                    <h3>{t('fightLab.dashboard.outcomes')}</h3>
                    <span>{report.sufficientSample ? t('fightLab.dashboard.sufficient') : t('fightLab.dashboard.insufficient')}</span>
                </div>
                <div className={styles.outcomeGrid}>
                    {(['ally', 'adversary'] as SideId[]).map(side => (
                        <SideOutcomeCard key={side} side={side} report={report} />
                    ))}
                    <div className={styles.chartPanel}>
                        <ResponsiveContainer width="100%" height={190}>
                            <BarChart data={outcomeData} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                                <CartesianGrid stroke="#343b3f" vertical={false} />
                                <XAxis dataKey="name" stroke="#aeb5b8" tick={{ fontSize: 11 }} />
                                <YAxis domain={[0, 100]} stroke="#aeb5b8" tick={{ fontSize: 10 }} />
                                <Tooltip formatter={value => `${Number(value ?? 0).toFixed(1)}%`} />
                                <Bar dataKey="value" isAnimationActive={false} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className={styles.exportActions}>
                    <strong>{t('fightLab.export.representative')}</strong>
                    {(['draw', 'allyWin', 'adversaryWin', 'tpk', 'longest'] as ReplaySelectionKind[]).map(kind => (
                        <button
                            key={kind}
                            disabled={!batchResult}
                            onClick={() => onExportOutcome(kind)}
                        >
                            {t(`fightLab.replay.selection.${kind}`)}
                        </button>
                    ))}
                </div>
            </section>

            <section>
                <div className={styles.sectionHeading}>
                    <h3>{t('fightLab.dashboard.risk')}</h3>
                </div>
                <div className={styles.riskGrid}>
                    {(['ally', 'adversary'] as SideId[]).map(side => (
                        <div className={styles.metricPanel} key={side}>
                            <h4>{t(`fightLab.side.${side}`)}</h4>
                            <RateLine label={t('combat.encounter.metrics.partyDefeatedRate')} metric={report.sideRisk[side].partyDefeatedRate} />
                            <RateLine label={t('combat.encounter.metrics.atLeastOneDeathRate')} metric={report.sideRisk[side].atLeastOneDeathRate} />
                            <RateLine label={t('combat.encounter.metrics.allDeadRate')} metric={report.sideRisk[side].allDeadRate} />
                        </div>
                    ))}
                </div>
            </section>

            <section className={styles.roundsSection}>
                <div className={styles.sectionHeading}>
                    <h3>{t('combat.encounter.metrics.rounds')}</h3>
                </div>
                <div className={styles.roundsGrid}>
                    <div className={styles.chartPanel}>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={roundsData} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
                                <CartesianGrid stroke="#343b3f" vertical={false} />
                                <XAxis dataKey="round" stroke="#aeb5b8" tick={{ fontSize: 10 }} />
                                <YAxis allowDecimals={false} stroke="#aeb5b8" tick={{ fontSize: 10 }} />
                                <Tooltip />
                                <Bar dataKey="fights" fill="#d0a343" isAnimationActive={false} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className={styles.distributionStats}>
                        <NumberStat label={t('fightLab.dashboard.mean')} value={formatNumber(report.rounds.mean)} />
                        <NumberStat label={t('fightLab.dashboard.median')} value={formatNumber(report.rounds.median)} />
                        <NumberStat label="P10" value={formatNumber(report.rounds.percentiles.p10)} />
                        <NumberStat label="P25" value={formatNumber(report.rounds.percentiles.p25)} />
                        <NumberStat label="P75" value={formatNumber(report.rounds.percentiles.p75)} />
                        <NumberStat label="P90" value={formatNumber(report.rounds.percentiles.p90)} />
                        <NumberStat label={t('fightLab.dashboard.range')} value={`${report.rounds.min}-${report.rounds.max}`} />
                    </div>
                </div>
            </section>

            <section>
                <div className={styles.sectionHeading}>
                    <h3>{t('fightLab.dashboard.combatants')}</h3>
                </div>
                <div className={styles.tableWrap}>
                    <table className={styles.combatantTable}>
                        <thead>
                            <tr>
                                <SortableHeader label={t('fightLab.dashboard.name')} sortKey="name" onSort={toggleSort} />
                                <SortableHeader label={t('combat.encounter.metrics.survivalRate')} sortKey="survival" onSort={toggleSort} />
                                <SortableHeader label={t('combat.encounter.metrics.deathRate')} sortKey="death" onSort={toggleSort} />
                                <SortableHeader label={t('fightLab.dashboard.survivorWounds')} sortKey="wounds" onSort={toggleSort} />
                                <th>{t('fightLab.dashboard.crits')}</th>
                                <th>{t('combat.encounter.metrics.conditionsInflicted')}</th>
                                <SortableHeader label={t('combat.encounter.metrics.fateSpent')} sortKey="fateBurn" onSort={toggleSort} />
                                <th>{t('combat.encounter.metrics.fortuneSpent')}</th>
                                <th>{t('combat.encounter.metrics.advantageGenerated')}</th>
                                <SortableHeader label={t('combat.encounter.metrics.damageDealt')} sortKey="damage" onSort={toggleSort} />
                            </tr>
                        </thead>
                        <tbody>
                            {combatants.map(combatant => (
                                <tr key={combatant.id}>
                                    <td><strong>{combatant.name}</strong><small>{t(`fightLab.side.${combatant.side}`)}</small></td>
                                    <td><MiniRate metric={combatant.survivalRate} /></td>
                                    <td>{formatPercent(combatant.deathRate.rate)}</td>
                                    <td>
                                        {formatNumber(combatant.finalWoundsAmongSurvivors.mean)}
                                        <small>
                                            {t('fightLab.dashboard.median')} {formatNumber(combatant.finalWoundsAmongSurvivors.median)}
                                            {' / '}P25/P75 {formatNumber(combatant.finalWoundsAmongSurvivors.percentiles.p25)}/{formatNumber(combatant.finalWoundsAmongSurvivors.percentiles.p75)}
                                        </small>
                                    </td>
                                    <td>{formatNumber(combatant.critsDealt.average)} / {formatNumber(combatant.critsTaken.average)}</td>
                                    <td>{formatNumber(combatant.conditionsInflicted.average)}</td>
                                    <td>
                                        {formatNumber(combatant.fateSpent.average)}
                                        <MiniRate metric={combatant.fateBurnRate} compact />
                                    </td>
                                    <td>{formatNumber(combatant.fortuneSpent.average)}</td>
                                    <td>{formatNumber(combatant.advantageGenerated.average)}</td>
                                    <td>{formatNumber(combatant.damageDealt.average)} / {formatNumber(combatant.damageTaken.average)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section>
                <div className={styles.sectionHeading}>
                    <h3>{t('combat.encounter.metrics.decisiveness')}</h3>
                </div>
                <div className={styles.decisivenessGrid}>
                    <NumberStat
                        label={t('combat.encounter.metrics.averageWinningSideSurvivors')}
                        value={formatNumber(report.decisiveness.averageWinningSideSurvivors.average)}
                    />
                    <NumberStat label={t('fightLab.dashboard.allyWinRounds')} value={formatNumber(report.decisiveness.roundsByOutcome.ally.mean)} />
                    <NumberStat label={t('fightLab.dashboard.adversaryWinRounds')} value={formatNumber(report.decisiveness.roundsByOutcome.adversary.mean)} />
                    <NumberStat label={t('fightLab.dashboard.drawRounds')} value={formatNumber(report.decisiveness.roundsByOutcome.draw.mean)} />
                </div>
            </section>

            <section>
                <div className={styles.sectionHeading}>
                    <h3>{t('fightLab.dashboard.failures')}</h3>
                    <span>{failures.length}</span>
                </div>
                {failures.length === 0 ? (
                    <p className={styles.muted}>{t('fightLab.dashboard.noFailures')}</p>
                ) : (
                    <div className={styles.failureList}>
                        {failures.map(failure => (
                            <div
                                key={`${failure.index}-${String(failure.seed)}`}
                                className={styles.failureRow}
                            >
                                <button
                                    className={styles.failureReplay}
                                    onClick={() => onReplayFailure(failure)}
                                >
                                    <span>#{failure.index}</span>
                                    <code>{String(failure.seed)}</code>
                                    <span>{failure.error}</span>
                                    <strong>{t('fightLab.dashboard.replay')}</strong>
                                </button>
                                <button onClick={() => onExportFailure(failure)}>
                                    {t('fightLab.export.action')}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

const SideOutcomeCard: React.FC<{ side: SideId; report: MetricReport }> = ({ side, report }) => {
    const { t } = useTranslation();
    const metrics = report.sideOutcomes[side];
    return (
        <div className={styles.metricPanel}>
            <h4>{t(`fightLab.side.${side}`)}</h4>
            <RateLine label={t('combat.encounter.metrics.winRate')} metric={metrics.winRate} prominent />
            <RateLine label={t('combat.encounter.metrics.lossRate')} metric={metrics.lossRate} />
            <RateLine label={t('combat.encounter.metrics.drawRate')} metric={metrics.drawRate} />
        </div>
    );
};

const RateLine: React.FC<{ label: string; metric: RateMetric; prominent?: boolean }> = ({ label, metric, prominent }) => (
    <div className={prominent ? styles.rateProminent : styles.rateLine}>
        <span>{label}</span>
        <strong>{formatPercent(metric.rate)}</strong>
        <small>{formatCI(metric)}</small>
    </div>
);

const MiniRate: React.FC<{ metric: RateMetric; compact?: boolean }> = ({ metric, compact }) => (
    <div className={compact ? styles.miniRateCompact : styles.miniRate}>
        <span><i style={{ width: `${Math.max(0, Math.min(100, metric.rate * 100))}%` }} /></span>
        <strong>{formatPercent(metric.rate)}</strong>
    </div>
);

const SortableHeader: React.FC<{ label: string; sortKey: SortKey; onSort: (key: SortKey) => void }> = ({
    label,
    sortKey,
    onSort,
}) => <th><button className={styles.sortButton} onClick={() => onSort(sortKey)}>{label}</button></th>;

const ProgressStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div><span>{label}</span><strong>{value}</strong></div>
);

const NumberStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className={styles.numberStat}><span>{label}</span><strong>{value}</strong></div>
);

function formatCI(metric: RateMetric): string {
    return `95% CI ${formatPercent(metric.ci.lower)}-${formatPercent(metric.ci.upper)}`;
}

function formatPercent(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDuration(milliseconds: number): string {
    const seconds = Math.max(0, Math.round(milliseconds / 1000));
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}
