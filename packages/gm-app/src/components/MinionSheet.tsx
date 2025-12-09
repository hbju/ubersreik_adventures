import React from 'react';
import {
    Character,
    Armor,
    Weapon,
    useGameData,
    calculateCharacteristicValue,
    QualityTooltip,
    calculateSkillValue
} from '@wfrp/shared';
import styles from './MinionSheet.module.css';

interface MinionSheetProps {
    character: Character;
    onCharacterUpdate: (updates: Partial<Character>) => void;
    onCharacteristicClick?: (charId: string, charName: string, charValue: number) => void;
    onSkillClick?: (skillId: string, skillName: string, skillValue: number) => void;
    onFullViewClick: () => void;
    onClose: () => void;
}

interface ArmourPoints {
    head: number;
    body: number;
    arms: number;
    legs: number;
}

const MinionSheet: React.FC<MinionSheetProps> = ({
    character,
    onCharacterUpdate,
    onCharacteristicClick,
    onSkillClick,
    onFullViewClick,
    onClose
}) => {
    const { weapons: weaponsData, armor: armorData, talents: talentsData, skills: skillsData } = useGameData();

    // Calculate initiative value
    const initiative = calculateCharacteristicValue(character.characteristics.i);

    // Calculate armour points per location from equipped armor
    const calculateArmourPoints = (): ArmourPoints => {
        const ap: ArmourPoints = {
            head: 0,
            body: 0,
            arms: 0,
            legs: 0
        };

        const armorById = Object.fromEntries((armorData as Armor[]).map(a => [a.id, a]));

        Object.entries(character.inventory.armor).forEach(([armorId, count]) => {
            if (count <= 0) return;
            const armor = armorById[armorId];
            if (!armor) return;

            armor.locations.forEach(location => {
                const loc = location.toLowerCase();
                if (loc.includes('head')) ap.head += armor.ap;
                if (loc.includes('body') || loc.includes('torso')) ap.body += armor.ap;
                if (loc.includes('arm')) ap.arms += armor.ap;
                if (loc.includes('leg')) ap.legs += armor.ap;
            });
        });

        return ap;
    };

    const armourPoints = calculateArmourPoints();

    // Get equipped weapons
    const weaponById = Object.fromEntries((weaponsData as Weapon[]).map(w => [w.id, w]));
    const equippedWeapons = Object.entries(character.inventory.weapons)
        .filter(([_, count]) => count > 0)
        .map(([weaponId]) => weaponById[weaponId])
        .filter(Boolean) as Weapon[];

    // Calculate damage for weapons
    const getWeaponDamage = (weapon: Weapon): string => {
        const damage = weapon.damage;
        if (!damage) return '—';

        if (damage.includes('SB')) {
            const sb = Math.floor(calculateCharacteristicValue(character.characteristics.s) / 10);
            const match = damage.match(/SB([+-]?\d+)?/);
            if (match) {
                const modifier = match[1] ? parseInt(match[1]) : 0;
                return `+${sb + modifier}`;
            }
        }
        return damage;
    };

    // Get weapon skill value (WS for melee, BS for ranged)
    const getWeaponSkillValue = (weapon: Weapon): number => {
        const isMelee = !weapon.group?.toLowerCase().includes('bow') &&
            !weapon.group?.toLowerCase().includes('crossbow') &&
            !weapon.group?.toLowerCase().includes('blackpowder') &&
            !weapon.group?.toLowerCase().includes('engineering') &&
            !weapon.group?.toLowerCase().includes('sling') &&
            !weapon.group?.toLowerCase().includes('thrown');

        const skill_id = isMelee ? (weapon.group === 'basic' ? 'melee' : 'melee_' + weapon.group) : ('bs_' + weapon.group);
        const skill = character.skills.find(s => s.id === skill_id);

        if (skill) {
            return calculateSkillValue(skill, character);
        }

        if (isMelee) {
            return calculateCharacteristicValue(character.characteristics.ws);
        }
        return calculateCharacteristicValue(character.characteristics.bs);
    };

    // Get Dodge skill value
    const getDodgeValue = (): number => {
        const dodgeSkill = character.skills.find(s => s.id === 'dodge' || s.name?.toLowerCase() === 'dodge');
        if (dodgeSkill) {
            return calculateSkillValue(dodgeSkill, character);
        }
        // Return Ag if no dodge skill
        return calculateCharacteristicValue(character.characteristics.ag);
    };

    // Get Melee skill for parry (best melee skill)
    const getParryValue = (): number => {
        const meleeSkills = character.skills.filter(s =>
            s.id?.startsWith('melee') || s.name?.toLowerCase().startsWith('melee')
        );

        if (meleeSkills.length === 0) {
            return calculateCharacteristicValue(character.characteristics.ws);
        }

        return Math.max(...meleeSkills.map(s => calculateSkillValue(s, character)));
    };

    // Get notable skills (with advances > 0)
    const notableSkills = character.skills
        .filter(s => s.advances > 0)
        .sort((a, b) => b.advances - a.advances)
        .slice(0, 6);

    // Get talent names
    const getTalentName = (talentId: string): string => {
        const talent = talentsData.find((t: any) => t.id === talentId);
        return talent?.name || talentId;
    };

    const handleWoundsChange = (delta: number) => {
        const newWounds = Math.max(0, Math.min(
            character.status.wounds.current + delta,
            character.status.wounds.max
        ));
        onCharacterUpdate({
            status: {
                ...character.status,
                wounds: {
                    ...character.status.wounds,
                    current: newWounds
                }
            }
        });
    };

    const handleCharacteristicClick = (charKey: string, value: number) => {
        const charNames: Record<string, string> = {
            ws: 'Weapon Skill',
            bs: 'Ballistic Skill',
            s: 'Strength',
            t: 'Toughness',
            i: 'Initiative',
            ag: 'Agility',
            dex: 'Dexterity',
            int: 'Intelligence',
            wp: 'Willpower',
            fel: 'Fellowship'
        };
        onCharacteristicClick?.(charKey, charNames[charKey] || charKey.toUpperCase(), value);
    };

    const handleWeaponClick = (weapon: Weapon) => {
        const skillValue = getWeaponSkillValue(weapon);
        const isMelee = !weapon.group?.toLowerCase().includes('bow') &&
            !weapon.group?.toLowerCase().includes('crossbow') &&
            !weapon.group?.toLowerCase().includes('blackpowder');
        const skillName = isMelee ? 'Melee' : 'Ballistic Skill';
        const skillId = isMelee ? 'melee' : 'bs';
        onSkillClick?.(skillId, `${weapon.name} (${skillName})`, skillValue);
    };

    return (
        <div className={styles.minionSheet}>
            {/* Header */}
            <div className={styles.header}>
                <span className={styles.name}>{character.name}</span>
                <div className={styles.headerActions}>
                    <button
                        className={styles.fullViewButton}
                        onClick={onFullViewClick}
                        title="Open Full Character Sheet"
                    >
                        Full View
                    </button>
                    <button
                        className={styles.closeButton}
                        onClick={onClose}
                        title="Close"
                    >
                        ×
                    </button>
                </div>
            </div>

            {/* Quick Stats Row */}
            <div className={styles.quickStats}>
                <div className={styles.woundsControl}>
                    <span className={styles.statLabel}>Wounds:</span>
                    <button
                        className={styles.woundButton}
                        onClick={() => handleWoundsChange(-1)}
                    >
                        −
                    </button>
                    <span className={`${styles.woundsValue} ${character.status.wounds.current <= 3 ? styles.woundsCritical : ''}`}>
                        {character.status.wounds.current}/{character.status.wounds.max}
                    </span>
                    <button
                        className={styles.woundButton}
                        onClick={() => handleWoundsChange(1)}
                    >
                        +
                    </button>
                </div>
                <div className={styles.quickStat}>
                    <span className={styles.statLabel}>Init:</span>
                    <span className={styles.statValue}>{initiative}</span>
                </div>
                <div className={styles.quickStat}>
                    <span className={styles.statLabel}>Move:</span>
                    <span className={styles.statValue}>{character.movement}</span>
                </div>
            </div>

            {/* Characteristics Grid */}
            <div className={styles.characteristicsGrid}>
                {(['ws', 'bs', 's', 't', 'ag', 'i', 'wp', 'fel'] as const).map(charKey => {
                    const value = calculateCharacteristicValue(character.characteristics[charKey]);
                    return (
                        <button
                            key={charKey}
                            className={styles.charButton}
                            onClick={() => handleCharacteristicClick(charKey, value)}
                        >
                            <span className={styles.charLabel}>{charKey.toUpperCase()}</span>
                            <span className={styles.charValue}>{value}</span>
                        </button>
                    );
                })}
            </div>

            {/* Attacks Section */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>ATTACKS</div>
                <div className={styles.attacksList}>
                    {equippedWeapons.length === 0 ? (
                        <div className={styles.emptyMessage}>No weapons</div>
                    ) : (
                        equippedWeapons.map(weapon => (
                            <button
                                key={weapon.id}
                                className={styles.attackButton}
                                onClick={() => handleWeaponClick(weapon)}
                            >
                                <span className={styles.weaponName}>{weapon.name}</span>
                                <span className={styles.weaponSkill}>{getWeaponSkillValue(weapon)}%</span>
                                <span className={styles.weaponDamage}>Dmg: {getWeaponDamage(weapon)}</span>
                                <span className={styles.weaponReach}>{weapon.reach || '—'}</span>
                            </button>
                        ))
                    )}
                    {/* Always show Punch as fallback */}
                    <button
                        className={styles.attackButton}
                        onClick={() => onSkillClick?.('melee', 'Punch (Melee)', calculateCharacteristicValue(character.characteristics.ws))}
                    >
                        <span className={styles.weaponName}>Punch</span>
                        <span className={styles.weaponSkill}>{ character.skills.find(s => s.id === 'melee_brawling') ?
                            calculateSkillValue(character.skills.find(s => s.id === 'melee_brawling')!, character) : calculateCharacteristicValue(character.characteristics.ws)
                        }%</span>
                        <span className={styles.weaponDamage}>Dmg: +{Math.floor(calculateCharacteristicValue(character.characteristics.s) / 10)}</span>
                        <span className={styles.weaponReach}>V.Short</span>
                    </button>
                </div>
            </div>

            {/* Defence Section */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>DEFENCE</div>
                <div className={styles.defenceGrid}>
                    <div className={styles.armourInfo}>
                        <span className={styles.armourLabel}>Armour:</span>
                        <span className={styles.armourValues}>
                            Head ({armourPoints.head}), Body ({armourPoints.body}), Arms ({armourPoints.arms}), Legs ({armourPoints.legs})
                        </span>
                    </div>
                    <div className={styles.defenceStats}>
                        <button
                            className={styles.defenceButton}
                            onClick={() => onSkillClick?.('dodge', 'Dodge', getDodgeValue())}
                        >
                            Dodge: {getDodgeValue()}%
                        </button>
                        <button
                            className={styles.defenceButton}
                            onClick={() => onSkillClick?.('melee', 'Parry', getParryValue())}
                        >
                            Parry: {getParryValue()}%
                        </button>
                    </div>
                </div>
            </div>

            {/* Traits / Skills Section */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>TRAITS / SKILLS</div>
                <div className={styles.traitsList}>
                    {Object.entries(character.talents).map(([talentId, ranks]) => (
                        <div key={talentId} className={styles.traitItem}>
                            <span className={styles.talentBadge}>T</span>
                            {getTalentName(talentId)}{ranks > 1 ? ` (${ranks})` : ''}
                        </div>
                    ))}
                    {notableSkills.map(skill => (
                        <button
                            key={skill.id}
                            className={styles.skillItem}
                            onClick={() => onSkillClick?.(skill.id, skill.name, calculateSkillValue(skill, character))}
                        >
                            {skill.name}: {calculateSkillValue(skill, character)}%
                        </button>
                    ))}
                    {Object.keys(character.talents).length === 0 && notableSkills.length === 0 && (
                        <div className={styles.emptyMessage}>No special traits</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MinionSheet;
