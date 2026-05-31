import type { Talent, TalentEffect, Weapon } from '../types/wfrp.types';
import { calculateSuccessLevel } from '../utils/mechanics';
import { spendAdvantage } from './advantage';
import { hasQuality } from './qualities';
import { applyFortunePostRollHook, type FortunePostRollHook } from './resources';
import { engagementKey, isInfighting } from './spatial';
import type {
    CombatEngineResult,
    CombatEvent,
    CombatState,
    Combatant,
    DamageModifierContext,
    MeleeHookContext,
    MeleeResolutionHooks,
    ModifierSource,
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

export const DEFAULT_TALENT_POLICY: 'never' = 'never';

export const combatTalentAuditIds = [
    'accurate-shot',
    'ambidextrous',
    'battle-rage',
    'berserk-charge',
    'beat-blade',
    'beneath-notice',
    'careful-strike',
    'combat-aware',
    'combat-master',
    'combat-reflexes',
    'deadeye-shot',
    'disarm',
    'distract',
    'drilled',
    'dual-wielder',
    'enclosed-fighter',
    'fast-shot',
    'fearless',
    'feint',
    'field-dressing',
    'frenzy',
    'frightening',
    'furious-assault',
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
    'tenacious',
    'unshakable',
    'warleader',
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
    charging: context => !!context.action?.isCharging || !!context.state.turnFlags.chargedCombatantIds.includes(context.combatant.id),
    'when charge': context => !!context.action?.isCharging || !!context.state.turnFlags.chargedCombatantIds.includes(context.combatant.id),
    'when defending': context => context.role === 'defender',
    'defending with a shield': context => context.role === 'defender' && !!equippedShield(context.combatant, context.state),
    'if weapon has fast quality': context => !!equippedWeapon(context.combatant, context.state) && hasQuality(equippedWeapon(context.combatant, context.state)!, 'fast'),
    'during melee': context => !!context.action,
    'during combat rounds': context => context.state.round > 0,
    surprise: context => context.combatant.conditions.includes('condition_surprised') || !!context.opponent?.conditions.includes('condition_surprised'),
    frenzied: context => context.combatant.conditions.includes('condition_frenzied'),
    'beat blade': context => context.testId === 'beat_blade' || context.action?.isExtraAttack === true,
    'when disarming': context => context.testId === 'disarm',
    'to touch an opponent': context => !!context.opponent && context.role === 'attacker',
    'when distracting': context => context.testId === 'distract',
    'when beside an ally with drilled': context => Object.values(context.state.combatants).some(other => (
        other.id !== context.combatant.id
        && other.side === context.combatant.side
        && talentRank(other, 'drilled') > 0
        && context.combatant.engagementIds.some(id => other.engagementIds.includes(id))
    )),
    'when attacking with two weapons': context => context.action?.hand === 'secondary' || hasTwoWeaponLoadout(context.combatant),
    'when making a fast shot': context => context.combatant.initiativeOverride === true,
    'for Feints': context => context.testId === 'feint',
    'when making extra attacks': context => context.action?.isExtraAttack === true,
    'combat initiative': context => context.role === 'initiative',
    'when in-fighting': context => !!context.opponent && isInfighting(context.state, context.combatant.id, context.opponent.id),
    'when in-fighting, or to enter in-fighting': context => !!context.opponent && isInfighting(context.state, context.combatant.id, context.opponent.id),
    'to resist stunned': context => context.testId === 'endurance' && context.combatant.conditions.includes('condition_stunned'),
    'when prone': context => context.combatant.conditions.includes('condition_prone'),
    aiming: context => context.testId === 'aim',
    'to reload a ranged weapon': context => context.testId === 'reload',
    'when reloading': context => context.testId === 'reload',
    'against hated group': context => context.testId === 'cool' || context.testId === 'wp' || context.testId === 'willpower',
    'to resist group': context => context.testId === 'wp' || context.testId === 'willpower',
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
            effects: (talent.effects || []).map(effect => effect.type),
            conditions: [...new Set((talent.effects || []).map(effect => effect.condition).filter((condition): condition is string => !!condition))],
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
        return resolveShieldsman(state, actor, request.targetId, request.effect === 'push' ? 'push' : 'damage');
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

export function getTalentInitiativeModifier(combatant: Combatant, state: CombatState): number {
    return applicableEffects(combatant, state, 'initiative', {
        state,
        combatant,
        role: 'initiative',
        testId: 'initiative',
    })
        .filter(effect => effect.type === 'INITIATIVE_BONUS' && typeof effect.value === 'number')
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

function talentPreRollModifiers(context: MeleeHookContext): ModifierSource[] {
    const effects = applicableEffects(context.attacker, context.state, context.action.attacker.skillId, {
        ...context,
        combatant: context.attacker,
        opponent: context.defender,
        role: 'attacker',
        testId: context.action.attacker.skillId,
    });

    return effects
        .filter(effect => (effect.type === 'TEST_BONUS' || effect.type === 'CHARACTERISTIC_BONUS') && typeof effect.value === 'number')
        .map(effect => ({
            id: `talent:${effect.talentId}:${effect.type}`,
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
    if (roll.roundedSuccessLevel < 0) return 0;

    return applicableEffects(combatant, context.state, roll.skillId, {
        ...context,
        combatant,
        opponent,
        roll,
        role: defenderPhase ? 'defender' : 'attacker',
        testId: roll.skillId,
    })
        .filter(effect => effect.type === 'SL_BONUS_ON_SUCCESS' && typeof effect.value === 'number')
        .reduce((total, effect) => total + Number(effect.value) * talentRank(combatant, effect.talentId), 0);
}

function talentDamageModifier(context: DamageModifierContext): number {
    return applicableEffects(context.attacker, context.state, context.action.attacker.skillId, {
        ...context,
        combatant: context.attacker,
        opponent: context.defender,
        role: 'attacker',
        testId: context.action.attacker.skillId,
    })
        .filter(effect => effect.type === 'DAMAGE_BONUS' && typeof effect.value === 'number')
        .reduce((total, effect) => total + Number(effect.value) * talentRank(context.attacker, effect.talentId), 0);
}

function talentOnHitEffects(context: DamageModifierContext): CombatEvent[] {
    const events: CombatEvent[] = [];
    if (talentRank(context.attacker, 'furious-assault') > 0 && context.action.attacker.skillId.toLowerCase().includes('melee')) {
        events.push(talentEvent(context.attacker.id, 'furious-assault', 'extraAttackAvailable', { trigger: 'economy', policy: DEFAULT_TALENT_POLICY, deferred: true }));
    }
    return events;
}

function talentCritEffects(context: DamageModifierContext): CombatEvent[] {
    const events: CombatEvent[] = [];
    if (talentRank(context.attacker, 'strike-to-injure') > 0) {
        events.push(talentEvent(context.attacker.id, 'strike-to-injure', 'chooseCriticalRoll', { trigger: 'onCrit', policy: DEFAULT_TALENT_POLICY, deferred: true }));
    }
    return events;
}

function resolveShieldsman(state: CombatState, actor: Combatant, targetId: string, mode: 'damage' | 'push'): CombatEngineResult {
    if (!equippedShield(actor, state)) return { state, events: [talentRejected(actor.id, 'shieldsman', 'invalidLoadout', targetId)] };
    if (state.advantagePools[actor.side] < 2) return { state, events: [talentRejected(actor.id, 'shieldsman', 'insufficientAdvantage', targetId)] };

    const spent = spendAdvantage(state, actor.side, 'additionalEffort', { actorId: actor.id, amount: 2 });
    let currentState = spent.state;
    const events = [...spent.events];
    const target = getCombatant(currentState, targetId);

    if (mode === 'push') {
        const direction = target.position >= actor.position ? 1 : -1;
        currentState = replaceCombatants(currentState, [
            { ...target, position: target.position + direction * 2, engagementIds: target.engagementIds.filter(id => id !== actor.id) },
            { ...getCombatant(currentState, actor.id), engagementIds: actor.engagementIds.filter(id => id !== target.id) },
        ]);
        delete currentState.engagements[engagementKey(actor.id, target.id)];
        events.push(talentEvent(actor.id, 'shieldsman', 'push', { targetId, amount: 2, trigger: 'onDefend', policy: 'always' }));
        return { state: currentState, events };
    }

    const damage = Math.max(1, shieldDamage(actor, state));
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
    return { state: currentState, events };
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

function applicableEffects(combatant: Combatant, state: CombatState, testId: string, context: TalentPredicateContext): Array<TalentEffect & { talentId: string }> {
    return Object.entries(combatant.character.talents || {}).flatMap(([talentId, rank]) => {
        if (rank <= 0) return [];
        const talent = state.talents.find(candidate => candidate.id === talentId || normalizeName(candidate.name) === normalizeName(talentId));
        if (!talent) return [];
        return (talent.effects || [])
            .filter(effect => appliesToTest(effect, testId))
            .filter(effect => evaluateTalentCondition(effect.condition, context))
            .map(effect => ({ ...effect, talentId }));
    });
}

function appliesToTest(effect: TalentEffect, testId: string): boolean {
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

function classifyTalent(talent: Talent): TalentCoverageClassification {
    if (deferredCombatTalentIds.includes(talent.id as typeof deferredCombatTalentIds[number])) return 'deferred-psychology';
    if (actionEconomyTalentIds.includes(talent.id as typeof actionEconomyTalentIds[number])) return 'deferred-action-economy';
    if (talentActivationRegistry[talent.id]) return 'activated-or-reaction';
    const effects = talent.effects || [];
    if (effects.some(effect => effect.type === 'PASSIVE')) return 'passive-needs-typed-effect';
    if (effects.some(effect => ['SL_BONUS_ON_SUCCESS', 'TEST_BONUS', 'DAMAGE_BONUS', 'WOUNDS_BONUS', 'INITIATIVE_BONUS', 'CHARACTERISTIC_BONUS'].includes(effect.type))) return 'typed-wired';
    if (effects.length > 0) return 'typed-not-wired';
    return 'non-combat';
}

function isCombatRelevantTalent(talent: Talent): boolean {
    const haystack = [
        talent.id,
        talent.name,
        talent.description,
        ...(talent.tests || []),
        ...(talent.effects || []).flatMap(effect => [effect.type, effect.condition || '', String(effect.value), ...(effect.appliesTo || [])]),
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

function hasTwoWeaponLoadout(combatant: Combatant): boolean {
    return !!combatant.weaponLoadout?.primaryWeaponId && !!combatant.weaponLoadout?.secondaryWeaponId;
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
