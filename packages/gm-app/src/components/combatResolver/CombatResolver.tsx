import React, { useState, useEffect } from 'react';
import styles from './CombatResolver.module.css';
import {
    rolld100,
    calculateSuccessLevel,
    getHitLocation,
    allSkillsAndCharacteristics,
    Character,
    Combatant,
    SkillCharDefinition,
    calculateSkillValue,
    calculateCharacteristicBonus,
    calculateCharacteristicValue,
    RequestOpposedTestMessage,
    OpposedTestResultMessage,
    AssignCharacterMessage,
    LogEntry
} from '@wfrp/shared';

import CharacterSelector from './CharacterSelector';

interface CombatResolverProps {
    characters: Character[];
    combatants: Combatant[];
    opposedTestResults: Map<string, OpposedTestResultMessage['payload']>;
    onClearOpposedTestResult: (testId: string, role: 'attacker' | 'defender') => void;
    onSendToPlayer: (characterId: string, message: RequestOpposedTestMessage | AssignCharacterMessage) => void;
    onLogEntry: (type: LogEntry['type'], content: string) => void;
    onUpdateCharacter: (character: Character) => void;
    onUpdateCombatant: (combatant: Combatant) => void;
    onClose: () => void;
}

interface CombatResult {
    attackRoll: number;
    defenseRoll: number;
    attackSuccessLevel: string;
    defenseSuccessLevel: string;
    outcomeMessage: string;
    damageDealt?: number;
    hitLocation?: string;
}

interface CombatantStats {
    skill: number;
    modifier: number;
    weaponDamage: number;
    toughnessBonus: number;
    armourPoints: number;
}

interface OpposedTestState {
    testId: string;
    attackerId: string;
    defenderId: string;
    attackerSkillName: string;
    defenderSkillName: string;
    attackerRoll: number | null;
    defenderRoll: number | null;
    attackerSL: number | null;
    defenderSL: number | null;
    attackerTarget: number;
    defenderTarget: number;
    weaponDamage: number;
    toughnessBonus: number;
    armourPoints: number;
}

const CombatResolver: React.FC<CombatResolverProps> = ({
    characters,
    combatants,
    opposedTestResults,
    onClearOpposedTestResult,
    onSendToPlayer,
    onLogEntry,
    onUpdateCharacter,
    onUpdateCombatant,
    onClose
}) => {
    const [selectedAttackerId, setSelectedAttackerId] = useState<string>(characters[0]?.id || 'manual');
    const [selectedDefenderId, setSelectedDefenderId] = useState<string>(characters[1]?.id || 'manual');

    const [attackerSkillId, setAttackerSkillId] = useState<string>('melee-basic');
    const [defenderSkillId, setDefenderSkillId] = useState<string>('melee-basic');

    const [attackerStats, setAttackerStats] = useState<CombatantStats>({
        skill: 45,
        modifier: 0,
        weaponDamage: 7,
        toughnessBonus: 0,
        armourPoints: 0,
    });

    const [defenderStats, setDefenderStats] = useState<CombatantStats>({
        skill: 35,
        modifier: 0,
        weaponDamage: 0,
        toughnessBonus: 3,
        armourPoints: 1,
    });

    const [result, setResult] = useState<CombatResult | null>(null);
    const [opposedTestState, setOpposedTestState] = useState<OpposedTestState | null>(null);

    const getSkillValue = (character: Character, skillId: string): number => {
        const skillInfo = (allSkillsAndCharacteristics as SkillCharDefinition[]).find(s => s.id === skillId);
        if (!skillInfo) return 0;

        const charValue = calculateCharacteristicValue(character.characteristics[skillInfo.characteristic]);

        if (skillInfo.type !== 'characteristic') {
            const skill = character.skills.find(s => s.id === skillId);
            if (skill) {
                return calculateSkillValue(skill, character);
            }
        }
        return charValue;
    };

    useEffect(() => {
        if (selectedAttackerId === 'manual') return;

        const attacker = characters.find(char => char.id === selectedAttackerId);
        if (attacker) {
            const strengthBonus = calculateCharacteristicBonus(attacker.characteristics.s);

            setAttackerStats(prevStats => ({
                ...prevStats,
                skill: getSkillValue(attacker, attackerSkillId),
                weaponDamage: 4 + strengthBonus,
            }));
        }
    }, [selectedAttackerId, attackerSkillId, characters]);

    useEffect(() => {
        if (selectedDefenderId === 'manual') return;

        const defender = characters.find(char => char.id === selectedDefenderId);
        if (defender) {
            const toughnessBonus = calculateCharacteristicBonus(defender.characteristics.t);

            setDefenderStats(prevStats => ({
                ...prevStats,
                skill: getSkillValue(defender, defenderSkillId),
                toughnessBonus: toughnessBonus,
                armourPoints: 0, // TODO - derive from equipment
            }));
        }
    }, [selectedDefenderId, defenderSkillId, characters]);

    // Watch for completed opposed tests and calculate outcome
    useEffect(() => {
        if (!opposedTestState) return;

        const attackerKey = `${opposedTestState.testId}-attacker`;
        const defenderKey = `${opposedTestState.testId}-defender`;

        const attackerResult = opposedTestResults.get(attackerKey);
        const defenderResult = opposedTestResults.get(defenderKey);

        if (attackerResult && !opposedTestState.attackerSL) {
            setOpposedTestState(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    attackerRoll: attackerResult.rollResult,
                    attackerSL: attackerResult.successLevel,
                };
            });
        }

        if (defenderResult && !opposedTestState.defenderSL) {
            setOpposedTestState(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    defenderRoll: defenderResult.rollResult,
                    defenderSL: defenderResult.successLevel,
                };
            });
        }
        if (opposedTestState.attackerSL !== null && opposedTestState.defenderSL !== null && (attackerResult || defenderResult)) {
            const attackerSL = Math.round(opposedTestState.attackerSL);
            const defenderSL = Math.round(opposedTestState.defenderSL);

            let outcomeMessage = '';
            let damageDealt: number | undefined;
            let hitLocation: string | undefined;

            if (attackerSL > defenderSL || (attackerSL === defenderSL && opposedTestState.attackerTarget > opposedTestState.defenderTarget)) {
                const slDiff = attackerSL - defenderSL;
                const damage = opposedTestState.weaponDamage + slDiff -
                    (opposedTestState.toughnessBonus + opposedTestState.armourPoints);
                damageDealt = Math.max(damage, 0);
                hitLocation = getHitLocation(opposedTestState.attackerRoll!);
                outcomeMessage = `Attacker wins by ${slDiff}! Damage Dealt: ${damageDealt} to ${hitLocation}.`;
                onLogEntry('info', outcomeMessage);
            }
            else if (attackerSL < defenderSL || (attackerSL === defenderSL && opposedTestState.attackerTarget < opposedTestState.defenderTarget)) {
                const slDiff = defenderSL - attackerSL;
                outcomeMessage = `Defender wins by ${slDiff}!`;
                onLogEntry('info', outcomeMessage);
            }
            else {
                outcomeMessage = 'Combat resulted in a draw!';
                onLogEntry('info', outcomeMessage);
            }

            const roundedAttackSL = attackerSL > 0 ? "+" + attackerSL :
                attackerSL < 0 ? "" + attackerSL : "0";
            const roundedDefenseSL = defenderSL > 0 ? "+" + defenderSL :
                defenderSL < 0 ? "" + defenderSL : "0";

            // Set the result for display
            setResult({
                attackRoll: opposedTestState.attackerRoll!,
                defenseRoll: opposedTestState.defenderRoll!,
                attackSuccessLevel: roundedAttackSL,
                defenseSuccessLevel: roundedDefenseSL,
                outcomeMessage,
                damageDealt,
                hitLocation
            });

            onClearOpposedTestResult(opposedTestState.testId, 'attacker');
            onClearOpposedTestResult(opposedTestState.testId, 'defender');
        }
    }, [opposedTestResults, opposedTestState, onClearOpposedTestResult, onLogEntry]);

    const handleStatChange = (
        combatant: 'attacker' | 'defender',
        stat: keyof CombatantStats,
        value: number
    ) => {
        const setter = combatant === 'attacker' ? setAttackerStats : setDefenderStats;
        setter(prevStats => ({
            ...prevStats,
            [stat]: value,
        }));
    };

    const handleResolveCombat = () => {
        const attackerTarget = attackerStats.skill + attackerStats.modifier;
        const defenderTarget = defenderStats.skill + defenderStats.modifier;

        const attackRoll = rolld100();
        const defenseRoll = rolld100();

        const attackSuccessLevel = calculateSuccessLevel(attackRoll, attackerTarget);
        const defenseSuccessLevel = calculateSuccessLevel(defenseRoll, defenderTarget);

        let outcomeMessage = '';
        let damageDealt: number | undefined;
        let hitLocation: string | undefined;

        if (attackSuccessLevel > defenseSuccessLevel || (attackSuccessLevel === defenseSuccessLevel && attackerStats.skill > defenderStats.skill)) {
            const slDiff = Math.round(attackSuccessLevel) - Math.round(defenseSuccessLevel);
            const damage = attackerStats.weaponDamage + slDiff -
                (defenderStats.toughnessBonus + defenderStats.armourPoints);
            damageDealt = Math.max(damage, 0);
            hitLocation = getHitLocation(attackRoll);
            outcomeMessage = `Attacker wins by ${slDiff}! Damage Dealt: ${damageDealt} to ${hitLocation}.`;
        }
        else if (attackSuccessLevel < defenseSuccessLevel || (attackSuccessLevel === defenseSuccessLevel && attackerStats.skill < defenderStats.skill)) {
            outcomeMessage = `Defender wins by ${Math.round(defenseSuccessLevel) - Math.round(attackSuccessLevel)}!`;
        }
        else {
            console.log("Combat resulted in a draw, resolving again...");
            handleResolveCombat();
            return;
        }

        const roundedAttackSL = attackSuccessLevel > 0 ? "+" + Math.round(attackSuccessLevel) :
            attackSuccessLevel < 0 ? "-" + Math.round(-attackSuccessLevel) : "0";
        const roundedDefenseSL = defenseSuccessLevel > 0 ? "+" + Math.round(defenseSuccessLevel) :
            defenseSuccessLevel < 0 ? "-" + Math.round(-defenseSuccessLevel) : "0";

        setResult({
            attackRoll,
            defenseRoll,
            attackSuccessLevel: roundedAttackSL,
            defenseSuccessLevel: roundedDefenseSL,
            outcomeMessage,
            damageDealt,
            hitLocation
        });
    };

    const handleRequestPlayerRolls = () => {
        const testId = crypto.randomUUID();
        const attackerSkillInfo = allSkillsAndCharacteristics.find(s => s.id === attackerSkillId);
        const defenderSkillInfo = allSkillsAndCharacteristics.find(s => s.id === defenderSkillId);

        if (!attackerSkillInfo || !defenderSkillInfo) {
            alert('Invalid skill selection.');
            return;
        }

        // Check if attacker and defender are connected players
        const attackerIsPlayer = selectedAttackerId !== 'manual' && combatants.some(c => c.sourceId === selectedAttackerId && c.isPlayer);
        const defenderIsPlayer = selectedDefenderId !== 'manual' && combatants.some(c => c.sourceId === selectedDefenderId && c.isPlayer);

        // Create opposed test state
        const newOpposedTestState: OpposedTestState = {
            testId,
            attackerId: selectedAttackerId,
            defenderId: selectedDefenderId,
            attackerSkillName: attackerSkillInfo.name,
            defenderSkillName: defenderSkillInfo.name,
            attackerRoll: attackerIsPlayer ? null : rolld100(), // Roll immediately for NPCs
            defenderRoll: defenderIsPlayer ? null : rolld100(), // Roll immediately for NPCs
            attackerSL: null,
            defenderSL: null,
            attackerTarget: attackerStats.skill + attackerStats.modifier,
            defenderTarget: defenderStats.skill + defenderStats.modifier,
            weaponDamage: attackerStats.weaponDamage,
            toughnessBonus: defenderStats.toughnessBonus,
            armourPoints: defenderStats.armourPoints,
        };

        // Calculate SL for NPC rolls
        if (newOpposedTestState.attackerRoll !== null) {
            newOpposedTestState.attackerSL = calculateSuccessLevel(newOpposedTestState.attackerRoll, newOpposedTestState.attackerTarget);
            const attackerName = selectedAttackerId === 'manual' ? 'Manual Attacker' : characters.find(c => c.id === selectedAttackerId)?.name || 'NPC';
            onLogEntry('roll', `${attackerName} (${attackerSkillInfo.name}) rolled ${newOpposedTestState.attackerRoll} with SL ${newOpposedTestState.attackerSL >= 0 ? '+' : ''}${Math.round(newOpposedTestState.attackerSL)}`);
        }
        if (newOpposedTestState.defenderRoll !== null) {
            newOpposedTestState.defenderSL = calculateSuccessLevel(newOpposedTestState.defenderRoll, newOpposedTestState.defenderTarget);
            const defenderName = selectedDefenderId === 'manual' ? 'Manual Defender' : characters.find(c => c.id === selectedDefenderId)?.name || 'NPC';
            onLogEntry('roll', `${defenderName} (${defenderSkillInfo.name}) rolled ${newOpposedTestState.defenderRoll} with SL ${newOpposedTestState.defenderSL >= 0 ? '+' : ''}${Math.round(newOpposedTestState.defenderSL)}`);
        }

        setOpposedTestState(newOpposedTestState);

        // Send messages only to connected players
        if (attackerIsPlayer) {
            const attackerMessage: RequestOpposedTestMessage = {
                type: 'REQUEST_OPPOSED_TEST',
                payload: {
                    testId,
                    role: 'attacker',
                    skillName: attackerSkillInfo.name,
                    targetNumber: attackerStats.skill,
                    modifier: attackerStats.modifier,
                }
            };
            onSendToPlayer(selectedAttackerId, attackerMessage);
        }

        if (defenderIsPlayer) {
            const defenderMessage: RequestOpposedTestMessage = {
                type: 'REQUEST_OPPOSED_TEST',
                payload: {
                    testId,
                    role: 'defender',
                    skillName: defenderSkillInfo.name,
                    targetNumber: defenderStats.skill,
                    modifier: defenderStats.modifier,
                }
            };
            onSendToPlayer(selectedDefenderId, defenderMessage);
        }

        onLogEntry('system', `Requested opposed test: ${attackerSkillInfo.name} vs ${defenderSkillInfo.name}`);
    };

    const handleAcceptResult = () => {
        if (!result || result.damageDealt === undefined) {
            onLogEntry('system', 'Result accepted (no damage)');
            setResult(null);
            setOpposedTestState(null);
            return;
        }

        // Apply damage to defender
        const defenderCombatant = combatants.find(c => c.sourceId === selectedDefenderId);
        if (defenderCombatant) {
            const newWounds = Math.max(0, defenderCombatant.currentWounds - result.damageDealt);
            const updatedCombatant: Combatant = {
                ...defenderCombatant,
                currentWounds: newWounds
            };
            onUpdateCombatant(updatedCombatant);

            // If defender is a character, update their wounds too
            const defenderCharacter = characters.find(c => c.id === selectedDefenderId);
            if (defenderCharacter) {
                const updatedCharacter: Character = {
                    ...defenderCharacter,
                    status: {
                        ...defenderCharacter.status,
                        wounds: {
                            ...defenderCharacter.status.wounds,
                            current: newWounds
                        }
                    }
                };
                onUpdateCharacter(updatedCharacter);

                // Send updated character to player if they're connected
                if (defenderCombatant.isPlayer) {
                    const message: AssignCharacterMessage = {
                        type: 'ASSIGN_CHARACTER',
                        payload: { character: updatedCharacter }
                    };
                    onSendToPlayer(selectedDefenderId, message);
                }
            }

            onLogEntry('system', `Result accepted: ${result.damageDealt} damage applied to defender (${newWounds} wounds remaining)`);
        } else {
            onLogEntry('system', 'Result accepted but defender not found in combat tracker');
        }

        // Clear the result and opposed test state
        setResult(null);
        setOpposedTestState(null);
    };

    const handleRejectResult = () => {
        onLogEntry('system', 'Result rejected by GM');
        setResult(null);
        setOpposedTestState(null);
    };

    return (
        <div className={styles.resolverContainer}>
            <button className={styles.closeButton} onClick={() => {
                setResult(null);
                setOpposedTestState(null);
                onClose();
            }}>x</button>
            <div className={styles.combatantPanel}>
                <h3 className={styles.attacker}>Attacker</h3>
                <CharacterSelector
                    characters={characters}
                    selectedCharacterId={selectedAttackerId}
                    onCharacterSelect={setSelectedAttackerId}
                />
                <div className={styles.statInput}>
                    <label>Test</label>
                    {/* If manual, show number input. Otherwise, show skill dropdown. */}
                    {selectedAttackerId === 'manual' ? (
                        <input
                            type="number"
                            value={attackerStats.skill}
                            onChange={(e) => handleStatChange('attacker', 'skill', parseInt(e.target.value) || 0)}
                        />
                    ) : (
                        <div className={styles.skillSelectContainer}>
                            <select
                                value={attackerSkillId}
                                onChange={(e) => setAttackerSkillId(e.target.value)}
                                className={styles.skillSelect}
                            >
                                <optgroup label="Characteristics">
                                    {allSkillsAndCharacteristics.filter(s => s.type === 'characteristic').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </optgroup>
                                <optgroup label="Skills">
                                    {allSkillsAndCharacteristics.filter(s => s.type === 'skill').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </optgroup>
                            </select>

                            <div className={styles.statDisplay}>
                                <span>Skill Total: <strong>{attackerStats.skill}</strong></span>
                            </div>
                        </div>
                    )}
                </div>
                <div className={styles.statInput}>
                    <label>Modifier</label>
                    <input
                        type="number"
                        step="10"
                        value={attackerStats.modifier}
                        onChange={(e) => handleStatChange('attacker', 'modifier', parseInt(e.target.value) || 0)}
                    />
                </div>
                <div className={styles.statInput}>
                    <label>Weapon Damage</label>
                    <input
                        type="number"
                        value={attackerStats.weaponDamage}
                        onChange={(e) => handleStatChange('attacker', 'weaponDamage', parseInt(e.target.value) || 0)}
                    />
                </div>
            </div>

            <div className={styles.actionPanel}>
                <button className={styles.fightButton} onClick={handleResolveCombat}>
                    - GM Rolls -
                </button>
                <button
                    className={styles.requestRollsButton}
                    onClick={handleRequestPlayerRolls}
                    disabled={false}
                >
                    Opposed Test
                </button>
                {opposedTestState && (
                    <div className={styles.opposedTestStatus}>
                        <p>Waiting for player rolls...</p>
                        <p>Attacker: {opposedTestState.attackerRoll !== null ? `✅ ${opposedTestState.attackerRoll} (SL: ${opposedTestState.attackerSL !== null ? (opposedTestState.attackerSL >= 0 ? '+' : '') + Math.round(opposedTestState.attackerSL) : '?'})` : '⏳'}</p>
                        <p>Defender: {opposedTestState.defenderRoll !== null ? `✅ ${opposedTestState.defenderRoll} (SL: ${opposedTestState.defenderSL !== null ? (opposedTestState.defenderSL >= 0 ? '+' : '') + Math.round(opposedTestState.defenderSL) : '?'})` : '⏳'}</p>
                        <button
                            className={styles.cancelTestButton}
                            onClick={() => {
                                if (opposedTestState) {
                                    onClearOpposedTestResult(opposedTestState.testId, 'attacker');
                                    onClearOpposedTestResult(opposedTestState.testId, 'defender');
                                }
                                setOpposedTestState(null);
                                onLogEntry('system', 'Opposed test cancelled');
                            }}
                        >
                            Cancel Test
                        </button>
                    </div>
                )}
            </div>

            <div className={styles.combatantPanel}>
                <h3 className={styles.defender}>Defender</h3>
                <CharacterSelector
                    characters={characters}
                    selectedCharacterId={selectedDefenderId}
                    onCharacterSelect={setSelectedDefenderId}
                />
                <div className={styles.statInput}>
                    <label>Test</label>
                    {/* If manual, show number input. Otherwise, show skill dropdown. */}
                    {selectedDefenderId === 'manual' ? (
                        <input
                            type="number"
                            value={defenderStats.skill}
                            onChange={(e) => handleStatChange('defender', 'skill', parseInt(e.target.value) || 0)}
                        />
                    ) : (
                        <div className={styles.skillSelectContainer}>
                            <select
                                value={defenderSkillId}
                                onChange={(e) => setDefenderSkillId(e.target.value)}
                                className={styles.skillSelect}
                            >
                                <optgroup label="Characteristics">
                                    {allSkillsAndCharacteristics.filter(s => s.type === 'characteristic').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </optgroup>
                                <optgroup label="Skills">
                                    {allSkillsAndCharacteristics.filter(s => s.type === 'skill').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </optgroup>
                            </select>

                            <div className={styles.statDisplay}>
                                <span>Skill Total: <strong>{defenderStats.skill}</strong></span>
                            </div>
                        </div>
                    )}
                </div>
                <div className={styles.statInput}>
                    <label>Modifier</label>
                    <input
                        type="number"
                        step="10"
                        value={defenderStats.modifier}
                        onChange={(e) => handleStatChange('defender', 'modifier', parseInt(e.target.value) || 0)}
                    />
                </div>
                <div className={styles.statInput}>
                    <label>Toughness Bonus</label>
                    <input
                        type="number"
                        value={defenderStats.toughnessBonus}
                        onChange={(e) => handleStatChange('defender', 'toughnessBonus', parseInt(e.target.value) || 0)}
                    />
                </div>
                <div className={styles.statInput}>
                    <label>Armour Points</label>
                    <input
                        type="number"
                        value={defenderStats.armourPoints}
                        onChange={(e) => handleStatChange('defender', 'armourPoints', parseInt(e.target.value) || 0)}
                    />
                </div>
            </div>

            {result && (
                <div className={styles.resultPanel}>
                    <div className={styles.resultSection}>
                        <h4>Rolls</h4>
                        <p>Attacker rolled: <span className={styles.rollValue}>{result.attackRoll}</span></p>
                        <p>Defender rolled: <span className={styles.rollValue}>{result.defenseRoll}</span></p>
                    </div>
                    <div className={styles.resultSection}>
                        <h4>Success Levels</h4>
                        <p>Attacker SL: <span className={styles.slValue}>{result.attackSuccessLevel}</span></p>
                        <p>Defender SL: <span className={styles.slValue}>{result.defenseSuccessLevel}</span></p>
                    </div>
                    <div className={styles.outcomeSection}>
                        <h3>Outcome</h3>
                        <p className={styles.outcomeMessage}>{result.outcomeMessage}</p>
                        <div className={styles.resultActions}>
                            <button className={styles.acceptButton} onClick={handleAcceptResult}>
                                ✓ Accept & Apply Damage
                            </button>
                            <button className={styles.rejectButton} onClick={handleRejectResult}>
                                ✗ Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
};

export default CombatResolver;