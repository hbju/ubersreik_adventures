import React from 'react';
import { useTranslation } from 'react-i18next';
import type { FightStateView } from '@wfrp/shared';
import styles from './PlayerFightScreen.module.css';

interface LiveBattlefieldProps {
    stateView: FightStateView;
    activeCombatantId: string | null;
}

function initials(name: string): string {
    return name.split(/\s+/).slice(0, 2).map(part => part[0] ?? '').join('').toUpperCase();
}

function tokenStatus(c: FightStateView['combatants'][string]): string {
    if (c.dead) return 'dead';
    if (c.removedFromEncounter) return 'removed';
    return 'active';
}

export const LiveBattlefield: React.FC<LiveBattlefieldProps> = ({ stateView, activeCombatantId }) => {
    const { t } = useTranslation();
    const combatants = Object.values(stateView.combatants);
    const positions = combatants.map(c => c.position);
    const min = Math.min(...positions, 0) - 2;
    const max = Math.max(...positions, 10) + 2;
    const span = Math.max(1, max - min);
    const x = (position: number) => (position - min) / span * 100;

    const bySide = {
        ally: combatants.filter(c => c.side === 'ally'),
        adversary: combatants.filter(c => c.side === 'adversary'),
    };

    const trackHeight = Math.max(200, Math.max(bySide.ally.length, bySide.adversary.length) * 110);

    const tokenTop = (c: FightStateView['combatants'][string]) => {
        const sideCombatants = bySide[c.side];
        const sideIndex = sideCombatants.findIndex(candidate => candidate.id === c.id);
        const fraction = (sideIndex + 0.5) / Math.max(1, sideCombatants.length);
        return c.side === 'ally' ? fraction * 42 : 58 + fraction * 40;
    };

    const allyAdv = stateView.advantagePools.ally ?? 0;
    const adversaryAdv = stateView.advantagePools.adversary ?? 0;

    return (
        <section className={styles.battlefield} aria-label={t('fightLab.replay.battlefield')}>
            <header>
                <strong>{t('fightLab.replay.battlefield')}</strong>
                <span>{t('fightLab.replay.advantage', { ally: allyAdv, adversary: adversaryAdv })}</span>
            </header>
            <div className={styles.track} style={{ height: trackHeight }}>
                <div className={styles.trackLine} />

                {Object.values(stateView.engagements).map((engagement) => {
                    const left = stateView.combatants[engagement.aId];
                    const right = stateView.combatants[engagement.bId];
                    if (!left || !right) return null;
                    const lx = x(left.position);
                    const rx = x(right.position);
                    const start = Math.min(lx, rx);
                    return (
                        <span
                            key={`${engagement.aId}:${engagement.bId}`}
                            className={engagement.grappling ? styles.grappleLink : styles.engagementLink}
                            style={{
                                left: `${start}%`,
                                width: `${Math.max(1, Math.abs(lx - rx))}%`,
                                top: '46%',
                            }}
                        />
                    );
                })}

                {combatants.map(c => {
                    const status = tokenStatus(c);
                    const isActive = c.id === activeCombatantId;
                    const cls = [styles.token, styles[c.side], isActive ? styles.active : '', styles[status]]
                        .filter(Boolean).join(' ');
                    return (
                        <div
                            key={c.id}
                            className={cls}
                            style={{ left: `${x(c.position)}%`, top: `${tokenTop(c)}%` }}
                            title={`${c.name}: ${c.position}`}
                        >
                            <strong>{initials(c.name)}</strong>
                            <span>{c.name}</span>
                            <small>{c.position}</small>
                        </div>
                    );
                })}

                <span className={styles.axisStart}>{min}</span>
                <span className={styles.axisEnd}>{max} {t('fightLab.replay.yards')}</span>
            </div>
        </section>
    );
};
