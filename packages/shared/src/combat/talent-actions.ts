import type { Character, Weapon } from '../types/wfrp.types';
import { calculateSuccessLevel } from '../utils/mechanics';
import { grantAdvantage, transferAdvantage } from './advantage';
const IMPROVISED_WEAPON_PROFILE = {
    id: 'weapon_improvised',
    name: 'Improvised',
    damage: '+SB+1',
    qualities: ['Undamaging', 'Unbalanced'] as string[],
    reach: 'Personal',
};
const UNARMED_WEAPON_PROFILE = {
    id: 'weapon_unarmed',
    name: 'Unarmed',
    damage: '+SB',
    qualities: ['Undamaging'] as string[],
    reach: 'Personal',
};

import { mathRandomRng, type Rng } from './rng';
import { engagementKey } from './spatial';
const DEFAULT_TALENT_POLICY: TalentCombatPolicy = 'never';
import type {
    CombatActionRequest,
    CombatEngineResult,
    CombatEvent,
    CombatState,
    Combatant,
    FeintBuff,
    SideId,
} from './types';
import { combatantSize } from './modifiers';

export type TalentCombatPolicy = 'always' | 'never';

const SIZE_RANK: Record<string, number> = {
    tiny: 0,
    little: 1,
    small: 2,
    average: 3,
    large: 4,
    enormous: 5,
    monstrous: 6,
};

export function resolveTalentCombatAction(
    state: CombatState,
    request: CombatActionRequest,
    rng: Rng = mathRandomRng
): CombatEngineResult {
    switch (request.kind) {
        case 'beatBlade':
            return resolveBeatBlade(state, request, rng);
        case 'disarm':
            return resolveDisarm(state, request, rng);
        case 'feint':
            return resolveFeint(state, request, rng);
        case 'distractOpponent':
            return resolveDistractTalent(state, request, rng);
        default:
            return { state, events: [] };
    }
}

export function toggleReversal(
    state: CombatState,
    combatantId: string,
    active: boolean,
    policy: TalentCombatPolicy = DEFAULT_TALENT_POLICY
): CombatEngineResult {
    const combatant = getCombatant(state, combatantId);
    if (policy !== 'always') {
        return { state, events: [talentRejected(combatantId, 'reversal', 'policyRejected')] };
    }
    if (!hasCombatTalent(combatant, 'reversal')) {
        return { state, events: [talentRejected(combatantId, 'reversal', 'missingTalent')] };
    }

    return {
        state: replaceCombatant(state, { ...combatant, reversalActive: active }),
        events: [talentEvent(combatantId, 'reversal', active ? 'armed' : 'disarmed', { trigger: 'onDefend', policy })],
    };
}

export function resolveReversalOnDefenderWin(
    state: CombatState,
    defenderId: string,
    attackerSide: SideId
): CombatEngineResult {
    const defender = getCombatant(state, defenderId);
    if (!defender.reversalActive || !hasCombatTalent(defender, 'reversal')) {
        return { state, events: [] };
    }

    const transfer = transferAdvantage(state, attackerSide, defender.side, 1, { targetCombatantId: defender.id });
    const cleared = replaceCombatant(transfer.state, {
        ...getCombatant(transfer.state, defenderId),
        reversalActive: false,
    });

    return {
        state: cleared,
        events: [
            ...transfer.events,
            talentEvent(defenderId, 'reversal', 'stoleAdvantage', { trigger: 'onDefend', policy: 'always' }),
        ],
    };
}

export function resolveShieldsmanActivation(
    state: CombatState,
    actorId: string,
    targetId: string,
    mode: 'damage' | 'push',
    policy: TalentCombatPolicy = DEFAULT_TALENT_POLICY
): CombatEngineResult {
    const actor = getCombatant(state, actorId);
    if (policy !== 'always') return { state, events: [talentRejected(actor.id, 'shieldsman', 'policyRejected', targetId)] };
    if (!hasCombatTalent(actor, 'shieldsman')) return { state, events: [talentRejected(actor.id, 'shieldsman', 'missingTalent', targetId)] };
    if (!targetId) return { state, events: [talentRejected(actor.id, 'shieldsman', 'missingTarget')] };
    if (state.turnFlags.shieldsmanUsedThisTurnIds.includes(actor.id)) {
        return { state, events: [talentRejected(actor.id, 'shieldsman', 'invalidTrigger', targetId)] };
    }

    const shield = equippedShield(actor, state);
    if (!shield) return { state, events: [talentRejected(actor.id, 'shieldsman', 'invalidLoadout', targetId)] };
    if (state.advantagePools[actor.side] < 2) {
        return { state, events: [talentRejected(actor.id, 'shieldsman', 'insufficientAdvantage', targetId)] };
    }

    const spent = grantAdvantage(state, actor.side, -2, { reason: 'manual', sourceCombatantId: actor.id });
    let currentState = spent.state;
    const events: CombatEvent[] = [...spent.events];

    if (mode === 'push') {
        const target = getCombatant(currentState, targetId);
        const direction = target.position >= actor.position ? 1 : -1;
        currentState = replaceCombatants(currentState, [
            {
                ...target,
                position: target.position + direction * 2,
                engagementIds: target.engagementIds.filter(id => id !== actor.id),
            },
            {
                ...getCombatant(currentState, actor.id),
                engagementIds: actor.engagementIds.filter(id => id !== targetId),
            },
        ]);
        delete currentState.engagements[engagementKey(actor.id, targetId)];
        events.push(talentEvent(actor.id, 'shieldsman', 'push', { targetId, amount: 2, trigger: 'onDefend', policy: 'always' }));
    } else {
        const target = getCombatant(currentState, targetId);
        const damage = Math.max(1, shieldDamageValue(shield));
        const woundsAfter = Math.max(0, target.currentWounds - damage);
        currentState = replaceCombatant(currentState, {
            ...target,
            currentWounds: woundsAfter,
            character: {
                ...target.character,
                status: {
                    ...target.character.status,
                    wounds: { ...target.character.status.wounds, current: woundsAfter },
                },
            },
            resources: {
                ...target.resources,
                wounds: { ...target.resources.wounds, current: woundsAfter },
            },
        });
        events.push(talentEvent(actor.id, 'shieldsman', 'damage', { targetId, amount: damage, trigger: 'onDefend', policy: 'always' }));
    }

    currentState = {
        ...currentState,
        turnFlags: {
            ...currentState.turnFlags,
            shieldsmanUsedThisTurnIds: [...currentState.turnFlags.shieldsmanUsedThisTurnIds, actor.id],
        },
    };

    return { state: currentState, events };
}

export function clearTalentCombatPenaltiesAtTurnStart(state: CombatState, combatantId: string): CombatState {
    const combatant = getCombatant(state, combatantId);
    if (!combatant.dualWieldDefensivePenalty) return state;
    return replaceCombatant(state, { ...combatant, dualWieldDefensivePenalty: false });
}

export function feintSlBonusForAttack(attacker: Combatant, defenderId: string, round: number): number {
    const buff = attacker.feintBuffs?.find(candidate => candidate.opponentId === defenderId && candidate.expiresEndOfRound >= round);
    return buff?.slBonus ?? 0;
}

export function consumeFeintBuff(state: CombatState, attackerId: string, defenderId: string): CombatState {
    const attacker = getCombatant(state, attackerId);
    if (!attacker.feintBuffs?.length) return state;
    return replaceCombatant(state, {
        ...attacker,
        feintBuffs: attacker.feintBuffs.filter(buff => buff.opponentId !== defenderId),
    });
}

function resolveBeatBlade(state: CombatState, request: CombatActionRequest, rng: Rng): CombatEngineResult {
    const actor = getCombatant(state, request.actorId);
    const policy = request.policy ?? DEFAULT_TALENT_POLICY;
    if (policy !== 'always') return rejectTalentAction(state, 'beat-blade', actor.id, 'policyRejected');
    if (!hasCombatTalent(actor, 'beat-blade')) return rejectTalentAction(state, 'beat-blade', actor.id, 'missingTalent');
    if (!request.targetId) return rejectTalentAction(state, 'beat-blade', actor.id, 'missingTarget');

    const opponent = getCombatant(state, request.targetId);
    if (!isArmed(opponent, state)) return rejectTalentAction(state, 'beat-blade', actor.id, 'invalidLoadout', request.targetId);
    if (isLargerThan(opponent, actor)) return rejectTalentAction(state, 'beat-blade', actor.id, 'invalidTrigger', request.targetId);

    const roll = request.rollResult ?? rolld100FromRng(rng);
    const targetNumber = request.targetNumber ?? skillTarget(actor, 'melee_basic');
    let successLevel = Math.round(calculateSuccessLevel(roll, targetNumber));
    if (successLevel < 0) {
        return {
            state,
            events: [talentEvent(actor.id, 'beat-blade', 'failed', { targetId: request.targetId, trigger: 'economy', policy, amount: successLevel })],
        };
    }
    successLevel += talentRank(actor, 'beat-blade');
    const loss = successLevel >= 6 ? 2 : 1;
    const adjusted = grantAdvantage(state, opponent.side, -loss, { reason: 'manual', sourceCombatantId: opponent.id });
    return {
        state: adjusted.state,
        events: [
            ...adjusted.events,
            talentEvent(actor.id, 'beat-blade', 'poolReduced', { targetId: request.targetId, trigger: 'economy', policy, amount: loss }),
        ],
    };
}

function resolveDisarm(state: CombatState, request: CombatActionRequest, rng: Rng): CombatEngineResult {
    const actor = getCombatant(state, request.actorId);
    const policy = request.policy ?? DEFAULT_TALENT_POLICY;
    if (policy !== 'always') return rejectTalentAction(state, 'disarm', actor.id, 'policyRejected');
    if (!hasCombatTalent(actor, 'disarm')) return rejectTalentAction(state, 'disarm', actor.id, 'missingTalent');
    if (!request.targetId) return rejectTalentAction(state, 'disarm', actor.id, 'missingTarget');

    const opponent = getCombatant(state, request.targetId);
    if (!isArmed(opponent, state)) return rejectTalentAction(state, 'disarm', actor.id, 'invalidLoadout', request.targetId);
    if (isLargerThan(opponent, actor)) return rejectTalentAction(state, 'disarm', actor.id, 'invalidTrigger', request.targetId);

    const attackerRoll = request.rollResult ?? rolld100FromRng(rng);
    const defenderRoll = request.opponentRollResult ?? rolld100FromRng(rng);
    const attackerTarget = request.targetNumber ?? skillTarget(actor, request.skillId ?? 'melee_basic');
    const defenderTarget = request.opponentTargetNumber ?? skillTarget(opponent, request.opponentSkillId ?? 'melee_basic');
    let attackerSl = Math.round(calculateSuccessLevel(attackerRoll, attackerTarget));
    if (attackerSl >= 0) {
        attackerSl += talentRank(actor, 'disarm');
    }
    const defenderSl = Math.round(calculateSuccessLevel(defenderRoll, defenderTarget));
    const slDifference = attackerSl - defenderSl;

    if (slDifference <= 0) {
        return {
            state,
            events: [talentEvent(actor.id, 'disarm', 'failed', { targetId: request.targetId, trigger: 'economy', policy })],
        };
    }

    const weapon = primaryWeapon(opponent, state);
    if (!weapon) return rejectTalentAction(state, 'disarm', actor.id, 'invalidLoadout', request.targetId);


    let nextOpponent = {
        ...opponent,
        weaponLoadout: {
            primaryWeaponId: undefined,
            secondaryWeaponId: opponent.weaponLoadout?.secondaryWeaponId,
        },
        character: {
            ...opponent.character,
            inventory: {
                ...opponent.character.inventory,
                equippedWeapons: {
                    ...opponent.character.inventory.equippedWeapons,
                    [weapon.id]: false,
                },
            },
        },
    };

    const grabbed = slDifference >= 6 && hasFreeHand(actor);
    let nextActor = actor;
    if (grabbed) {
        nextActor = {
            ...actor,
            weaponLoadout: {
                primaryWeaponId: weapon.id,
                secondaryWeaponId: actor.weaponLoadout?.secondaryWeaponId,
            },
            character: {
                ...actor.character,
                inventory: {
                    ...actor.character.inventory,
                    equippedWeapons: {
                        ...actor.character.inventory.equippedWeapons,
                        [weapon.id]: true,
                    },
                    weapons: {
                        ...actor.character.inventory.weapons,
                        [weapon.id]: 1,
                    },
                },
            },
        };
    }

    const withCombatants = replaceCombatants(state, grabbed ? [nextOpponent, nextActor] : [nextOpponent]);
    return {
        state: {
            ...withCombatants,
        },
        events: [
            talentEvent(actor.id, 'disarm', grabbed ? 'disarmedAndGrabbed' : 'disarmed', {
                targetId: request.targetId,
                trigger: 'economy',
                policy,
                amount: slDifference,
            }),
        ],
    };
}

function resolveFeint(state: CombatState, request: CombatActionRequest, rng: Rng): CombatEngineResult {
    const actor = getCombatant(state, request.actorId);
    const policy = request.policy ?? DEFAULT_TALENT_POLICY;
    if (policy !== 'always') return rejectTalentAction(state, 'feint', actor.id, 'policyRejected');
    if (!hasCombatTalent(actor, 'feint')) return rejectTalentAction(state, 'feint', actor.id, 'missingTalent');
    if (!request.targetId) return rejectTalentAction(state, 'feint', actor.id, 'missingTarget');

    const opponent = getCombatant(state, request.targetId);
    if (!isArmed(opponent, state)) return rejectTalentAction(state, 'feint', actor.id, 'invalidLoadout', request.targetId);

    const attackerRoll = request.rollResult ?? rolld100FromRng(rng);
    const defenderRoll = request.opponentRollResult ?? rolld100FromRng(rng);
    const attackerTarget = request.targetNumber ?? skillTarget(actor, 'melee_fencing');
    const defenderTarget = request.opponentTargetNumber ?? skillTarget(opponent, request.opponentSkillId ?? 'melee_basic');
    let attackerSl = Math.round(calculateSuccessLevel(attackerRoll, attackerTarget));
    if (attackerSl >= 0) {
        attackerSl += talentRank(actor, 'feint');
    }
    const defenderSl = Math.round(calculateSuccessLevel(defenderRoll, defenderTarget));

    if (attackerSl <= defenderSl) {
        return {
            state,
            events: [talentEvent(actor.id, 'feint', 'failed', { targetId: request.targetId, trigger: 'economy', policy })],
        };
    }

    const buff: FeintBuff = {
        opponentId: request.targetId,
        slBonus: attackerSl,
        expiresEndOfRound: state.round + 1,
    };
    const existing = actor.feintBuffs || [];
    const withoutTarget = existing.filter(candidate => candidate.opponentId !== request.targetId);

    return {
        state: replaceCombatant(state, {
            ...actor,
            feintBuffs: [...withoutTarget, buff],
        }),
        events: [talentEvent(actor.id, 'feint', 'buffStored', { targetId: request.targetId, trigger: 'economy', policy, amount: attackerSl })],
    };
}

function resolveDistractTalent(state: CombatState, request: CombatActionRequest, rng: Rng): CombatEngineResult {
    const actor = getCombatant(state, request.actorId);
    const policy = request.policy ?? DEFAULT_TALENT_POLICY;
    if (policy !== 'always') return rejectTalentAction(state, 'distract', actor.id, 'policyRejected');
    if (!hasCombatTalent(actor, 'distract')) return rejectTalentAction(state, 'distract', actor.id, 'missingTalent');
    if (!request.targetId) return rejectTalentAction(state, 'distract', actor.id, 'missingTarget');

    const opponent = getCombatant(state, request.targetId);
    const actorRoll = request.rollResult ?? rolld100FromRng(rng);
    const opponentRoll = request.opponentRollResult ?? rolld100FromRng(rng);
    const actorTarget = request.targetNumber ?? skillTarget(actor, 'athletics');
    const opponentTarget = request.opponentTargetNumber ?? skillTarget(opponent, 'cool');
    let actorSl = Math.round(calculateSuccessLevel(actorRoll, actorTarget));
    if (actorSl >= 0) {
        actorSl += talentRank(actor, 'distract');
    }
    const opponentSl = Math.round(calculateSuccessLevel(opponentRoll, opponentTarget));

    if (actorSl <= opponentSl) {
        return {
            state,
            events: [talentEvent(actor.id, 'distract', 'failed', { targetId: request.targetId, trigger: 'economy', policy })],
        };
    }

    return {
        state: replaceCombatant(state, {
            ...opponent,
            cannotGenerateAdvantageUntilRound: state.round + 1,
        }),
        events: [talentEvent(actor.id, 'distract', 'advantageBlocked', { targetId: request.targetId, trigger: 'economy', policy })],
    };
}

function isArmed(combatant: Combatant, state: CombatState): boolean {
    const weapon = primaryWeapon(combatant, state);
    if (!weapon) return false;
    return !weapon.id.includes(':improvised') && weapon.group.toLowerCase() !== 'unarmed';
}

function primaryWeapon(combatant: Combatant, state: CombatState): Weapon | undefined {
    const byId = new Map(state.weapons.map(weapon => [weapon.id, weapon]));
    const weaponId = combatant.weaponLoadout?.primaryWeaponId
        ?? Object.entries(combatant.character.inventory.equippedWeapons || {}).find(([, equipped]) => equipped)?.[0];
    return weaponId ? byId.get(weaponId) : undefined;
}

function isLargerThan(largerCandidate: Combatant, smallerCandidate: Combatant): boolean {
    const largerRank = SIZE_RANK[combatantSize(largerCandidate)] ?? SIZE_RANK.average;
    const smallerRank = SIZE_RANK[combatantSize(smallerCandidate)] ?? SIZE_RANK.average;
    return largerRank > smallerRank;
}

function hasFreeHand(combatant: Combatant): boolean {
    const loadout = combatant.weaponLoadout;
    if (!loadout?.primaryWeaponId) return true;
    if (!loadout.secondaryWeaponId) return true;
    return loadout.primaryWeaponId === loadout.secondaryWeaponId;
}

function equippedShield(combatant: Combatant, state: CombatState): Weapon | undefined {
    return equippedWeapons(combatant, state).find(weapon =>
        weapon.group.toLowerCase().includes('shield')
        || weapon.name.toLowerCase().includes('shield')
        || weapon.qualities.some(quality => quality.toLowerCase().startsWith('shield')));
}

function equippedWeapons(combatant: Combatant, state: CombatState): Weapon[] {
    const byId = new Map(state.weapons.map(weapon => [weapon.id, weapon]));
    return Object.entries(combatant.character.inventory.equippedWeapons || {})
        .filter(([, equipped]) => equipped)
        .map(([id]) => byId.get(id))
        .filter((weapon): weapon is Weapon => !!weapon);
}

function shieldDamageValue(weapon: Weapon): number {
    const match = String(weapon.damage).match(/[+-]?\d+/g);
    return match ? match.reduce((total, value) => total + Number(value), 0) : 1;
}

function reverseD100(roll: number): number {
    if (roll === 100) return 1;
    const tens = Math.floor(roll / 10);
    const ones = roll % 10;
    return ones * 10 + tens;
}

function rolld100FromRng(rng: Rng): number {
    return Math.floor(rng.next() * 100) + 1;
}

function talentEvent(combatantId: string, talentId: string, effect: string, data: Record<string, unknown> = {}): CombatEvent {
    return {
        type: 'TalentEffectApplied',
        i18nKey: `combat.talent.${talentId}.${effect}`,
        data: {
            combatantId,
            talentId,
            effect,
            ...data,
        },
    };
}

function talentRejected(
    combatantId: string,
    talentId: string,
    reason: 'missingTalent' | 'policyRejected' | 'insufficientAdvantage' | 'invalidTrigger' | 'missingTarget' | 'invalidLoadout',
    targetId?: string
): CombatEvent {
    return {
        type: 'TalentActivationRejected',
        i18nKey: `combat.talent.rejected.${reason}`,
        data: { combatantId, talentId, targetId, reason },
    };
}

function skillTarget(combatant: Combatant, skillId: string): number {
    const skill = combatant.character.skills.find(candidate => candidate.id === skillId || candidate.name.toLowerCase() === skillId.toLowerCase());
    if (skill) {
        const characteristic = combatant.character.characteristics[skill.characteristic as keyof Character['characteristics']];
        const charValue = characteristic.initial + characteristic.advances + characteristic.talents + characteristic.modifier;
        return charValue + skill.advances + skill.talents;
    }
    const key = skillId.includes('fencing') ? 'ws' : skillId === 'cool' ? 'wp' : 'ag';
    const characteristic = combatant.character.characteristics[key as 'ws' | 'wp' | 'ag'];
    return characteristic.initial + characteristic.advances + characteristic.talents + characteristic.modifier;
}

function talentRank(combatant: Combatant, talentId: string): number {
    return combatant.character.talents?.[talentId] ?? 0;
}

function hasCombatTalent(combatant: Combatant, talentId: string): boolean {
    return talentRank(combatant, talentId) > 0;
}

function offHandPenaltyFor(combatant: Combatant): number {
    const rank = talentRank(combatant, 'ambidextrous');
    if (rank >= 2) return 0;
    if (rank === 1) return -10;
    return -20;
}

function rejectTalentAction(
    state: CombatState,
    talentId: string,
    actorId: string,
    reason: 'missingTalent' | 'policyRejected' | 'missingTarget' | 'invalidLoadout' | 'invalidTrigger',
    targetId?: string
): CombatEngineResult {
    return { state, events: [talentRejected(actorId, talentId, reason, targetId)] };
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

function replaceCombatants(state: CombatState, combatants: Combatant[]): CombatState {
    return {
        ...state,
        combatants: {
            ...state.combatants,
            ...Object.fromEntries(combatants.map(combatant => [combatant.id, combatant])),
        },
    };
}
