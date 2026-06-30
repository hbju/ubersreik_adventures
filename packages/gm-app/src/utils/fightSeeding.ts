import type { Combatant, Character, SideId, CombatState } from '@wfrp/shared';
import { createCombatantFromCharacter, createCombatState } from '@wfrp/shared';

/**
 * Build a CombatState and remote actor set from the GM's initiative tracker.
 *
 * @param trackerCombatants - Combatants from the initiative tracker (wfrp.types.ts)
 * @param characters        - Campaign characters, used to resolve full Character data
 * @param sideMap           - GM-assigned sides: combatantId → 'ally'|'adversary'
 * @param initialDistance   - Starting distance in yards between the two sides
 */
export function buildCombatStateFromTracker(
    trackerCombatants: Combatant[],
    characters: Character[],
    sideMap: Record<string, SideId>,
    initialDistance: number,
): { combatState: CombatState; remoteActorIds: Set<string> } {
    const engineCombatants = trackerCombatants.flatMap(tc => {
        const character = characters.find(c => c.id === tc.sourceId);
        if (!character) {
            console.warn(`[fightSeeding] No character found for sourceId "${tc.sourceId}" (${tc.name}) — skipping`);
            return [];
        }
        const side: SideId = sideMap[tc.id] ?? 'adversary';
        const position = side === 'ally' ? 0 : initialDistance;
        return [createCombatantFromCharacter(character, {
            id: tc.id,
            side,
            position,
            currentWounds: tc.currentWounds,
            maxWounds: tc.maxWounds,
            conditions: tc.conditions ?? [],
            engagementIds: [],
        })];
    });

    const combatState = createCombatState(engineCombatants);

    const remoteActorIds = new Set(
        engineCombatants
            .filter(tc => tc.isPlayer)
            .map(tc => tc.id),
    );

    return { combatState, remoteActorIds };
}
