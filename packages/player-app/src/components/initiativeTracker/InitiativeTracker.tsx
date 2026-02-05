import React from 'react';
import { Combatant, useGameData, Advantages } from '@wfrp/shared';
import styles from './InitiativeTracker.module.css';
import Draggable from 'react-draggable';
import { get } from 'http';

interface InitiativeTrackerProps {
    combatants: Combatant[];
    currentTurnId: string | null;
    advantages?: Advantages;
    currentCharacterId?: string;
}

const InitiativeTracker: React.FC<InitiativeTrackerProps> = ({
    combatants, currentTurnId, advantages, currentCharacterId
}) => {
    const gameData = useGameData();
    const conditionsData = gameData.conditions;

    const nodeRef = React.useRef(null);

    if (combatants.length === 0) {
        return null; // Don't show tracker if no combat is active
    }

    const characterState = (currentWounds: number | null, maxWounds: number | null): string => {
        if (currentWounds === null || maxWounds === null) return '-';
        const ratio = currentWounds / maxWounds;
        if (ratio >= 0.75) return 'Healthy';
        if (ratio >= 0.5) return 'Injured';
        if (ratio >= 0.25) return 'Wounded';
        return 'Critical';
    };

    const getWoundStyles = (currentWounds: number | null, maxWounds: number | null): string => {
        if (currentWounds === null || maxWounds === null) return styles.woundHealthy;
        const ratio = currentWounds / maxWounds;
        if (ratio >= 0.75) return styles.woundHealthy;
        if (ratio >= 0.5) return styles.woundInjured;
        if (ratio >= 0.25) return styles.woundWounded;
        return styles.woundCritical;
    }

    const getConditionName = (conditionId: string): string => {
        const condition = conditionsData.find(c => c.id === conditionId);
        return condition ? condition.name : conditionId;
    };

    const getConditionDescription = (conditionId: string): string => {
        const condition = conditionsData.find(c => c.id === conditionId);
        return condition ? condition.description : '';
    };

    const getConditionCounts = (conditions: string[]): Map<string, number> => {
        const counts = new Map<string, number>();
        conditions.forEach(condId => {
            counts.set(condId, (counts.get(condId) || 0) + 1);
        });
        return counts;
    };

    return (
        <Draggable nodeRef={nodeRef}>
            <div className={styles.trackerContainer} ref={nodeRef}>
                <header className={styles.header}>
                    <h3>Initiative Tracker</h3>
                </header>
                {advantages && (
                    <div className={styles.advantageDisplay}>
                        <div>
                            Player Adv. : {advantages.playerAdvantage} -
                            Enemy Adv. : {advantages.enemyAdvantage}
                        </div>
                    </div>
                )}
                <ol className={styles.combatantList}>
                    {combatants.map(c => {
                        const conditionCounts = getConditionCounts(c.conditions || []);
                        return (
                            <li key={c.id} className={c.id === currentTurnId ? styles.activeTurn : ''}>
                                <div className={styles.combatantRow}>
                                    <span className={styles.initiative}>{c.initiative ?? '-'}</span>
                                    <span className={styles.name}>{c.name}</span>
                                    <div className={styles.wounds}>
                                        {currentCharacterId && c.sourceId === currentCharacterId && (
                                            <span className={styles.woundsDisplay}>
                                                {c.currentWounds} / {c.maxWounds}
                                            </span>
                                        )}
                                        {currentCharacterId && c.sourceId !== currentCharacterId && (
                                            <span className={getWoundStyles(c.currentWounds, c.maxWounds)}>
                                                {characterState(c.currentWounds, c.maxWounds)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {conditionCounts.size > 0 && (
                                    <div className={styles.conditionBadges}>
                                        {Array.from(conditionCounts.entries()).map(([condId, count]) => (
                                            <span
                                                key={condId}
                                                className={styles.conditionBadge}
                                                title={getConditionDescription(condId)}
                                            >
                                                {getConditionName(condId)}{count > 1 ? ` (${count})` : ''}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ol>
            </div>
        </Draggable>
    );
}

export default InitiativeTracker