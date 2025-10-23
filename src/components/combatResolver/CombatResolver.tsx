import React, { useState, useEffect } from 'react';
import styles from './CombatResolver.module.css';
import { rolld100, calculateSuccessLevel, getHitLocation } from '../../utils/mechanics';

import allSkillsAndCharacteristics from '../../data/skillsAndCharacteristics.json';

import { Character, SkillCharDefinition } from '@/type/wfrp.types';
import { calculateSkillValue, calculateCharacteristicBonus, calculateCharacteristicValue } from '../../utils/skills';
import CharacterSelector from './CharacterSelector';

interface CombatResolverProps {
    characters: Character[];
}

interface CombatResult {
    attackRoll: number;
    defenseRoll: number;
    attackSuccessLevel: string;
    defenseSuccessLevel: string;
    outcomeMessage: string;
}


interface CombatantStats {
    skill: number;
    modifier: number;
    weaponDamage: number;
    toughnessBonus: number;
    armourPoints: number;
}

const CombatResolver: React.FC<CombatResolverProps> = ({ characters }) => {
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

        if (attackSuccessLevel > defenseSuccessLevel || (attackSuccessLevel === defenseSuccessLevel && attackerStats.skill > defenderStats.skill)) {
            const slDiff = Math.round(attackSuccessLevel) - Math.round(defenseSuccessLevel);
            const damage = attackerStats.weaponDamage + slDiff -
                (defenderStats.toughnessBonus + defenderStats.armourPoints);
            const hitLocation = getHitLocation(attackRoll);
            outcomeMessage = `Attacker wins by ${slDiff} ! Damage Dealt: ${damage > 0 ? damage : 0} to ${hitLocation}.`;
        }
        else if (attackSuccessLevel < defenseSuccessLevel || (attackSuccessLevel === defenseSuccessLevel && attackerStats.skill < defenderStats.skill)) {
            outcomeMessage = `Defender wins by ${Math.round(defenseSuccessLevel) - Math.round(attackSuccessLevel)} !`;
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
            outcomeMessage
        });
    };

    return (
        <div className={styles.resolverContainer}>
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
                    FIGHT!
                </button>
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
                    </div>
                </div>
            )}
        </div>
    );

}

export default CombatResolver;