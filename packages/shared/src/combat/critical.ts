import { getHitLocation, rolld100, rollDice } from '../utils/mechanics';
import { calculateCharacteristicBonus } from '../utils/skills';
import { mathRandomRng, type Rng } from './rng';
import type {
    CombatEngineResult,
    CombatEvent,
    CombatState,
    Combatant,
    CritHookContext,
    CritResolverContext,
} from './types';

export type CriticalLocation = 'head' | 'arm' | 'body' | 'leg';
export type InjuryType = 'brokenBone' | 'tornMuscle' | 'amputation' | 'recordOnly';
export type InjurySeverity = 'minor' | 'major' | 'average' | 'difficult' | 'hard' | 'veryHard' | 'easy';
type CriticalRounds = number | { dice: [number, number]; modifier?: number; minimum?: number };

export type CriticalEffect =
    | { type: 'loseWounds'; amount: number | { dice: [number, number] } }
    | { type: 'gainCondition'; conditionId: string; amount: number | { dice: [number, number] } }
    | { type: 'conditionalTest'; skill: string; difficulty: number; onFail: CriticalEffect[]; testOutcome?: number }
    | { type: 'injury'; injuryType: InjuryType; severity: InjurySeverity; location?: CriticalLocation }
    | { type: 'amputation'; part: string; difficulty: InjurySeverity; testOutcome?: number }
    | { type: 'dropItem' }
    | { type: 'limbUseless'; location?: CriticalLocation; rounds: CriticalRounds }
    | { type: 'death' }
    | { type: 'recordOnly'; note: string };

export interface CriticalWoundRow {
    location: CriticalLocation;
    min: number;
    max?: number;
    name: string;
    wounds: number | 'death';
    trivial?: boolean;
    effects: CriticalEffect[];
}

export interface CriticalWoundRecord {
    id: string;
    location: CriticalLocation;
    name: string;
    trivial: boolean;
    wounds: number | 'death';
    roll: number;
}

export interface InjuryRecord {
    id: string;
    type: InjuryType;
    severity: InjurySeverity;
    location: CriticalLocation;
    penalty?: number;
    movementHalved?: boolean;
    partLost?: string;
    deferred?: string[];
}

export interface CriticalCombatantState {
    criticalWounds?: CriticalWoundRecord[];
    injuries?: InjuryRecord[];
    dead?: boolean;
    droppedItems?: number;
    movementMultiplier?: number;
}

export interface CriticalRollOptions {
    rng?: Rng;
    resultRoll?: number;
    locationRoll?: number;
    amputationTestOutcome?: number;
    suddenDeath?: boolean;
}

export const criticalWoundTables: Record<CriticalLocation, CriticalWoundRow[]> = {
    head: [
        row('head', 1, 3, 'Dramatic Injury', 'T', [cond('condition_bleeding')]),
        row('head', 4, 6, 'Rattling Blow', 1, [cond('condition_stunned')]),
        row('head', 7, 9, 'Poked Eye', 1, [cond('condition_blinded')]),
        row('head', 10, 15, 'Ear Bash', 1, [cond('condition_deafened')]),
        row('head', 16, 20, 'Minor Cut', 1, [cond('condition_bleeding')]),
        row('head', 21, 25, 'Black Eye', 2, [cond('condition_blinded', 2)]),
        row('head', 26, 30, 'Sliced Ear', 2, [cond('condition_deafened', 2), cond('condition_bleeding')]),
        row('head', 31, 35, 'Struck Forehead', 2, [cond('condition_bleeding', 2), cond('condition_blinded')]),
        row('head', 36, 40, 'Fractured Jaw', 2, [cond('condition_stunned', 2), injury('brokenBone', 'minor')]),
        row('head', 41, 45, 'Major Eye Wound', 3, [cond('condition_bleeding'), cond('condition_blinded')]),
        row('head', 46, 50, 'Major Ear Wound', 3, [record('Hearing tests suffer -20; repeat causes permanent hearing loss.')]),
        row('head', 51, 55, 'Broken Nose', 3, [cond('condition_bleeding', 2), test('Endurance', 0, [cond('condition_stunned')])]),
        row('head', 56, 60, 'Broken Jaw', 3, [cond('condition_stunned', 3), test('Endurance', 0, [cond('condition_unconscious')]), injury('brokenBone', 'major')]),
        row('head', 61, 65, 'Mangled Ear', 4, [cond('condition_deafened', 3), cond('condition_bleeding', 2), amp('ear', 'average')]),
        row('head', 66, 75, 'Smashed Mouth', 4, [cond('condition_bleeding', 2), amp('teeth', 'easy')]),
        row('head', 76, 80, 'Concussive Blow', 4, [cond('condition_deafened'), cond('condition_bleeding', 2), cond('condition_stunned', { dice: [1, 10] }), cond('condition_fatigued')]),
        row('head', 81, 85, 'Devastated Eye', 5, [cond('condition_blinded', 3), cond('condition_bleeding', 2), cond('condition_stunned'), amp('eye', 'difficult')]),
        row('head', 86, 94, 'Disfiguring Blow', 5, [cond('condition_bleeding', 3), cond('condition_blinded', 3), cond('condition_stunned', 2), amp('eye and nose', 'hard')]),
        row('head', 95, 99, 'Mangled Jaw', 5, [cond('condition_bleeding', 4), cond('condition_stunned', 3), injury('brokenBone', 'major'), amp('tongue and teeth', 'hard')]),
        row('head', 100, undefined, 'Shattered Skull', 'death', [{ type: 'death' }]),
    ],
    arm: [
        row('arm', 1, 10, 'Jolted Wrist', 'T', [{ type: 'dropItem' }]),
        row('arm', 11, 20, 'Jarred Arm', 'T', [{ type: 'dropItem' }, useless('arm', { dice: [1, 10], modifier: -1, minimum: 1 })]),
        row('arm', 21, 25, 'Minor Cut', 1, [cond('condition_bleeding')]),
        row('arm', 26, 40, 'Sprain', 1, [injury('tornMuscle', 'minor')]),
        row('arm', 41, 45, 'Torn Muscles', 1, [cond('condition_bleeding'), injury('tornMuscle', 'minor')]),
        row('arm', 46, 50, 'Bleeding Hand', 1, [cond('condition_bleeding'), test('Dexterity', 20, [{ type: 'dropItem' }])]),
        row('arm', 51, 55, 'Wrenched Arm', 2, [{ type: 'dropItem' }, useless('arm', { dice: [1, 10] })]),
        row('arm', 56, 60, 'Gaping Wound', 2, [cond('condition_bleeding', 2), record('Until Surgery, arm damage inflicts additional Bleeding.')]),
        row('arm', 61, 75, 'Clean Break', 2, [{ type: 'dropItem' }, injury('brokenBone', 'minor'), test('Endurance', -10, [cond('condition_stunned')])]),
        row('arm', 76, 80, 'Ruptured Ligament', 2, [{ type: 'dropItem' }, injury('tornMuscle', 'major')]),
        row('arm', 81, 85, 'Deep Cut', 3, [cond('condition_bleeding', 2), cond('condition_stunned'), injury('tornMuscle', 'minor'), test('Endurance', -20, [cond('condition_unconscious')])]),
        row('arm', 86, 90, 'Crushed Elbow', 3, [{ type: 'dropItem' }, injury('brokenBone', 'major')]),
        row('arm', 91, 95, 'Damaged Artery', 3, [cond('condition_bleeding', 4)]),
        row('arm', 96, 109, 'Dislocated Shoulder', 4, [useless('arm', 999), cond('condition_stunned'), record('Medical Attention required; later tests using the arm suffer -10.')]),
        row('arm', 110, 115, 'Severed Finger', 4, [cond('condition_bleeding'), amp('finger', 'average')]),
        row('arm', 116, 120, 'Cleft Hand', 4, [cond('condition_bleeding', 2), cond('condition_stunned'), amp('finger', 'difficult')]),
        row('arm', 121, 125, 'Mauled Bicep', 5, [{ type: 'dropItem' }, cond('condition_bleeding', 2), cond('condition_stunned'), injury('tornMuscle', 'major')]),
        row('arm', 126, 130, 'Mangled Hand', 5, [cond('condition_bleeding', 2), amp('hand', 'hard'), test('Endurance', -20, [cond('condition_stunned'), cond('condition_prone')])]),
        row('arm', 131, 135, 'Sliced Tendons', 5, [cond('condition_bleeding', 3), cond('condition_stunned'), useless('arm', 999), amp('arm', 'veryHard'), test('Endurance', -20, [cond('condition_unconscious')])]),
        row('arm', 136, undefined, 'Brutal Dismemberment', 'death', [{ type: 'death' }]),
    ],
    body: [
        row('body', 1, 10, 'Winded', 'T', [cond('condition_stunned'), test('Endurance', 20, [cond('condition_prone')]), useless('body', { dice: [1, 10] })]),
        row('body', 11, 20, "'Tis But A Scratch!", 1, [cond('condition_bleeding')]),
        row('body', 21, 25, 'Gut Blow', 1, [cond('condition_stunned'), test('Endurance', 40, [cond('condition_prone')])]),
        row('body', 26, 30, 'Low Blow!', 1, [test('Endurance', -20, [cond('condition_stunned', 3)])]),
        row('body', 31, 35, 'Twisted Back', 1, [injury('tornMuscle', 'minor')]),
        row('body', 36, 40, 'Bruised Ribs', 2, [record('Agility-based Tests suffer -10 for 1d10 days.')]),
        row('body', 41, 45, 'Wrenched Collar Bone', 2, [{ type: 'dropItem' }, useless('arm', { dice: [1, 10] })]),
        row('body', 46, 50, 'Ragged Wound', 2, [cond('condition_bleeding', 2)]),
        row('body', 51, 55, 'Cracked Ribs', 2, [cond('condition_stunned'), injury('brokenBone', 'minor')]),
        row('body', 56, 60, 'Gaping Wound', 3, [cond('condition_bleeding', 3), record('Until Surgery, body wounds inflict additional Bleeding.')]),
        row('body', 61, 65, 'Painful Cut', 3, [cond('condition_bleeding', 2), cond('condition_stunned'), test('Endurance', -20, [cond('condition_unconscious')])]),
        row('body', 66, 70, 'Arterial Damage', 3, [cond('condition_bleeding', 4), record('Until Surgery, body damage gains 2 additional Bleeding.')]),
        row('body', 71, 75, 'Pulled Back', 3, [injury('tornMuscle', 'major')]),
        row('body', 76, 80, 'Fractured Hip', 4, [cond('condition_stunned'), test('Endurance', 0, [cond('condition_prone')]), injury('brokenBone', 'minor')]),
        row('body', 81, 85, 'Major Chest Wound', 4, [cond('condition_bleeding', 4), record('Until Surgery, body wounds also inflict 2 Bleeding.')]),
        row('body', 86, 90, 'Gut Wound', 4, [cond('condition_bleeding', 2), record('Contract Festering Wound after combat.')]),
        row('body', 91, 95, 'Smashed Rib Cage', 5, [cond('condition_stunned'), injury('brokenBone', 'major')]),
        row('body', 96, 110, 'Broken Collar Bone', 5, [cond('condition_unconscious'), injury('brokenBone', 'major')]),
        row('body', 111, 115, 'Internal Bleeding', 5, [cond('condition_bleeding'), record('Contract Blood Rot; Bleeding requires Surgery.')]),
        row('body', 116, undefined, 'Torn Apart', 'death', [{ type: 'death' }]),
    ],
    leg: [
        row('leg', 1, 10, 'Stubbed Toe', 'T', [test('Endurance', 20, [record('Agility Tests suffer -10 until end of next turn.')])]),
        row('leg', 11, 20, 'Lost Footing', 'T', [test('Athletics', 0, [cond('condition_prone')])]),
        row('leg', 21, 25, 'Twisted Ankle', 1, [record('Agility Tests suffer -10 for 1d10 Rounds.')]),
        row('leg', 26, 40, 'Minor Cut', 1, [cond('condition_bleeding')]),
        row('leg', 41, 45, 'Thigh Strike', 1, [cond('condition_bleeding'), test('Endurance', 20, [cond('condition_prone')])]),
        row('leg', 46, 50, 'Sprained Ankle', 1, [injury('tornMuscle', 'minor')]),
        row('leg', 51, 55, 'Twisted Knee', 2, [record('Agility Tests suffer -20 for 1d10 Rounds.')]),
        row('leg', 56, 60, 'Badly Cut Toe', 2, [cond('condition_bleeding'), record('After the encounter, Endurance Test or lose a toe.')]),
        row('leg', 61, 65, 'Bad Cut', 2, [cond('condition_bleeding', 2), test('Endurance', 0, [cond('condition_prone')])]),
        row('leg', 66, 70, 'Badly Twisted Knee', 2, [injury('tornMuscle', 'major')]),
        row('leg', 71, 75, 'Hacked Leg', 3, [cond('condition_prone'), cond('condition_bleeding', 2), injury('brokenBone', 'minor')]),
        row('leg', 76, 80, 'Torn Thigh', 3, [cond('condition_bleeding', 3), record('Until Surgery, leg damage inflicts additional Bleeding.')]),
        row('leg', 81, 85, 'Ruptured Tendon', 3, [cond('condition_prone'), cond('condition_stunned'), test('Endurance', -20, [cond('condition_unconscious')]), injury('tornMuscle', 'major')]),
        row('leg', 86, 90, 'Cracked Shin', 4, [cond('condition_stunned'), cond('condition_prone'), injury('tornMuscle', 'major'), injury('brokenBone', 'minor')]),
        row('leg', 91, 95, 'Broken Knee', 4, [cond('condition_bleeding'), cond('condition_prone'), cond('condition_stunned'), injury('brokenBone', 'major')]),
        row('leg', 96, 105, 'Dislocated Knee', 4, [cond('condition_prone'), test('Endurance', -20, [cond('condition_stunned')]), record('Medical Attention required; movement halved and leg Tests suffer -10 afterward.')]),
        row('leg', 106, 115, 'Crushed Foot', 4, [cond('condition_bleeding', 2), test('Endurance', 20, [cond('condition_prone'), amp('toe', 'average')])]),
        row('leg', 116, 120, 'Severed Foot', 5, [cond('condition_bleeding', 3), cond('condition_stunned', 2), cond('condition_prone'), amp('foot', 'hard')]),
        row('leg', 121, 125, 'Cut Tendon', 5, [cond('condition_bleeding', 2), cond('condition_stunned', 2), cond('condition_prone'), amp('leg', 'veryHard')]),
        row('leg', 126, undefined, 'Shattered Pelvis', 'death', [{ type: 'death' }]),
    ],
};

export function criticalRoll(context: CritResolverContext, options: CriticalRollOptions = {}): CombatEngineResult {
    const rng = options.rng ?? mathRandomRng;
    if (context.trigger === 'fumbleInjury') {
        return applyCriticalEffects(context.state, context.combatantId, [{
            type: 'injury',
            injuryType: 'tornMuscle',
            severity: 'minor',
            location: normalizeCriticalLocation(context.hitLocation),
        }], context, { row: row(normalizeCriticalLocation(context.hitLocation), 1, 1, 'Torn Muscle (Minor)', 'T', []) });
    }

    const target = getCombatant(context.state, context.combatantId);
    if (options.suddenDeath && target.currentWounds === 0 && shouldApplySuddenDeath(target)) {
        return killCombatant(context.state, context.combatantId, 'suddenDeath');
    }

    const locationRoll = options.locationRoll ?? (context.trigger === 'unconsciousAuto' ? undefined : rolld100(rng));
    const location = context.trigger === 'unconsciousAuto'
        ? normalizeCriticalLocation(context.hitLocation)
        : normalizeCriticalLocation(getHitLocation(locationRoll!));
    const baseResultRoll = options.resultRoll ?? rolld100(rng);
    const modifier = criticalRollModifier(context, target);
    const modifiedRoll = Math.max(1, baseResultRoll + modifier);
    const tableRow = resolveCriticalRow(location, modifiedRoll);
    const hookContext: CritHookContext = {
        ...context,
        hitLocation: location,
        resultRoll: modifiedRoll,
        locationRoll,
    };
    const effects = [...tableRow.effects];
    if (tableRow.wounds !== 'death' && tableRow.wounds > 0) {
        effects.push({ type: 'loseWounds', amount: tableRow.wounds });
    }

    const result = applyCriticalEffects(context.state, context.combatantId, effects, hookContext, {
        row: tableRow,
        baseRoll: baseResultRoll,
        modifiedRoll,
        modifier,
        locationRoll,
        amputationTestOutcome: options.amputationTestOutcome,
        rng,
    });
    return result;
}

export function criticalRollModifier(context: CritResolverContext, target: Combatant): number {
    const beyond = context.woundsBeyondZero ?? 0;
    if (beyond <= 0) return 0;
    const tb = calculateCharacteristicBonus(target.character.characteristics.t);
    return beyond * 10 + (beyond < tb ? -20 : 0);
}

export function resolveCriticalRow(location: CriticalLocation, roll: number): CriticalWoundRow {
    return criticalWoundTables[location].find(candidate => roll >= candidate.min && (candidate.max === undefined || roll <= candidate.max))
        ?? criticalWoundTables[location][criticalWoundTables[location].length - 1];
}

export function applyCriticalEffects(
    state: CombatState,
    combatantId: string,
    effects: CriticalEffect[],
    context: CritResolverContext,
    meta: {
        row: CriticalWoundRow;
        baseRoll?: number;
        modifiedRoll?: number;
        modifier?: number;
        locationRoll?: number;
        amputationTestOutcome?: number;
        rng?: Rng;
    }
): CombatEngineResult {
    let currentState = state;
    const events: CombatEvent[] = [];
    const location = meta.row.location;

    if (meta.modifiedRoll !== undefined) {
        events.push({
            type: 'CritRolled',
            i18nKey: context.trigger === 'zeroWounds' ? 'combat.critical.zeroWounds' : 'combat.critical.roll',
            data: {
                combatantId,
                role: context.role,
                trigger: context.trigger,
                roll: context.roll,
                targetNumber: context.targetNumber,
                critRoll: meta.modifiedRoll,
                hitLocation: location,
                woundsBeyondZero: context.woundsBeyondZero,
            },
        }, {
            type: 'CriticalWoundResolved',
            i18nKey: 'combat.critical.woundResolved',
            data: {
                combatantId,
                location,
                tableRoll: meta.baseRoll ?? meta.modifiedRoll,
                modifiedRoll: meta.modifiedRoll,
                modifier: meta.modifier ?? 0,
                name: meta.row.name,
                wounds: meta.row.wounds,
                trivial: !!meta.row.trivial,
            },
        });
    }

    if (!meta.row.trivial && meta.row.wounds !== 'death') {
        currentState = recordCriticalWound(currentState, combatantId, {
            id: `${combatantId}:${location}:${meta.row.name}:${meta.modifiedRoll ?? 0}`,
            location,
            name: meta.row.name,
            trivial: false,
            wounds: meta.row.wounds,
            roll: meta.modifiedRoll ?? 0,
        });
    }

    for (const effect of effects) {
        const applied = applyCriticalEffect(currentState, combatantId, effect, location, meta.rng ?? mathRandomRng, meta.amputationTestOutcome);
        currentState = applied.state;
        events.push(...applied.events);
    }

    return { state: currentState, events };
}

export function accumulatedCriticalDeathCheck(state: CombatState, combatantId: string): CombatEngineResult {
    const combatant = getCombatant(state, combatantId) as Combatant & CriticalCombatantState;
    const nonTrivialCriticals = (combatant.criticalWounds || []).filter(critical => !critical.trivial).length;
    const tb = calculateCharacteristicBonus(combatant.character.characteristics.t);
    if (combatant.currentWounds === 0 && combatant.conditions.includes('condition_unconscious') && nonTrivialCriticals > tb) {
        return killCombatant(state, combatantId, 'accumulatedCriticals');
    }
    return { state, events: [] };
}

export function coupDeGrace(state: CombatState, _attackerId: string, targetId: string): CombatEngineResult {
    const target = getCombatant(state, targetId);
    if (!target.conditions.includes('condition_unconscious')) return { state, events: [] };
    return killCombatant(state, targetId, 'coupDeGrace');
}

export function applySuddenDeathAtZero(state: CombatState, combatantId: string, enabled: boolean): CombatEngineResult {
    const combatant = getCombatant(state, combatantId);
    if (!enabled || combatant.currentWounds > 0 || !shouldApplySuddenDeath(combatant)) return { state, events: [] };
    return killCombatant(state, combatantId, 'suddenDeath');
}

export function shouldApplySuddenDeath(combatant: Combatant): boolean {
    if (combatant.isPlayer || combatant.character.userId) return false;
    if (hasLuckTalent(combatant)) return false;
    return !!combatant.character.isMinion;
}

function applyCriticalEffect(
    state: CombatState,
    combatantId: string,
    effect: CriticalEffect,
    location: CriticalLocation,
    rng: Rng,
    amputationTestOutcome?: number
): CombatEngineResult {
    const combatant = getCombatant(state, combatantId) as Combatant & CriticalCombatantState;
    const events: CombatEvent[] = [];

    if (effect.type === 'gainCondition') {
        const amount = resolveAmount(effect.amount, rng);
        const conditions = addConditions(combatant.conditions, effect.conditionId, amount);
        events.push({ type: 'ConditionApplied', i18nKey: 'combat.condition.applied', data: { targetId: combatantId, conditionId: effect.conditionId, stacks: amount } });
        return { state: replaceCombatant(state, { ...combatant, conditions }), events };
    }

    if (effect.type === 'loseWounds') {
        const amount = resolveAmount(effect.amount, rng);
        const nextWounds = Math.max(0, combatant.currentWounds - amount);
        events.push({ type: 'CriticalEffectApplied', i18nKey: 'combat.critical.effect.loseWounds', data: { combatantId, effect: 'loseWounds', amount, location } });
        return { state: replaceCombatant(state, woundCombatant(combatant, nextWounds)), events };
    }

    if (effect.type === 'death') {
        return killCombatant(state, combatantId, 'criticalWound');
    }

    if (effect.type === 'dropItem') {
        events.push({ type: 'CriticalEffectApplied', i18nKey: 'combat.critical.effect.dropItem', data: { combatantId, effect: 'dropItem', location } });
        return { state: replaceCombatant(state, { ...combatant, droppedItems: (combatant.droppedItems || 0) + 1 } as Combatant), events };
    }

    if (effect.type === 'limbUseless') {
        const rounds = typeof effect.rounds === 'number'
            ? effect.rounds
            : Math.max(effect.rounds.minimum ?? 0, rollDice(effect.rounds.dice[0], effect.rounds.dice[1], rng) + (effect.rounds.modifier ?? 0));
        const injuryRecord = injuryRecordFor('recordOnly', 'minor', effect.location ?? location, { deferred: [`Useless for ${rounds} rounds.`] });
        events.push({ type: 'InjuryRecorded', i18nKey: 'combat.injury.recorded', data: { combatantId, injuryType: 'limbUseless', severity: 'temporary', location: effect.location ?? location } });
        return { state: appendInjury(state, combatantId, injuryRecord), events };
    }

    if (effect.type === 'injury') {
        const injuryLocation = effect.location ?? location;
        const injuryRecord = injuryRecordFor(effect.injuryType, effect.severity, injuryLocation);
        events.push({
            type: 'InjuryRecorded',
            i18nKey: 'combat.injury.recorded',
            data: {
                combatantId,
                injuryType: effect.injuryType,
                severity: effect.severity,
                location: injuryLocation,
                penalty: injuryRecord.penalty,
                movementHalved: injuryRecord.movementHalved,
            },
        });
        return { state: appendInjury(state, combatantId, injuryRecord), events };
    }

    if (effect.type === 'amputation') {
        let currentState = appendInjury(state, combatantId, injuryRecordFor('amputation', effect.difficulty, location, { partLost: effect.part }));
        events.push({ type: 'InjuryRecorded', i18nKey: 'combat.injury.recorded', data: { combatantId, injuryType: 'amputation', severity: effect.difficulty, location } });
        const outcome = effect.testOutcome ?? amputationTestOutcome ?? 0;
        const failedEffects = amputationFailureEffects(outcome);
        for (const failedEffect of failedEffects) {
            const applied = applyCriticalEffect(currentState, combatantId, failedEffect, location, rng, amputationTestOutcome);
            currentState = applied.state;
            events.push(...applied.events);
        }
        return { state: currentState, events };
    }

    if (effect.type === 'conditionalTest') {
        if ((effect.testOutcome ?? 0) >= 0) return { state, events };
        let currentState = state;
        for (const failedEffect of effect.onFail) {
            const applied = applyCriticalEffect(currentState, combatantId, failedEffect, location, rng, amputationTestOutcome);
            currentState = applied.state;
            events.push(...applied.events);
        }
        return { state: currentState, events };
    }

    events.push({ type: 'CriticalEffectApplied', i18nKey: 'combat.critical.effect.recordOnly', data: { combatantId, effect: effect.note, location } });
    return {
        state: appendInjury(state, combatantId, injuryRecordFor('recordOnly', 'minor', location, { deferred: [effect.note] })),
        events,
    };
}

function row(location: CriticalLocation, min: number, max: number | undefined, name: string, wounds: number | 'death' | 'T', effects: CriticalEffect[]): CriticalWoundRow {
    return { location, min, max, name, wounds: wounds === 'T' ? 0 : wounds, trivial: wounds === 'T', effects };
}

function cond(conditionId: string, amount: number | { dice: [number, number] } = 1): CriticalEffect {
    return { type: 'gainCondition', conditionId, amount };
}

function injury(injuryType: InjuryType, severity: InjurySeverity): CriticalEffect {
    return { type: 'injury', injuryType, severity };
}

function amp(part: string, difficulty: InjurySeverity): CriticalEffect {
    return { type: 'amputation', part, difficulty };
}

function test(skill: string, difficulty: number, onFail: CriticalEffect[]): CriticalEffect {
    return { type: 'conditionalTest', skill, difficulty, onFail };
}

function record(note: string): CriticalEffect {
    return { type: 'recordOnly', note };
}

function useless(location: CriticalLocation, rounds: CriticalRounds): CriticalEffect {
    return { type: 'limbUseless', location, rounds };
}

function normalizeCriticalLocation(location: string): CriticalLocation {
    const normalized = location.toLowerCase();
    if (normalized.includes('head')) return 'head';
    if (normalized.includes('arm')) return 'arm';
    if (normalized.includes('leg')) return 'leg';
    return 'body';
}

function resolveAmount(amount: number | { dice: [number, number] }, rng: Rng): number {
    return typeof amount === 'number' ? amount : rollDice(amount.dice[0], amount.dice[1], rng);
}

function amputationFailureEffects(successLevel: number): CriticalEffect[] {
    if (successLevel >= 0) return [];
    const effects: CriticalEffect[] = [cond('condition_prone')];
    if (successLevel <= -2) effects.push(cond('condition_stunned'));
    if (successLevel <= -4) effects.push(cond('condition_unconscious'));
    return effects;
}

function injuryRecordFor(type: InjuryType, severity: InjurySeverity, location: CriticalLocation, extras: Partial<InjuryRecord> = {}): InjuryRecord {
    const penalty = type === 'tornMuscle' ? (severity === 'major' ? -20 : -10) : undefined;
    return {
        id: `${type}:${severity}:${location}`,
        type,
        severity,
        location,
        penalty,
        movementHalved: (location === 'leg' && (type === 'tornMuscle' || type === 'brokenBone' || type === 'amputation'))
            || (location === 'body' && type === 'brokenBone'),
        deferred: ['Recovery and permanent effects are recorded for the live app.'],
        ...extras,
    };
}

function recordCriticalWound(state: CombatState, combatantId: string, record: CriticalWoundRecord): CombatState {
    const combatant = getCombatant(state, combatantId) as Combatant & CriticalCombatantState;
    return replaceCombatant(state, {
        ...combatant,
        criticalWounds: [...(combatant.criticalWounds || []), record],
    } as Combatant);
}

function appendInjury(state: CombatState, combatantId: string, injuryRecord: InjuryRecord): CombatState {
    const combatant = getCombatant(state, combatantId) as Combatant & CriticalCombatantState;
    return replaceCombatant(state, {
        ...combatant,
        injuries: [...(combatant.injuries || []), injuryRecord],
        movementBudget: injuryRecord.movementHalved
            ? { ...combatant.movementBudget, walk: combatant.movementBudget.walk / 2, run: combatant.movementBudget.run / 2, remaining: Math.min(combatant.movementBudget.remaining, combatant.movementBudget.run / 2) }
            : combatant.movementBudget,
    } as Combatant);
}

function killCombatant(state: CombatState, combatantId: string, reason: 'criticalWound' | 'accumulatedCriticals' | 'coupDeGrace' | 'suddenDeath'): CombatEngineResult {
    const combatant = getCombatant(state, combatantId) as Combatant & CriticalCombatantState;
    return {
        state: replaceCombatant(state, { ...woundCombatant(combatant, 0), dead: true } as Combatant),
        events: [{ type: 'CombatantDied', i18nKey: `combat.death.${reason}`, data: { combatantId, reason } }],
    };
}

function woundCombatant(combatant: Combatant, currentWounds: number): Combatant {
    return {
        ...combatant,
        currentWounds,
        character: {
            ...combatant.character,
            status: {
                ...combatant.character.status,
                wounds: { ...combatant.character.status.wounds, current: currentWounds },
            },
        },
        resources: {
            ...combatant.resources,
            wounds: { ...combatant.resources.wounds, current: currentWounds },
        },
    };
}

function addConditions(conditions: string[], conditionId: string, amount: number): string[] {
    const nonStacking = ['condition_prone', 'condition_surprised', 'condition_unconscious'];
    if (nonStacking.includes(conditionId) && conditions.includes(conditionId)) return conditions;
    return [...conditions, ...Array.from({ length: nonStacking.includes(conditionId) ? 1 : amount }, () => conditionId)];
}

function hasLuckTalent(combatant: Combatant): boolean {
    return Object.keys(combatant.character.talents || {}).some(talentId => talentId.toLowerCase().includes('luck'));
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
