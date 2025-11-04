import React, { useState } from 'react';
import { Combatant, rollDice, conditionsData, TeamAdvantage } from '@wfrp/shared';
import styles from './InitiativeTracker.module.css';

interface InitiativeTrackerProps {
    combatants: Combatant[];
    onSetCombatants: (combatants: Combatant[]) => void;
    onUpdateCombatant: (combatant: Combatant) => void;
    onClearCombatants: () => void;
    currentTurnId: string | null;
    onSetCurrentTurnId: (id: string | null) => void;
    playerAdvantage?: TeamAdvantage;
    enemyAdvantage?: TeamAdvantage;
    onUpdateAdvantage: (advantage: TeamAdvantage) => void;
}

const InitiativeTracker: React.FC<InitiativeTrackerProps> = ({
    combatants, onSetCombatants, onUpdateCombatant, onClearCombatants, currentTurnId, onSetCurrentTurnId, playerAdvantage, enemyAdvantage, onUpdateAdvantage
}) => {
    const [expandedCombatantId, setExpandedCombatantId] = useState<string | null>(null);

    const handleRollInitiative = () => {
        const rolledCombatants = combatants.map(c => ({
            ...c,
            initiative: c.baseAg + c.baseInitiative + rollDice(1, 10),
        }));

        const sorted = rolledCombatants.sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0) || b.baseInitiative - a.initiative);
        onSetCombatants(sorted);
        onSetCurrentTurnId(sorted[0]?.id || null);
    };

    const handleNextTurn = () => {
        if (!currentTurnId || combatants.length === 0) return;

        const currentIndex = combatants.findIndex(c => c.id === currentTurnId);
        const nextIndex = (currentIndex + 1) % combatants.length;
        onSetCurrentTurnId(combatants[nextIndex].id);
    }

    const handleWoundsChange = (combatantId: string, newWounds: number) => {
        const combatant = combatants.find(c => c.id === combatantId);
        if (combatant)
            onUpdateCombatant({ ...combatant, currentWounds: newWounds });
    };

    const handleAddCondition = (combatantId: string, conditionId: string) => {
        const combatant = combatants.find(c => c.id === combatantId);
        if (!combatant) return;

        const condition = conditionsData.find(cond => cond.id === conditionId);
        if (!condition) return;

        const updatedConditions = [...(combatant.conditions || [])];
        
        // Check if condition can stack
        if (condition.stack > 1) {
            updatedConditions.push(conditionId);
        } else {
            // If doesn't stack and not already present, add it
            if (!updatedConditions.includes(conditionId)) {
                updatedConditions.push(conditionId);
            }
        }

        onUpdateCombatant({ ...combatant, conditions: updatedConditions });
    };

    const handleRemoveCondition = (combatantId: string, conditionId: string, index: number) => {
        const combatant = combatants.find(c => c.id === combatantId);
        if (!combatant) return;

        const updatedConditions = [...(combatant.conditions || [])];
        updatedConditions.splice(index, 1);

        onUpdateCombatant({ ...combatant, conditions: updatedConditions });
    };

    const handleAdvantageChange = (combatantId: string, delta: number, advantage: TeamAdvantage) => {
        const combatant = combatants.find(c => c.id === combatantId);
        if (!combatant) return;

        advantage = { ...advantage, advantage: Math.max(0, advantage.advantage + delta) };
        onUpdateAdvantage(advantage);
    };

    const toggleExpanded = (combatantId: string) => {
        setExpandedCombatantId(prev => prev === combatantId ? null : combatantId);
    };

    const getConditionName = (conditionId: string): string => {
        const condition = conditionsData.find(c => c.id === conditionId);
        return condition ? condition.name : conditionId;
    };

    const getConditionDescription = (conditionId: string): string => {
        const condition = conditionsData.find(c => c.id === conditionId);
        return condition ? condition.description : '';
    };

    // Group conditions by ID and count them
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
                <h3>Encounter</h3>
                <div className={styles.actions}>
                    <button onClick={handleRollInitiative}>Roll Init</button>
                    <button onClick={handleNextTurn}>Next Turn</button>
                    <button onClick={onClearCombatants} className={styles.clearBtn}>Clear</button>
                </div>
            </header>
            <ol className={styles.combatantList}>
                {combatants.map(c => {
                    const conditionCounts = getConditionCounts(c.conditions || []);
                    const isExpanded = expandedCombatantId === c.id;
                    
                    return (
                        <li key={c.id} className={c.id === currentTurnId ? styles.activeTurn : ''}>
                            <div className={styles.combatantRow}>
                                <span className={styles.initiative}>{c.initiative ?? '-'}</span>
                                <span className={styles.name}>{c.name}</span>
                                <div className={styles.wounds}>
                                    <input
                                        type="number"
                                        value={c.currentWounds}
                                        onChange={(e) => handleWoundsChange(c.id, Math.min(Math.max(parseInt(e.target.value), 0), c.maxWounds) || 0)}
                                    /> / {c.maxWounds}
                                </div>
                                <button 
                                    className={styles.expandBtn}
                                    onClick={() => toggleExpanded(c.id)}
                                    title="Manage conditions and advantage"
                                >
                                    {isExpanded ? '▲' : '▼'}
                                </button>
                            </div>

                            {/* Display active conditions */}
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

                            {/* Display advantage */}
                            {(c.advantage || 0) > 0 && (
                                <div className={styles.advantageDisplay}>
                                    Advantage: {c.advantage}
                                </div>
                            )}

                            {/* Condition management panel */}
                            {isExpanded && (
                                <div className={styles.conditionPanel}>
                                    <div className={styles.panelSection}>
                                        <label>Add Condition:</label>
                                        <select 
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    handleAddCondition(c.id, e.target.value);
                                                    e.target.value = '';
                                                }
                                            }}
                                            className={styles.conditionSelect}
                                        >
                                            <option value="">Select...</option>
                                            {conditionsData.map(condition => (
                                                <option key={condition.id} value={condition.id}>
                                                    {condition.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {(c.conditions || []).length > 0 && (
                                        <div className={styles.panelSection}>
                                            <label>Active Conditions:</label>
                                            <div className={styles.activeConditionsList}>
                                                {(c.conditions || []).map((condId, index) => (
                                                    <div key={`${condId}-${index}`} className={styles.activeConditionItem}>
                                                        <span 
                                                            className={styles.conditionText}
                                                            title={getConditionDescription(condId)}
                                                        >
                                                            {getConditionName(condId)}
                                                        </span>
                                                        <button
                                                            onClick={() => handleRemoveCondition(c.id, condId, index)}
                                                            className={styles.removeConditionBtn}
                                                            title="Remove condition"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className={styles.panelSection}>
                                        <label>Advantage:</label>
                                        <div className={styles.advantageControls}>
                                            <button
                                                onClick={() => handleAdvantageChange(c.id, -1)}
                                                className={styles.advantageBtn}
                                                disabled={(c.advantage || 0) === 0}
                                            >
                                                −
                                            </button>
                                            <span className={styles.advantageValue}>{c.advantage || 0}</span>
                                            <button
                                                onClick={() => handleAdvantageChange(c.id, 1)}
                                                className={styles.advantageBtn}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
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