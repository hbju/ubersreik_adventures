import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CombatDecision, DecisionRequest, FightStateView, TurnEnginePhase } from '@wfrp/shared';
import type { Character } from '@wfrp/shared';
import { LiveBattlefield } from './LiveBattlefield';
import { DecisionPalette } from './DecisionPalette';
import styles from './PlayerFightScreen.module.css';

interface PlayerFightScreenProps {
    fightState: {
        stateView: FightStateView;
        activeCombatantId: string | null;
        phase: TurnEnginePhase;
    };
    pendingDecision: DecisionRequest | null;
    myActorId: string | null;
    character: Character | null;
    onSubmitDecision: (requestId: string, decision: CombatDecision) => void;
}

function conditionLabel(condition: string): string {
    return condition.replace(/^condition_/, '').replace(/_/g, ' ');
}

const CombatantPanels: React.FC<{ stateView: FightStateView }> = ({ stateView }) => {
    const { t } = useTranslation();
    const combatants = Object.values(stateView.combatants);
    return (
        <section className={styles.combatantSection}>
            <div className={styles.combatantPanels}>
                {combatants.map(c => {
                    const woundsPct = Math.max(0, c.currentWounds / Math.max(1, c.maxWounds) * 100);
                    const fortune = c.resources?.fortune;
                    const fate = c.resources?.fate;
                    const panelCls = `${styles.combatantPanel} ${c.side === 'adversary' ? styles.adversary : ''}`;
                    return (
                        <article key={c.id} className={panelCls}>
                            <header>
                                <strong>{c.name}</strong>
                                <span>{c.dead ? t('fightLab.replay.status.dead') : c.removedFromEncounter ? t('fightLab.replay.status.removed') : t('fightLab.replay.status.active')}</span>
                            </header>
                            <div className={styles.wounds}>
                                <span style={{ width: `${woundsPct}%` }} />
                            </div>
                            <div className={styles.panelStats}>
                                <span>{t('sheet.wounds')} <strong>{c.currentWounds}/{c.maxWounds}</strong></span>
                                <span>{t('fightLab.replay.position')} <strong>{c.position}</strong></span>
                                {fate && <span>{t('sheet.fate')} <strong>{fate.current}/{fate.max}</strong></span>}
                                {fortune && <span>{t('sheet.fortune')} <strong>{fortune.current}/{fortune.max}</strong></span>}
                            </div>
                            {c.conditions.length > 0 && (
                                <div className={styles.conditions}>
                                    {c.conditions.map((cond, i) => (
                                        <span key={`${cond}-${i}`}>{conditionLabel(cond)}</span>
                                    ))}
                                </div>
                            )}
                        </article>
                    );
                })}
            </div>
        </section>
    );
};

export const PlayerFightScreen: React.FC<PlayerFightScreenProps> = ({
    fightState,
    pendingDecision,
    myActorId,
    character,
    onSubmitDecision,
}) => {
    const { t } = useTranslation();
    const { stateView, activeCombatantId, phase } = fightState;

    const phaseLabel = (() => {
        switch (phase) {
            case 'awaitingDecision': return t('fight.phase.awaitingDecision');
            case 'roundStart': return t('fight.phase.roundStart');
            case 'roundEnd': return t('fight.phase.roundEnd');
            case 'complete': return t('fight.phase.complete');
            default: return phase;
        }
    })();

    const isMyTurn = pendingDecision !== null && pendingDecision.actorId === myActorId;
    const isOtherTurn = pendingDecision !== null && pendingDecision.actorId !== myActorId;

    return (
        <div className={styles.screen}>
            <header className={styles.header}>
                <h2>{t('fight.round', { n: stateView.round })}</h2>
                <span className={styles.phaseBadge}>{phaseLabel}</span>
            </header>

            <LiveBattlefield stateView={stateView} activeCombatantId={activeCombatantId} />

            <CombatantPanels stateView={stateView} />

            <div className={styles.bottomArea}>
                {isMyTurn && (
                    <DecisionPalette
                        decision={pendingDecision}
                        character={character}
                        onSubmit={d => onSubmitDecision(pendingDecision.requestId, d)}
                    />
                )}
                {isOtherTurn && (
                    <p className={styles.spectatorBanner}>
                        {t('fight.awaiting', { name: pendingDecision.characterName })}
                    </p>
                )}
                {!pendingDecision && phase !== 'awaitingDecision' && phase !== 'complete' && (
                    <p className={styles.npcBanner}>{t('fight.npcResolving')}</p>
                )}
                {phase === 'complete' && (
                    <p className={styles.npcBanner}>{t('fight.phase.complete')}</p>
                )}
            </div>
        </div>
    );
};
