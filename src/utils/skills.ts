import { Skill, Characteristic, Character } from '../type/wfrp.types';

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