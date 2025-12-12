/**
 * Dice Parser Utility
 * Parses dice roll commands like /roll 1d100, /r 2d10+5, etc.
 */

import { DiceRequest, DiceRollData } from '../types/chat.types';

/**
 * Regex pattern for dice notation: XdY or XdY+Z or XdY-Z
 * Captures: count (optional), sides, modifier sign and value (optional)
 */
const DICE_PATTERN = /^(\d*)d(\d+)([+-]\d+)?$/i;

/**
 * Parse a dice string like "2d10+5" into a DiceRequest object
 * @param command The dice string (e.g., "1d100", "2d10+5", "d20-2")
 * @returns DiceRequest object or null if invalid syntax
 */
export function parseDiceString(command: string): DiceRequest | null {
    const trimmed = command.trim().toLowerCase();
    const match = trimmed.match(DICE_PATTERN);
    
    if (!match) {
        return null;
    }

    const countStr = match[1];
    const sidesStr = match[2];
    const modifierStr = match[3];

    // Default count to 1 if not specified (e.g., "d20" means "1d20")
    const count = countStr ? parseInt(countStr, 10) : 1;
    const sides = parseInt(sidesStr, 10);
    const modifier = modifierStr ? parseInt(modifierStr, 10) : 0;

    // Validation
    if (count <= 0 || count > 100) {
        return null; // Reasonable limits
    }
    if (sides <= 0 || sides > 1000) {
        return null; // Reasonable limits
    }

    return { count, sides, modifier };
}

/**
 * Execute a dice roll based on a DiceRequest and return the results
 * @param request The parsed dice request
 * @returns DiceRollData with individual rolls and total
 */
export function executeDiceRoll(request: DiceRequest): DiceRollData {
    const rolls: number[] = [];
    
    for (let i = 0; i < request.count; i++) {
        rolls.push(Math.floor(Math.random() * request.sides) + 1);
    }

    const rollSum = rolls.reduce((sum, roll) => sum + roll, 0);
    const total = rollSum + request.modifier;

    // Build formula string
    let formula = `${request.count}d${request.sides}`;
    if (request.modifier > 0) {
        formula += `+${request.modifier}`;
    } else if (request.modifier < 0) {
        formula += `${request.modifier}`;
    }

    return {
        formula,
        rolls,
        modifier: request.modifier,
        total
    };
}

/**
 * Parse a chat command and determine if it's a roll command
 * @param input The full input string (e.g., "/roll 2d10+5")
 * @returns Object with isRollCommand flag and parsed data
 */
export function parseChatCommand(input: string): {
    isRollCommand: boolean;
    isPrivate: boolean;
    diceRequest: DiceRequest | null;
    errorMessage?: string;
} {
    const trimmed = input.trim();
    
    // Check for /roll or /r prefix
    const rollMatch = trimmed.match(/^\/(?:roll|r|groll|gr)\s+(.+)$/i);
    const isPrivate = /^\/groll|^\/gr/i.test(trimmed);
    
    if (!rollMatch) {
        return { isRollCommand: false, isPrivate: false, diceRequest: null };
    }

    const diceString = rollMatch[1].trim();
    const diceRequest = parseDiceString(diceString);

    if (!diceRequest) {
        return {
            isRollCommand: true,
            isPrivate,
            diceRequest: null,
            errorMessage: `Invalid dice syntax: "${diceString}". Use format like 1d100, 2d10+5, or d20-2.`
        };
    }

    return { isRollCommand: true, isPrivate, diceRequest };
}

/**
 * Format a dice roll result for display
 * @param data The dice roll data
 * @returns Formatted string like "[4, 8] + 5 = 17"
 */
export function formatRollResult(data: DiceRollData): string {
    const rollsStr = `[${data.rolls.join(', ')}]`;
    
    if (data.modifier > 0) {
        return `${rollsStr} + ${data.modifier} = ${data.total}`;
    } else if (data.modifier < 0) {
        return `${rollsStr} - ${Math.abs(data.modifier)} = ${data.total}`;
    }
    
    return `${rollsStr} = ${data.total}`;
}
