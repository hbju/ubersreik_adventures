/**
 * Get armor locations as normalized lowercase location names.
 */
export function normalizeArmorLocations(locations: string[]): string[] {
    const normalized: string[] = [];
    for (const loc of locations) {
        const lower = loc.toLowerCase();
        if (lower.includes('head')) normalized.push('head');
        if (lower.includes('body') || lower.includes('torso')) normalized.push('body');
        if (lower.includes('arm')) {
            if (lower.includes('left')) normalized.push('left arm');
            else if (lower.includes('right')) normalized.push('right arm');
            else {
                normalized.push('left arm');
                normalized.push('right arm');
            }
        }
        if (lower.includes('leg')) {
            if (lower.includes('left')) normalized.push('left leg');
            else if (lower.includes('right')) normalized.push('right leg');
            else {
                normalized.push('left leg');
                normalized.push('right leg');
            }
        }
    }
    return [...new Set(normalized)];
}
