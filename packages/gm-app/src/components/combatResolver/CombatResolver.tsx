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
    Weapon,
    Talent,
    QueuedRoll,
    normalizeArmorLocations,
} from '@wfrp/shared';

import CharacterSelector from './CharacterSelector';
import { RollQueueCard } from './RollQueueCard';
import { CombatantSlot } from './CombatantSlot';
import { useCombatContext } from '../../context/CombatContext';

interface CombatResolverProps {
    characters: Character[];
    opposedTestResults: Map<string, OpposedTestResultMessage['payload']>;
    rollQueue: QueuedRoll[];
    onRemoveFromQueue: (rollId: string) => void;
    onClearOpposedTestResult: (testId: string, role: 'attacker' | 'defender') => void;
    onSendToPlayer: (charId: string, message: RequestOpposedTestMessage | AssignCharacterMessage) => void;
    onLogEntry: (type: LogEntry['type'], content: string) => void;
    onUpdateCharacter: (character: Character) => void;
    onClose: () => void;
}

interface AssignedRoll {
    characterId: string;
    characterName: string;
    skillId: string;
    skillName: string;
    rollResult: number;
    targetNumber: number;
    successLevel: number;
    weaponName?: string;
    weaponDamage?: number;
    usedTalents?: { name: string; rank: number }[];
    isNpc?: boolean;
}

interface CombatResult {
    attackRoll: number;
    defenseRoll: number;
    attackSuccessLevel: string;
    defenseSuccessLevel: string;
    outcomeMessage: string;
    rawDamage?: number;
    damageDealt?: number;
    hitLocation?: string;
    attackerCritical?: boolean;
    attackerFumble?: boolean;
    attackerCritRoll?: number;
    defenderCritical?: boolean;
    defenderFumble?: boolean;
    defenderCritRoll?: number;
    attackerName?: string;
    defenderName?: string;
}

const CombatResolver: React.FC<CombatResolverProps> = ({
    characters,
    opposedTestResults,
    rollQueue,
    onRemoveFromQueue,
    onClearOpposedTestResult,
    onSendToPlayer,
    onLogEntry,
    onUpdateCharacter,
    onClose
}) => {
    const { combatState, updateCombatant, updateAdvantage } = useCombatContext();
    const { combatants, advantage } = combatState;
    const { skills, weapons: weaponsData, talents, armor: armorData } = useGameData();

    // State for assigned rolls (async mode)
    const [attackerRoll, setAttackerRoll] = useState<AssignedRoll | null>(null);
    const [defenderRoll, setDefenderRoll] = useState<AssignedRoll | null>(null);

    // SL fudge adjustments
    const [attackerFudge, setAttackerFudge] = useState<number>(0);
    const [defenderFudge, setDefenderFudge] = useState<number>(0);

    // Applicable talents for NPC rolls (computed after roll, togglable by GM)
    const [attackerApplicableTalents, setAttackerApplicableTalents] = useState<Array<{ talent: Talent; rank: number }>>([]);
    const [defenderApplicableTalents, setDefenderApplicableTalents] = useState<Array<{ talent: Talent; rank: number }>>([]);

    // Toggle between combat (with damage) and skill (SL comparison only)
    const [isCombatMode, setIsCombatMode] = useState(true);

    // Combat result
    const [result, setResult] = useState<CombatResult | null>(null);

    // State for critical/fumble modals
    const [showCriticalModal, setShowCriticalModal] = useState<{ location: string; wounds: number } | null>(null);
    const [showFumbleModal, setShowFumbleModal] = useState<number | null>(null);

    // Calculate armour points for a character at a specific location
    const getArmourPoints = (character: Character, location: string): number => {
        let totalAP = 0;
        const armorById: Record<string, typeof armorData[0]> = Object.fromEntries((armorData as any[]).map(a => [a.id, a]));
        Object.entries(character.inventory?.equippedArmor || {}).forEach(([armorId, equipped]) => {
            if (!equipped) return;
            const armor = armorById[armorId];
            if (!armor) return;

            const loc = normalizeArmorLocations([location])[0];
            const armorLocs = normalizeArmorLocations(armor.locations);

            if (armorLocs.some((l: string) => l.includes(loc) || loc.includes(l))) {
                totalAP += armor.ap;
            }
        });

        return totalAP;
    };

    // Assign a roll from the queue to attacker
    const handleAssignAttacker = (roll: QueuedRoll) => {
        setAttackerRoll({
            characterId: roll.characterId,
            characterName: roll.characterName,
            skillId: roll.skillId,
            skillName: roll.skillName,
            rollResult: roll.rollResult,
            targetNumber: roll.targetNumber,
            successLevel: roll.successLevel,
            weaponName: roll.weaponName,
            weaponDamage: roll.weaponDamage,
            usedTalents: roll.usedTalents,
            isNpc: false,
        });
        onRemoveFromQueue(roll.id);
    };

    // Assign a roll from the queue to defender
    const handleAssignDefender = (roll: QueuedRoll) => {
        setDefenderRoll({
            characterId: roll.characterId,
            characterName: roll.characterName,
            skillId: roll.skillId,
            skillName: roll.skillName,
            rollResult: roll.rollResult,
            targetNumber: roll.targetNumber,
            successLevel: roll.successLevel,
            weaponName: roll.weaponName,
            weaponDamage: roll.weaponDamage,
            usedTalents: roll.usedTalents,
            isNpc: false,
        });
        onRemoveFromQueue(roll.id);
    };

    // Handle NPC roll for a slot
    const handleNpcRoll = (role: 'attacker' | 'defender', characterId: string, skillId: string, weaponId?: string) => {
        const character = characters.find(c => c.id === characterId);
        if (!character) return;

        // Get skill value
        let skillValue: number;
        let skillName: string;
        const skill = character.skills.find(s => s.id === skillId);
        if (skill) {
            skillValue = calculateSkillValue(skill, character);
            skillName = skill.name;
        } else {
            // Fallback to characteristic
            const charKey = skillId as keyof Character['characteristics'];
            if (character.characteristics[charKey]) {
                skillValue = calculateCharacteristicValue(character.characteristics[charKey]);
                skillName = skillId.toUpperCase();
            } else {
                skillValue = 30; // Default fallback
                skillName = skillId;
            }
        }

        // Roll
        const roll = rolld100();
        const sl = calculateSuccessLevel(roll, skillValue);

        // Get weapon info if attacking
        let weaponDamage = 0;
        let weaponName: string | undefined;
        if (role === 'attacker') {
            const weaponById = Object.fromEntries((weaponsData as Weapon[]).map(w => [w.id, w]));
            const equippedWeaponIds = Object.entries(character.inventory?.weapons || {})
                .filter(([id, count]) => count > 0 && (weaponById[id].group.includes(skillId) || skillId.includes(weaponById[id].group)))
                .map(([id]) => id);

            if (equippedWeaponIds.length > 0) {
                const weapon = weaponById[equippedWeaponIds[0]];
                if (weapon) {
                    weaponName = weapon.name;
                    // Parse damage
                    const damage = weapon.damage;
                    if (damage?.includes('SB')) {
                        const sb = calculateCharacteristicBonus(character.characteristics.s);
                        const match = damage.match(/SB([+-]?\d+)?/);
                        if (match) {
                            const modifier = match[1] ? parseInt(match[1]) : 0;
                            weaponDamage = sb + modifier;
                        }
                    } else {
                        weaponDamage = parseInt(damage || '0') || 0;
                    }
                }
            } else {
                // Unarmed
                weaponDamage = calculateCharacteristicBonus(character.characteristics.s);
                weaponName = 'Unarmed';
            }
        }

        const assignedRoll: AssignedRoll = {
            characterId: character.id,
            characterName: character.name,
            skillId,
            skillName,
            rollResult: roll,
            targetNumber: skillValue,
            successLevel: sl,
            weaponName,
            weaponDamage,
            isNpc: true,
        };

        // Compute applicable talents for NPC
        const applicable = getApplicableTalents(character, skillId, talents);

        if (role === 'attacker') {
            setAttackerRoll(assignedRoll);
            setAttackerApplicableTalents(applicable);
        } else {
            setDefenderRoll(assignedRoll);
            setDefenderApplicableTalents(applicable);
        }

        const slSign = sl >= 0 ? '+' : '';
        onLogEntry('roll', `${character.name} (NPC) ${skillName}: Rolled ${roll} vs ${skillValue}. SL: ${slSign}${Math.round(sl)}`);
    };

    // Auto-calculate result when both slots are filled
    useEffect(() => {
        if (!attackerRoll || !defenderRoll) return;

        const attackerSL = Math.round(attackerRoll.successLevel);
        const defenderSL = Math.round(defenderRoll.successLevel);

        // Check for criticals and fumbles
        const attackerCriticalCheck = checkCriticalResult(attackerRoll.rollResult, attackerRoll.targetNumber);
        const defenderCriticalCheck = checkCriticalResult(defenderRoll.rollResult, defenderRoll.targetNumber);

        let outcomeMessage = '';
        let damageDealt: number | undefined;
        let rawDamage: number = 0;
        let hitLocation: string | undefined;

        if (attackerSL > defenderSL || (attackerSL === defenderSL && attackerRoll.targetNumber > defenderRoll.targetNumber)) {
            const slDiff = attackerSL - defenderSL;

            if (isCombatMode) {
                const talentDamageBonus = getTalentDamageBonus(
                    attackerRoll.usedTalents || [],
                    attackerRoll.skillId,
                    talents
                );

                // Get defender's toughness bonus and armor
                const defender = characters.find(c => c.id === defenderRoll.characterId);
                const toughnessBonus = defender ? calculateCharacteristicBonus(defender.characteristics.t) : 0;
                hitLocation = getHitLocation(attackerRoll.rollResult);
                const armourPoints = defender ? getArmourPoints(defender, hitLocation) : 0;

                const damage = (attackerRoll.weaponDamage || 0) + slDiff + talentDamageBonus - toughnessBonus - armourPoints;
                damageDealt = Math.max(damage, 0);
                rawDamage = (attackerRoll.weaponDamage || 0) + slDiff + talentDamageBonus;
                outcomeMessage = `${attackerRoll.characterName} wins by ${slDiff} SL! Damage: ${damageDealt} to ${hitLocation}.`;
            } else {
                outcomeMessage = `${attackerRoll.characterName} wins by ${slDiff} SL!`;
            }
        } else if (attackerSL < defenderSL || (attackerSL === defenderSL && attackerRoll.targetNumber < defenderRoll.targetNumber)) {
            const slDiff = defenderSL - attackerSL;
            outcomeMessage = `${defenderRoll.characterName} wins by ${slDiff} SL!`;
        } else {
            outcomeMessage = 'Result is a tie! (Re-roll or narrative resolution)';
        }

        const roundedAttackSL = attackerSL >= 0 ? `+${attackerSL}` : `${attackerSL}`;
        const roundedDefenseSL = defenderSL >= 0 ? `+${defenderSL}` : `${defenderSL}`;

        setResult({
            attackRoll: attackerRoll.rollResult,
            defenseRoll: defenderRoll.rollResult,
            attackSuccessLevel: roundedAttackSL,
            defenseSuccessLevel: roundedDefenseSL,
            outcomeMessage,
            rawDamage: rawDamage,
            damageDealt,
            hitLocation,
            attackerCritical: attackerCriticalCheck.isCritical,
            attackerFumble: attackerCriticalCheck.isFumble,
            attackerCritRoll: attackerCriticalCheck.critRoll,
            defenderCritical: defenderCriticalCheck.isCritical,
            defenderFumble: defenderCriticalCheck.isFumble,
            defenderCritRoll: defenderCriticalCheck.critRoll,
            attackerName: attackerRoll.characterName,
            defenderName: defenderRoll.characterName,
        });

        onLogEntry('info', outcomeMessage);
    }, [attackerRoll, defenderRoll, isCombatMode]);

    // When fudge change, recalculate result relevant rolls
    useEffect(() => {
        if (!attackerRoll && !defenderRoll) return;
        
        for (const role of ['attacker', 'defender'] as const) {   
            const roll = role === 'attacker' ? attackerRoll : defenderRoll; 
            if (!roll) continue;

            const currentTalents = roll.usedTalents || [];            

            // Recalculate SL: start from the base roll SL (before any talent bonuses)
            const character = characters.find(c => c.id === roll.characterId);
            const fudgedRoll = role === 'attacker' ? roll.rollResult - attackerFudge : roll.rollResult - defenderFudge;
            const SL = calculateSuccessLevel(fudgedRoll, roll.targetNumber);
            const newSL = applyTalentSLBonuses(SL, currentTalents, talents, character);

            const updatedRoll: AssignedRoll = {
                ...roll,
                successLevel: newSL
            };

            if (role === 'attacker') {
                setAttackerRoll(updatedRoll);
            } else {
                setDefenderRoll(updatedRoll);
            }
        }
    }, [attackerFudge, defenderFudge]);


    const handleApplyDamage = () => {
        if (!result || !defenderRoll || result.damageDealt === undefined) {
            onLogEntry('system', 'Result accepted (no damage)');
            handleDiscardResult();
            return;
        }

        // Apply damage to defender
        const defenderCombatant = combatants.find(c => c.sourceId === defenderRoll.characterId);
        if (defenderCombatant) {
            const newWounds = Math.max(0, defenderCombatant.currentWounds - result.damageDealt);
            const updatedCombatant: Combatant = {
                ...defenderCombatant,
                currentWounds: newWounds
            };
            updateCombatant(updatedCombatant);

            // If defender is a character, update their wounds too
            const defenderCharacter = characters.find(c => c.id === defenderRoll.characterId);
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
                if (defenderCombatant.isPlayer && defenderCharacter.userId) {
                    const message: AssignCharacterMessage = {
                        type: 'ASSIGN_CHARACTER',
                        payload: { character: updatedCharacter }
                    };
                    onSendToPlayer(defenderRoll.characterId, message);
                }
            }

            const fudgeNote = (attackerFudge !== 0 || defenderFudge !== 0)
                ? ` [GM adjusted: ATK SL ${attackerFudge >= 0 ? '+' : ''}${attackerFudge}, DEF SL ${defenderFudge >= 0 ? '+' : ''}${defenderFudge}]`
                : '';
            onLogEntry('system', `${result.damageDealt} damage applied to ${defenderRoll.characterName} (${newWounds} wounds remaining)${fudgeNote}`);
        }

        // Grant advantage to attacker if they won (dealt damage)
        if (result.damageDealt > 0 && attackerRoll) {
            const attackerPlayer = characters.find(c => c.id === attackerRoll.characterId);
            if (attackerPlayer) {
                const team = attackerPlayer.userId != null ? 'players' : 'enemies';
                const next = team === 'players'
                    ? { ...advantage, playerAdvantage: advantage.playerAdvantage + 1 }
                    : { ...advantage, enemyAdvantage: advantage.enemyAdvantage + 1 };
                updateAdvantage(next);
                onLogEntry('system', `Team ${team} gains +1 Advantage`);
            }
        }

        handleDiscardResult();
    };

    // Handle NPC talent toggle: recalculate SL with selected talents
    const handleToggleNpcTalent = (role: 'attacker' | 'defender', talentName: string, rank: number) => {
        const roll = role === 'attacker' ? attackerRoll : defenderRoll;
        if (!roll || !roll.isNpc) return;

        const currentTalents = roll.usedTalents || [];
        const isAlreadyUsed = currentTalents.some(t => t.name === talentName);

        let newUsedTalents: { name: string; rank: number }[];
        if (isAlreadyUsed) {
            newUsedTalents = currentTalents.filter(t => t.name !== talentName);
        } else {
            newUsedTalents = [...currentTalents, { name: talentName, rank }];
        }

        // Recalculate SL: start from the base roll SL (before any talent bonuses)
        const character = characters.find(c => c.id === roll.characterId);
        const fudgedRoll = role === 'attacker' ? roll.rollResult - attackerFudge : roll.rollResult - defenderFudge;
        const baseSL = calculateSuccessLevel(fudgedRoll, roll.targetNumber);
        const newSL = applyTalentSLBonuses(baseSL, newUsedTalents, talents, character);

        const updatedRoll: AssignedRoll = {
            ...roll,
            successLevel: newSL,
            usedTalents: newUsedTalents,
        };

        if (role === 'attacker') {
            setAttackerRoll(updatedRoll);
        } else {
            setDefenderRoll(updatedRoll);
        }
    };

    const handleDiscardResult = () => {
        setResult(null);
        setAttackerRoll(null);
        setDefenderRoll(null);
        setAttackerFudge(0);
        setDefenderFudge(0);
        setAttackerApplicableTalents([]);
        setDefenderApplicableTalents([]);
    };

    return (
        <div className={styles.resolverContainer}>
            <button className={styles.closeButton} onClick={onClose}>×</button>

            <div className={styles.headerBar}>
                <h2>Opposed Test Resolver</h2>
                <label className={styles.modeToggle}>
                    <input
                        type="checkbox"
                        checked={isCombatMode}
                        onChange={(e) => setIsCombatMode(e.target.checked)}
                    />
                    <span className={styles.toggleSlider}></span>
                    <span className={styles.modeLabel}>{isCombatMode ? '⚔️ Combat Mode' : '🎲 Skill Mode'}</span>
                </label>
            </div>

            {/* Main Content: Attacker vs Defender */}
            <div className={styles.slotsContainer}>
                <CombatantSlot
                    role="attacker"
                    assignedRoll={attackerRoll}
                    characters={characters}
                    combatants={combatants}
                    fudge={attackerFudge}
                    applicableTalents={attackerApplicableTalents}
                    onClear={() => { setAttackerRoll(null); setAttackerFudge(0); setAttackerApplicableTalents([]); }}
                    onNpcRoll={(charId, skillId, weaponId) => handleNpcRoll('attacker', charId, skillId, weaponId)}
                    onChangeFudge={setAttackerFudge}
                    onToggleNpcTalent={(talentName, rank) => handleToggleNpcTalent('attacker', talentName, rank)}
                />

                <div className={styles.vsLabel}>VS</div>

                <CombatantSlot
                    role="defender"
                    assignedRoll={defenderRoll}
                    characters={characters}
                    combatants={combatants}
                    fudge={defenderFudge}
                    applicableTalents={defenderApplicableTalents}
                    onClear={() => { setDefenderRoll(null); setDefenderFudge(0); setDefenderApplicableTalents([]); }}
                    onNpcRoll={(charId, skillId, weaponId) => handleNpcRoll('defender', charId, skillId, weaponId)}
                    onChangeFudge={setDefenderFudge}
                    onToggleNpcTalent={(talentName, rank) => handleToggleNpcTalent('defender', talentName, rank)}
                />
            </div>

            {/* Result Panel */}
            {result && (
                <div className={styles.resultDisplay}>
                    <h3>Result</h3>
                    <div className={styles.resultDetails}>
                        <div className={styles.resultSummary}>
                            <span className={styles.attName}>{result.attackerName}</span>
                            <span className={styles.slCompare}>{result.attackSuccessLevel} vs {result.defenseSuccessLevel}</span>
                            <span className={styles.defName}>{result.defenderName}</span>
                        </div>
                        <p className={styles.outcomeMessage}>{result.outcomeMessage}</p>
                        {result.hitLocation && result.defenderName && (
                            <p className={styles.hitLocation}>Hit Location: {result.hitLocation}. Raw Damage: {result.rawDamage}. <br />
                            Armour Points at Location: {getArmourPoints(characters.find(c => c.name === result.defenderName)!, result.hitLocation)}. Toughness Bonus : {calculateCharacteristicBonus(characters.find(c => c.name === result.defenderName)!.characteristics.t)} </p>
                        )}
                    </div>
                    {(result.attackerCritical || result.attackerFumble || result.defenderCritical || result.defenderFumble) && (
                        <div className={styles.criticalSection}>
                            {result.attackerCritical && (
                                <button className={styles.criticalButton} onClick={() => result.hitLocation && result.damageDealt !== undefined && setShowCriticalModal({ location: result.hitLocation, wounds: result.damageDealt })}>
                                    🎯 Attacker Critical!
                                </button>
                            )}
                            {result.attackerFumble && (
                                <button className={styles.fumbleBadge} onClick={() => setShowFumbleModal(result.attackerCritRoll || -1)}>
                                    💀 Attacker Fumble!
                                </button>
                            )}
                            {result.defenderCritical && (
                                <span className={styles.criticalBadge}>🛡️ Defender Critical!</span>
                            )}
                            {result.defenderFumble && (
                                <button className={styles.fumbleBadge} onClick={() => setShowFumbleModal(result.defenderCritRoll || -1)}>
                                    💀 Defender Fumble!
                                </button>
                            )}
                        </div>
                    )}
                    <div className={styles.resultActions}>
                        {isCombatMode && result.damageDealt !== undefined && (
                            <button className={styles.applyButton} onClick={handleApplyDamage}>
                                ✓ Apply Damage ({result.damageDealt})
                            </button>
                        )}
                        <button className={styles.discardButton} onClick={handleDiscardResult}>
                            ✗ Discard Result
                        </button>
                    </div>
                </div>
            )}

            {/* Roll Queue */}
            <div className={styles.rollQueueSection}>
                <h3 className={styles.queueTitle}>
                    Incoming Rolls
                    {rollQueue.length > 0 && <span className={styles.queueCount}>({rollQueue.length})</span>}
                </h3>
                {rollQueue.length === 0 ? (
                    <p className={styles.emptyQueue}>No player rolls in queue. Waiting for player actions...</p>
                ) : (
                    <div className={styles.rollQueueList}>
                        {rollQueue.map(roll => (
                            <RollQueueCard
                                key={roll.id}
                                roll={roll}
                                onAssignAttacker={() => handleAssignAttacker(roll)}
                                onAssignDefender={() => handleAssignDefender(roll)}
                                onDismiss={() => onRemoveFromQueue(roll.id)}
                            />
                        ))}
                    </div>
                )}
            </div>

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
    );
};

export default CombatResolver;