import { Skill, Characteristic, Character, SkillCharDefinition } from '../types/wfrp.types';
import allSkillsAndCharacteristics from '../data/skillsAndCharacteristics.json';

export function calculateSkillValue(skill: Skill, character: Character): number {
    const char = character.characteristics[skill.characteristic as keyof typeof character.characteristics];
    const initialValue = char.initial + char.advances + char.talents + char.modifier;
    return initialValue + skill.advances + skill.talents + skill.modifier;
}

export function calculateCharacteristicValue(characteristic: Characteristic): number {
    return characteristic.initial + characteristic.advances + characteristic.talents + characteristic.modifier;
}

export function calculateCharacteristicBonus(characteristic: Characteristic): number {
    const value = calculateCharacteristicValue(characteristic);
    return Math.floor(value / 10);
}

export function getGroupedSkill(skillId: string): Skill | null {
    // skill id will be in format 'skill-id_group', where skill-id is the base skill id, and _group is the group suffix. For example, melee_basic should map to {id: 'melee_basic', name: 'Melee (Basic)', characteristic: 'ws', ...} as the base skill 'melee' with group 'basic'.
    const baseSkillId = skillId.split('_')[0];

    const skillDef = (allSkillsAndCharacteristics as SkillCharDefinition[]).find(s => s.id === baseSkillId && s.type === 'skill');
    if (!skillDef) return null;

    const group = skillId.split('_')[1];
    if (!group) {
        return {
            id: skillId,
            name: skillDef.name ,
            characteristic: skillDef.characteristic,
            advances: 0,
            talents: 0,
            modifier: 0
        };
    }

    const name = skillDef.name.split(' (')[0]; // Remove any existing group from name


    return {
        id: skillId,
        name: name + ` (${group.charAt(0).toUpperCase() + group.slice(1)})`,
        characteristic: skillDef.characteristic,
        advances: 0,
        talents: 0,
        modifier: 0
    };
}

export function isSkillGrouped(skillId: string): boolean {
    const parts = skillId.split('_');
    return parts.length > 1;
}