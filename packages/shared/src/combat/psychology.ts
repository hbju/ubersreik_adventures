import { calculateSuccessLevel, rolld100 } from '../utils/mechanics';
import { calculateCharacteristicBonus, calculateCharacteristicValue } from '../utils/skills';
import type { Rng } from './rng';
import type {
    CombatEngineResult,
    CombatEvent,
    CombatState,
    Combatant,
    FearSourceState,
    MeleeHookContext,
    ModifierSource,
    ResolvedOpposedRoll,
} from './types';

export interface PsychologyExposureOptions {
    terrorTestModifier?: number | ((source: Combatant, target: Combatant) => number);
}

export interface PsychologyTestResult {
    roll: number;
    targetNumber: number;
    successLevel: number;
}

export function psychologyState(): NonNullable<Combatant['psychology']> {
    return { fears: {}, terrors: {} };
}

export function isFrenzied(combatant: Combatant | undefined): boolean {
    return combatant?.psychology?.frenzy?.active === true;
}

export function canEnterFrenzy(combatant: Combatant): boolean {
    return (combatant.character.talents?.frenzy ?? 0) > 0;
}

export function enterFrenzy(
    state: CombatState,
    combatantId: string,
    source: 'willpower' | 'flagellant'
): CombatEngineResult {
    const combatant = state.combatants[combatantId];
    if (!combatant || isFrenzied(combatant)) return { state, events: [] };
    const psychology = clonePsychology(combatant);
    psychology.frenzy = {
        active: true,
        enteredRound: state.round,
        entrySource: source,
    };
    psychology.immuneToAllPsychology = true;
    return {
        state: replaceCombatant(state, { ...combatant, psychology }),
        events: [{
            type: 'FrenzyStateChanged',
            i18nKey: 'combat.psychology.frenzy.entered',
            data: {
                combatantId,
                active: true,
                reason: source,
                fatiguedApplied: 0,
            },
        }],
    };
}

export function exitFrenzy(
    state: CombatState,
    combatantId: string,
    reason: 'battleRage' | 'noActiveEnemies' | 'incapacitated'
): CombatEngineResult {
    const combatant = state.combatants[combatantId];
    if (!combatant || !isFrenzied(combatant)) return { state, events: [] };
    const psychology = clonePsychology(combatant);
    psychology.frenzy = { ...psychology.frenzy!, active: false };
    psychology.immuneToAllPsychology = false;
    return {
        state: replaceCombatant(state, {
            ...combatant,
            psychology,
            conditions: [...combatant.conditions, 'condition_fatigued'],
        }),
        events: [{
            type: 'FrenzyStateChanged',
            i18nKey: 'combat.psychology.frenzy.exited',
            data: {
                combatantId,
                active: false,
                reason,
                fatiguedApplied: 1,
            },
        }],
    };
}

export function resolveFrenzyExits(state: CombatState): CombatEngineResult {
    let currentState = state;
    const events: CombatEvent[] = [];
    for (const combatantId of Object.keys(state.combatants).sort()) {
        const combatant = currentState.combatants[combatantId];
        if (!isFrenzied(combatant)) continue;
        const incapacitated = combatant.conditions.includes('condition_stunned')
            || combatant.conditions.includes('condition_unconscious');
        const hasActiveEnemy = Object.values(currentState.combatants).some(other =>
            other.side !== combatant.side && !other.dead && isPsychologyParticipant(other)
        );
        if (!incapacitated && hasActiveEnemy) continue;
        const result = exitFrenzy(
            currentState,
            combatantId,
            incapacitated ? 'incapacitated' : 'noActiveEnemies'
        );
        currentState = result.state;
        events.push(...result.events);
    }
    return { state: currentState, events };
}

export function markFrenzyFreeMeleeUsed(state: CombatState, combatantId: string): CombatState {
    const combatant = state.combatants[combatantId];
    if (!combatant?.psychology?.frenzy) return state;
    const psychology = clonePsychology(combatant);
    psychology.frenzy = {
        ...psychology.frenzy!,
        freeMeleeTestUsedRound: state.round,
    };
    return replaceCombatant(state, { ...combatant, psychology });
}

export function resolvePsychologyRoundStart(
    state: CombatState,
    rng: Rng,
    options: PsychologyExposureOptions = {}
): CombatEngineResult {
    let result = resolvePsychologyExposures(state, rng, options);
    const combatantIds = Object.keys(state.combatants).sort();

    for (const targetId of combatantIds) {
        result = appendResult(result, resolveFearExtendedTests(result.state, targetId, rng));
    }
    return result;
}

export function resolvePsychologyExposures(
    state: CombatState,
    rng: Rng,
    options: PsychologyExposureOptions = {}
): CombatEngineResult {
    let result: CombatEngineResult = { state, events: [] };
    const combatantIds = Object.keys(state.combatants).sort();

    for (const targetId of combatantIds) {
        for (const sourceId of combatantIds) {
            if (targetId === sourceId) continue;
            const target = result.state.combatants[targetId];
            const source = result.state.combatants[sourceId];
            if (!isPsychologyParticipant(target) || !isPsychologyParticipant(source) || target.side === source.side) continue;
            result = appendResult(result, resolvePsychologyExposure(result.state, targetId, sourceId, rng, options));
        }
    }
    return result;
}

export function resolvePsychologyExposure(
    state: CombatState,
    combatantId: string,
    sourceId: string,
    rng: Rng,
    options: PsychologyExposureOptions = {}
): CombatEngineResult {
    const target = state.combatants[combatantId];
    const source = state.combatants[sourceId];
    if (!target || !source || target.side === source.side || psychologyImmune(target)) return { state, events: [] };

    const psychology = clonePsychology(target);
    const events: CombatEvent[] = [];
    const fearless = fearImmune(target);

    if (source.causesTerror?.rating && !psychology.terrors[source.id]?.tested) {
        const rating = normalizedRating(source.causesTerror.rating);
        if (fearless) {
            psychology.terrors[source.id] = { sourceId: source.id, rating, tested: true };
            psychology.fears[source.id] = activeFear(source.id, rating, true);
            events.push(exposureEvent(target.id, source.id, 'terror', rating, 'downgraded'));
        } else {
            const modifier = typeof options.terrorTestModifier === 'function'
                ? options.terrorTestModifier(source, target)
                : options.terrorTestModifier ?? -10 * rating;
            const test = resolveCoolTest(target, rng, modifier);
            const brokenApplied = test.successLevel < 0 ? rating + Math.abs(test.successLevel) : 0;
            psychology.terrors[source.id] = {
                sourceId: source.id,
                rating,
                tested: true,
                successLevel: test.successLevel,
                brokenApplied,
            };
            psychology.fears[source.id] = {
                ...activeFear(source.id, rating, true),
                lastTestRound: state.round,
            };
            events.push(exposureEvent(target.id, source.id, 'terror', rating, 'active'));
            events.push(testEvent(target.id, source.id, 'terror', test, {
                brokenApplied,
            }));
            return {
                state: replaceCombatant(state, {
                    ...target,
                    psychology,
                    conditions: addConditionStacks(target.conditions, 'condition_broken', brokenApplied),
                }),
                events,
            };
        }
    }

    const fearRating = source.causesFear?.rating ?? source.causesTerror?.rating;
    if (fearRating && !psychology.fears[source.id]) {
        const registered = registerFearOnCombatant(state, target, source.id, fearRating);
        return registered.events.length > 0
            ? registered
            : { state, events: [] };
    }

    return events.length > 0
        ? { state: replaceCombatant(state, { ...target, psychology }), events }
        : { state, events: [] };
}

export function registerFearFromSource(
    state: CombatState,
    combatantId: string,
    sourceId: string,
    rating = 1,
    options: { fromIntimidate?: boolean } = {}
): CombatEngineResult {
    const target = state.combatants[combatantId];
    const source = state.combatants[sourceId];
    if (!target || !source || target.side === source.side) return { state, events: [] };
    return registerFearOnCombatant(state, target, sourceId, rating, options);
}

export function resolveIntimidateAction(
    state: CombatState,
    actorId: string,
    primaryTargetId: string | undefined,
    rng: Rng,
    overrides: { rollResult?: number; targetNumber?: number; opponentRollResult?: number; opponentTargetNumber?: number } = {}
): CombatEngineResult {
    const actor = state.combatants[actorId];
    const primaryTarget = primaryTargetId ? state.combatants[primaryTargetId] : undefined;
    if (!actor || !primaryTarget || actor.side === primaryTarget.side) return { state, events: [] };

    const actorRoll = resolveSkillRoll(actor, 'intimidate', state, rng, overrides.rollResult, overrides.targetNumber);
    const menacing = talentRank(actor, 'menacing');
    const modifiedActorRoll = withSlModifier(actorRoll, menacing);
    const targetRoll = resolveSkillRoll(primaryTarget, 'cool', state, rng, overrides.opponentRollResult, overrides.opponentTargetNumber);
    const success = opposedWins(modifiedActorRoll, targetRoll);
    const sl = Math.max(0, modifiedActorRoll.roundedSuccessLevel - targetRoll.roundedSuccessLevel);
    const capacity = success ? Math.max(0, calculateCharacteristicBonus(actor.character.characteristics.s) + sl) : 0;

    let currentState = state;
    const events: CombatEvent[] = [];
    const affectedTargetIds: string[] = [];

    if (success && capacity > 0) {
        for (const targetId of intimidateTargets(state, actor, primaryTarget.id, capacity)) {
            const result = registerFearFromSource(currentState, targetId, actor.id, 1, { fromIntimidate: true });
            currentState = result.state;
            events.push(...result.events.map(event => event.type === 'PsychologyExposure'
                ? { ...event, i18nKey: 'combat.psychology.intimidate.fearApplied' }
                : event));
            if (isActivelyAfraidOf(currentState.combatants[targetId], actor.id)) {
                affectedTargetIds.push(targetId);
            }
        }
    }

    events.unshift({
        type: 'IntimidateTestResolved',
        i18nKey: success ? 'combat.psychology.intimidate.success' : 'combat.psychology.intimidate.failure',
        data: {
            actorId,
            targetId: primaryTarget.id,
            actorRoll: modifiedActorRoll,
            targetRoll,
            outcome: success ? 'success' : 'failure',
            affectedTargetIds,
            capacity,
        },
    });

    return { state: currentState, events };
}

export function resolveLeadershipAction(
    state: CombatState,
    actorId: string,
    rng: Rng,
    overrides: { rollResult?: number; targetNumber?: number } = {}
): CombatEngineResult {
    const actor = state.combatants[actorId];
    if (!actor) return { state, events: [] };

    const roll = resolveSkillRoll(actor, 'leadership', state, rng, overrides.rollResult, overrides.targetNumber);
    const warLeader = talentRank(actor, 'war-leader');
    const commandingPresence = talentRank(actor, 'commanding-presence');
    const successLevel = roll.roundedSuccessLevel + (roll.roundedSuccessLevel >= 0 ? warLeader : 0);
    const success = successLevel >= 0;
    const bonus = 10 + (commandingPresence * 10);
    const expiresEndOfRound = state.round + 1;
    const affectedAllyIds = success
        ? nearestAllies(state, actor, Math.max(0, calculateCharacteristicBonus(actor.character.characteristics.fel) + successLevel))
        : [];

    let currentState = state;
    const events: CombatEvent[] = [];
    for (const allyId of affectedAllyIds) {
        const ally = currentState.combatants[allyId];
        const psychology = clonePsychology(ally);
        const existing = psychology.psychologyTestBonus;
        psychology.psychologyTestBonus = !existing || bonus >= existing.value || expiresEndOfRound >= existing.expiresEndOfRound
            ? { value: bonus, expiresEndOfRound, sourceId: actor.id }
            : existing;
        currentState = replaceCombatant(currentState, { ...ally, psychology });
        events.push({
            type: 'PsychologyBonusApplied',
            i18nKey: 'combat.psychology.leadership.bonusApplied',
            data: {
                combatantId: ally.id,
                sourceId: actor.id,
                value: psychology.psychologyTestBonus.value,
                expiresEndOfRound: psychology.psychologyTestBonus.expiresEndOfRound,
            },
        });
    }

    events.unshift({
        type: 'LeadershipTestResolved',
        i18nKey: success ? 'combat.psychology.leadership.success' : 'combat.psychology.leadership.failure',
        data: {
            actorId,
            roll: roll.rollResult,
            targetNumber: roll.targetNumber,
            successLevel,
            outcome: success ? 'success' : 'failure',
            affectedAllyIds,
            bonus,
            expiresEndOfRound,
        },
    });

    return { state: currentState, events };
}

export function expirePsychologyBonuses(state: CombatState): CombatEngineResult {
    let currentState = state;
    const events: CombatEvent[] = [];
    for (const combatant of Object.values(state.combatants)) {
        const bonus = combatant.psychology?.psychologyTestBonus;
        if (!bonus || bonus.expiresEndOfRound > state.round) continue;
        const psychology = clonePsychology(combatant);
        delete psychology.psychologyTestBonus;
        currentState = replaceCombatant(currentState, { ...currentState.combatants[combatant.id], psychology });
        events.push({
            type: 'PsychologyBonusExpired',
            i18nKey: 'combat.psychology.leadership.bonusExpired',
            data: { combatantId: combatant.id, sourceId: bonus.sourceId },
        });
    }
    return { state: currentState, events };
}

export function resolveFearExtendedTests(
    state: CombatState,
    combatantId: string,
    rng: Rng
): CombatEngineResult {
    const target = state.combatants[combatantId];
    if (!target || psychologyImmune(target)) return { state, events: [] };
    const psychology = clonePsychology(target);
    const events: CombatEvent[] = [];

    for (const fear of Object.values(psychology.fears).sort((a, b) => a.sourceId.localeCompare(b.sourceId))) {
        if (fear.status !== 'active' || fear.lastTestRound === state.round) continue;
        const source = state.combatants[fear.sourceId];
        if (!isPsychologyParticipant(source)) continue;
        const test = resolveCoolTest(target, rng, 0, state.round);
        fear.accumulatedSL = Math.max(0, fear.accumulatedSL + test.successLevel);
        fear.lastTestRound = state.round;
        if (fear.accumulatedSL >= fear.rating) fear.status = 'immune';
        events.push(testEvent(target.id, fear.sourceId, 'fear', test, {
            accumulatedSL: fear.accumulatedSL,
            targetSL: fear.rating,
            completed: fear.status === 'immune',
        }));
    }

    return events.length > 0
        ? { state: replaceCombatant(state, { ...target, psychology }), events }
        : { state, events: [] };
}

export function fearPreRollModifiers(context: MeleeHookContext): ModifierSource[] {
    return isActivelyAfraidOf(context.attacker, context.defender.id)
        ? [{
            id: `psychology:fear:${context.defender.id}`,
            type: 'psychology',
            phase: 'preRollModifiers',
            label: 'Fear',
            value: -10,
            combatantId: context.attacker.id,
        }]
        : [];
}

export function resolveVoluntaryFearApproach(
    state: CombatState,
    combatantId: string,
    destination: number,
    rng: Rng
): { allowed: boolean; events: CombatEvent[] } {
    const combatant = state.combatants[combatantId];
    if (!combatant) return { allowed: false, events: [] };
    if (psychologyImmune(combatant)) return { allowed: true, events: [] };
    const approached = activeFearStates(combatant)
        .filter(fear => {
            const source = state.combatants[fear.sourceId];
            return source && Math.abs(destination - source.position) < Math.abs(combatant.position - source.position);
        })
        .sort((a, b) => a.sourceId.localeCompare(b.sourceId));
    const events: CombatEvent[] = [];

    for (const fear of approached) {
        const test = resolveCoolTest(combatant, rng, 0, state.round);
        events.push(testEvent(combatant.id, fear.sourceId, 'fearApproach', test));
        if (test.successLevel < 0) return { allowed: false, events };
    }
    return { allowed: true, events };
}

export function resolveSourceApproachFear(
    stateBeforeMove: CombatState,
    stateAfterMove: CombatState,
    sourceId: string,
    rng: Rng
): CombatEngineResult {
    const sourceBefore = stateBeforeMove.combatants[sourceId];
    const sourceAfter = stateAfterMove.combatants[sourceId];
    if (!sourceBefore || !sourceAfter || sourceBefore.position === sourceAfter.position) {
        return { state: stateAfterMove, events: [] };
    }

    let currentState = stateAfterMove;
    const events: CombatEvent[] = [];
    for (const target of Object.values(stateAfterMove.combatants).sort((a, b) => a.id.localeCompare(b.id))) {
        if (!isActivelyAfraidOf(target, sourceId)) continue;
        const previousDistance = Math.abs(target.position - sourceBefore.position);
        const nextDistance = Math.abs(target.position - sourceAfter.position);
        if (nextDistance >= previousDistance) continue;
        const test = resolveCoolTest(target, rng, 0, stateAfterMove.round);
        const brokenApplied = test.successLevel < 0 ? 1 : 0;
        events.push(testEvent(target.id, sourceId, 'sourceApproach', test, { brokenApplied }));
        if (brokenApplied > 0) {
            currentState = replaceCombatant(currentState, {
                ...currentState.combatants[target.id],
                conditions: [...currentState.combatants[target.id].conditions, 'condition_broken'],
            });
        }
    }
    return { state: currentState, events };
}

export function isActivelyAfraidOf(combatant: Combatant, sourceId: string): boolean {
    return !psychologyImmune(combatant)
        && combatant.psychology?.fears[sourceId]?.status === 'active';
}

export function activeFearStates(combatant: Combatant): FearSourceState[] {
    if (psychologyImmune(combatant)) return [];
    return Object.values(combatant.psychology?.fears ?? {}).filter(fear => fear.status === 'active');
}

export function resolveCoolTest(combatant: Combatant, rng: Rng, modifier = 0, round?: number): PsychologyTestResult {
    const targetNumber = skillTarget(combatant, 'cool')
        + modifier
        + activePsychologyTestBonus(combatant, round);
    const roll = rolld100(rng);
    return {
        roll,
        targetNumber,
        successLevel: Math.round(calculateSuccessLevel(roll, targetNumber)),
    };
}

function registerFearOnCombatant(
    state: CombatState,
    target: Combatant,
    sourceId: string,
    ratingValue: number,
    options: { fromIntimidate?: boolean } = {}
): CombatEngineResult {
    if (psychologyImmune(target)) return { state, events: [] };
    const psychology = clonePsychology(target);
    if (psychology.fears[sourceId]) return { state, events: [] };
    const rating = normalizedRating(ratingValue);
    const fearless = fearImmune(target) || (options.fromIntimidate === true && hasTalent(target, 'iron-will'));
    psychology.fears[sourceId] = fearless
        ? { ...activeFear(sourceId, rating), status: 'immune' }
        : activeFear(sourceId, rating);
    return {
        state: replaceCombatant(state, { ...target, psychology }),
        events: [exposureEvent(target.id, sourceId, 'fear', rating, fearless ? 'immune' : 'active')],
    };
}

function psychologyImmune(combatant: Combatant): boolean {
    return isFrenzied(combatant)
        || combatant.psychology?.immuneToAllPsychology === true;
}

function fearImmune(combatant: Combatant): boolean {
    return combatant.psychology?.immuneToFear === true
        || (combatant.character.talents?.fearless ?? 0) > 0;
}

function activePsychologyTestBonus(combatant: Combatant, round?: number): number {
    const bonus = combatant.psychology?.psychologyTestBonus;
    if (!bonus) return 0;
    if (round !== undefined && bonus.expiresEndOfRound < round) return 0;
    return bonus.value;
}

function resolveSkillRoll(
    combatant: Combatant,
    skillId: string,
    state: CombatState,
    rng: Rng,
    rollOverride?: number,
    targetOverride?: number
): ResolvedOpposedRoll {
    const targetNumber = targetOverride ?? skillTarget(combatant, skillId);
    const rollResult = rollOverride ?? rolld100(rng);
    const successLevel = Math.round(calculateSuccessLevel(rollResult, targetNumber));
    return {
        skillId,
        rollResult,
        targetNumber,
        successLevel,
        roundedSuccessLevel: successLevel,
        usedTalents: skillId === 'intimidate' && talentRank(combatant, 'menacing') > 0
            ? [{ name: 'Menacing', rank: talentRank(combatant, 'menacing') }]
            : skillId === 'leadership' && (talentRank(combatant, 'war-leader') > 0 || talentRank(combatant, 'commanding-presence') > 0)
                ? [
                    ...(talentRank(combatant, 'war-leader') > 0 ? [{ name: 'War Leader', rank: talentRank(combatant, 'war-leader') }] : []),
                    ...(talentRank(combatant, 'commanding-presence') > 0 ? [{ name: 'Commanding Presence', rank: talentRank(combatant, 'commanding-presence') }] : []),
                ]
                : [],
    };
}

function withSlModifier(roll: ResolvedOpposedRoll, modifier: number): ResolvedOpposedRoll {
    if (modifier === 0) return roll;
    return {
        ...roll,
        successLevel: roll.successLevel + modifier,
        roundedSuccessLevel: roll.roundedSuccessLevel + modifier,
    };
}

function opposedWins(actorRoll: ResolvedOpposedRoll, targetRoll: ResolvedOpposedRoll): boolean {
    return actorRoll.roundedSuccessLevel > targetRoll.roundedSuccessLevel
        || (actorRoll.roundedSuccessLevel === targetRoll.roundedSuccessLevel && actorRoll.targetNumber > targetRoll.targetNumber);
}

function intimidateTargets(state: CombatState, actor: Combatant, primaryTargetId: string, capacity: number): string[] {
    const candidates = Object.values(state.combatants)
        .filter(combatant => combatant.side !== actor.side && isPsychologyParticipant(combatant))
        .sort((a, b) => {
            if (a.id === primaryTargetId) return -1;
            if (b.id === primaryTargetId) return 1;
            return Math.abs(a.position - actor.position) - Math.abs(b.position - actor.position)
                || a.id.localeCompare(b.id);
        });
    return candidates.slice(0, capacity).map(combatant => combatant.id);
}

function nearestAllies(state: CombatState, actor: Combatant, count: number): string[] {
    if (count <= 0) return [];
    return Object.values(state.combatants)
        .filter(combatant => combatant.id !== actor.id && combatant.side === actor.side && isPsychologyParticipant(combatant))
        .sort((a, b) => Math.abs(a.position - actor.position) - Math.abs(b.position - actor.position)
            || a.id.localeCompare(b.id))
        .slice(0, count)
        .map(combatant => combatant.id);
}

function skillTarget(combatant: Combatant, skillId: string): number {
    const normalized = skillId.toLowerCase();
    const skill = combatant.character.skills.find(candidate =>
        candidate.id.toLowerCase() === normalized || candidate.name.toLowerCase() === normalized
    );
    if (skill) {
        return calculateCharacteristicValue(combatant.character.characteristics[skill.characteristic as keyof typeof combatant.character.characteristics])
            + skill.advances
            + skill.talents
            + skill.modifier;
    }
    const fallback = normalized === 'cool'
        ? 'wp'
        : normalized === 'leadership'
            ? 'fel'
            : normalized === 'intimidate'
                ? 's'
                : 'ws';
    return calculateCharacteristicValue(combatant.character.characteristics[fallback]);
}

function talentRank(combatant: Combatant, talentId: string): number {
    const compact = talentId.toLowerCase().replace(/[\s_]+/g, '-');
    return combatant.character.talents?.[talentId] ?? combatant.character.talents?.[compact] ?? 0;
}

function hasTalent(combatant: Combatant, talentId: string): boolean {
    return talentRank(combatant, talentId) > 0;
}

function clonePsychology(combatant: Combatant): NonNullable<Combatant['psychology']> {
    return {
        ...psychologyState(),
        ...combatant.psychology,
        fears: Object.fromEntries(Object.entries(combatant.psychology?.fears ?? {}).map(([id, fear]) => [id, { ...fear }])),
        terrors: Object.fromEntries(Object.entries(combatant.psychology?.terrors ?? {}).map(([id, terror]) => [id, { ...terror }])),
    };
}

function activeFear(sourceId: string, rating: number, downgradedFromTerror = false): FearSourceState {
    return {
        sourceId,
        rating,
        accumulatedSL: 0,
        status: 'active',
        downgradedFromTerror,
    };
}

function normalizedRating(rating: number): number {
    return Math.max(1, Math.floor(rating));
}

function isPsychologyParticipant(combatant: Combatant | undefined): combatant is Combatant {
    return !!combatant
        && combatant.currentWounds > 0
        && !combatant.removedFromEncounter
        && !combatant.conditions.includes('condition_unconscious');
}

function addConditionStacks(conditions: string[], conditionId: string, amount: number): string[] {
    return amount > 0
        ? [...conditions, ...Array.from({ length: amount }, () => conditionId)]
        : conditions;
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

function appendResult(current: CombatEngineResult, next: CombatEngineResult): CombatEngineResult {
    return {
        state: next.state,
        events: [...current.events, ...next.events],
    };
}

function exposureEvent(
    combatantId: string,
    sourceId: string,
    psychology: 'fear' | 'terror',
    rating: number,
    outcome: 'active' | 'immune' | 'downgraded'
): CombatEvent {
    return {
        type: 'PsychologyExposure',
        i18nKey: `combat.psychology.${psychology}.exposure.${outcome}`,
        data: { combatantId, sourceId, psychology, rating, outcome },
    };
}

function testEvent(
    combatantId: string,
    sourceId: string,
    psychology: 'fear' | 'terror' | 'fearApproach' | 'sourceApproach',
    test: PsychologyTestResult,
    extra: Partial<Extract<CombatEvent, { type: 'PsychologyTestResolved' }>['data']> = {}
): CombatEvent {
    return {
        type: 'PsychologyTestResolved',
        i18nKey: `combat.psychology.${psychology}.test`,
        data: {
            combatantId,
            sourceId,
            psychology,
            ...test,
            ...extra,
        },
    };
}
