import React from 'react';
import { Combatant, useGameData, Advantages } from '@wfrp/shared';
import styles from './InitiativeTracker.module.css';

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
    
    if (combatants.length === 0) {
        return null; // Don't show tracker if no combat is active
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
        <div className={styles.trackerContainer}>
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
    );
}

export default InitiativeTracker