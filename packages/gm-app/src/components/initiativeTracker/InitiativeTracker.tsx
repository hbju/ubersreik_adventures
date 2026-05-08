import React, { useState } from 'react';
import Draggable from 'react-draggable';
import {
    Combatant,
    rollDice,
    Advantages,
    ConditionPromptModal,
    applyEndOfRoundConditionEffects,
    checkConditionEffects,
    Character,
    RequestConditionTestMessage,
    calculateSkillValue,
    useGameData
} from '@wfrp/shared';
import styles from './InitiativeTracker.module.css';
import { useCombatContext } from '../../context/CombatContext';

interface InitiativeTrackerProps {
    onUpdateCombatant: (combatant: Combatant) => void;
    characters: Character[];
    onSendToPlayer: (charId: string, message: RequestConditionTestMessage) => void;
}

const InitiativeTracker: React.FC<InitiativeTrackerProps> = ({
    onUpdateCombatant, characters, onSendToPlayer
}) => {
    const { combatState, reorderInitiative, setCurrentTurnId, updateAdvantage, endCombat, incrementRound, nextTurn } = useCombatContext();
    const conditions = useGameData().conditions;
    const { combatants, currentTurnId, advantage: advantages, roundNumber } = combatState;

    const [expandedCombatantId, setExpandedCombatantId] = useState<string | null>(null);
    const [conditionPromptCombatant, setConditionPromptCombatant] = useState<Combatant | null>(null);

    const nodeRef = React.useRef(null);

    const handleRollInitiative = () => {
        const rolledCombatants = combatants.map(c => ({
            ...c,
            initiative: c.baseAg + c.baseInitiative + rollDice(1, 10),
        }));

        const sorted = rolledCombatants.sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0) || b.baseInitiative - a.initiative);
        reorderInitiative(sorted);
        setCurrentTurnId(sorted[0]?.id || null);
    };

    const handleNextTurn = async () => {
        if (!currentTurnId || combatants.length === 0) return;
        const currentIndex = combatants.findIndex(c => c.id === currentTurnId);
        const nextIndex = (currentIndex + 1) % combatants.length;
        const nextCombatant = combatants[nextIndex];

        // Check if next combatant has conditions that need processing. TODO : to be reimplemented later
        /** if (nextCombatant && nextCombatant.conditions && nextCombatant.conditions.length > 0) {
            const uniqueConditions = Array.from(new Set(nextCombatant.conditions));
            const needsPrompt = uniqueConditions.some(condId => {
                const effect = checkConditionEffects(condId, nextCombatant);
                return effect.needsTest || effect.automaticEffect?.type === 'remove';
            });

            if (needsPrompt) {
                    const character = characters.find(c => c.id === nextCombatant.sourceId);
                    if (character && character.userId != null) {
                        uniqueConditions.forEach(condId => {
                            const effect = checkConditionEffects(condId, nextCombatant, character);
                            if (effect.needsTest) {
                                const testId = `condition-test-${Date.now()}-${Math.random()}`;
                                const conditionData = conditionsData.find(c => c.id === condId);
                                const conditionCount = nextCombatant.conditions?.filter(c => c === condId).length || 1;
                                
                                // Calculate target number based on test type
                                let targetNumber = 0;
                                const testType = effect.testType || 'Endurance';
                                
                                // Try to find the skill first
                                const skill = character.skills.find(s => s.name === testType);
                                if (skill) {
                                    targetNumber = calculateSkillValue(skill, character);
                                } else {
                                    // Fallback to characteristic (Endurance is typically Toughness-based)
                                    const charMap: { [key: string]: keyof Character['characteristics'] } = {
                                        'Endurance': 't',
                                        'Cool': 'wp',
                                        'Strength': 's',
                                        'Athletics': 'ag'
                                    };
                                    const charKey = charMap[testType] || 't';
                                    targetNumber = character.characteristics[charKey].initial + character.characteristics[charKey].advances;
                                }
                                
                                const message: RequestConditionTestMessage = {
                                    type: 'REQUEST_CONDITION_TEST',
                                    payload: {
                                        testId,
                                        conditionId: condId,
                                        conditionName: conditionData?.name || condId,
                                        testType: testType,
                                        targetNumber: targetNumber,
                                        modifier: effect.testDifficulty || 0,
                                        conditionCount,
                                        description: conditionData?.description || ''
                                    }
                                };
                                
                                onSendToPlayer(nextCombatant.sourceId, message);
                            }
                        });
                } else {
                    setConditionPromptCombatant(nextCombatant);
                }
            }
        }
        **/
        console.log('Next Turn:', nextCombatant?.name);
        await nextTurn();
    }

    // TODO: to be reimplemented later
    const handleEndOfRound = () => {
        // Apply end-of-round condition effects to all combatants
        const updatedCombatants = [...combatants];
        const allLogs: string[] = [];

        updatedCombatants.forEach((combatant, index) => {
            if (combatant.conditions && combatant.conditions.length > 0) {
                const result = applyEndOfRoundConditionEffects(combatant, roundNumber);

                updatedCombatants[index] = result.combatant;
                allLogs.push(...result.log);

                // Apply condition changes
                result.conditionsToRemove.forEach(condId => {
                    const condIndex = updatedCombatants[index].conditions?.indexOf(condId);
                    if (condIndex !== undefined && condIndex !== -1) {
                        updatedCombatants[index].conditions?.splice(condIndex, 1);
                    }
                });

                result.conditionsToAdd.forEach(condId => {
                    if (!updatedCombatants[index].conditions) {
                        updatedCombatants[index].conditions = [];
                    }
                    updatedCombatants[index].conditions!.push(condId);
                });
            }
        });

        reorderInitiative(updatedCombatants);

        // Log end-of-round effects
        if (allLogs.length > 0) {
            console.log('End of Round Effects:', allLogs.join('\n'));
            // You could display these in a modal or log panel
        }
    }

    const handleWoundsChange = (combatantId: string, newWounds: number) => {
        const combatant = combatants.find(c => c.id === combatantId);
        if (combatant)
            onUpdateCombatant({ ...combatant, currentWounds: newWounds });
    };

    const handleAddCondition = (combatantId: string, conditionId: string) => {
        const combatant = combatants.find(c => c.id === combatantId);
        if (!combatant) return;

        const condition = conditions.find(cond => cond.id === conditionId);
        if (!condition) return;

        const updatedConditions = [...(combatant.conditions || [])];

        updatedConditions.push(conditionId);

        onUpdateCombatant({ ...combatant, conditions: updatedConditions });
    };

    const handleRemoveCondition = (combatantId: string, conditionId: string, index: number) => {
        const combatant = combatants.find(c => c.id === combatantId);
        if (!combatant) return;

        const updatedConditions = [...(combatant.conditions || [])];
        updatedConditions.splice(index, 1);

        onUpdateCombatant({ ...combatant, conditions: updatedConditions });
    };

    const handleAdvantageChange = (delta: number, advantage: Advantages, team: 'player' | 'enemy') => {
        const newAdvantage = { ...advantage };
        if (team === 'player') {
            newAdvantage.playerAdvantage = Math.max(0, advantage.playerAdvantage + delta);
        } else {
            newAdvantage.enemyAdvantage = Math.max(0, advantage.enemyAdvantage + delta);
        }

        updateAdvantage(newAdvantage);
    };

    const toggleExpanded = (combatantId: string) => {
        setExpandedCombatantId(prev => prev === combatantId ? null : combatantId);
    };

    const getConditionName = (conditionId: string): string => {
        const condition = conditions.find(c => c.id === conditionId);
        return condition ? condition.name : conditionId;
    };

    const getConditionDescription = (conditionId: string): string => {
        const condition = conditions.find(c => c.id === conditionId);
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
        <Draggable nodeRef={nodeRef}>
            <div className={styles.trackerContainer} ref={nodeRef}>
                <header className={styles.header}>
                    <h3>Encounter {roundNumber > 0 && `- Round ${roundNumber}`}</h3>
                    <div className={styles.actions}>
                        <button onClick={handleRollInitiative}>Roll Init</button>
                        <button onClick={handleNextTurn}>Next Turn</button>
                        <button onClick={() => { /**handleEndOfRound(); */ incrementRound(); }}>End Round</button>
                        <button onClick={endCombat} className={styles.clearBtn}>Clear</button>
                    </div>
                </header>
                <div className={styles.advantageDisplay}>
                    {advantages && (
                        <div className={styles.advantageControls}>
                            <span> Player Adv. : {advantages.playerAdvantage} </span>
                            <span> Enemy Adv. : {advantages.enemyAdvantage} </span>
                            <span>
                                <button onClick={() => handleAdvantageChange(-1, advantages, 'player')} className={styles.advantageBtn}>-</button>
                                <button onClick={() => handleAdvantageChange(1, advantages, 'player')} className={styles.advantageBtn}>+</button>
                            </span>
                            <span>
                                <button onClick={() => handleAdvantageChange(-1, advantages, 'enemy')} className={styles.advantageBtn}>-</button>
                                <button onClick={() => handleAdvantageChange(1, advantages, 'enemy')} className={styles.advantageBtn}>+</button>
                            </span>
                        </div>
                    )}
                </div>
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
                                                {conditions.map(condition => (
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
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ol>

                {/* Condition Prompt Modal */}
                {conditionPromptCombatant && (
                    <ConditionPromptModal
                        combatant={conditionPromptCombatant}
                        conditions={conditionPromptCombatant.conditions || []}
                        onClose={() => setConditionPromptCombatant(null)}
                        onApplyEffects={(conditionsRemoved, conditionsToAdd, log) => {
                            // Update combatant with condition changes
                            let updatedConditions = [...(conditionPromptCombatant.conditions || [])];

                            // Remove conditions
                            for (let i = 0; i < conditionsRemoved; i++) {
                                const uniqueConditions = Array.from(new Set(updatedConditions));
                                if (uniqueConditions.length > 0) {
                                    const condToRemove = uniqueConditions[0];
                                    const index = updatedConditions.indexOf(condToRemove);
                                    if (index !== -1) {
                                        updatedConditions.splice(index, 1);
                                    }
                                }
                            }

                            // Add new conditions
                            updatedConditions = [...updatedConditions, ...conditionsToAdd];

                            // Update combatant
                            onUpdateCombatant({
                                ...conditionPromptCombatant,
                                conditions: updatedConditions
                            });

                            // Log effects
                            if (log.length > 0) {
                                console.log('Condition Effects:', log.join('\n'));
                            }

                            setConditionPromptCombatant(null);
                        }}
                    />
                )}
            </div>
        </Draggable>
    );
}

export default InitiativeTracker