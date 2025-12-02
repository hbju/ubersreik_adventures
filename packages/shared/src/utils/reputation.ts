/**
 * Reputation utility functions for the Faction & Reputation System
 */

export type ReputationLabel =
    | 'nemesis'
    | 'hated'
    | 'hostile'
    | 'unfriendly'
    | 'wary'
    | 'neutral'
    | 'cordial'
    | 'friendly'
    | 'trusted'
    | 'allied'
    | 'champion';


/**
 * Get a human-readable label for a reputation value
 * @param value Reputation value from -100 to 100
 * @returns A descriptive label for the reputation level
 */
export function getReputationLabel(value: number): ReputationLabel {
    if (value === -100) return 'nemesis';
    if (value <= -80) return 'hated';
    if (value <= -60) return 'hostile';
    if (value <= -40) return 'unfriendly';
    if (value <= -20) return 'wary';
    if (value < 20) return 'neutral';
    if (value < 40) return 'cordial';
    if (value < 60) return 'friendly';
    if (value < 80) return 'trusted';
    if (value < 100) return 'allied';
    return 'champion';
}

/**
 * Get a Tailwind color class based on the reputation value
 * @param value Reputation value from -100 to 100
 * @returns A Tailwind CSS color class
 */
export function getReputationColor(value: number): string {
    if (value === -100) return 'text-red-800';
    if (value <= -60) return 'text-red-600';     // Hated/Hostile
    if (value <= -20) return 'text-orange-500';  // Unfriendly/Wary
    if (value < 20) return 'text-yellow-500';    // Neutral
    if (value < 60) return 'text-lime-500';      // Cordial/Friendly
    if (value < 100) return 'text-green-500';    // Trusted/Allied
    return 'text-green-700';                     // Champion
}

/**
 * Get a background color class for reputation badges
 * @param value Reputation value from -100 to 100
 * @returns A Tailwind CSS background color class
 */
export function getReputationBgColor(value: number): string {
    if (value === -100) return 'bg-red-800';
    if (value <= -60) return 'bg-red-900';
    if (value <= -20) return 'bg-orange-900';
    if (value < 20) return 'bg-yellow-900';
    if (value < 60) return 'bg-lime-900';
    if (value < 100) return 'bg-green-900';
    return 'bg-green-700';
}

/**
 * Get an inline style object for reputation display (for non-Tailwind contexts)
 * @param value Reputation value from -100 to 100
 * @returns An object with color styles
 */
export function getReputationColorStyle(value: number): { color: string; backgroundColor: string } {
    if (value === -100) {
        return { color: '#991b1b', backgroundColor: 'rgba(69, 14, 14, 0.5)' }; // Dark Red
    }
    if (value <= -60) {
        return { color: '#dc2626', backgroundColor: 'rgba(127, 29, 29, 0.5)' }; // Red
    }
    if (value <= -20) {
        return { color: '#f97316', backgroundColor: 'rgba(124, 45, 18, 0.5)' }; // Orange
    }
    if (value < 20) {
        return { color: '#eab308', backgroundColor: 'rgba(113, 63, 18, 0.5)' }; // Yellow
    }
    if (value < 60) {
        return { color: '#84cc16', backgroundColor: 'rgba(54, 83, 20, 0.5)' }; // Lime
    }
    if (value < 100) {
        return { color: '#22c55e', backgroundColor: 'rgba(20, 83, 45, 0.5)' }; // Green
    }
    return { color: '#16a34a', backgroundColor: 'rgba(5, 77, 32, 0.5)' }; // Dark Green
}

/**
 * Get the icon for a faction category
 * @param category The faction category
 * @returns An emoji representing the category
 */
export function getFactionCategoryIcon(category: string): string {
    switch (category) {
        case 'government': return '🏛️';
        case 'noble_house': return '👑';
        case 'guild': return '⚒️';
        case 'criminal': return '🗡️';
        case 'religious': return '⛪';
        case 'military': return '⚔️';
        case 'cult': return '🔮';
        default: return '🏴';
    }
}

/**
 * Get the display name for a faction category
 * @param category The faction category
 * @returns A human-readable category name
 */
export function getFactionCategoryName(category: string): string {
    switch (category) {
        case 'government': return 'Government';
        case 'noble_house': return 'Noble House';
        case 'guild': return 'Guild';
        case 'criminal': return 'Criminal';
        case 'religious': return 'Religious';
        case 'military': return 'Military';
        case 'cult': return 'Cult';
        default: return 'Other';
    }
}

/**
 * Clamp a reputation value to the valid range
 * @param value The value to clamp
 * @returns The value clamped between -100 and 100
 */
export function clampReputation(value: number): number {
    return Math.max(-100, Math.min(100, value));
}
