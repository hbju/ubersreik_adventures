import type { Character } from '../types/wfrp.types';
import { grantAdvantage } from './advantage';
import { resolveEffectiveWeapon } from './actions';
import { resolveMeleeAttack } from './engine';
import { mathRandomRng, type Rng } from './rng';
import { offHandPenaltyFor } from './talents';
import type {
    CombatActionRequest,
    CombatEngineResult,
    CombatEvent,
    CombatState,
    Combatant,
    MeleeAttackAction,
} from './types';

export function resolveDualWieldAttack(
    state: CombatState,
    request: CombatActionRequest,
    rng: Rng = mathRandomRng
): CombatEngineResult {
    const actor = getCombatant(state, request.actorId);
    if (!request.targetId) {
        return reject(state, request.actorId, 'missingTarget');
    }
    if (!hasTalent(actor, 'dual-wielder')) {
        return reject(state, request.actorId, 'invalidLoadout');
    }
    const loadout = actor.weaponLoadout;
    if (!loadout?.primaryWeaponId || !loadout?.secondaryWeaponId) {
        return reject(state, request.actorId, 'invalidLoadout');
    }

    const primaryWeapon = resolveEffectiveWeapon(actor, state, request.targetId, 'primary');
    const defender = getCombatant(state, request.targetId);
    const primaryAction: MeleeAttackAction = {
        attackerId: actor.id,
        defenderId: request.targetId,
        attacker: {
            skillId: 'melee_basic',
            targetNumber: skillTarget(actor, 'melee_basic'),
            rollResult: request.rollResult,
            weaponId: primaryWeapon?.id,
            weaponName: primaryWeapon?.name,
            weaponDamage: primaryWeapon ? numericDamage(primaryWeapon.damage) : undefined,
            weaponDamageFormula: primaryWeapon?.damage,
        },
        defender: {
            skillId: request.defenderSkillId ?? 'melee_basic',
            targetNumber: request.defenderTargetNumber ?? skillTarget(defender, 'melee_basic'),
            rollResult: request.defenderRollResult,
        },
        grantAdvantage: false,
        generatesAdvantage: false,
        hand: 'primary',
    };

    const primary = resolveMeleeAttack(state, primaryAction, rng);
    let currentState = primary.state;
    const events: CombatEvent[] = [...primary.events];

    const attackResolved = primary.events.find(event => event.type === 'AttackResolved');
    const primaryHit = attackResolved?.data.outcome === 'attacker';
    const primaryRoll = attackResolved?.data.attackerRoll.rollResult as number | undefined;
    let secondaryHit = false;

    if (primaryHit && primaryRoll !== undefined) {
        const critEvent = primary.events.find(event => event.type === 'CritRolled');
        const secondaryToHit = critEvent ? critEvent.data.critRoll : reverseD100(primaryRoll);
        const secondaryTargetId = request.secondaryTargetId ?? request.targetId;
        const secondaryDefender = getCombatant(currentState, secondaryTargetId);
        const secondaryWeapon = resolveEffectiveWeapon(actor, currentState, secondaryTargetId, 'secondary');
        const secondaryAction: MeleeAttackAction = {
            attackerId: actor.id,
            defenderId: secondaryTargetId,
            attacker: {
                skillId: 'melee_basic',
                targetNumber: skillTarget(actor, 'melee_basic'),
                rollResult: secondaryToHit,
                testModifier: offHandPenaltyFor(actor),
                weaponId: secondaryWeapon?.id,
                weaponName: secondaryWeapon?.name,
                weaponDamage: secondaryWeapon ? numericDamage(secondaryWeapon.damage) : undefined,
                weaponDamageFormula: secondaryWeapon?.damage,
            },
            defender: {
                skillId: request.opponentSkillId ?? 'melee_basic',
                targetNumber: request.opponentTargetNumber ?? skillTarget(secondaryDefender, 'melee_basic'),
                rollResult: request.opponentRollResult ?? rolld100(rng),
            },
            grantAdvantage: false,
            generatesAdvantage: false,
            hand: 'secondary',
        };

        const secondary = resolveMeleeAttack(currentState, secondaryAction, rng);
        currentState = secondary.state;
        events.push(...secondary.events);
        const secondaryResolved = secondary.events.find(event => event.type === 'AttackResolved');
        secondaryHit = secondaryResolved?.data.outcome === 'attacker';
    }

    currentState = replaceCombatant(currentState, {
        ...getCombatant(currentState, actor.id),
        dualWieldDefensivePenalty: true,
    });

    if (primaryHit && secondaryHit) {
        const granted = grantAdvantage(currentState, actor.side, 1, {
            reason: 'opposedTestWin',
            sourceCombatantId: actor.id,
        });
        currentState = granted.state;
        events.push(...granted.events);
    }

    events.push({
        type: 'TalentEffectApplied',
        i18nKey: 'combat.talent.dual-wielder.attackWithBoth',
        data: {
            combatantId: actor.id,
            targetId: request.targetId,
            talentId: 'dual-wielder',
            effect: 'attackWithBoth',
            primaryRoll,
            secondaryRoll: primaryRoll === undefined ? undefined : reverseD100(primaryRoll),
            amount: offHandPenaltyFor(actor),
            trigger: 'onHit',
            primaryHit,
            secondaryHit,
        },
    });

    return { state: currentState, events };
}

function hasTalent(combatant: Combatant, talentId: string): boolean {
    return (combatant.character.talents?.[talentId] ?? 0) > 0;
}

function skillTarget(combatant: Combatant, skillId: string): number {
    const skill = combatant.character.skills.find(candidate => candidate.id === skillId || candidate.name.toLowerCase() === skillId.toLowerCase());
    if (skill) {
        const characteristic = combatant.character.characteristics[skill.characteristic as keyof Character['characteristics']];
        const charValue = characteristic.initial + characteristic.advances + characteristic.talents + characteristic.modifier;
        return charValue + skill.advances + skill.talents;
    }
    const key = skillId.includes('fencing') ? 'ws' : 'ag';
    const characteristic = combatant.character.characteristics[key as 'ws' | 'ag'];
    return characteristic.initial + characteristic.advances + characteristic.talents + characteristic.modifier;
}

function numericDamage(formula: string): number {
    const match = String(formula).match(/[+-]?\d+/g);
    return match ? match.reduce((total, value) => total + Number(value), 0) : 1;
}

function reverseD100(roll: number): number {
    if (roll === 100) return 1;
    const tens = Math.floor(roll / 10);
    const ones = roll % 10;
    return ones * 10 + tens;
}

function rolld100(rng: Rng): number {
    return Math.floor(rng.next() * 100) + 1;
}

function reject(state: CombatState, actorId: string, reason: 'missingTarget' | 'invalidLoadout'): CombatEngineResult {
    return {
        state,
        events: [{
            type: 'CombatActionRejected',
            i18nKey: `combat.action.rejected.${reason}`,
            data: { kind: 'attackWithBoth', actorId, reason },
        }],
    };
}

function getCombatant(state: CombatState, combatantId: string): Combatant {
    const combatant = state.combatants[combatantId];
    if (!combatant) throw new Error(`Combatant not found: ${combatantId}`);
    return combatant;
}

function replaceCombatant(state: CombatState, combatant: Combatant): CombatState {
    return {
        ...state,
        combatants: {
            ...state.combatants,
            [combatant.id]: combatant,
        },
    };
}
