import type { NormalizedTalentEffect, Talent, TalentEffect, TalentEffectKind, TalentEffectWhen, Weapon } from '../types/wfrp.types';
import { calculateSuccessLevel } from '../utils/mechanics';
import { calculateCharacteristicBonus } from '../utils/skills';
import { spendAdvantage } from './advantage';
import { resolveShieldsmanActivation } from './talent-actions';
import { hasQuality } from './qualities';
import { applyFortunePostRollHook, type FortunePostRollHook } from './resources';
import { engagementKey, isInfighting } from './spatial';
import type {
    CombatEngineResult,
    CombatEvent,
    CombatState,
    Combatant,
    DamageModifierContext,
    DamageMultiplierContext,
    MeleeHookContext,
    MeleeResolutionHooks,
    ModifierSource,
    OnHitContext,
    QualityActivation,
    ResolvedOpposedRoll,
    SlModifierContext,
} from './types';

export type TalentCoverageClassification =
    | 'typed-wired'
    | 'typed-not-wired'
    | 'passive-needs-typed-effect'
    | 'activated-or-reaction'
    | 'deferred-psychology'
    | 'deferred-action-economy'
    | 'non-combat';

export interface TalentCoverageRow {
    id: string;
    name: string;
    effects: string[];
    conditions: string[];
    classification: TalentCoverageClassification;
    notes?: string;
}

export interface TalentPredicateContext {
    state: CombatState;
    combatant: Combatant;
    opponent?: Combatant;
    action?: MeleeHookContext['action'];
    roll?: ResolvedOpposedRoll;
    role?: 'attacker' | 'defender' | 'initiative' | 'reaction';
    testId?: string;
}

export type TalentPredicate = (context: TalentPredicateContext) => boolean;

interface ResolvedTalentEffect {
    talentId: string;
    kind: TalentEffectKind;
    value?: number | string;
    appliesTo?: string[];
    when: string[];
    trigger?: string;
    cost?: { resource: 'advantage' | 'move' | 'action' | 'reaction'; amount: number };
    params?: Record<string, number | string | boolean | string[] | number[] | undefined>;
}

const legacyEffectKind: Record<string, TalentEffectKind> = {
    SL_BONUS_ON_SUCCESS: 'slBonus',
    SL_BONUS: 'slBonus',
    WOUNDS_BONUS: 'woundsBonus',
    ENCUMBRANCE_BONUS: 'encumbranceBonus',
    TEST_BONUS: 'testBonus',
    DAMAGE_BONUS: 'damageBonus',
    DAMAGE_REDUCTION: 'damageReduction',
    DAMAGE_CALCULATION_MODIFIER: 'damageCalculationModifier',
    DAMAGE_MULTIPLIER_ON_CRITICAL: 'criticalDamageMultiplier',
    CRITICAL_DAMAGE_TABLE_ROLL_MODIFIER: 'criticalRollChoice',
    ARMOUR_PIERCING: 'armourPointIgnore',
    INITIATIVE_BONUS: 'initiativeBonus',
    REVERSE_ROLL_ON_FAIL: 'reverseRollOnFail',
    ATTRIBUTE_BONUS: 'attributeBonus',
    CHARACTERISTIC_BONUS: 'characteristicBonus',
    FEAR_RATING: 'fearRating',
    AUTO_PASS_FIRST_TEST: 'autoPassFirstTest',
    ADVANTAGE_BONUS: 'advantageBonus',
    BLEEDING_CONDITION_IGNORE: 'conditionLossIgnore',
};

const legacyConditionWhen: Record<string, TalentEffectWhen> = {
    charging: 'charging',
    'when charge': 'whenCharge',
    'when defending': 'whenDefending',
    'defending with a shield': 'defendingWithShield',
    'if weapon has fast quality': 'weaponFast',
    'during melee': 'duringMelee',
    'during combat rounds': 'duringCombatRounds',
    surprise: 'surprise',
    frenzied: 'frenzied',
    'beat blade': 'beatBlade',
    'when disarming': 'disarming',
    'to touch an opponent': 'touchOpponent',
    'when distracting': 'distracting',
    'when beside an ally with drilled': 'besideAllyWithDrilled',
    'when attacking with two weapons': 'attackingWithTwoWeapons',
    'when making a fast shot': 'fastShot',
    'for feints': 'feint',
    'when making extra attacks': 'extraAttack',
    'combat initiative': 'combatInitiative',
    'when in-fighting': 'infighting',
    'when in-fighting, or to enter in-fighting': 'infighting',
    'to resist stunned': 'resistStunned',
    'when prone': 'prone',
    aiming: 'aiming',
    'to reload a ranged weapon': 'reload',
    'when reloading': 'reload',
    'against hated group': 'hatedGroup',
    'to resist group': 'resistGroup',
    'using bandages': 'usingBandages',
    'when fleeing': 'fleeing',
    'enclosed spaces': 'confinedSpace',
    'in enclosed environments': 'confinedSpace',
    'from specified enemy': 'specifiedEnemy',
    'to oppose your enemy’s intimidate, fear, and terror': 'specifiedEnemy',
    'to oppose your enemy\'s intimidate, fear, and terror': 'specifiedEnemy',
    'after daily flagellation': 'dailyFlagellation',
    'to resist the associated threat': 'associatedThreat',
    'when determining damage': 'determiningDamage',
    'if target is larger and you score a critical': 'largerTargetCritical',
    'long–extreme range': 'longExtremeRange',
    'long-extreme range': 'longExtremeRange',
    'concerning running': 'running',
    'to activate this talent': 'stepAside',
    'to remove broken conditions': 'removeBroken',
    'when striking to stun': 'strikingToStun',
    'in opposed strength tests': 'opposedStrength',
    'to resist blackpowder panic': 'blackpowderPanic',
    'during war': 'duringWar',
    'concerning this talent': 'always',
};

export interface TalentActivationRequest {
    talentId: string;
    actorId: string;
    targetId?: string;
    trigger: QualityActivation['trigger'];
    effect?: string;
    policy?: 'always' | 'never';
}

export interface TalentRerollRequest {
    talentId: string;
    actorId: string;
    testId: string;
    rollResult: number;
    targetNumber: number;
    policy?: 'always' | 'never';
}

export interface TalentConditionReactionRequest {
    talentId: 'iron-jaw' | 'jump-up';
    actorId: string;
    conditionId: 'condition_stunned' | 'condition_prone';
    rollResult: number;
    targetNumber: number;
    policy?: 'always' | 'never';
}

export const DEFAULT_TALENT_POLICY: 'never' = 'never';

export const combatTalentAuditIds = [
    'accurate-shot',
    'ambidextrous',
    'battle-rage',
    'beat-blade',
    'berserk-charge',
    'careful-strike',
    'combat-aware',
    'combat-master',
    'combat-reflexes',
    'commanding-presence',
    'deadeye-shot',
    'dirty-fighting',
    'disarm',
    'distract',
    'drilled',
    'dual-wielder',
    'enclosed-fighter',
    'fast-shot',
    'fearless',
    'feint',
    'field-dressing',
    'flagellant',
    'flee',
    'frenzy',
    'frightening',
    'furious-assault',
    'gunner',
    'hatred',
    'implacable',
    'in-fighter',
    'iron-jaw',
    'iron-will',
    'jump-up',
    'menacing',
    'rapid-reload',
    'reaction-strike',
    'relentless',
    'resistance',
    'resolute',
    'reversal',
    'riposte',
    'robust',
    'sharpshooter',
    'shieldsman',
    'slayer',
    'sixth-sense',
    'sniper',
    'sprinter',
    'step-aside',
    'stout-hearted',
    'strike-mighty-blow',
    'strike-to-injure',
    'strike-to-stun',
    'strong-back',
    'sure-shot',
    'unshakable',
    'war-leader',
] as const;

export const deferredCombatTalentIds = [
    'battle-rage',
    'fearless',
    'frenzy',
    'frightening',
    'hatred',
    'menacing',
] as const;

export const actionEconomyTalentIds = [
    'fast-shot',
    'furious-assault',
    'reaction-strike',
] as const;

export const talentConditionPredicates: Record<string, TalentPredicate> = {
    always: () => true,
    whencharge: context => !!context.action?.isCharging || !!context.state.turnFlags.chargedCombatantIds.includes(context.combatant.id),
    charging: context => !!context.action?.isCharging || !!context.state.turnFlags.chargedCombatantIds.includes(context.combatant.id),
    'when charge': context => !!context.action?.isCharging || !!context.state.turnFlags.chargedCombatantIds.includes(context.combatant.id),
    whendefending: context => context.role === 'defender',
    'when defending': context => context.role === 'defender',
    defendingwithshield: context => context.role === 'defender' && !!equippedShield(context.combatant, context.state),
    'defending with a shield': context => context.role === 'defender' && !!equippedShield(context.combatant, context.state),
    weaponfast: context => !!equippedWeapon(context.combatant, context.state) && hasQuality(equippedWeapon(context.combatant, context.state)!, 'fast'),
    'if weapon has fast quality': context => !!equippedWeapon(context.combatant, context.state) && hasQuality(equippedWeapon(context.combatant, context.state)!, 'fast'),
    duringmelee: context => !!context.action,
    'during melee': context => !!context.action,
    duringcombatrounds: context => context.state.round > 0,
    'during combat rounds': context => context.state.round > 0,
    surprise: context => context.combatant.conditions.includes('condition_surprised') || !!context.opponent?.conditions.includes('condition_surprised'),
    frenzied: context => context.combatant.conditions.includes('condition_frenzied'),
    beatblade: context => context.testId === 'beat_blade' || context.action?.isExtraAttack === true,
    'beat blade': context => context.testId === 'beat_blade' || context.action?.isExtraAttack === true,
    disarming: context => context.testId === 'disarm',
    'when disarming': context => context.testId === 'disarm',
    touchopponent: context => !!context.opponent && context.role === 'attacker',
    'to touch an opponent': context => !!context.opponent && context.role === 'attacker',
    distracting: context => context.testId === 'distract',
    'when distracting': context => context.testId === 'distract',
    besideallywithdrilled: context => Object.values(context.state.combatants).some(other => (
        other.id !== context.combatant.id
        && other.side === context.combatant.side
        && talentRank(other, 'drilled') > 0
        && context.combatant.engagementIds.some(id => other.engagementIds.includes(id))
    )),
    'when beside an ally with drilled': context => Object.values(context.state.combatants).some(other => (
        other.id !== context.combatant.id
        && other.side === context.combatant.side
        && talentRank(other, 'drilled') > 0
        && context.combatant.engagementIds.some(id => other.engagementIds.includes(id))
    )),
    attackingwithtwoweapons: context => context.action?.hand === 'secondary' || hasTwoWeaponLoadout(context.combatant),
    'when attacking with two weapons': context => context.action?.hand === 'secondary' || hasTwoWeaponLoadout(context.combatant),
    fastshot: context => context.combatant.initiativeOverride === true,
    'when making a fast shot': context => context.combatant.initiativeOverride === true,
    feint: context => context.testId === 'feint',
    'for Feints': context => context.testId === 'feint',
    extraattack: context => context.action?.isExtraAttack === true,
    'when making extra attacks': context => context.action?.isExtraAttack === true,
    combatinitiative: context => context.role === 'initiative',
    'combat initiative': context => context.role === 'initiative',
    infighting: context => !!context.opponent && isInfighting(context.state, context.combatant.id, context.opponent.id),
    'when in-fighting': context => !!context.opponent && isInfighting(context.state, context.combatant.id, context.opponent.id),
    'when in-fighting, or to enter in-fighting': context => !!context.opponent && isInfighting(context.state, context.combatant.id, context.opponent.id),
    resiststunned: context => context.testId === 'endurance' && context.combatant.conditions.includes('condition_stunned'),
    'to resist stunned': context => context.testId === 'endurance' && context.combatant.conditions.includes('condition_stunned'),
    prone: context => context.combatant.conditions.includes('condition_prone'),
    'when prone': context => context.combatant.conditions.includes('condition_prone'),
    aiming: context => context.testId === 'aim',
    reload: context => context.testId === 'reload',
    'to reload a ranged weapon': context => context.testId === 'reload',
    'when reloading': context => context.testId === 'reload',
    hatedgroup: context => context.testId === 'cool' || context.testId === 'wp' || context.testId === 'willpower',
    'against hated group': context => context.testId === 'cool' || context.testId === 'wp' || context.testId === 'willpower',
    resistgroup: context => context.testId === 'wp' || context.testId === 'willpower',
    'to resist group': context => context.testId === 'wp' || context.testId === 'willpower',
    usingbandages: context => context.testId === 'heal',
    fleeing: context => context.testId === 'athletics',
    confinedspace: context => context.testId === 'dodge' || !!context.action,
    specifiedenemy: context => context.testId === 'cool',
    dailyflagellation: context => context.testId === 'frenzy' || context.testId === 'wp' || context.testId === 'willpower',
    associatedthreat: context => ['resistance', 'cool', 'endurance'].includes(context.testId ?? ''),
    determiningdamage: context => context.role === 'attacker',
    largertargetcritical: context => context.role === 'attacker',
    longextremerange: context => context.testId?.startsWith('ranged') ?? false,
    running: context => context.testId === 'athletics',
    stepaside: context => context.testId === 'dodge',
    removebroken: context => context.testId === 'cool' && context.combatant.conditions.includes('condition_broken'),
    strikingtostun: context => context.testId?.startsWith('melee') ?? false,
    opposedstrength: context => context.testId === 's' || context.testId === 'strength',
    blackpowderpanic: context => context.testId === 'cool',
    duringwar: context => context.testId === 'leadership',
};

export const distinctCombatTalentConditions = Object.keys(talentConditionPredicates).sort();

export const talentActivationRegistry: Record<string, QualityActivation[]> = {
    shieldsman: [{
        trigger: 'onDefend',
        cost: { resource: 'advantage', amount: 2 },
        effect: 'shieldDamageOrPush',
        gate: 'defending with a shield',
        policy: DEFAULT_TALENT_POLICY,
    }],
    riposte: [{
        trigger: 'reaction',
        effect: 'defenderDamageOnWinningDefence',
        gate: 'if weapon has Fast quality',
        policy: DEFAULT_TALENT_POLICY,
    }],
    'reaction-strike': [{
        trigger: 'reaction',
        effect: 'freeAttackWhenCharged',
        gate: 'charging',
        policy: DEFAULT_TALENT_POLICY,
    }],
    'furious-assault': [{
        trigger: 'economy',
        cost: { resource: 'advantage', amount: 1 },
        effect: 'extraAttack',
        gate: 'when making extra attacks',
        policy: DEFAULT_TALENT_POLICY,
    }],
};

export function createTalentHooks(): Partial<MeleeResolutionHooks> {
    return {
        preRollModifiers: talentPreRollModifiers,
        slModifiers: talentSlModifier,
        damageModifiers: talentDamageModifier,
        damageMultiplier: talentDamageMultiplier,
        onHitEffects: context => talentOnHitEffects(context),
        onCritEffects: context => talentCritEffects(context),
    };
}

export function catalogueCombatTalentCoverage(talents: Talent[]): TalentCoverageRow[] {
    return talents
        .filter(talent => combatTalentAuditIds.includes(talent.id as typeof combatTalentAuditIds[number]) || isCombatRelevantTalent(talent))
        .map(talent => ({
            id: talent.id,
            name: talent.name,
            effects: (talent.effects || []).map(effectLabel),
            conditions: [...new Set((talent.effects || []).flatMap(effectWhenLabels))],
            classification: classifyTalent(talent),
            notes: coverageNotes(talent),
        }));
}

export function evaluateTalentCondition(condition: string | undefined, context: TalentPredicateContext): boolean {
    if (!condition) return true;
    const normalized = normalizeCondition(condition);
    const predicate = talentConditionPredicates[normalized];
    if (!predicate) return false;
    return predicate(context);
}

export function applyTalentRerollHook(
    roll: ResolvedOpposedRoll,
    state: CombatState,
    request: TalentRerollRequest
): { roll: ResolvedOpposedRoll; events: CombatEvent[]; hook?: FortunePostRollHook } {
    const actor = getCombatant(state, request.actorId);
    if (request.policy !== 'always') {
        return {
            roll,
            events: [talentRejected(request.actorId, request.talentId, 'policyRejected')],
        };
    }
    if (talentRank(actor, request.talentId) <= 0) {
        return { roll, events: [talentRejected(request.actorId, request.talentId, 'missingTalent')] };
    }
    if (Math.round(calculateSuccessLevel(request.rollResult, request.targetNumber)) >= 0) {
        return { roll, events: [] };
    }

    const reversed = reverseD100(request.rollResult);
    if (Math.round(calculateSuccessLevel(reversed, request.targetNumber)) < 0) {
        return { roll, events: [] };
    }

    const hook = { reroll: true, rerollResult: reversed };
    return {
        roll: applyFortunePostRollHook(roll, hook),
        hook,
        events: [talentEvent(request.actorId, request.talentId, 'reroll', {
            amount: reversed,
            trigger: 'postRoll',
            policy: request.policy,
        })],
    };
}

export function resolveTalentActivation(state: CombatState, request: TalentActivationRequest): CombatEngineResult {
    const actor = getCombatant(state, request.actorId);
    const policy = request.policy ?? DEFAULT_TALENT_POLICY;
    if (policy !== 'always') return { state, events: [talentRejected(actor.id, request.talentId, 'policyRejected', request.targetId)] };
    if (talentRank(actor, request.talentId) <= 0) return { state, events: [talentRejected(actor.id, request.talentId, 'missingTalent', request.targetId)] };
    if (!request.targetId) return { state, events: [talentRejected(actor.id, request.talentId, 'missingTarget')] };

    if (request.talentId === 'shieldsman') {
        return resolveShieldsmanActivation(
            state,
            actor.id,
            request.targetId,
            request.effect === 'push' ? 'push' : 'damage',
            request.policy ?? DEFAULT_TALENT_POLICY
        );
    }

    if (request.talentId === 'riposte') {
        return resolveRiposteReaction(state, actor, request.targetId);
    }

    return { state, events: [talentRejected(actor.id, request.talentId, 'invalidTrigger', request.targetId)] };
}

export function registerTalentReactions(state: CombatState, combatantId: string): CombatEvent[] {
    const combatant = getCombatant(state, combatantId);
    const events: CombatEvent[] = [];
    if (talentRank(combatant, 'riposte') > 0) {
        events.push({
            type: 'TalentReactionRegistered',
            i18nKey: 'combat.talent.reaction.registered',
            data: { combatantId, talentId: 'riposte', window: 'winningDefence', policy: DEFAULT_TALENT_POLICY },
        });
    }
    if (talentRank(combatant, 'reaction-strike') > 0) {
        events.push({
            type: 'TalentReactionRegistered',
            i18nKey: 'combat.talent.reaction.registered',
            data: { combatantId, talentId: 'reaction-strike', window: 'charged', policy: DEFAULT_TALENT_POLICY },
        });
    }
    if (talentRank(combatant, 'furious-assault') > 0) {
        events.push({
            type: 'TalentReactionRegistered',
            i18nKey: 'combat.talent.reaction.registered',
            data: { combatantId, talentId: 'furious-assault', window: 'extraAttack', policy: DEFAULT_TALENT_POLICY },
        });
    }
    return events;
}

export function prepareTalentExtraAttack(state: CombatState, combatantId: string, policy: 'always' | 'never' = DEFAULT_TALENT_POLICY): CombatEngineResult {
    const combatant = getCombatant(state, combatantId);
    if (policy !== 'always') return { state, events: [talentRejected(combatantId, 'furious-assault', 'policyRejected')] };
    if (talentRank(combatant, 'furious-assault') <= 0) return { state, events: [talentRejected(combatantId, 'furious-assault', 'missingTalent')] };

    return {
        state: {
            ...state,
            turnFlags: {
                ...state.turnFlags,
                talentExtraAttackCombatantIds: [...new Set([...state.turnFlags.talentExtraAttackCombatantIds, combatantId])],
            },
        },
        events: [talentEvent(combatantId, 'furious-assault', 'extraAttack', { trigger: 'economy', policy, deferred: true })],
    };
}

export function resolveTalentConditionReaction(state: CombatState, request: TalentConditionReactionRequest): CombatEngineResult {
    const actor = getCombatant(state, request.actorId);
    const policy = request.policy ?? DEFAULT_TALENT_POLICY;
    if (policy !== 'always') return { state, events: [talentRejected(actor.id, request.talentId, 'policyRejected')] };
    if (talentRank(actor, request.talentId) <= 0) return { state, events: [talentRejected(actor.id, request.talentId, 'missingTalent')] };

    const successLevel = Math.round(calculateSuccessLevel(request.rollResult, request.targetNumber));
    if (request.talentId === 'iron-jaw') {
        if (request.conditionId !== 'condition_stunned' || !actor.conditions.includes('condition_stunned')) {
            return { state, events: [talentRejected(actor.id, request.talentId, 'invalidTrigger')] };
        }
        if (successLevel < 0) {
            return { state, events: [talentEvent(actor.id, request.talentId, 'reactionFailed', { trigger: 'onGainCondition', policy, conditionId: request.conditionId })] };
        }
        const removeCount = 1 + Math.max(0, successLevel);
        const updated = removeConditionStacks(actor, 'condition_stunned', removeCount);
        return {
            state: replaceCombatant(state, updated),
            events: [talentEvent(actor.id, request.talentId, 'conditionRemoved', { trigger: 'onGainCondition', policy, conditionId: request.conditionId, amount: actor.conditions.length - updated.conditions.length })],
        };
    }

    if (request.conditionId !== 'condition_prone' || !actor.conditions.includes('condition_prone')) {
        return { state, events: [talentRejected(actor.id, request.talentId, 'invalidTrigger')] };
    }
    if (successLevel < 0) {
        return { state, events: [talentEvent(actor.id, request.talentId, 'reactionFailed', { trigger: 'onGainCondition', policy, conditionId: request.conditionId })] };
    }
    const updated = removeConditionStacks(actor, 'condition_prone', 1);
    return {
        state: replaceCombatant(state, updated),
        events: [talentEvent(actor.id, request.talentId, 'conditionRemoved', { trigger: 'onGainCondition', policy, conditionId: request.conditionId, amount: actor.conditions.length - updated.conditions.length })],
    };
}

export function getTalentInitiativeModifier(combatant: Combatant, state: CombatState): number {
    return applicableEffects(combatant, state, 'initiative', {
        state,
        combatant,
        role: 'initiative',
        testId: 'initiative',
    })
        .filter(effect => effect.kind === 'initiativeBonus' && typeof effect.value === 'number')
        .reduce((total, effect) => total + Number(effect.value) * talentRank(combatant, effect.talentId), 0);
}

export function offHandPenaltyFor(combatant: Combatant): number {
    const rank = talentRank(combatant, 'ambidextrous');
    if (rank >= 2) return 0;
    if (rank === 1) return -10;
    return -20;
}

export function hasCombatTalent(combatant: Combatant, talentId: string): boolean {
    return talentRank(combatant, talentId) > 0;
}

export function resolveCarefulStrikeHitLocation(combatant: Combatant, attackRoll: number, naturalLocation: string, chosenLocation?: string): string {
    if (!chosenLocation) return naturalLocation;
    if (chosenLocation && talentRank(combatant, 'careful-strike') <= 0) return chosenLocation;
    const rank = talentRank(combatant, 'careful-strike');
    if (rank <= 0) return naturalLocation;
    return hitLocationShiftDistance(attackRoll, chosenLocation) <= rank * 10 ? chosenLocation : naturalLocation;
}

export function ignoresWeaponLengthPenalty(combatant: Combatant): boolean {
    return talentRank(combatant, 'in-fighter') > 0;
}

export function calledShotPenaltyFor(context: MeleeHookContext): number {
    const chosenLocation = context.action.chosenHitLocation;
    if (!chosenLocation) return 0;
    const roll = context.action.attacker.rollResult;
    if (roll !== undefined && talentRank(context.attacker, 'careful-strike') > 0 && hitLocationShiftDistance(roll, chosenLocation) <= talentRank(context.attacker, 'careful-strike') * 10) {
        return 0;
    }
    if (chosenLocation.toLowerCase() === 'head' && talentRank(context.attacker, 'strike-to-stun') > 0 && attackHasPummel(context)) {
        return 0;
    }
    return -20;
}

function talentPreRollModifiers(context: MeleeHookContext): ModifierSource[] {
    const effects = applicableEffects(context.attacker, context.state, context.action.attacker.skillId, {
        ...context,
        combatant: context.attacker,
        opponent: context.defender,
        role: 'attacker',
        testId: context.action.attacker.skillId,
    });

    return effects
        .filter(effect => (effect.kind === 'testBonus' || effect.kind === 'characteristicBonus') && typeof effect.value === 'number')
        .map(effect => ({
            id: `talent:${effect.talentId}:${effect.kind}`,
            type: 'talent',
            phase: 'preRollModifiers',
            value: Number(effect.value) * talentRank(context.attacker, effect.talentId),
            combatantId: context.attacker.id,
        }));
}

function talentSlModifier(context: SlModifierContext): number {
    const defenderPhase = !!context.defenderRoll;
    const combatant = defenderPhase ? context.defender : context.attacker;
    const opponent = defenderPhase ? context.attacker : context.defender;
    const roll = defenderPhase ? context.defenderRoll! : context.attackerRoll;

    const effectBonus = applicableEffects(combatant, context.state, roll.skillId, {
        ...context,
        combatant,
        opponent,
        roll,
        role: defenderPhase ? 'defender' : 'attacker',
        testId: roll.skillId,
    })
        .filter(effect => effect.kind === 'slBonus' && typeof effect.value === 'number' && effect.trigger !== 'onSuccess')
        .reduce((total, effect) => total + Number(effect.value) * talentRank(combatant, effect.talentId), 0);

    if (roll.roundedSuccessLevel + effectBonus < 0) return effectBonus;

    return effectBonus + tiedTestSlBonus(combatant, context.state, roll.skillId, {
        ...context,
        combatant,
        opponent,
        roll,
        role: defenderPhase ? 'defender' : 'attacker',
        testId: roll.skillId,
    });
}

function talentDamageModifier(context: DamageModifierContext): number {
    const attackerEffects = applicableEffects(context.attacker, context.state, context.action.attacker.skillId, {
        ...context,
        combatant: context.attacker,
        opponent: context.defender,
        role: 'attacker',
        testId: context.action.attacker.skillId,
    });
    const defenderEffects = applicableEffects(context.defender, context.state, context.action.attacker.skillId, {
        ...context,
        combatant: context.defender,
        opponent: context.attacker,
        role: 'defender',
        testId: context.action.attacker.skillId,
    });

    const damageBonus = attackerEffects
        .filter(effect => effect.kind === 'damageBonus' && typeof effect.value === 'number')
        .reduce((total, effect) => total + Number(effect.value) * talentRank(context.attacker, effect.talentId), 0);
    const damageReduction = defenderEffects
        .filter(effect => effect.kind === 'damageReduction' && typeof effect.value === 'number')
        .reduce((total, effect) => total + Number(effect.value) * talentRank(context.defender, effect.talentId), 0);
    const slayerStrengthBonus = attackerEffects.some(effect => effect.kind === 'damageCalculationModifier') || talentRank(context.attacker, 'slayer') > 0
        ? Math.max(0, calculateCharacteristicBonus(context.defender.character.characteristics.t) - calculateCharacteristicBonus(context.attacker.character.characteristics.s))
        : 0;

    return damageBonus + slayerStrengthBonus - damageReduction;
}

function talentDamageMultiplier(context: DamageMultiplierContext): number {
    if (!context.criticalHit || !context.action.attacker.skillId.toLowerCase().startsWith('melee')) return 1;
    const slayerRank = talentRank(context.attacker, 'slayer');
    if (slayerRank <= 0) return 1;
    const steps = sizeStepsLarger(context.attacker, context.defender);
    return steps > 0 ? steps : 1;
}

function talentOnHitEffects(context: OnHitContext): CombatEngineResult {
    const events: CombatEvent[] = [];
    let state = context.state;
    if (talentRank(context.attacker, 'furious-assault') > 0 && context.action.attacker.skillId.toLowerCase().includes('melee')) {
        events.push(talentEvent(context.attacker.id, 'furious-assault', 'extraAttackAvailable', { trigger: 'economy', policy: DEFAULT_TALENT_POLICY, deferred: true }));
    }
    if (talentRank(context.attacker, 'strike-to-stun') > 0 && context.hitLocation.toLowerCase() === 'head' && attackHasPummel(context)) {
        const defender = getCombatant(state, context.defender.id);
        state = replaceCombatant(state, { ...defender, conditions: [...defender.conditions, 'condition_stunned'] });
        events.push(talentEvent(context.attacker.id, 'strike-to-stun', 'pummelStun', { targetId: context.defender.id, trigger: 'onHit', amount: 1 }));
    }
    return { state, events };
}

function talentCritEffects(context: DamageModifierContext): CombatEvent[] {
    const events: CombatEvent[] = [];
    if (talentRank(context.attacker, 'strike-to-injure') > 0) {
        events.push(talentEvent(context.attacker.id, 'strike-to-injure', 'chooseCriticalRoll', { trigger: 'onCrit', policy: DEFAULT_TALENT_POLICY, deferred: true }));
    }
    const slayerSteps = sizeStepsLarger(context.attacker, context.defender);
    if (talentRank(context.attacker, 'slayer') > 0 && slayerSteps > 0) {
        events.push(talentEvent(context.attacker.id, 'slayer', 'largerTargetMultiplier', { targetId: context.defender.id, trigger: 'onCrit', amount: slayerSteps }));
    }
    return events;
}

function resolveRiposteReaction(state: CombatState, actor: Combatant, targetId: string): CombatEngineResult {
    const weapon = equippedWeapon(actor, state);
    if (!weapon || !hasQuality(weapon, 'fast')) return { state, events: [talentRejected(actor.id, 'riposte', 'invalidLoadout', targetId)] };
    const target = getCombatant(state, targetId);
    const damage = Math.max(1, weaponDamageNumber(weapon));
    const woundsAfter = Math.max(0, target.currentWounds - damage);
    return {
        state: replaceCombatant(state, {
            ...target,
            currentWounds: woundsAfter,
            resources: { ...target.resources, wounds: { ...target.resources.wounds, current: woundsAfter } },
            character: { ...target.character, status: { ...target.character.status, wounds: { ...target.character.status.wounds, current: woundsAfter } } },
        }),
        events: [talentEvent(actor.id, 'riposte', 'reactionDamage', { targetId, amount: damage, trigger: 'reaction', policy: 'always' })],
    };
}

function applicableEffects(combatant: Combatant, state: CombatState, testId: string, context: TalentPredicateContext): ResolvedTalentEffect[] {
    return Object.entries(combatant.character.talents || {}).flatMap(([talentId, rank]) => {
        if (rank <= 0) return [];
        const talent = state.talents.find(candidate => candidate.id === talentId || normalizeName(candidate.name) === normalizeName(talentId));
        if (!talent) return [];
        return (talent.effects || [])
            .map(effect => normalizeTalentEffect(effect, talentId))
            .filter(effect => appliesToTest(effect, testId))
            .filter(effect => effect.when.every(when => evaluateTalentCondition(when, context)));
    });
}

function normalizeTalentEffect(effect: TalentEffect, talentId: string): ResolvedTalentEffect {
    if (isNormalizedTalentEffect(effect)) {
        return {
            talentId,
            kind: effect.kind,
            value: effect.value,
            appliesTo: effect.appliesTo,
            when: normalizeWhenList(effect.when),
            trigger: effect.trigger,
            cost: effect.cost,
            params: effect.params,
        };
    }

    const normalizedCondition = effect.condition ? normalizeCondition(effect.condition) : undefined;
    return {
        talentId,
        kind: legacyEffectKind[effect.type] ?? 'ruleNote',
        value: effect.value,
        appliesTo: effect.appliesTo,
        when: normalizedCondition ? [legacyConditionWhen[normalizedCondition] ?? normalizedConditionToWhen(normalizedCondition)] : ['always'],
        trigger: effect.type === 'SL_BONUS_ON_SUCCESS' ? 'onSuccess' : undefined,
    };
}

function normalizeWhenList(when: TalentEffectWhen | TalentEffectWhen[] | undefined): string[] {
    if (!when) return ['always'];
    return Array.isArray(when) ? when : [when];
}

function normalizedConditionToWhen(condition: string): string {
    const compact = condition.replace(/[^a-z0-9]+/g, '');
    return talentConditionPredicates[compact] ? compact : condition;
}

function appliesToTest(effect: ResolvedTalentEffect, testId: string): boolean {
    if (effect.kind === 'damageReduction' || effect.kind === 'conditionLossIgnore') return true;
    if (!effect.appliesTo || effect.appliesTo.length === 0) return true;
    const normalizedTest = normalizeName(testId);
    return effect.appliesTo.some(target => {
        const normalizedTarget = normalizeName(target);
        return normalizedTest === normalizedTarget
            || normalizedTest.includes(normalizedTarget)
            || normalizedTarget.includes(normalizedTest)
            || (normalizedTarget === 'melee' && normalizedTest.startsWith('melee'))
            || (normalizedTarget === 'ranged' && normalizedTest.startsWith('ranged'));
    });
}

function tiedTestSlBonus(combatant: Combatant, state: CombatState, testId: string, context: TalentPredicateContext): number {
    return Object.entries(combatant.character.talents || {}).reduce((total, [talentId, rank]) => {
        if (rank <= 0) return total;
        const talent = state.talents.find(candidate => candidate.id === talentId || normalizeName(candidate.name) === normalizeName(talentId));
        if (!talent || !talent.tests || talent.tests.length === 0) return total;
        const applies = talent.tests.some(test => testDescriptionApplies(test, testId) && testDescriptionWhens(test).every(when => evaluateTalentCondition(when, context)));
        return applies ? total + rank : total;
    }, 0);
}

function testDescriptionApplies(description: string, testId: string): boolean {
    const normalizedDescription = normalizeName(description);
    const normalizedTest = normalizeName(testId);
    if (normalizedDescription.includes('any_test')) return true;
    if (normalizedDescription.includes(normalizedTest) || normalizedTest.includes(normalizedDescription)) return true;
    if (normalizedTest.startsWith('melee') && normalizedDescription.includes('melee')) return true;
    if (normalizedTest.startsWith('ranged') && normalizedDescription.includes('ranged')) return true;
    if (normalizedTest === 'wp' && normalizedDescription.includes('willpower')) return true;
    if (normalizedTest === 's' && normalizedDescription.includes('strength')) return true;
    return normalizedDescription.split('_').includes(normalizedTest);
}

function testDescriptionWhens(description: string): string[] {
    const normalized = normalizeCondition(description);
    const whens = Object.entries(legacyConditionWhen)
        .filter(([condition]) => normalized.includes(condition))
        .map(([, when]) => when);
    return whens.length > 0 ? [...new Set(whens)] : ['always'];
}

function isNormalizedTalentEffect(effect: TalentEffect): effect is NormalizedTalentEffect {
    return effect.kind !== undefined;
}

function effectLabel(effect: TalentEffect): string {
    return effect.kind ?? effect.type ?? 'unknown';
}

function effectWhenLabels(effect: TalentEffect): string[] {
    if (isNormalizedTalentEffect(effect)) return normalizeWhenList(effect.when);
    return effect.condition ? [effect.condition] : [];
}

function classifyTalent(talent: Talent): TalentCoverageClassification {
    if (deferredCombatTalentIds.includes(talent.id as typeof deferredCombatTalentIds[number])) return 'deferred-psychology';
    if (actionEconomyTalentIds.includes(talent.id as typeof actionEconomyTalentIds[number])) return 'deferred-action-economy';
    if (talentActivationRegistry[talent.id]) return 'activated-or-reaction';
    const effects = (talent.effects || []).map(effect => normalizeTalentEffect(effect, talent.id));
    if (effects.some(effect => effect.kind === 'ruleNote')) return 'passive-needs-typed-effect';
    if (effects.some(effect => [
        'slBonus',
        'testBonus',
        'damageBonus',
        'damageReduction',
        'damageCalculationModifier',
        'initiativeBonus',
        'characteristicBonus',
        'hitLocationShift',
        'weaponLengthImmunity',
        'calledShotPenaltyWaiver',
        'weaponQualityGrant',
        'criticalRollChoice',
        'criticalDamageMultiplier',
        'outnumberingCount',
        'losingAdvantageCount',
        'advantageCostReduction',
        'conditionLossIgnore',
        'conditionGainReaction',
        'offHandPenaltyReduction',
        'armourPointIgnore',
        'woundsBonus',
    ].includes(effect.kind))) return 'typed-wired';
    if (effects.length > 0) return 'typed-not-wired';
    return 'non-combat';
}

function isCombatRelevantTalent(talent: Talent): boolean {
    const haystack = [
        talent.id,
        talent.name,
        talent.description,
        ...(talent.tests || []),
        ...(talent.effects || []).flatMap(effect => {
            const normalized = normalizeTalentEffect(effect, talent.id);
            return [normalized.kind, normalized.when.join(' '), String(normalized.value), ...(normalized.appliesTo || [])];
        }),
    ].join(' ').toLowerCase();
    return /\b(combat|melee|ranged|dodge|charge|advantage|critical|damage|wound|initiative|shield|weapon|attack|defend|flee|reload|stunned|prone|frenzy|fear|terror)\b/.test(haystack);
}

function coverageNotes(talent: Talent): string | undefined {
    if (talentActivationRegistry[talent.id]) return 'Optional effect registered with default-off policy for PBI 5.';
    if (deferredCombatTalentIds.includes(talent.id as typeof deferredCombatTalentIds[number])) return 'Psychology/Fear resolution retained as data and deferred.';
    if (actionEconomyTalentIds.includes(talent.id as typeof actionEconomyTalentIds[number])) return 'Economy flag/event emitted; turn engine consumes it in PBI 5.';
    return undefined;
}

function equippedShield(combatant: Combatant, state: CombatState): Weapon | undefined {
    return equippedWeapons(combatant, state).find(weapon => weapon.group.toLowerCase().includes('shield') || weapon.name.toLowerCase().includes('shield') || hasQuality(weapon, 'shield'));
}

function equippedWeapon(combatant: Combatant, state: CombatState): Weapon | undefined {
    return equippedWeapons(combatant, state)[0];
}

function attackWeapon(context: MeleeHookContext): Weapon | undefined {
    if (context.action.attacker.weaponId) {
        const weapon = context.state.weapons.find(candidate => candidate.id === context.action.attacker.weaponId);
        if (weapon) return weapon;
    }
    return equippedWeapon(context.attacker, context.state);
}

function attackHasPummel(context: MeleeHookContext): boolean {
    const weapon = attackWeapon(context);
    return !!weapon && (hasQuality(weapon, 'pummel') || (weapon.id.includes(':improvised') || weapon.name.toLowerCase().includes('improvised')));
}

function equippedWeapons(combatant: Combatant, state: CombatState): Weapon[] {
    const byId = new Map(state.weapons.map(weapon => [weapon.id, weapon]));
    const equippedIds = Object.entries(combatant.character.inventory.equippedWeapons || {})
        .filter(([, equipped]) => equipped)
        .map(([id]) => id);
    return equippedIds.map(id => byId.get(id)).filter((weapon): weapon is Weapon => !!weapon);
}

function shieldDamage(actor: Combatant, state: CombatState): number {
    const shield = equippedShield(actor, state);
    return shield ? weaponDamageNumber(shield) : 1;
}

function weaponDamageNumber(weapon: Weapon): number {
    const match = String(weapon.damage).match(/[+-]?\d+/g);
    return match ? match.reduce((total, value) => total + Number(value), 0) : 1;
}

const HIT_LOCATION_RANGES: Record<string, [number, number]> = {
    head: [1, 9],
    'right arm': [10, 24],
    'left arm': [25, 44],
    body: [45, 79],
    'right leg': [80, 89],
    'left leg': [90, 100],
};

function hitLocationShiftDistance(attackRoll: number, location: string): number {
    const range = HIT_LOCATION_RANGES[location.toLowerCase()];
    if (!range) return Number.POSITIVE_INFINITY;
    const hitRoll = hitLocationRoll(attackRoll);
    if (hitRoll >= range[0] && hitRoll <= range[1]) return 0;
    return hitRoll < range[0] ? range[0] - hitRoll : hitRoll - range[1];
}

function hitLocationRoll(attackRoll: number): number {
    if (attackRoll === 100) return 100;
    if (attackRoll < 10) return attackRoll * 10;
    const tens = Math.floor(attackRoll / 10);
    const ones = attackRoll % 10;
    return ones * 10 + tens;
}

function hasTwoWeaponLoadout(combatant: Combatant): boolean {
    return !!combatant.weaponLoadout?.primaryWeaponId && !!combatant.weaponLoadout?.secondaryWeaponId;
}

const SIZE_RANK: Record<string, number> = {
    tiny: 0,
    little: 1,
    small: 2,
    average: 3,
    large: 4,
    enormous: 5,
    monstrous: 6,
};

function sizeStepsLarger(attacker: Combatant, defender: Combatant): number {
    return Math.max(0, combatantSizeRank(defender) - combatantSizeRank(attacker));
}

function combatantSizeRank(combatant: Combatant): number {
    const explicitSize = (combatant as Combatant & { size?: string }).size
        ?? (combatant.character as Combatant['character'] & { size?: string }).size;
    if (explicitSize && SIZE_RANK[explicitSize] !== undefined) return SIZE_RANK[explicitSize];
    const sizeTag = combatant.character.tags
        .map(tag => tag.toLowerCase().trim())
        .find(tag => tag.startsWith('size:') || tag.startsWith('size='));
    const taggedSize = sizeTag?.split(/[:=]/)[1];
    return taggedSize && SIZE_RANK[taggedSize] !== undefined ? SIZE_RANK[taggedSize] : SIZE_RANK.average;
}

function talentRank(combatant: Combatant, talentId: string): number {
    return combatant.character.talents?.[talentId] ?? combatant.character.talents?.[normalizeName(talentId)] ?? 0;
}

function reverseD100(roll: number): number {
    if (roll === 100) return 1;
    const tens = Math.floor(roll / 10);
    const ones = roll % 10;
    return ones * 10 + tens;
}

function normalizeCondition(condition: string): string {
    return condition.toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
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

function talentRejected(combatantId: string, talentId: string, reason: 'missingTalent' | 'policyRejected' | 'insufficientAdvantage' | 'invalidTrigger' | 'missingTarget' | 'invalidLoadout', targetId?: string): CombatEvent {
    return {
        type: 'TalentActivationRejected',
        i18nKey: `combat.talent.rejected.${reason}`,
        data: { combatantId, talentId, targetId, reason },
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

function replaceCombatants(state: CombatState, combatants: Combatant[]): CombatState {
    return {
        ...state,
        combatants: {
            ...state.combatants,
            ...Object.fromEntries(combatants.map(combatant => [combatant.id, combatant])),
        },
    };
}

function removeConditionStacks(combatant: Combatant, conditionId: string, amount: number): Combatant {
    let removed = 0;
    const conditions = combatant.conditions.filter(condition => {
        if (condition === conditionId && removed < amount) {
            removed += 1;
            return false;
        }
        return true;
    });
    return { ...combatant, conditions };
}
