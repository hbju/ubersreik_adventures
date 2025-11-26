import { Character, Talent, TalentEffect } from '../types/wfrp.types';
import { calculateCharacteristicBonus } from './skills';
import { rolld100 } from './mechanics';
import { useGameData } from '..';

/**
 * Gets all talents that could apply to a given skill or characteristic test
 * @param character The character whose talents to check
 * @param testId The id of the skill or characteristic being tested (e.g., "perception", "melee_two-hands", "WS")
 * @returns Array of talents that could apply to this test
 */
export function getApplicableTalents(character: Character, testId: string, talents: Talent[]): Array<{ talent: Talent; rank: number }> {
    const result: Array<{ talent: Talent; rank: number }> = [];

    // Get all talents the character has
    const characterTalentIds = Object.keys(character.talents);

    for (const talentId of characterTalentIds) {
        const rank = character.talents[talentId];
        if (rank <= 0) continue;

        // Find the talent definition
        const talentDef = talents.find(t => t.id === talentId);
        if (!talentDef) continue;

        // Check if this talent has effects that could apply to this test
        if (talentDef.effects && talentDef.effects.length > 0) {
            for (const effect of talentDef.effects) {
                if (doesEffectApplyToTest(effect, testId)) {
                    result.push({ talent: talentDef, rank });
                    break; // Only add the talent once even if multiple effects apply
                }
            }
        }
    }

    return result;
}

/**
 * Checks if a talent effect applies to a given test
 */
function doesEffectApplyToTest(effect: TalentEffect, testId: string): boolean {
    if (!effect.appliesTo || effect.appliesTo.length === 0) {
        // Effects without appliesTo might be passive or apply universally
        return effect.type === 'SL_BONUS_ON_SUCCESS';
    }

    const normalizedTestName = testId.toLowerCase().trim();

    for (const target of effect.appliesTo) {
        const normalizedTarget = target.toLowerCase().trim();

        // Direct match
        if (normalizedTestName === normalizedTarget) {
            return true;
        }

        // Partial match for specialized skills (e.g., "Melee (Basic)" matches "melee")
        if (normalizedTestName.includes(normalizedTarget) || normalizedTarget.includes(normalizedTestName)) {
            return true;
        }
    }

    return false;
}

/**
 * Calculates the character's effective maximum wounds including talent bonuses
 * @param character The character to calculate wounds for
 * @returns The effective maximum wounds
 */
export function calculateEffectiveMaxWounds(character: Character, talents: Talent[]): number {
    return calculateCharacteristicBonus(character.characteristics.t) * 2
        + calculateCharacteristicBonus(character.characteristics.s)
        + calculateCharacteristicBonus(character.characteristics.wp)
        + calculateTalentBonus(character, 'WOUNDS_BONUS', talents);
}

/**
 * Applies talent SL bonuses to a successful test
 * @param baseSL The base success level from the test (must be >= 0 for a success)
 * @param usedTalents Array of talents and their ranks that were used
 * @param character The character performing the test (needed for conditional talents)
 * @returns The final success level including talent bonuses
 */
export function applyTalentSLBonuses(
    baseSL: number,
    usedTalents: { name: string; rank: number }[],
    talents: Talent[],
    character?: Character
): number {
    // Only apply bonuses to successful tests
    if (baseSL < 0) {
        return baseSL;
    }

    let finalSL = baseSL;

    for (const { name, rank } of usedTalents) {
        // Find the talent definition by name
        const talentDef = talents.find(t => t.name === name || t.id === name);
        if (!talentDef || !talentDef.effects) continue;

        // Check for SL bonus effects
        for (const effect of talentDef.effects) {
            if (effect.type === 'SL_BONUS_ON_SUCCESS') {
                // Check conditions if any
                if (effect.condition && character) {
                    // Evaluate condition (placeholder for future complex conditions)
                    // For now, do nothing
                }

                if (typeof effect.value === 'number') {
                    finalSL += effect.value * rank;
                }
            }
        }
    }

    return finalSL;
}

/**
 * Gets the test bonus from talents for a given skill/characteristic
 * @param character The character to check
 * @param testName The name of the skill or characteristic being tested
 * @returns The total test bonus from all applicable talents
 */
export function getTalentTestBonus(character: Character, testName: string, talents: Talent[]): number {
    let bonus = 0;

    const applicableTalents = getApplicableTalents(character, testName, talents);

    for (const { talent, rank } of applicableTalents) {
        if (!talent.effects) continue;

        for (const effect of talent.effects) {
            if (effect.type === 'TEST_BONUS' && typeof effect.value === 'number') {
                bonus += effect.value * rank;
            }
        }
    }

    return bonus;
}

/**
 * Gets damage bonus from talents for ranged or melee attacks
 * @param character The character to check
 * @param attackType Either "ranged" or "melee"
 * @returns The total damage bonus from all applicable talents
 */
export function getTalentDamageBonus(talents: { name: string; rank: number }[], skillId: string, talentsData : Talent[]): number {
    let bonus = 0;
    for (const { name, rank } of talents) {
        const talentDef = talentsData.find(t => t.name === name);
        if (!talentDef || !talentDef.effects) continue;
        for (const effect of talentDef.effects) {
            if (effect.type === 'DAMAGE_BONUS' && typeof effect.value === 'number') {
                if (!effect.appliesTo || effect.appliesTo.some(appl => skillId.toLowerCase().includes(appl.toLowerCase()) || appl.toLowerCase().includes(skillId.toLowerCase()))) {
                    bonus += effect.value * rank;
                }
            }
        }
    }
    return bonus;
}

/**
 * Gets initiative bonus from talents
 * @param character The character to check
 * @returns The total initiative bonus from all applicable talents
 */
export function getTalentInitiativeBonus(character: Character, talents: Talent[]): number {
    return calculateTalentBonus(character, 'INITIATIVE_BONUS', talents);
}

export function calculateEffectiveMaxEncumbrance(character: Character, talents: Talent[]): number {
    return calculateCharacteristicBonus(character.characteristics.s)
        + calculateCharacteristicBonus(character.characteristics.t)
        + calculateTalentBonus(character, 'ENCUMBRANCE_BONUS', talents);
}

function calculateTalentBonus(character: Character, talentType : string, talents: Talent[]): number {
    let bonus = 0;
    const characterTalentIds = Object.keys(character.talents);

    for (const talentId of characterTalentIds) {
        const rank = character.talents[talentId];
        if (rank <= 0) continue;

        const talentDef = talents.find(t => t.id === talentId);
        if (!talentDef || !talentDef.effects) continue;

        for (const effect of talentDef.effects) {
            if (effect.type === talentType) {
                if (typeof effect.value === 'number') {
                    bonus += effect.value * rank;
                }
                if (typeof effect.value === 'string') {
                    const charBonus = calculateCharacteristicBonus(character.characteristics[effect.value.toLowerCase() as keyof Character['characteristics']]);
                    bonus += charBonus * rank;
                }
            }
        }
    }

    return bonus;
}

/**
 * Checks if a roll is a critical success or fumble
 * @param roll The d100 roll result
 * @param target The target number
 * @returns Object indicating if it's a critical/fumble
 */
export function checkCriticalResult(roll: number, target: number): {
    isCritical: boolean;
    isFumble: boolean;
    critRoll?: number;
} {
    const isCritical = roll <= 5 || (roll <= target && roll % 11 === 0);
    const isFumble = roll >= 96 || (roll > target && roll % 11 === 0);

    if (isCritical || isFumble) {
        return { isCritical, isFumble, critRoll: rolld100() };
    }

    return { isCritical, isFumble };
}

/**
 * Gets characteristic bonuses from talents for a given characteristic
 * @param character The character to check
 * @param characteristicKey The characteristic key (e.g., 's', 't', 'ws', 'bs')
 * @returns The total characteristic bonus from all applicable talents
 */
export function getTalentCharacteristicBonus(
    character: Character,
    talents: Talent[],
    characteristicKey: keyof Character['characteristics']
): number {
    let bonus = 0;

    // Get all talents the character has
    const characterTalentIds = Object.keys(character.talents);

    const characteristicNameMap: Record<keyof Character['characteristics'], string> = {
        s: 'Strength',
        t: 'Toughness',
        ws: 'Weapon Skill',
        bs: 'Ballistic Skill',
        i: 'Initiative',
        ag: 'Agility',
        dex: 'Dexterity',
        fel: 'Fellowship',
        int: 'Intelligence',
        wp: 'Willpower',
    };

    for (const talentId of characterTalentIds) {
        const rank = character.talents[talentId];
        if (rank <= 0) continue;

        // Find the talent definition
        const talentDef = talents.find(t => t.id === talentId);
        if (!talentDef || !talentDef.effects) continue;

        // Check for characteristic bonuses
        for (const effect of talentDef.effects) {
            if ((effect.type === 'CHARACTERISTIC_BONUS' || effect.type === 'ATTRIBUTE_BONUS') && typeof effect.value === 'number') {
                // Check if this effect applies to the specific characteristic
                if (effect.appliesTo && effect.appliesTo.some(char => char.toLowerCase() === characteristicKey.toLowerCase() || char.toLowerCase() === characteristicNameMap[characteristicKey].toLowerCase())) {
                    bonus += effect.value * rank;
                }
            }
        }
    }

    return bonus;
}

/**
 * Gets the fear rating from talents
 * @param character The character to check
 * @returns The total fear rating from all applicable talents
 */
export function getTalentFearRating(character: Character, talents: Talent[]): number {
    let fearRating = 0;

    // Get all talents the character has
    const characterTalentIds = Object.keys(character.talents);

    for (const talentId of characterTalentIds) {
        const rank = character.talents[talentId];
        if (rank <= 0) continue;

        // Find the talent definition
        const talentDef = talents.find(t => t.id === talentId);
        if (!talentDef || !talentDef.effects) continue;

        // Check for fear rating effects
        for (const effect of talentDef.effects) {
            if (effect.type === 'FEAR_RATING' && typeof effect.value === 'number') {
                fearRating += effect.value * rank;
            }
        }
    }

    return fearRating;
}

/**
 * Checks if character has a talent that allows ignoring bleeding conditions
 * @param character The character to check
 * @returns True if character can ignore bleeding, false otherwise
 */
export function canIgnoreBleeding(character: Character, talents: Talent[]): boolean {
    // Get all talents the character has
    const characterTalentIds = Object.keys(character.talents);

    for (const talentId of characterTalentIds) {
        const rank = character.talents[talentId];
        if (rank <= 0) continue;

        // Find the talent definition
        const talentDef = talents.find(t => t.id === talentId);
        if (!talentDef || !talentDef.effects) continue;

        // Check for bleeding ignore effects
        for (const effect of talentDef.effects) {
            if (effect.type === 'BLEEDING_CONDITION_IGNORE') {
                return true;
            }
        }
    }

    return false;
}

export function recalculateCharacterTalentBonuses(character: Character, talents: Talent[]): Character {
    const updatedCharacteristics = { ...character.characteristics };

    for (const charKey of Object.keys(updatedCharacteristics) as (keyof Character['characteristics'])[]) {
        const char = updatedCharacteristics[charKey];
        const talentBonus = getTalentCharacteristicBonus(character, talents, charKey);
        updatedCharacteristics[charKey] = {
            ...char,
            talents: talentBonus
        };
    }

    const updatedMaxWounds = calculateEffectiveMaxWounds(character, talents);
    return {
        ...character,
        characteristics: updatedCharacteristics,
        status: {
            ...character.status,
            wounds: {
                current: Math.min(character.status.wounds.current, updatedMaxWounds),
                max: updatedMaxWounds
            }
        }
    };
}

/**
 * Gets the maximum ranks for a talent based on its definition and the character's characteristics
 * @param talent The talent definition
 * @param character The character to check
 * @returns The maximum ranks for the talent
 */
export function getMaxRanks(talent: Talent, character: Character): number {
    if (typeof talent.max_ranks === 'number') {
        return talent.max_ranks;
    }

    const charKey = talent.max_ranks as keyof Character['characteristics'];
    if (character.characteristics[charKey]) {
        const char = character.characteristics[charKey];
        return Math.floor((char.initial + char.advances + char.talents + char.modifier) / 10);
    }

    return 1;
};