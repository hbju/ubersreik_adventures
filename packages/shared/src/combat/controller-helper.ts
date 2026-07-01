import { skillTarget } from '../utils/skills';
import type { Rng } from './rng';
import type { Combatant, CombatState, MeleeAttackAction, OpposedRollInput, RangedAttackAction } from './types';
import type { CombatDecision, DecisionContext } from './turn-engine';
import { resolveWeaponUse } from './proficiency';
import { additionalEffortTestModifier } from './advantage';
import { hasQuality } from './qualities';

// ---------------------------------------------------------------------------
// materializeDecision
//
// Fills in the dice-roll `action` field for decisions that require it.
// Both HeuristicController (after target selection) and RemotePlayerController
// (after receiving the player's choice) call this before returning to the engine.
//
// For decisions that don't need additional parameters (endTurn, wait, reactions,
// spendAdvantage, fortuneReroll, etc.) the decision is returned unchanged.
// ---------------------------------------------------------------------------

export function materializeDecision(context: DecisionContext, decision: CombatDecision): CombatDecision {
    switch (decision.kind) {
        case 'meleeAttack':
            return buildMeleeAction(context, decision, false);

        case 'move':
            return decision.mode === 'charge'
                ? buildMeleeAction(context, decision, true)
                : decision;

        case 'rangedAttack':
            return buildRangedAction(context, decision);

        case 'reload': {
            const action = decision.action && 'weaponId' in decision.action
                ? decision.action
                : { actorId: decision.actorId, weaponId: decision.weaponId! };
            return {
                ...decision,
                action: { ...action, rollResult: d100(context.rng), targetNumber: skillTarget(context.actor, 'ranged_blackpowder') },
            };
        }

        case 'intimidate': {
            const target = decision.targetId ? context.state.combatants[decision.targetId] : undefined;
            return {
                ...decision,
                rollResult: d100(context.rng),
                targetNumber: skillTarget(context.actor, 'intimidate'),
                request: {
                    kind: 'intimidate',
                    actorId: decision.actorId,
                    targetId: decision.targetId,
                    opponentRollResult: d100(context.rng),
                    opponentTargetNumber: target ? skillTarget(target, 'cool') : 0,
                },
            };
        }

        case 'leadership':
            return {
                ...decision,
                rollResult: d100(context.rng),
                targetNumber: skillTarget(context.actor, 'leadership'),
                request: { kind: 'leadership', actorId: decision.actorId },
            };

        case 'assess':
        case 'defend':
        case 'aim':
        case 'sprint':
        case 'firstAid':
        case 'infighting':
        case 'disengageDodge':
        case 'grappleInitiate':
        case 'grappleMaintain':
        case 'grappleBreak':
        case 'attackWithBoth':
        case 'beatBlade':
        case 'disarm':
        case 'feint':
        case 'distractOpponent':
            return decision.request
                ? decision
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                : { ...decision, request: { kind: decision.kind as any, actorId: decision.actorId, targetId: decision.targetId } };

        default:
            // reaction, spendAdvantage, endTurn, wait, fortuneReroll, etc. — dispatched as-is
            return decision;
    }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function d100(rng: Rng): number {
    return Math.floor(rng.next() * 100) + 1;
}

function rollInput(context: DecisionContext, combatant: Combatant | undefined, skillId: string, weaponId?: string): OpposedRollInput {
    return {
        skillId,
        targetNumber: combatant ? skillTarget(combatant, skillId) : 0,
        rollResult: d100(context.rng),
        weaponId,
    };
}

function primaryWeapon(state: CombatState, combatant: Combatant | undefined) {
    if (!combatant) return undefined;
    const weaponId = combatant.weaponLoadout?.primaryWeaponId
        ?? Object.entries(combatant.character.inventory.equippedWeapons ?? {}).find(([, equipped]) => equipped)?.[0];
    return weaponId ? state.weapons.find(w => w.id === weaponId) : undefined;
}

function rangedSkillId(weapon: ReturnType<typeof primaryWeapon>): string {
    if (!weapon) return 'ranged_bow';
    if (hasQuality(weapon, 'blackpowder') || weapon.group.toLowerCase().includes('blackpowder')) return 'ranged_blackpowder';
    if (weapon.group.toLowerCase().includes('crossbow')) return 'ranged_crossbow';
    if (weapon.group.toLowerCase().includes('throw')) return 'ranged_throwing';
    return 'ranged_bow';
}

function buildMeleeAction(context: DecisionContext, decision: CombatDecision, forceCharge: boolean): CombatDecision {
    const weapon = primaryWeapon(context.state, context.actor);
    const weaponUse = weapon ? resolveWeaponUse(context.actor, weapon) : undefined;
    const skillId = weaponUse
        ? (weaponUse.test.type === 'skill' ? weaponUse.test.skillId : weaponUse.test.characteristic)
        : 'melee_basic';
    const action: MeleeAttackAction = {
        attackerId: context.actor.id,
        defenderId: decision.targetId!,
        attacker: rollInput(context, context.actor, skillId, weapon?.id),
        defender: { skillId: 'melee_basic', targetNumber: 0 },
        isCharging: forceCharge || context.state.turnFlags.chargedCombatantIds.includes(context.actor.id),
        grantAdvantage: additionalEffortTestModifier !== undefined,
    };
    return { ...decision, action };
}

function buildRangedAction(context: DecisionContext, decision: CombatDecision): CombatDecision {
    const weapon = primaryWeapon(context.state, context.actor);
    const action: RangedAttackAction = {
        attackerId: context.actor.id,
        defenderId: decision.targetId!,
        attacker: rollInput(context, context.actor, rangedSkillId(weapon), weapon?.id),
        cover: decision.targetId ? context.state.combatants[decision.targetId]?.cover ?? 'none' : 'none',
        grantAdvantage: additionalEffortTestModifier !== undefined,
    };
    return { ...decision, action };
}
