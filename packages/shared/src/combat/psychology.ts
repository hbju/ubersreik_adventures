import { calculateSuccessLevel, rolld100 } from '../utils/mechanics';
import { calculateCharacteristicValue } from '../utils/skills';
import type { Rng } from './rng';
import type {
    CombatEngineResult,
    CombatEvent,
    CombatState,
    Combatant,
    FearSourceState,
    MeleeHookContext,
    ModifierSource,
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
        const rating = normalizedRating(fearRating);
        psychology.fears[source.id] = fearless
            ? { ...activeFear(source.id, rating), status: 'immune' }
            : activeFear(source.id, rating);
        events.push(exposureEvent(target.id, source.id, 'fear', rating, fearless ? 'immune' : 'active'));
    }

    return events.length > 0
        ? { state: replaceCombatant(state, { ...target, psychology }), events }
        : { state, events: [] };
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
        const test = resolveCoolTest(target, rng);
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
        const test = resolveCoolTest(combatant, rng);
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
        const test = resolveCoolTest(target, rng);
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

export function resolveCoolTest(combatant: Combatant, rng: Rng, modifier = 0): PsychologyTestResult {
    const skill = combatant.character.skills.find(candidate =>
        candidate.id.toLowerCase() === 'cool' || candidate.name.toLowerCase() === 'cool'
    );
    const wp = calculateCharacteristicValue(combatant.character.characteristics.wp);
    const targetNumber = wp
        + (skill?.advances ?? 0)
        + (skill?.talents ?? 0)
        + (skill?.modifier ?? 0)
        + modifier;
    const roll = rolld100(rng);
    return {
        roll,
        targetNumber,
        successLevel: Math.round(calculateSuccessLevel(roll, targetNumber)),
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
