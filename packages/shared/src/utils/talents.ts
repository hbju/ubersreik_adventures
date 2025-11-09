import { Character, Talent, TalentEffect } from '../types/wfrp.types';
import talentsData from '../data/talents.json';

/**
 * Gets all talents that could apply to a given skill or characteristic test
 * @param character The character whose talents to check
 * @param testName The name of the skill or characteristic being tested (e.g., "Perception", "Melee (Basic)", "WS")
 * @returns Array of talents that could apply to this test
 */
export function getApplicableTalents(character: Character, testName: string): Array<{ talent: Talent; rank: number }> {
    const result: Array<{ talent: Talent; rank: number }> = [];

    // Get all talents the character has
    const characterTalentIds = Object.keys(character.talents);

    for (const talentId of characterTalentIds) {
        const rank = character.talents[talentId];
        if (rank <= 0) continue;

        // Find the talent definition
        const talentDef = (talentsData as Talent[]).find(t => t.id === talentId);
        if (!talentDef) continue;

        // Check if this talent has effects that could apply to this test
        if (talentDef.effects && talentDef.effects.length > 0) {
            for (const effect of talentDef.effects) {
                if (doesEffectApplyToTest(effect, testName)) {
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
function doesEffectApplyToTest(effect: TalentEffect, testName: string): boolean {
    if (!effect.appliesTo || effect.appliesTo.length === 0) {
        // Effects without appliesTo might be passive or apply universally
        return effect.type === 'SL_BONUS_ON_SUCCESS';
    }

    const normalizedTestName = testName.toLowerCase().trim();

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
 * Legacy function to check if a test name matches
 */
function testMatchesName(testStr: string, testName: string): boolean {
    const normalizedTest = testStr.toLowerCase().trim();
    const normalizedName = testName.toLowerCase().trim();

    return normalizedTest === normalizedName ||
        normalizedName.includes(normalizedTest) ||
        normalizedTest.includes(normalizedName);
}

/**
 * Calculates the character's effective maximum wounds including talent bonuses
 * @param character The character to calculate wounds for
 * @returns The effective maximum wounds
 */
export function calculateEffectiveMaxWounds(character: Character): number {
    let maxWounds = character.status.wounds.max;

    // Get all talents the character has
    const characterTalentIds = Object.keys(character.talents);

    for (const talentId of characterTalentIds) {
        const rank = character.talents[talentId];
        if (rank <= 0) continue;

        // Find the talent definition
        const talentDef = (talentsData as Talent[]).find(t => t.id === talentId);
        if (!talentDef || !talentDef.effects) continue;

        // Check for wounds bonuses
        for (const effect of talentDef.effects) {
            if (effect.type === 'WOUNDS_BONUS') {
                if (typeof effect.value === 'number') {
                    maxWounds += effect.value * rank;
                } else if (typeof effect.value === 'string') {
                    // Handle formulas like "TB" (Toughness Bonus)
                    if (effect.value.toUpperCase() === 'TB') {
                        const toughnessBonus = Math.floor(
                            (character.characteristics.t.initial + character.characteristics.t.advances) / 10
                        );
                        maxWounds += toughnessBonus * rank;
                    }
                    // Can add more formula types here as needed
                }
            }
        }
    }

    return maxWounds;
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
    character?: Character
): number {
    // Only apply bonuses to successful tests
    if (baseSL < 0) {
        return baseSL;
    }

    let finalSL = baseSL;

    for (const { name, rank } of usedTalents) {
        // Find the talent definition by name
        const talentDef = (talentsData as Talent[]).find(t => t.name === name || t.id === name);
        if (!talentDef || !talentDef.effects) continue;

        // Check for SL bonus effects
        for (const effect of talentDef.effects) {
            if (effect.type === 'SL_BONUS_ON_SUCCESS') {
                // Check conditions if any
                if (effect.condition && character) {
                    // Evaluate condition (placeholder for future complex conditions)
                    // For now, skip conditional talents
                    continue;
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
export function getTalentTestBonus(character: Character, testName: string): number {
    let bonus = 0;

    const applicableTalents = getApplicableTalents(character, testName);

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
export function getTalentDamageBonus(talents: { name: string; rank: number }[], attackType: 'ranged' | 'melee'): number {
    let bonus = 0;
    for (const { name, rank } of talents) {
        const talentDef = (talentsData as Talent[]).find(t => t.name === name);
        if (!talentDef || !talentDef.effects) continue;
        for (const effect of talentDef.effects) {
            if (effect.type === 'DAMAGE_BONUS' && typeof effect.value === 'number') {
                if (!effect.appliesTo || effect.appliesTo.includes(attackType)) {
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
export function getTalentInitiativeBonus(character: Character): number {
    let bonus = 0;

    // Get all talents the character has
    const characterTalentIds = Object.keys(character.talents);

    for (const talentId of characterTalentIds) {
        const rank = character.talents[talentId];
        if (rank <= 0) continue;

        // Find the talent definition
        const talentDef = (talentsData as Talent[]).find(t => t.id === talentId);
        if (!talentDef || !talentDef.effects) continue;

        // Check for initiative bonuses
        for (const effect of talentDef.effects) {
            if (effect.type === 'INITIATIVE_BONUS' && typeof effect.value === 'number') {
                bonus += effect.value * rank;
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
} {
    const isCritical = roll <= 5 || (roll <= target && roll % 11 === 0);
    const isFumble = roll >= 96 || (roll > target && roll % 11 === 0);

    return { isCritical, isFumble };
}
