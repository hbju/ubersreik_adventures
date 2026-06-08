import React, { useEffect, useMemo, useState } from 'react';
import {
    deriveFightSeed,
    replayFight,
    selectReplayOutcome,
    type BatchResult,
    type CombatEvent,
    type EncounterConfig,
    type FightReplay,
    type FightReplayFrame,
    type FightSeed,
    type ReplaySelectionKind,
} from '@wfrp/shared';
import { useTranslation } from 'react-i18next';
import type { ReplayHandoff } from '../../fight-lab/run-state';
import styles from './FightReplayViewer.module.css';

interface FightReplayViewerProps {
    config: EncounterConfig;
    batchResult?: BatchResult;
    handoff?: ReplayHandoff | null;
}

const SELECTIONS: ReplaySelectionKind[] = ['draw', 'allyWin', 'adversaryWin', 'tpk', 'longest'];

export const FightReplayViewer: React.FC<FightReplayViewerProps> = ({
    config,
    batchResult,
    handoff,
}) => {
    const { t } = useTranslation();
    const [replay, setReplay] = useState<FightReplay>();
    const [frameIndex, setFrameIndex] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [error, setError] = useState<string>();
    const [seedInput, setSeedInput] = useState('');

    const loadReplay = (seed: FightSeed) => {
        setPlaying(false);
        setError(undefined);
        try {
            const next = replayFight(config, seed);
            setReplay(next);
            setFrameIndex(0);
            setSeedInput(String(seed));
        } catch (cause) {
            setReplay(undefined);
            setError(cause instanceof Error ? cause.message : String(cause));
        }
    };

    useEffect(() => {
        if (handoff) loadReplay(handoff.seed);
    }, [handoff?.index, handoff?.seed]);

    useEffect(() => {
        if (!playing || !replay) return;
        const timer = setInterval(() => {
            setFrameIndex(current => {
                if (current >= replay.frames.length - 1) {
                    setPlaying(false);
                    return current;
                }
                return current + 1;
            });
        }, Math.max(120, 900 / speed));
        return () => clearInterval(timer);
    }, [playing, replay, speed]);

    const frame = replay?.frames[frameIndex];
    const roundFrames = useMemo(() => replay ? distinctRounds(replay.frames) : [], [replay]);
    const pickRepresentative = (kind: ReplaySelectionKind) => {
        if (!batchResult) return;
        const selected = selectReplayOutcome(batchResult, kind);
        if (!selected) {
            setError(t('fightLab.replay.selectionUnavailable'));
            return;
        }
        loadReplay(deriveFightSeed(batchResult.masterSeed, selected.index));
    };

    return (
        <div className={styles.viewer}>
            <header className={styles.header}>
                <div>
                    <h2>{t('fightLab.replay.title')}</h2>
                    <p>{replay
                        ? t('fightLab.replay.summary', {
                            seed: String(replay.seed),
                            winner: t(`fightLab.replay.outcome.${replay.outcome.winner}`),
                            rounds: replay.outcome.rounds,
                        })
                        : t('fightLab.replay.description')}
                    </p>
                </div>
                <div className={styles.seedLoader}>
                    <input
                        value={seedInput}
                        onChange={event => setSeedInput(event.target.value)}
                        placeholder={t('fightLab.replay.seedPlaceholder')}
                        aria-label={t('fightLab.replay.seed')}
                    />
                    <button onClick={() => loadReplay(seedInput)} disabled={!seedInput.trim()}>
                        {t('fightLab.replay.load')}
                    </button>
                </div>
            </header>

            <section className={styles.entryPanel}>
                <span>{t('fightLab.replay.representative')}</span>
                <div>
                    {SELECTIONS.map(kind => (
                        <button
                            key={kind}
                            disabled={!batchResult}
                            onClick={() => pickRepresentative(kind)}
                        >
                            {t(`fightLab.replay.selection.${kind}`)}
                        </button>
                    ))}
                </div>
                {!batchResult && <small>{t('fightLab.replay.sessionRequired')}</small>}
            </section>

            {error && <div className={styles.error}>{t('fightLab.replay.error', { error })}</div>}
            {!replay || !frame ? (
                <div className={styles.empty}>
                    <strong>{t('fightLab.replay.emptyTitle')}</strong>
                    <span>{t('fightLab.replay.emptyBody')}</span>
                </div>
            ) : (
                <>
                    <ReplayControls
                        replay={replay}
                        frameIndex={frameIndex}
                        playing={playing}
                        speed={speed}
                        roundFrames={roundFrames}
                        onFrame={setFrameIndex}
                        onPlaying={setPlaying}
                        onSpeed={setSpeed}
                    />
                    <ReplayBattlefield frame={frame} />
                    <div className={styles.detailGrid}>
                        <ReplayCombatantPanels frame={frame} />
                        <ReplayNarration frame={frame} />
                        <ReplayDecisionPanel frame={frame} />
                    </div>
                </>
            )}
        </div>
    );
};

interface ReplayControlsProps {
    replay: FightReplay;
    frameIndex: number;
    playing: boolean;
    speed: number;
    roundFrames: Array<{ round: number; first: number }>;
    onFrame: (index: number) => void;
    onPlaying: (playing: boolean) => void;
    onSpeed: (speed: number) => void;
}

const ReplayControls: React.FC<ReplayControlsProps> = ({
    replay,
    frameIndex,
    playing,
    speed,
    roundFrames,
    onFrame,
    onPlaying,
    onSpeed,
}) => {
    const { t } = useTranslation();
    const frame = replay.frames[frameIndex];
    const previousRound = [...roundFrames].reverse().find(item => item.round < frame.round);
    const nextRound = roundFrames.find(item => item.round > frame.round);
    return (
        <section className={styles.controls}>
            <div className={styles.transport}>
                <button title={t('fightLab.replay.previousRound')} onClick={() => onFrame(previousRound?.first ?? 0)}>&lt;&lt;</button>
                <button title={t('fightLab.replay.previousStep')} onClick={() => onFrame(Math.max(0, frameIndex - 1))}>&lt;</button>
                <button title={playing ? t('fightLab.replay.pause') : t('fightLab.replay.play')} onClick={() => onPlaying(!playing)}>
                    {playing ? '||' : '>'}
                </button>
                <button title={t('fightLab.replay.nextStep')} onClick={() => onFrame(Math.min(replay.frames.length - 1, frameIndex + 1))}>&gt;</button>
                <button title={t('fightLab.replay.nextRound')} onClick={() => onFrame(nextRound?.first ?? replay.frames.length - 1)}>&gt;&gt;</button>
            </div>
            <strong>{t('fightLab.replay.frame', {
                current: frameIndex + 1,
                total: replay.frames.length,
                round: frame.round,
            })}</strong>
            <label>
                {t('fightLab.replay.speed')}
                <select value={speed} onChange={event => onSpeed(Number(event.target.value))}>
                    {[0.5, 1, 2, 4].map(value => <option key={value} value={value}>{value}x</option>)}
                </select>
            </label>
            <div className={styles.scrubber}>
                <input
                    type="range"
                    min={0}
                    max={replay.frames.length - 1}
                    value={frameIndex}
                    onChange={event => onFrame(Number(event.target.value))}
                    aria-label={t('fightLab.replay.scrubber')}
                />
                <div className={styles.markers}>
                    {replay.frames.map(candidate => {
                        const marker = candidate.markers.death
                            ? 'death'
                            : candidate.markers.critical
                                ? 'critical'
                                : candidate.markers.fateSpent ? 'fate' : undefined;
                        return marker ? (
                            <button
                                key={candidate.index}
                                className={styles[marker]}
                                style={{ left: `${candidate.index / Math.max(1, replay.frames.length - 1) * 100}%` }}
                                title={t(`fightLab.replay.marker.${marker}`, { round: candidate.round })}
                                onClick={() => onFrame(candidate.index)}
                            />
                        ) : null;
                    })}
                </div>
            </div>
            <div className={styles.markerLegend}>
                <span className={styles.death}>{t('fightLab.replay.marker.deathLabel')}</span>
                <span className={styles.critical}>{t('fightLab.replay.marker.criticalLabel')}</span>
                <span className={styles.fate}>{t('fightLab.replay.marker.fateLabel')}</span>
            </div>
        </section>
    );
};

export const ReplayBattlefield: React.FC<{ frame: FightReplayFrame }> = ({ frame }) => {
    const { t } = useTranslation();
    const combatants = Object.values(frame.state.combatants);
    const positions = combatants.map(combatant => combatant.position);
    const min = Math.min(...positions, 0) - 2;
    const max = Math.max(...positions, 10) + 2;
    const span = Math.max(1, max - min);
    const x = (position: number) => (position - min) / span * 100;
    const active = frame.activeCombatantId ? frame.state.combatants[frame.activeCombatantId] : undefined;
    const bySide = {
        ally: combatants.filter(combatant => combatant.side === 'ally'),
        adversary: combatants.filter(combatant => combatant.side === 'adversary'),
    };
    const trackHeight = Math.max(245, Math.max(bySide.ally.length, bySide.adversary.length) * 130);
    const tokenTop = (combatant: FightReplayFrame['state']['combatants'][string]) => {
        const sideCombatants = bySide[combatant.side];
        const sideIndex = sideCombatants.findIndex(candidate => candidate.id === combatant.id);
        const fraction = (sideIndex + 0.5) / Math.max(1, sideCombatants.length);
        return combatant.side === 'ally' ? fraction * 42 : 58 + fraction * 40;
    };

    return (
        <section className={styles.battlefield} aria-label={t('fightLab.replay.battlefield')}>
            <header>
                <strong>{t('fightLab.replay.battlefield')}</strong>
                <span>{t('fightLab.replay.advantage', {
                    ally: frame.state.advantagePools.ally,
                    adversary: frame.state.advantagePools.adversary,
                })}</span>
            </header>
            <div className={styles.track} style={{ height: trackHeight }}>
                <div className={styles.trackLine} />
                {active?.rangeBands && (
                    <div className={styles.rangeBands} style={{ left: `${x(active.position)}%` }}>
                        {(['extreme', 'long', 'normal', 'short', 'pointBlank'] as const).map(band => (
                            <span
                                key={band}
                                className={styles[band]}
                                style={{ width: `${active.rangeBands![band] / span * 200}%` }}
                                title={`${t(`fightLab.replay.range.${band}`)}: ${active.rangeBands![band]}`}
                            />
                        ))}
                    </div>
                )}
                {frame.state.engagements.map((engagement, index) => {
                    const left = frame.state.combatants[engagement.aId];
                    const right = frame.state.combatants[engagement.bId];
                    if (!left || !right) return null;
                    const start = Math.min(x(left.position), x(right.position));
                    return (
                        <span
                            key={`${engagement.aId}:${engagement.bId}`}
                            className={engagement.grappling ? styles.grappleLink : styles.engagementLink}
                            style={{
                                left: `${start}%`,
                                width: `${Math.max(1, Math.abs(x(left.position) - x(right.position)))}%`,
                                top: `${46 + index % 3 * 4}%`,
                            }}
                        />
                    );
                })}
                {combatants.map(combatant => (
                    <div
                        key={combatant.id}
                        className={`${styles.token} ${styles[combatant.side]} ${styles[combatant.status]}`}
                        style={{
                            left: `${x(combatant.position)}%`,
                            top: `${tokenTop(combatant)}%`,
                        }}
                        title={`${combatant.name}: ${combatant.position}`}
                    >
                        <strong>{initials(combatant.name)}</strong>
                        <span>{combatant.name}</span>
                        <small>{combatant.position}</small>
                    </div>
                ))}
                <span className={styles.axisStart}>{min}</span>
                <span className={styles.axisEnd}>{max} {t('fightLab.replay.yards')}</span>
            </div>
        </section>
    );
};

export const ReplayCombatantPanels: React.FC<{ frame: FightReplayFrame }> = ({ frame }) => {
    const { t } = useTranslation();
    return (
        <section className={styles.combatantSection}>
            <h3>{t('fightLab.replay.combatants')}</h3>
            <div className={styles.combatantPanels}>
                {Object.values(frame.state.combatants).map(combatant => (
                    <article key={combatant.id} className={`${styles.combatantPanel} ${styles[combatant.side]}`}>
                        <header>
                            <strong>{combatant.name}</strong>
                            <span>{t(`fightLab.replay.status.${combatant.status}`)}</span>
                        </header>
                        <div className={styles.wounds}>
                            <span style={{ width: `${Math.max(0, combatant.currentWounds / Math.max(1, combatant.maxWounds) * 100)}%` }} />
                        </div>
                        <div className={styles.panelStats}>
                            <span>{t('sheet.wounds')} <strong>{combatant.currentWounds}/{combatant.maxWounds}</strong></span>
                            <span>{t('sheet.fate')} <strong>{combatant.fate.current}/{combatant.fate.max}</strong></span>
                            <span>{t('sheet.fortune')} <strong>{combatant.fortune.current}/{combatant.fortune.max}</strong></span>
                            <span>{t('fightLab.replay.position')} <strong>{combatant.position}</strong></span>
                        </div>
                        <p>{combatant.currentAction ?? t('fightLab.replay.noCurrentAction')}</p>
                        <div className={styles.conditions}>
                            {combatant.conditions.length > 0
                                ? combatant.conditions.map((condition, index) => <span key={`${condition}-${index}`}>{conditionLabel(condition)}</span>)
                                : <small>{t('fightLab.replay.noConditions')}</small>}
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
};

const ReplayNarration: React.FC<{ frame: FightReplayFrame }> = ({ frame }) => {
    const { t } = useTranslation();
    return (
        <section className={styles.narration}>
            <h3>{t('fightLab.replay.narration')}</h3>
            {frame.events.length === 0 ? <p>{t('fightLab.replay.noEvents')}</p> : (
                <ol>
                    {frame.events.map((event, index) => (
                        <li key={`${event.type}-${index}`}>
                            <strong>{translatedEvent(t, event)}</strong>
                            <small>{event.type}</small>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
};

const ReplayDecisionPanel: React.FC<{ frame: FightReplayFrame }> = ({ frame }) => {
    const { t } = useTranslation();
    return (
        <section className={styles.reasoning}>
            <h3>{t('fightLab.replay.reasoning')}</h3>
            {frame.rationales.length === 0 ? <p>{t('fightLab.replay.noRationale')}</p> : frame.rationales.map((rationale, index) => (
                <article key={`${rationale.actorId}-${index}`}>
                    <header>
                        <strong>{frame.state.combatants[rationale.actorId]?.name ?? rationale.actorId}</strong>
                        <span>{rationale.level}</span>
                    </header>
                    <p>{t(`combat.decision.${rationale.reasonCode}`, { defaultValue: rationale.reasonCode })}</p>
                    <dl>
                        <dt>{t('fightLab.replay.chosen')}</dt>
                        <dd>{rationale.chosen}</dd>
                        <dt>{t('fightLab.replay.rejected')}</dt>
                        <dd>{rationale.rejectedAlternatives.join(', ') || t('fightLab.replay.none')}</dd>
                    </dl>
                </article>
            ))}
        </section>
    );
};

function distinctRounds(frames: FightReplayFrame[]): Array<{ round: number; first: number }> {
    const rounds = new Map<number, number>();
    frames.forEach((frame, index) => {
        if (!rounds.has(frame.round)) rounds.set(frame.round, index);
    });
    return [...rounds].map(([round, first]) => ({ round, first }));
}

function translatedEvent(
    t: ReturnType<typeof useTranslation>['t'],
    event: CombatEvent
): string {
    return t(event.i18nKey, {
        ...event.data,
        defaultValue: t('fightLab.replay.eventFallback', { type: event.type }),
    });
}

function conditionLabel(condition: string): string {
    return condition.replace(/^condition_/, '').replace(/_/g, ' ');
}

function initials(name: string): string {
    return name.split(/\s+/).slice(0, 2).map(part => part[0] ?? '').join('').toUpperCase();
}

export default FightReplayViewer;
