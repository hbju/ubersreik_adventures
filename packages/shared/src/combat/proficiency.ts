import type { Character, Skill, Weapon } from '../types/wfrp.types';
import type { Combatant } from './types';

export type WeaponUseTest =
    | { type: 'skill'; skillId: string; skillName: string; targetNumber: number }
    | { type: 'characteristic'; characteristic: 'ws' | 'bs'; targetNumber: number };

export interface WeaponUseResolution {
    test: WeaponUseTest;
    qualitiesActive: boolean;
    extraFlaws: string[];
    usable: boolean;
    parryOffHandExempt?: boolean;
}

const ALWAYS_ACTIVE_FLAWS = new Set([
    'blackpowder',
    'dangerous',
    'imprecise',
    'reload',
    'slow',
    'tiring',
    'unbalanced',
    'undamaging',
]);

export function resolveWeaponUse(combatant: Combatant, weapon: Weapon): WeaponUseResolution {
    const group = normalizedGroup(weapon.group);
    const meleeSkill = findSkill(combatant.character, group === 'basic' ? 'melee' : `melee_${group}`);
    if (isMeleeWeapon(weapon)) {
        const skilled = !!meleeSkill && meleeSkill.advances > 0;
        return {
            test: skilled ? skillTest(combatant.character, meleeSkill) : characteristicTest(combatant.character, 'ws'),
            qualitiesActive: skilled,
            extraFlaws: !skilled && group === 'flail' ? ['Dangerous'] : [],
            usable: true,
            parryOffHandExempt: isParryWeapon(weapon),
        };
    }

    const rangedSkill = findSkill(combatant.character, `ranged_${group}`);
    if (rangedSkill && rangedSkill.advances > 0) {
        return {
            test: skillTest(combatant.character, rangedSkill),
            qualitiesActive: true,
            extraFlaws: [],
            usable: true,
        };
    }

    if (group === 'crossbow' || group === 'throwing') {
        return {
            test: characteristicTest(combatant.character, 'bs'),
            qualitiesActive: false,
            extraFlaws: [],
            usable: true,
        };
    }

    if (group === 'engineering' && trained(combatant.character, 'ranged_blackpowder')) {
        return {
            test: skillTest(combatant.character, findSkill(combatant.character, 'ranged_blackpowder')!),
            qualitiesActive: false,
            extraFlaws: [],
            usable: true,
        };
    }

    if ((group === 'blackpowder' || group === 'explosive') && trained(combatant.character, 'ranged_engineering')) {
        return {
            test: skillTest(combatant.character, findSkill(combatant.character, 'ranged_engineering')!),
            qualitiesActive: true,
            extraFlaws: [],
            usable: true,
        };
    }

    return {
        test: characteristicTest(combatant.character, 'bs'),
        qualitiesActive: false,
        extraFlaws: [],
        usable: false,
    };
}

export function weaponForUse(weapon: Weapon, use: Pick<WeaponUseResolution, 'qualitiesActive' | 'extraFlaws'>): Weapon {
    return {
        ...weapon,
        qualities: [
            ...(use.qualitiesActive ? weapon.qualities : weapon.qualities.filter(isAlwaysActiveFlaw)),
            ...use.extraFlaws,
            ...cavalryExtraFlaws(weapon),
        ],
    };
}

export function isAlwaysActiveFlaw(rawQuality: string): boolean {
    return ALWAYS_ACTIVE_FLAWS.has(normalizedQuality(rawQuality));
}

function cavalryExtraFlaws(weapon: Weapon): string[] {
    if (normalizedGroup(weapon.group) !== 'cavalry') return [];
    return hasQualityId(weapon, 'two_handed') || hasQualityId(weapon, 'two-handed') ? [] : twoHandedReach(weapon) ? ['Two-Handed'] : [];
}

function twoHandedReach(weapon: Weapon): boolean {
    const text = `${weapon.name} ${weapon.reach} ${(weapon.qualities || []).join(' ')}`.toLowerCase();
    return text.includes('two-handed') || text.includes('2-handed') || text.includes('two handed') || text.includes('very long') || text.includes('long');
}

function isMeleeWeapon(weapon: Weapon): boolean {
    return !isRangedGroup(normalizedGroup(weapon.group));
}

function isRangedGroup(group: string): boolean {
    return ['blackpowder', 'bow', 'crossbow', 'engineering', 'entangling', 'explosive', 'sling', 'throwing'].includes(group);
}

function isParryWeapon(weapon: Weapon): boolean {
    return hasQualityId(weapon, 'defensive') && !hasQualityId(weapon, 'two_handed') && !hasQualityId(weapon, 'two-handed');
}

function hasQualityId(weapon: Weapon, qualityId: string): boolean {
    const normalized = normalizeId(qualityId);
    return (weapon.qualities || []).some(rawQuality => normalizeId(rawQuality.replace(/\*/g, '').replace(/\s+\d+$/, '')) === normalized);
}

function trained(character: Character, skillId: string): boolean {
    const skill = findSkill(character, skillId);
    return !!skill && skill.advances > 0;
}

function findSkill(character: Character, skillId: string): Skill | undefined {
    const normalized = normalizeId(skillId);
    return character.skills.find(skill => normalizeId(skill.id) === normalized || normalizeId(skill.name) === normalized);
}

function skillTest(character: Character, skill: Skill): WeaponUseTest {
    const characteristic = character.characteristics[skill.characteristic as keyof Character['characteristics']];
    return {
        type: 'skill',
        skillId: skill.id,
        skillName: skill.name,
        targetNumber: characteristicValue(characteristic) + skill.advances + skill.talents + skill.modifier,
    };
}

function characteristicTest(character: Character, characteristic: 'ws' | 'bs'): WeaponUseTest {
    return {
        type: 'characteristic',
        characteristic,
        targetNumber: characteristicValue(character.characteristics[characteristic]),
    };
}

function normalizedGroup(group: string): string {
    return group.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function normalizedQuality(rawQuality: string): string {
    return rawQuality.replace(/\*/g, '').replace(/\s+\d+$/, '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function normalizeId(id: string): string {
    return id.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function characteristicValue(characteristic: Character['characteristics']['ws']): number {
    return characteristic.initial + characteristic.advances + characteristic.talents + characteristic.modifier;
}
