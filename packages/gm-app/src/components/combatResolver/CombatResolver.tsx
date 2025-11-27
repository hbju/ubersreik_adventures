import React, { useState, useEffect } from 'react';
import styles from './CombatResolver.module.css';
import {
    rolld100,
    calculateSuccessLevel,
    getHitLocation,
    Character,
    Combatant,
    SkillCharDefinition,
    calculateSkillValue,
    calculateCharacteristicBonus,
    calculateCharacteristicValue,
    RequestOpposedTestMessage,
    OpposedTestResultMessage,
    AssignCharacterMessage,
    LogEntry,
    checkCriticalResult,
    CriticalHitModal,
    FumbleModal,
    getApplicableTalents,
    getTalentDamageBonus,
    getTalentTestBonus,
    applyTalentSLBonuses,
    useGameData,
} from '@wfrp/shared';

import CharacterSelector from './CharacterSelector';
import { cp } from 'node:fs';
import { use } from 'i18next';

interface CombatResolverProps {
    characters: Character[];
    combatants: Combatant[];
    opposedTestResults: Map<string, OpposedTestResultMessage['payload']>;
    onClearOpposedTestResult: (testId: string, role: 'attacker' | 'defender') => void;
    onSendToPlayer: (charId: string, message: RequestOpposedTestMessage | AssignCharacterMessage) => void;
    onLogEntry: (type: LogEntry['type'], content: string) => void;
    onUpdateCharacter: (character: Character) => void;
    onUpdateCombatant: (combatant: Combatant) => void;
    onUpdateAdvantage: (team: 'players' | 'enemies', amount: number) => void;
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
    attackerCritical?: boolean;
    attackerFumble?: boolean;
    attackerCritRoll?: number;
    defenderCritical?: boolean;
    defenderFumble?: boolean;
    defenderCritRoll?: number;
}

interface CombatantStats {
    skill: number;
    modifier: number;
    weaponDamage: number;
    toughnessBonus: number;
    armourPoints: number;
    selectedTalents?: Array<{ name: string; rank: number }>;
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
    onUpdateAdvantage,
    onClose
}) => {
    const skills = useGameData().skills;
    const talents = useGameData().talents;

    const [selectedAttackerId, setSelectedAttackerId] = useState<string>(characters[0]?.id || 'manual');
    const [selectedDefenderId, setSelectedDefenderId] = useState<string>(characters[1]?.id || 'manual');

    const [attackerSkillId, setAttackerSkillId] = useState<string>('melee');
    const [defenderSkillId, setDefenderSkillId] = useState<string>('melee');

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

    // State for critical/fumble modals
    const [showCriticalModal, setShowCriticalModal] = useState<{ location: string; wounds: number } | null>(null);
    const [showFumbleModal, setShowFumbleModal] = useState<number | null>(null);

    // State for talent selection
    const [attackerApplicableTalents, setAttackerApplicableTalents] = useState<Array<{ talent: any; rank: number }>>([]);
    const [defenderApplicableTalents, setDefenderApplicableTalents] = useState<Array<{ talent: any; rank: number }>>([]);

    const getSkillValue = (character: Character, skillId: string): number => {
        const skill = character.skills.find(s => s.id === skillId);
        if (!skill) {
            const char = character.characteristics[skillId as keyof typeof character.characteristics];
            return calculateCharacteristicValue(char);
        }

        return calculateSkillValue(skill, character);
    };

    useEffect(() => {
        if (selectedAttackerId === 'manual') {
            setAttackerApplicableTalents([]);
            return;
        }

        const attacker = characters.find(char => char.id === selectedAttackerId);
        if (attacker) {
            const strengthBonus = calculateCharacteristicBonus(attacker.characteristics.s);
            const skillInfo = attacker.skills.find(s => s.id === attackerSkillId);

            console.log("Attacker Skill Info:", skillInfo);
            const applicableTalents = skillInfo ? getApplicableTalents(attacker, skillInfo.id, talents) : [];
            setAttackerApplicableTalents(applicableTalents);

            // Auto-select SL bonus talents
            const autoSelectedTalents = applicableTalents
                .filter(({ talent }) => talent.effects?.some((e: any) => e.type === 'SL_BONUS_ON_SUCCESS'))
                .map(({ talent, rank }) => ({ name: talent.name, rank }));

            const talentDamageBonus = getTalentDamageBonus(autoSelectedTalents, attackerSkillId, talents);

            setAttackerStats(prevStats => ({
                ...prevStats,
                skill: getSkillValue(attacker, attackerSkillId),
                weaponDamage: 4 + strengthBonus + talentDamageBonus,
                selectedTalents: autoSelectedTalents,
            }));
        }
    }, [selectedAttackerId, attackerSkillId, characters]);

    useEffect(() => {
        if (selectedDefenderId === 'manual') {
            setDefenderApplicableTalents([]);
            return;
        }

        const defender = characters.find(char => char.id === selectedDefenderId);
        if (defender) {
            const toughnessBonus = calculateCharacteristicBonus(defender.characteristics.t);
            const skillInfo = skills.find(s => s.id === defenderSkillId);

            // Get applicable talents for the selected skill
            const applicableTalents = skillInfo ? getApplicableTalents(defender, skillInfo.id, talents) : [];
            setDefenderApplicableTalents(applicableTalents);

            // Auto-select SL bonus talents
            const autoSelectedTalents = applicableTalents
                .filter(({ talent }) => talent.effects?.some((e: any) => e.type === 'SL_BONUS_ON_SUCCESS'))
                .map(({ talent, rank }) => ({ name: talent.name, rank }));

            setDefenderStats(prevStats => ({
                ...prevStats,
                skill: getSkillValue(defender, defenderSkillId),
                toughnessBonus: toughnessBonus,
                armourPoints: 0, // TODO - derive from equipment
                selectedTalents: autoSelectedTalents,
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
            let attackerSL = Math.round(opposedTestState.attackerSL);
            let defenderSL = Math.round(opposedTestState.defenderSL);

            // Apply talent SL bonuses
            if (attackerStats.selectedTalents && attackerStats.selectedTalents.length > 0 && attackerSL >= 0) {
                const attacker = characters.find(c => c.id === selectedAttackerId);
                attackerSL = applyTalentSLBonuses(attackerSL, attackerStats.selectedTalents, talents, attacker);
            }

            if (defenderStats.selectedTalents && defenderStats.selectedTalents.length > 0 && defenderSL >= 0) {
                const defender = characters.find(c => c.id === selectedDefenderId);
                defenderSL = applyTalentSLBonuses(defenderSL, defenderStats.selectedTalents, talents, defender);
            }

            // Check for criticals and fumbles
            const attackerCriticalCheck = checkCriticalResult(opposedTestState.attackerRoll!, opposedTestState.attackerTarget);
            const defenderCriticalCheck = checkCriticalResult(opposedTestState.defenderRoll!, opposedTestState.defenderTarget);

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
                hitLocation,
                attackerCritical: attackerCriticalCheck.isCritical,
                attackerFumble: attackerCriticalCheck.isFumble,
                attackerCritRoll: attackerCriticalCheck.critRoll,
                defenderCritical: defenderCriticalCheck.isCritical,
                defenderFumble: defenderCriticalCheck.isFumble,
                defenderCritRoll: defenderCriticalCheck.critRoll,
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

        let attackSuccessLevel = calculateSuccessLevel(attackRoll, attackerTarget);
        let defenseSuccessLevel = calculateSuccessLevel(defenseRoll, defenderTarget);

        // Apply talent SL bonuses
        if (attackerStats.selectedTalents && attackerStats.selectedTalents.length > 0 && attackSuccessLevel >= 0) {
            const attacker = characters.find(c => c.id === selectedAttackerId);
            attackSuccessLevel = applyTalentSLBonuses(attackSuccessLevel, attackerStats.selectedTalents, talents, attacker);
        }

        if (defenderStats.selectedTalents && defenderStats.selectedTalents.length > 0 && defenseSuccessLevel >= 0) {
            const defender = characters.find(c => c.id === selectedDefenderId);
            defenseSuccessLevel = applyTalentSLBonuses(defenseSuccessLevel, defenderStats.selectedTalents, talents, defender);
        }

        // Check for criticals and fumbles
        const attackerCriticalCheck = checkCriticalResult(attackRoll, attackerTarget);
        const defenderCriticalCheck = checkCriticalResult(defenseRoll, defenderTarget);

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

            // Log talent usage
            if (attackerStats.selectedTalents && attackerStats.selectedTalents.length > 0) {
                const talentString = attackerStats.selectedTalents.map(t => `${t.name} (Rank ${t.rank})`).join(', ');
                onLogEntry('info', `Attacker used talents: ${talentString}`);
            }
        }
        else if (attackSuccessLevel < defenseSuccessLevel || (attackSuccessLevel === defenseSuccessLevel && attackerStats.skill < defenderStats.skill)) {
            outcomeMessage = `Defender wins by ${Math.round(defenseSuccessLevel) - Math.round(attackSuccessLevel)}!`;

            // Log talent usage
            if (defenderStats.selectedTalents && defenderStats.selectedTalents.length > 0) {
                const talentString = defenderStats.selectedTalents.map(t => `${t.name} (Rank ${t.rank})`).join(', ');
                onLogEntry('info', `Defender used talents: ${talentString}`);
            }
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
            hitLocation,
            attackerCritical: attackerCriticalCheck.isCritical,
            attackerFumble: attackerCriticalCheck.isFumble,
            attackerCritRoll: attackerCriticalCheck.critRoll,
            defenderCritical: defenderCriticalCheck.isCritical,
            defenderFumble: defenderCriticalCheck.isFumble,
            defenderCritRoll: defenderCriticalCheck.critRoll,
        });
    };

    const handleRequestPlayerRolls = () => {
        const testId = crypto.randomUUID();
        const attacker = characters.find(c => c.id === selectedAttackerId);
        const defender = characters.find(c => c.id === selectedDefenderId);

        if (!attacker || !defender) {
            alert('Please select valid attacker and defender characters.');
            return;
        }

        const attackerSkillInfo = attacker.skills.find(s => s.id === attackerSkillId);
        const defenderSkillInfo = defender.skills.find(s => s.id === defenderSkillId);

        if (!attackerSkillInfo || !defenderSkillInfo) {
            alert('Invalid skill selection.');
            return;
        }

        // Check if attacker and defender are connected players
        const attackerIsPlayer = selectedAttackerId !== 'manual' && characters.some(c => c.id === selectedAttackerId && c.userId != null);
        const defenderIsPlayer = selectedDefenderId !== 'manual' && characters.some(c => c.id === selectedDefenderId && c.userId != null);

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

        // Grant advantage to attacker if they won (dealt damage)
        if (result.damageDealt > 0) {
            const attackerPlayer = characters.find(c => c.id === selectedAttackerId);
            if (attackerPlayer) {
                const team = attackerPlayer.userId != null ? 'players' : 'enemies';
                onUpdateAdvantage(team, 1);
                onLogEntry('system', `Team ${team} gains +1 Advantage`);
            }
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
                    onCharacterSelect={(id) => {setSelectedAttackerId(id); setAttackerSkillId('melee');}}
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
                                    {skills.filter(s => s.type === 'characteristic').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </optgroup>
                                <optgroup label="Skills">
                                    {characters.find(c => c.id === selectedAttackerId) && characters.find(c => c.id === selectedAttackerId)!.skills.sort((a, b) => a.name.localeCompare(b.name)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
                {attackerApplicableTalents.length > 0 && (
                    <div className={styles.talentSection}>
                        <label className={styles.talentLabel}>Applicable Talents</label>
                        {attackerApplicableTalents.map(({ talent, rank }) => {
                            const isSelected = attackerStats.selectedTalents?.some(t => t.name === talent.name) || false;
                            const slBonus = talent.effects?.find((e: any) => e.type === 'SL_BONUS_ON_SUCCESS');
                            return (
                                <label key={talent.id} className={styles.talentCheckbox}>
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                const newTalents = [...(attackerStats.selectedTalents || []), { name: talent.name, rank }];
                                                setAttackerStats(prev => ({
                                                    ...prev,
                                                    selectedTalents: newTalents
                                                }));
                                                const weaponDamage = getTalentDamageBonus(newTalents, attackerSkillId, talents);
                                                setAttackerStats(prev => ({
                                                    ...prev,
                                                    weaponDamage: 4 + calculateCharacteristicBonus(characters.find(c => c.id === selectedAttackerId)!.characteristics.s) + weaponDamage,
                                                }));
                                            } else {
                                                const newTalents = attackerStats.selectedTalents?.filter(t => t.name !== talent.name) || [];
                                                setAttackerStats(prev => ({
                                                    ...prev,
                                                    selectedTalents: newTalents
                                                }));
                                                const weaponDamage = getTalentDamageBonus(newTalents, attackerSkillId, talents);
                                                setAttackerStats(prev => ({
                                                    ...prev,
                                                    weaponDamage: 4 + calculateCharacteristicBonus(characters.find(c => c.id === selectedAttackerId)!.characteristics.s) + weaponDamage,
                                                }));
                                            }
                                        }}
                                    />
                                    <span className={styles.talentName}>
                                        {talent.name} (Rank {rank})
                                        {slBonus && <span className={styles.talentBonus}> +{slBonus.value * rank} SL</span>}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                )}
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
                    onCharacterSelect={(id) => {setSelectedDefenderId(id); setDefenderSkillId('melee');}}
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
                                    {skills.filter(s => s.type === 'characteristic').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </optgroup>
                                <optgroup label="Skills">
                                    {characters.find(c => c.id === selectedDefenderId) && characters.find(c => c.id === selectedDefenderId)!.skills.sort((a, b) => a.name.localeCompare(b.name)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
                {defenderApplicableTalents.length > 0 && (
                    <div className={styles.talentSection}>
                        <label className={styles.talentLabel}>Applicable Talents</label>
                        {defenderApplicableTalents.map(({ talent, rank }) => {
                            const isSelected = defenderStats.selectedTalents?.some(t => t.name === talent.name) || false;
                            const slBonus = talent.effects?.find((e: any) => e.type === 'SL_BONUS_ON_SUCCESS');
                            return (
                                <label key={talent.id} className={styles.talentCheckbox}>
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setDefenderStats(prev => ({
                                                    ...prev,
                                                    selectedTalents: [...(prev.selectedTalents || []), { name: talent.name, rank }]
                                                }));
                                            } else {
                                                setDefenderStats(prev => ({
                                                    ...prev,
                                                    selectedTalents: prev.selectedTalents?.filter(t => t.name !== talent.name) || []
                                                }));
                                            }
                                        }}
                                    />
                                    <span className={styles.talentName}>
                                        {talent.name} (Rank {rank})
                                        {slBonus && <span className={styles.talentBonus}> +{slBonus.value * rank} SL</span>}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                )}
            </div>

            {result && (
                <div className={styles.resultPanel}>
                    <div className={styles.resultSection}>
                        <h4>Rolls</h4>
                        <p>
                            Attacker rolled: <span className={styles.rollValue}>{result.attackRoll}</span>
                            {result.attackerCritical && <span className={styles.criticalBadge}>CRITICAL!</span>}
                            {result.attackerFumble && <span className={styles.fumbleBadge}>FUMBLE!</span>}
                        </p>
                        <p>
                            Defender rolled: <span className={styles.rollValue}>{result.defenseRoll}</span>
                            {result.defenderCritical && <span className={styles.criticalBadge}>CRITICAL!</span>}
                            {result.defenderFumble && <span className={styles.fumbleBadge}>FUMBLE!</span>}
                        </p>
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
                    {(result.attackerCritical || result.attackerFumble || result.defenderCritical || result.defenderFumble) && (
                        <div className={styles.criticalSection}>
                            <h4>Critical/Fumble Results</h4>
                            {result.attackerCritical && result.hitLocation && result.damageDealt !== undefined && (
                                <button
                                    className={styles.criticalButton}
                                    onClick={() => setShowCriticalModal({ location: result.hitLocation!, wounds: result.damageDealt! })}
                                >
                                    🎯 View Attacker Critical Hit
                                </button>
                            )}
                            {result.attackerFumble && (
                                <button
                                    className={styles.fumbleButton}
                                    onClick={() => setShowFumbleModal(result.attackerCritRoll || -1)}
                                >
                                    💀 View Attacker Fumble
                                </button>
                            )}
                            {result.defenderCritical && (
                                <button
                                    className={styles.criticalButton}
                                    onClick={() => {
                                        // For defender critical, just show a placeholder or narrative element
                                        alert('Defender rolled a critical! They have dramatically succeeded in their defense.');
                                    }}
                                >
                                    🛡️ View Defender Critical
                                </button>
                            )}
                            {result.defenderFumble && (
                                <button
                                    className={styles.fumbleButton}
                                    onClick={() => setShowFumbleModal(result.defenderCritRoll || -1)}
                                >
                                    💀 View Defender Fumble
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Critical Hit Modal */}
            {showCriticalModal && (
                <CriticalHitModal
                    location={showCriticalModal.location}
                    wounds={showCriticalModal.wounds}
                    onClose={() => setShowCriticalModal(null)}
                    onApplyEffects={(effects) => {
                        onLogEntry('system', `Applied critical hit effects: ${effects.join(', ')}`);
                        setShowCriticalModal(null);
                    }}
                />
            )}

            {/* Fumble Modal */}
            {showFumbleModal !== null && (
                <FumbleModal
                    fumbleRoll={showFumbleModal}
                    onClose={() => setShowFumbleModal(null)}
                    onApplyEffect={(effect) => {
                        onLogEntry('system', `Applied fumble effect: ${effect}`);
                        setShowFumbleModal(null);
                    }}
                />
            )}
        </div>
    )
};

export default CombatResolver;