import React from 'react';
import {
    Character,
    Armor,
    Weapon,
    useGameData,
    EditableField,
    calculateCharacteristicValue,
    calculateSkillValue,
    QualityTooltip,
    calculateCharacteristicBonus,
    getTalentDamageBonus
} from '@wfrp/shared';
import './CombatTab.css';

interface CombatTabProps {
    character: Character;
    isEditMode: boolean;
    onCharacterUpdate: (updates: Partial<Character>) => void;
    onWeaponRoll?: (weapon: Weapon, skillId: string, skillName: string, skillValue: number, weaponDamage: number) => void;
    onDefendRoll?: (skillId: string, skillName: string, skillValue: number) => void;
}

interface ArmourPoints {
    head: number;
    body: number;
    leftArm: number;
    rightArm: number;
    leftLeg: number;
    rightLeg: number;
}

export const CombatTab: React.FC<CombatTabProps> = ({
    character,
    isEditMode,
    onCharacterUpdate,
    onWeaponRoll,
    onDefendRoll
}) => {
    const { weapons: weaponsData, armor: armorData, conditions: conditionsData, skills: skillsData } = useGameData();

    // Calculate armour points per location from equipped armor only
    const calculateArmourPoints = (): ArmourPoints => {
        const ap: ArmourPoints = {
            head: 0,
            body: 0,
            leftArm: 0,
            rightArm: 0,
            leftLeg: 0,
            rightLeg: 0
        };

        const armorById = Object.fromEntries((armorData as Armor[]).map(a => [a.id, a]));
        const equippedArmor = character.inventory.equippedArmor || {};

        Object.entries(character.inventory.armor).forEach(([armorId, count]) => {
            if (count <= 0) return;
            if (equippedArmor[armorId] !== true) return;

            const armor = armorById[armorId];
            if (!armor) return;

            armor.locations.forEach(location => {
                const loc = location.toLowerCase();
                if (loc.includes('head')) ap.head += armor.ap;
                if (loc.includes('body') || loc.includes('torso')) ap.body += armor.ap;
                if (loc.includes('arm')) {
                    ap.leftArm += armor.ap;
                    ap.rightArm += armor.ap;
                }
                if (loc.includes('left arm')) ap.leftArm += armor.ap;
                if (loc.includes('right arm')) ap.rightArm += armor.ap;
                if (loc.includes('leg')) {
                    ap.leftLeg += armor.ap;
                    ap.rightLeg += armor.ap;
                }
                if (loc.includes('left leg')) ap.leftLeg += armor.ap;
                if (loc.includes('right leg')) ap.rightLeg += armor.ap;
            });
        });

        return ap;
    };

    const armourPoints = calculateArmourPoints();

    const weaponById = Object.fromEntries((weaponsData as Weapon[]).map(w => [w.id, w]));
    const equippedWeaponsState = character.inventory.equippedWeapons || {};
    const equippedWeapons = Object.entries(character.inventory.weapons)
        .filter(([weaponId, count]) => count > 0 && equippedWeaponsState[weaponId] === true)
        .map(([weaponId]) => weaponById[weaponId])
        .filter(Boolean) as Weapon[];

    console.log(equippedWeapons)

    const getConditionName = (conditionId: string): string => {
        const condition = conditionsData.find((c: any) => c.id === conditionId);
        return condition ? condition.name : conditionId;
    };

    const getConditionDescription = (conditionId: string): string => {
        const condition = conditionsData.find(c => c.id === conditionId);
        return condition ? condition.description : '';
    };

    const handleWoundsChange = (value: number) => {
        onCharacterUpdate({
            status: {
                ...character.status,
                wounds: {
                    ...character.status.wounds,
                    current: Math.max(0, Math.min(value, character.status.wounds.max))
                }
            }
        });
    };

    const getWeaponDamage = (weapon: Weapon): string => {
        const damage = weapon.damage;
        if (!damage) return '—';

        if (damage.includes('SB')) {
            const sb = Math.floor(calculateCharacteristicValue(character.characteristics.s) / 10);
            const match = damage.match(/SB([+-]?\d+)?/);
            if (match) {
                const modifier = match[1] ? parseInt(match[1]) : 0;
                return `${sb + modifier}`;
            }
        }
        return damage;
    };

    const getWeaponDamageValue = (weapon: Weapon): number => {
        const damage = weapon.damage;
        if (!damage) return 0;

        if (damage.includes('SB')) {
            const sb = calculateCharacteristicBonus(character.characteristics.s);
            const match = damage.match(/SB([+-]?\d+)?/);
            if (match) {
                const modifier = match[1] ? parseInt(match[1]) : 0;
                return sb + modifier;
            }
        }

        return parseInt(damage) || 0;
    };

    const isRangedWeapon = (weapon: Weapon): boolean => {
        const group = weapon.group?.toLowerCase() || '';
        return group.includes('bow') ||
            group.includes('crossbow') ||
            group.includes('blackpowder') ||
            group.includes('engineering') ||
            group.includes('sling') ||
            group.includes('thrown');
    };

    const getWeaponSkillId = (weapon: Weapon): string => {
        const isRanged = isRangedWeapon(weapon);
        if (isRanged) {
            return 'ranged_' + (weapon.group?.toLowerCase() || 'basic');
        }
        const group = weapon.group?.toLowerCase() || 'basic';
        return group === 'basic' ? 'melee' : 'melee_' + group;
    };

    const getWeaponSkillValue = (weapon: Weapon): { skillId: string; skillName: string; value: number } => {
        const isRanged = isRangedWeapon(weapon);
        const skillId = getWeaponSkillId(weapon);

        const skill = character.skills.find(s => s.id === skillId);

        if (skill) {
            return {
                skillId: skill.id,
                skillName: skill.name,
                value: calculateSkillValue(skill, character)
            };
        }

        if (isRanged) {
            return {
                skillId: 'bs',
                skillName: 'Ballistic Skill',
                value: calculateCharacteristicValue(character.characteristics.bs)
            };
        }
        return {
            skillId: 'ws',
            skillName: 'Weapon Skill',
            value: calculateCharacteristicValue(character.characteristics.ws)
        };
    };

    const getDodgeSkill = (): { skillId: string; skillName: string; value: number } => {
        const dodgeSkill = character.skills.find(s => s.id === 'dodge' || s.name?.toLowerCase() === 'dodge');
        if (dodgeSkill) {
            return {
                skillId: dodgeSkill.id,
                skillName: dodgeSkill.name,
                value: calculateSkillValue(dodgeSkill, character)
            };
        }
        return {
            skillId: 'ag',
            skillName: 'Agility',
            value: calculateCharacteristicValue(character.characteristics.ag)
        };
    };

    const getBestMeleeSkill = (): { skillId: string; skillName: string; value: number, weapon: Weapon | null } => {
        const equipedMeleeWeapons = equippedWeapons.filter(w => !isRangedWeapon(w));
        if (equipedMeleeWeapons.length === 0) {
            return {
                skillId: 'ws',
                skillName: 'Weapon Skill',
                value: calculateCharacteristicValue(character.characteristics.ws),
                weapon: null
            };
        }
        const meleeSkills = equipedMeleeWeapons.map(weapon => {
            const { skillId, skillName, value } = getWeaponSkillValue(weapon);
            return { skillId, skillName, value };
        });

        let bestSkill = meleeSkills[0];
        let bestValue = meleeSkills[0].value;
        let bestWeapon = equipedMeleeWeapons[0];

        meleeSkills.forEach((skill, index) => {
            if (skill.value > bestValue) {
                bestValue = skill.value;
                bestSkill = skill;
                bestWeapon = equipedMeleeWeapons[index];
            }
        });

        return {
            skillId: bestSkill.skillId,
            skillName: bestSkill.skillName,
            value: bestValue,
            weapon: bestWeapon
        };
    };

    const handleWeaponAttack = (weapon: Weapon) => {
        if (!onWeaponRoll) return;
        const { skillId, skillName, value } = getWeaponSkillValue(weapon);
        const damage = getWeaponDamageValue(weapon);
        onWeaponRoll(weapon, skillId, skillName, value, damage);
    };

    const handleDodge = () => {
        if (!onDefendRoll) return;
        const { skillId, skillName, value } = getDodgeSkill();
        onDefendRoll(skillId, skillName, value);
    };

    const handleParry = (weapon: Weapon) => {
        if (!onWeaponRoll) return;
        const { skillId, skillName, value } = getWeaponSkillValue(weapon);
        onWeaponRoll(weapon, skillId, skillName, value, 0);
    };

    const handleWeaponDragStart = (e: React.DragEvent, weapon: Weapon) => {
        e.dataTransfer.setData('application/action-type', 'weapon');
        e.dataTransfer.setData('application/action-id', weapon.id);
        e.dataTransfer.setData('application/action-label', weapon.name);
        e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div className="combat-tab">
            {/* Quick Defense Actions */}
            {(onDefendRoll || onWeaponRoll) && (
                <div className="combat-panel defense-actions-panel">
                    <h3 className="panel-title">Quick Defense</h3>
                    <div className="defense-actions">
                        <button
                            className="defense-button dodge-button"
                            onClick={handleDodge}
                            title={`Dodge (${getDodgeSkill().value})`}
                        >
                            🏃 Dodge ({getDodgeSkill().value})
                        </button>
                        {equippedWeapons.filter(w => !isRangedWeapon(w)).length > 0 && (
                            <button
                                className="defense-button parry-button"
                                onClick={() => handleParry(getBestMeleeSkill().weapon!)}
                                title={`Parry with ${getBestMeleeSkill().weapon?.name}`}
                            >
                                🛡️ Parry ({getBestMeleeSkill().value})
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Weapons Panel */}
            <div className="combat-panel weapons-panel">
                <h3 className="panel-title">Weapons</h3>
                <div className="weapons-list">
                    {equippedWeapons.length === 0 ? (
                        <p className="empty-message">No weapons equipped</p>
                    ) : (
                        equippedWeapons.map(weapon => {
                            const { skillName, value } = getWeaponSkillValue(weapon);
                            const isRanged = isRangedWeapon(weapon);
                            return (
                                <div
                                    key={weapon.id}
                                    className="weapon-card"
                                    draggable
                                    onDragStart={(e) => handleWeaponDragStart(e, weapon)}
                                    title="Drag to Action Bar to create quick slot"
                                >
                                    <div className="weapon-header">
                                        <span className="weapon-name">{weapon.name}</span>
                                        <span className="weapon-group">{weapon.group}</span>
                                    </div>
                                    <div className="weapon-stats">
                                        <div className="weapon-stat">
                                            <span className="stat-label">Skill:</span>
                                            <span className="stat-value">{skillName} ({value})</span>
                                        </div>
                                        <div className="weapon-stat">
                                            <span className="stat-label">Damage:</span>
                                            <span className="stat-value">{getWeaponDamage(weapon)}</span>
                                        </div>
                                        <div className="weapon-stat">
                                            <span className="stat-label">Reach:</span>
                                            <span className="stat-value">{weapon.reach || '—'}</span>
                                        </div>
                                    </div>
                                    {weapon.qualities && weapon.qualities.length > 0 && (
                                        <div className="weapon-qualities">
                                            <span className="qualities-label">Qualities:</span>
                                            <span className="qualities-list">
                                                {weapon.qualities.map((quality, index) => (
                                                    <React.Fragment key={quality}>
                                                        <QualityTooltip qualityString={quality} className="quality-tag" />
                                                        {index < weapon.qualities.length - 1 && ', '}
                                                    </React.Fragment>
                                                ))}
                                            </span>
                                        </div>
                                    )}
                                    {onWeaponRoll && (
                                        <div className="weapon-actions">
                                            <button
                                                className="weapon-action-button attack-button"
                                                onClick={() => handleWeaponAttack(weapon)}
                                                title="Roll to Attack"
                                            >
                                                ⚔️ Attack
                                            </button>
                                            {!isRanged && (
                                                <button
                                                    className="weapon-action-button parry-button"
                                                    onClick={() => handleParry(weapon)}
                                                    title="Roll to Parry"
                                                >
                                                    🛡️ Parry
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Armour Silhouette Panel */}
            <div className="combat-panel silhouette-panel">
                <h3 className="panel-title">Armour Points</h3>
                <div className="silhouette-container">
                    <svg viewBox="0 0 200 350" className="body-silhouette">
                        {/* Head */}
                        <circle cx="100" cy="35" r="30" className="body-part head" />
                        <text x="100" y="42" className="ap-text">{armourPoints.head}</text>

                        {/* Body/Torso */}
                        <rect x="60" y="70" width="80" height="100" rx="10" className="body-part body" />
                        <text x="100" y="125" className="ap-text">{armourPoints.body}</text>

                        {/* Left Arm */}
                        <rect x="20" y="70" width="35" height="90" rx="8" className="body-part left-arm" />
                        <text x="37" y="120" className="ap-text ap-text-small">{armourPoints.leftArm}</text>

                        {/* Right Arm */}
                        <rect x="145" y="70" width="35" height="90" rx="8" className="body-part right-arm" />
                        <text x="162" y="120" className="ap-text ap-text-small">{armourPoints.rightArm}</text>

                        {/* Left Leg */}
                        <rect x="60" y="180" width="35" height="120" rx="8" className="body-part left-leg" />
                        <text x="77" y="245" className="ap-text ap-text-small">{armourPoints.leftLeg}</text>

                        {/* Right Leg */}
                        <rect x="105" y="180" width="35" height="120" rx="8" className="body-part right-leg" />
                        <text x="122" y="245" className="ap-text ap-text-small">{armourPoints.rightLeg}</text>
                    </svg>

                    <div className="silhouette-legend">
                        <div className="legend-item">
                            <span className="legend-label">Head:</span>
                            <span className="legend-value">{armourPoints.head}</span>
                        </div>
                        <div className="legend-item">
                            <span className="legend-label">Body:</span>
                            <span className="legend-value">{armourPoints.body}</span>
                        </div>
                        <div className="legend-item">
                            <span className="legend-label">Arms:</span>
                            <span className="legend-value">{armourPoints.leftArm}/{armourPoints.rightArm}</span>
                        </div>
                        <div className="legend-item">
                            <span className="legend-label">Legs:</span>
                            <span className="legend-value">{armourPoints.leftLeg}/{armourPoints.rightLeg}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Status Panel */}
            <div className="combat-panel status-panel">
                <h3 className="panel-title">Combat Status</h3>

                <div className="wounds-section">
                    <span className="wounds-label">Wounds:</span>
                    <div className="wounds-control">
                        {isEditMode ? (
                            <input
                                type="number"
                                value={character.status.wounds.current}
                                onChange={(e) => handleWoundsChange(parseInt(e.target.value) || 0)}
                                min={0}
                                max={character.status.wounds.max}
                                className="wounds-input"
                            />
                        ) : (
                            <span className="wounds-current">{character.status.wounds.current}</span>
                        )}
                        <span className="wounds-separator">/</span>
                        <span className="wounds-max">{character.status.wounds.max}</span>
                    </div>
                    <div className="wounds-bar">
                        <div
                            className="wounds-fill"
                            style={{
                                width: `${(character.status.wounds.current / character.status.wounds.max) * 100}%`,
                                backgroundColor: character.status.wounds.current <= character.status.wounds.max * 0.25
                                    ? '#dc2626'
                                    : character.status.wounds.current <= character.status.wounds.max * 0.5
                                        ? '#f59e0b'
                                        : '#22c55e'
                            }}
                        />
                    </div>
                </div>

                <div className="advantage-section">
                    <span className="advantage-label">Advantage:</span>
                    <span className="advantage-value">0</span>
                </div>

                {/* Conditions */}
                <div className="conditions-section">
                    <h4 className="conditions-title">Conditions</h4>
                    {character.conditions.length === 0 ? (
                        <p className="empty-message">No active conditions</p>
                    ) : (
                        <div className="conditions-list">
                            {character.conditions.map((condition, index) => (
                                <div key={`${condition.id}-${index}`} className="condition-item" title={getConditionDescription(condition.id)}>
                                    <span className="condition-name">{getConditionName(condition.id)}</span>
                                    {condition.stack > 1 && (
                                        <span className="condition-stack">×{condition.stack}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CombatTab;
