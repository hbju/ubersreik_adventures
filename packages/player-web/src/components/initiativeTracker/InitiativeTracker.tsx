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
  combatants,
  currentTurnId,
  advantages,
  currentCharacterId,
}) => {
  const { conditions: conditionsData } = useGameData();

  if (combatants.length === 0) return null;

  const characterState = (current: number | null, max: number | null): string => {
    if (current === null || max === null) return '-';
    const ratio = current / max;
    if (ratio >= 0.75) return 'Healthy';
    if (ratio >= 0.5) return 'Injured';
    if (ratio >= 0.25) return 'Wounded';
    return 'Critical';
  };

  const getWoundStyles = (current: number | null, max: number | null): string => {
    if (current === null || max === null) return styles.woundHealthy;
    const ratio = current / max;
    if (ratio >= 0.75) return styles.woundHealthy;
    if (ratio >= 0.5) return styles.woundInjured;
    if (ratio >= 0.25) return styles.woundWounded;
    return styles.woundCritical;
  };

  const getConditionName = (conditionId: string) =>
    conditionsData.find(c => c.id === conditionId)?.name || conditionId;

  const getConditionCounts = (conditions: string[]) => {
    const counts = new Map<string, number>();
    conditions.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
    return counts;
  };

  return (
    <div className={styles.trackerContainer}>
      <header className={styles.header}>
        <h3>Initiative Tracker</h3>
      </header>
      {advantages && (
        <div className={styles.advantageDisplay}>
          Player Adv.: {advantages.playerAdvantage} — Enemy Adv.: {advantages.enemyAdvantage}
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
                  {currentCharacterId && c.sourceId === currentCharacterId ? (
                    <span className={styles.woundsDisplay}>
                      {c.currentWounds} / {c.maxWounds}
                    </span>
                  ) : (
                    <span className={getWoundStyles(c.currentWounds, c.maxWounds)}>
                      {characterState(c.currentWounds, c.maxWounds)}
                    </span>
                  )}
                </div>
              </div>
              {conditionCounts.size > 0 && (
                <div className={styles.conditionBadges}>
                  {Array.from(conditionCounts.entries()).map(([condId, count]) => (
                    <span key={condId} className={styles.conditionBadge}>
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
};

export default InitiativeTracker;
