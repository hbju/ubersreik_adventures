import type { Armor, Character } from '../types/wfrp.types';
import { attackerModifiersFor, conditionsRemovedAfterAttack, opposedTestCollapseFor } from '../utils/conditions';
import { calculateSuccessLevel, getHitLocation, rolld100 } from '../utils/mechanics';
import { calculateCharacteristicBonus } from '../utils/skills';
import { createAdvantagePools, grantAdvantage } from './advantage';
import { defensiveBonusForSkill, resolveEffectiveWeapon } from './actions';
import { criticalRoll } from './critical';
import { collectMeleePreRollModifiers, resolveModifierTotal } from './modifiers';
import { applyBlackpowderTargetEffect, armourPointsAtLocation, createQualityHooks, defenderTargetModifierFromQualities } from './qualities';
import { tryInterceptDamageWithFate } from './resources';
import { mathRandomRng, type Rng } from './rng';
import { createMovementBudget } from './spatial';
import { createTalentHooks, getTalentInitiativeModifier } from './talents';
import type {
    CombatEngineResult,
    CombatEvent,
    CombatState,
    Combatant,
    CritResolverContext,
    DamageHit,
    MeleeResolutionHooks,
    MeleeAttackAction,
    OpposedRollInput,
    ResolvedOpposedRoll,
    SideId,
} from './types';

export function createCombatantFromCharacter(
    character: Character,
    options: Partial<Pick<Combatant, 'id' | 'side' | 'currentWounds' | 'maxWounds' | 'position' | 'movementBudget' | 'engagementIds' | 'budget' | 'conditions' | 'conditionInstances'>> = {}
): Combatant {
    const currentWounds = options.currentWounds ?? character.status.wounds.current;
    const maxWounds = options.maxWounds ?? character.status.wounds.max;

    return {
        id: options.id ?? character.id,
        sourceId: character.id,
        name: character.name,
        side: options.side ?? (character.userId ? 'ally' : 'adversary'),
        isPlayer: character.userId != null,
        character,
        currentWounds,
        maxWounds,
        position: options.position ?? 0,
        movementBudget: options.movementBudget ?? createMovementBudget(character.movement),
        engagementIds: options.engagementIds ?? [],
        budget: options.budget ?? { actions: 1, moves: 1, reactions: 1 },
        conditions: options.conditions ?? character.conditions.map(condition => condition.id),
        conditionInstances: options.conditionInstances,
        resources: {
            wounds: { ...character.status.wounds, current: currentWounds, max: maxWounds },
            fate: character.status.fate,
            fortune: character.status.fortune,
            resilience: character.status.resilience,
            resolve: character.status.resolve,
        },
    };
}

export function createCombatState(
    combatants: Combatant[],
    options: { armor?: Armor[]; talents?: CombatState['talents']; weapons?: CombatState['weapons']; advantagePools?: CombatState['advantagePools']; tacticalDominantSide?: CombatState['tacticalDominantSide']; turnFlags?: Partial<CombatState['turnFlags']>; engagements?: CombatState['engagements']; round?: number } = {}
): CombatState {
    return {
        combatants: Object.fromEntries(combatants.map(combatant => [combatant.id, combatant])),
        round: options.round ?? 0,
        armor: options.armor ?? [],
        weapons: options.weapons ?? [],
        talents: options.talents ?? [],
        advantagePools: createAdvantagePools(options.advantagePools),
        tacticalDominantSide: options.tacticalDominantSide,
        turnFlags: {
            additionalActionCombatantIds: options.turnFlags?.additionalActionCombatantIds ?? [],
            chargedCombatantIds: options.turnFlags?.chargedCombatantIds ?? [],
            talentExtraAttackCombatantIds: options.turnFlags?.talentExtraAttackCombatantIds ?? [],
        },
        engagements: options.engagements ?? {},
    };
}

export function getArmorPointsAtLocation(character: Character, location: string, armorData: Armor[]): number {
    return armourPointsAtLocation(character, location, armorData);
}

export function resolveDamage(state: CombatState, hit: DamageHit, rng: Rng = mathRandomRng): CombatEngineResult {
    const attacker = getCombatant(state, hit.attackerId);
    const defender = getCombatant(state, hit.defenderId);
    const hooks = normalizeHooks(hit.hooks, rng);
    const hitLocation = hit.hitLocation ?? (hit.attackRoll ? getHitLocation(hit.attackRoll) : 'Unknown');
    const toughnessBonus = calculateCharacteristicBonus(defender.character.characteristics.t);
    const baseArmourPoints = getArmorPointsAtLocation(defender.character, hitLocation, state.armor);
    const armourPoints = Math.max(0, baseArmourPoints + hooks.apModifiers({
        state,
        action: {
            attackerId: attacker.id,
            defenderId: defender.id,
            attacker: { skillId: hit.skillId, targetNumber: 0 },
            defender: { skillId: 'melee_basic', targetNumber: 0 },
        },
        attacker,
        defender,
        attackerRoll: rollFromDamageHit(hit),
        hitLocation,
        weaponDamage: hit.weaponDamage,
        attackerSuccessLevel: hit.sl ?? hit.slDifference,
        armourPoints: baseArmourPoints,
    }));
    const hookDamageBonus = hooks.damageModifiers({
        state,
        action: {
            attackerId: attacker.id,
            defenderId: defender.id,
            attacker: { skillId: hit.skillId, targetNumber: 0 },
            defender: { skillId: 'melee_basic', targetNumber: 0 },
            isCharging: hit.isCharging,
        },
        attacker,
        defender,
        attackerRoll: rollFromDamageHit(hit),
        hitLocation,
        weaponDamage: hit.weaponDamage,
        attackerSuccessLevel: hit.sl ?? hit.slDifference,
        defenderSuccessLevel: hit.defenderSuccessLevel,
    });
    const rawDamage = hit.weaponDamage + hit.slDifference + hookDamageBonus;
    const mitigatedDamage = rawDamage - toughnessBonus - armourPoints;
    const minimumOneWoundApplied = !hit.disableMinimumWound && mitigatedDamage <= 0;
    let damageDealt = hit.disableMinimumWound ? Math.max(mitigatedDamage, 0) : Math.max(mitigatedDamage, 1);
    const woundsBefore = defender.currentWounds;
    const woundsBeyondZero = Math.max(0, damageDealt - woundsBefore);
    const woundsAfter = Math.max(0, woundsBefore - damageDealt);

    const onHit = hooks.onHitEffects({
        state,
        action: {
            attackerId: attacker.id,
            defenderId: defender.id,
            attacker: { skillId: hit.skillId, targetNumber: 0 },
            defender: { skillId: 'melee_basic', targetNumber: 0 },
        },
        attacker,
        defender,
        attackerRoll: rollFromDamageHit(hit),
        hitLocation,
        weaponDamage: hit.weaponDamage,
        attackerSuccessLevel: hit.sl ?? hit.slDifference,
        armourPoints,
        damageDealt,
        woundsBefore,
        woundsAfter,
    });
    const onHitResult = Array.isArray(onHit) ? { state, events: onHit, suppressNormalDamage: false } : onHit;
    if (onHitResult.suppressNormalDamage) {
        return { state: onHitResult.state, events: onHitResult.events };
    }

    const fateIntercept = tryInterceptDamageWithFate(onHitResult.state, defender.id, damageDealt, hit.fatePolicy);
    if (fateIntercept.intercepted) {
        return { state: fateIntercept.state, events: [...onHitResult.events, ...fateIntercept.events] };
    }

    const defenderAfterOnHit = getCombatant(onHitResult.state, defender.id);

    const updatedDefender: Combatant = {
        ...defenderAfterOnHit,
        currentWounds: woundsAfter,
        conditions: woundsBefore > 0 && woundsAfter === 0
            ? addCondition(defenderAfterOnHit.conditions, 'condition_prone')
            : defenderAfterOnHit.conditions,
        conditionInstances: woundsBefore > 0 && woundsAfter === 0
            ? [...(defenderAfterOnHit.conditionInstances || []), { id: 'condition_unconscious_pending', roundApplied: state.round }]
            : defenderAfterOnHit.conditionInstances,
        character: {
            ...defenderAfterOnHit.character,
            status: {
                ...defenderAfterOnHit.character.status,
                wounds: {
                    ...defenderAfterOnHit.character.status.wounds,
                    current: woundsAfter,
                },
            },
        },
        resources: {
            ...defenderAfterOnHit.resources,
            wounds: {
                ...defenderAfterOnHit.resources.wounds,
                current: woundsAfter,
            },
        },
    };

    const nextState = replaceCombatant(onHitResult.state, updatedDefender);
    let currentStateAfterCrit = nextState;
    const events: CombatEvent[] = [
        {
            type: 'DamageDealt',
            i18nKey: 'combat.damage.dealt',
            data: {
                attackerId: attacker.id,
                defenderId: defender.id,
                defenderName: defender.name,
                hitLocation,
                rawDamage,
                damageDealt,
                toughnessBonus,
                armourPoints,
                minimumOneWoundApplied,
                woundsBeyondZero,
                woundsBefore,
                woundsAfter,
            },
        },
    ];

    if (woundsBefore > 0 && woundsAfter === 0 && damageDealt > 0) {
        events.push({ type: 'ConditionApplied', i18nKey: 'combat.condition.applied', data: { targetId: defender.id, conditionId: 'condition_prone', stacks: 1 } });
        const critical = resolveCritHook(hooks, critContext({
            state: currentStateAfterCrit,
            attacker,
            defender: updatedDefender,
            hit,
            hitLocation,
            trigger: 'zeroWounds',
            combatantId: defender.id,
            role: 'target',
            woundsBeyondZero,
            damageDealt,
            woundsBefore,
            woundsAfter,
            rawWeaponDamage: hit.weaponDamage,
            armourPoints,
        }));
        events.push(...critical.events);
        currentStateAfterCrit = critical.state;
    }

    events.push(...onHitResult.events);
    return { state: currentStateAfterCrit, events };
}

export function resolveMeleeAttack(state: CombatState, action: MeleeAttackAction, rng: Rng = mathRandomRng): CombatEngineResult {
    const attacker = getCombatant(state, action.attackerId);
    const defender = getCombatant(state, action.defenderId);
    const hooks = normalizeHooks(action.hooks, rng);
    const hookContext = { state, action, attacker, defender };
    const hookPreRollSources = hooks.preRollModifiers(hookContext);
    const preRollSources = [
        ...collectMeleePreRollModifiers(state, action, attacker, defender),
        ...hookPreRollSources,
    ];
    const modifierTotal = resolveModifierTotal(preRollSources);
    const conditionModifiers = attackerModifiersFor(defender);
    const collapse = opposedTestCollapseFor(defender, {
        attackTargetNumber: action.attacker.targetNumber + modifierTotal.total,
        chosenHitLocation: action.chosenHitLocation,
    });
    let currentState = state;
    const events: CombatEvent[] = [{
        type: 'MeleeHookPhase',
        i18nKey: 'combat.melee.hook.preRollModifiers',
        data: { phase: 'preRollModifiers', sources: preRollSources.length, modifier: modifierTotal.total },
    }];

    if (conditionModifiers.advantageToAttacker > 0) {
        const advantageResult = grantAdvantage(currentState, attacker.side, conditionModifiers.advantageToAttacker, {
            reason: 'condition',
            sourceCombatantId: defender.id,
        });
        currentState = advantageResult.state;
        events.push(...advantageResult.events);
    }

    if (action.isCharging) {
        const wasEngaged = attacker.engagementIds.includes(defender.id);
        if (!wasEngaged) {
            const chargeAdvantage = grantAdvantage(currentState, attacker.side, 1, {
                reason: 'condition',
                sourceCombatantId: attacker.id,
            });
            currentState = chargeAdvantage.state;
            events.push(...chargeAdvantage.events);
        }
    }

    currentState = stampAttackEngagement(currentState, attacker.id, defender.id);

    const attackerRoll = resolveOpposedRoll({
        ...action.attacker,
        testModifier: (action.attacker.testModifier ?? 0) + modifierTotal.total,
    }, attacker.character, currentState, rng);
    const slModifier = hooks.slModifiers({ ...hookContext, state: currentState, attackerRoll });
    const modifiedAttackerRoll = withSlModifier(attackerRoll, slModifier);
    events.push({ type: 'MeleeHookPhase', i18nKey: 'combat.melee.hook.slModifiers', data: { phase: 'slModifiers', modifier: slModifier } });

    const defenderCanCrit = isMeleeDefense(action.defender.skillId);
    const defenderAvoidsOnly = !defenderCanCrit;
    let defenderRoll: ResolvedOpposedRoll | undefined;
    let outcome: 'attacker' | 'defender' | 'tie';
    let slDifference: number;
    let hitLocation: string | undefined;
    let collapsed: 'none' | 'surprised' | 'unconscious' = 'none';

    if (collapse.mode === 'autoHit') {
        collapsed = 'unconscious';
        outcome = 'attacker';
        defenderRoll = autoDefenderRoll(action.defender);
        slDifference = Math.max(0, collapse.maxSuccessLevel ?? modifiedAttackerRoll.roundedSuccessLevel);
        hitLocation = action.chosenHitLocation ?? 'Body';
    } else if (collapse.mode === 'unopposed') {
        collapsed = 'surprised';
        defenderRoll = autoDefenderRoll(action.defender);
        outcome = modifiedAttackerRoll.roundedSuccessLevel >= 0 ? 'attacker' : 'defender';
        slDifference = outcome === 'attacker' ? Math.max(0, modifiedAttackerRoll.roundedSuccessLevel) : 0;
        hitLocation = outcome === 'attacker' && action.combatMode !== false ? getHitLocation(modifiedAttackerRoll.rollResult) : undefined;
    } else {
        const defenderTargetModifier = defenderTargetModifierFromQualities({ ...hookContext, state: currentState, attackerRoll: modifiedAttackerRoll });
        defenderRoll = resolveOpposedRoll({
            ...action.defender,
            testModifier: (action.defender.testModifier ?? 0) + defenderTargetModifier + defensiveBonusForSkill(defender, action.defender.skillId, currentState.round),
        }, defender.character, currentState, rng);
        const defenderSlModifier = hooks.slModifiers({ ...hookContext, state: currentState, attackerRoll: modifiedAttackerRoll, defenderRoll });
        defenderRoll = withSlModifier(defenderRoll, defenderSlModifier);
        outcome = determineOutcome(modifiedAttackerRoll, defenderRoll);
        slDifference = Math.abs(modifiedAttackerRoll.roundedSuccessLevel - defenderRoll.roundedSuccessLevel);
        hitLocation = outcome === 'attacker' && action.combatMode !== false ? getHitLocation(modifiedAttackerRoll.rollResult) : undefined;
    }

    events.push(
        {
            type: 'AttackResolved',
            i18nKey: `combat.attack.${outcome}`,
            data: {
                attackerId: attacker.id,
                defenderId: defender.id,
                attackerName: attacker.name,
                defenderName: defender.name,
                attackerRoll: modifiedAttackerRoll,
                defenderRoll: defenderRoll!,
                outcome,
                winnerId: outcome === 'attacker' ? attacker.id : outcome === 'defender' ? defender.id : undefined,
                slDifference: outcome === 'tie' ? 0 : slDifference,
                hitLocation,
                modifiers: modifierTotal,
                defenderCanCrit,
                defenderAvoidsOnly,
                collapsed,
            },
        },
    );

    const blackpowder = applyBlackpowderTargetEffect({ ...hookContext, state: currentState, attackerRoll: modifiedAttackerRoll, defenderRoll });
    currentState = blackpowder.state;
    events.push(...blackpowder.events);

    if (outcome === 'attacker' && shouldTriggerCritical(hooks, critContext({
        state: currentState,
        attacker,
        defender,
        hitLocation: hitLocation ?? getHitLocation(modifiedAttackerRoll.rollResult),
        trigger: 'roll',
        combatantId: defender.id,
        role: 'target',
        roll: modifiedAttackerRoll.rollResult,
        targetNumber: modifiedAttackerRoll.targetNumber,
        rawWeaponDamage: modifiedAttackerRoll.weaponDamage ?? 0,
    }), modifiedAttackerRoll.rollResult, modifiedAttackerRoll.targetNumber)) {
        const critical = resolveCritHook(hooks, critContext({
            state: currentState,
            attacker,
            defender,
            hitLocation: hitLocation ?? getHitLocation(modifiedAttackerRoll.rollResult),
            trigger: 'roll',
            combatantId: defender.id,
            role: 'target',
            roll: modifiedAttackerRoll.rollResult,
            targetNumber: modifiedAttackerRoll.targetNumber,
            rawWeaponDamage: modifiedAttackerRoll.weaponDamage ?? 0,
        }));
        currentState = critical.state;
        events.push(...critical.events);
    }

    if (isFumbleRoll(modifiedAttackerRoll.rollResult, modifiedAttackerRoll.targetNumber) || hooks.fumbleTriggers({ ...hookContext, state: currentState, attackerRoll: modifiedAttackerRoll })) {
        const fumble = resolveFumble(currentState, attacker.id, 'attacker', modifiedAttackerRoll, hooks, rng);
        currentState = fumble.state;
        events.push(...fumble.events);
    }

    if (defenderRoll && defenderCanCrit && outcome === 'defender' && shouldTriggerCritical(hooks, critContext({
        state: currentState,
        attacker,
        defender,
        hitLocation: hitLocation ?? getHitLocation(defenderRoll.rollResult),
        trigger: 'roll',
        combatantId: attacker.id,
        role: 'target',
        roll: defenderRoll.rollResult,
        targetNumber: defenderRoll.targetNumber,
        rawWeaponDamage: defenderRoll.weaponDamage ?? 0,
    }), defenderRoll.rollResult, defenderRoll.targetNumber)) {
        const critical = resolveCritHook(hooks, critContext({
            state: currentState,
            attacker: defender,
            defender: attacker,
            hitLocation: hitLocation ?? getHitLocation(defenderRoll.rollResult),
            trigger: 'roll',
            combatantId: attacker.id,
            role: 'target',
            roll: defenderRoll.rollResult,
            targetNumber: defenderRoll.targetNumber,
            rawWeaponDamage: defenderRoll.weaponDamage ?? 0,
        }));
        currentState = critical.state;
        events.push(...critical.events);
    }

    if (defenderRoll && collapse.mode === 'opposed' && (isFumbleRoll(defenderRoll.rollResult, defenderRoll.targetNumber) || hooks.fumbleTriggers({ ...hookContext, state: currentState, attacker: defender, defender: attacker, attackerRoll: defenderRoll, defenderRoll: modifiedAttackerRoll }))) {
        const fumble = resolveFumble(currentState, defender.id, 'defender', defenderRoll, hooks, rng);
        currentState = fumble.state;
        events.push(...fumble.events);
    }

    if (outcome === 'attacker' && action.combatMode !== false) {
        if (!hitLocation) hitLocation = getHitLocation(modifiedAttackerRoll.rollResult);
        const weaponDamage = collapse.mode === 'autoHit'
            ? Math.max(parseMeleeWeaponDamage(modifiedAttackerRoll, attacker, currentState, defender.id, action.hand ?? 'primary'), modifiedAttackerRoll.targetNumber >= 100 ? 10 : Math.floor(modifiedAttackerRoll.targetNumber / 10))
            : parseMeleeWeaponDamage(modifiedAttackerRoll, attacker, currentState, defender.id, action.hand ?? 'primary');
        const damageResult = resolveDamage(currentState, {
            attackerId: attacker.id,
            defenderId: defender.id,
            skillId: modifiedAttackerRoll.skillId,
            slDifference,
            weaponDamage,
            attackRoll: modifiedAttackerRoll.rollResult,
            defenderSuccessLevel: defenderRoll?.roundedSuccessLevel,    
            hitLocation,
            usedTalents: modifiedAttackerRoll.usedTalents,
            disableMinimumWound: action.disableMinimumWound || weaponHasQuality(modifiedAttackerRoll, currentState, 'undamaging'),
            hooks: action.hooks,
            sl: collapse.mode === 'autoHit' ? slDifference : modifiedAttackerRoll.roundedSuccessLevel,
            isCharging: action.isCharging,
        }, rng);

        currentState = damageResult.state;
        events.push(...damageResult.events);

        if (collapse.mode === 'autoHit') {
            const critical = resolveCritHook(hooks, critContext({
                state: currentState,
                attacker,
                defender: getCombatant(currentState, defender.id),
                hitLocation,
                trigger: 'unconsciousAuto',
                combatantId: defender.id,
                role: 'target',
                rawWeaponDamage: weaponDamage,
            }));
            currentState = critical.state;
            events.push(...critical.events);
        }
    }

    currentState = applyLoserActionEnd(currentState, outcome === 'attacker' ? defender.id : outcome === 'defender' ? attacker.id : undefined);
    currentState = clearChargeFlag(currentState, attacker.id);
    currentState = removeConditions(currentState, defender.id, conditionsRemovedAfterAttack(defender));

    if (outcome === 'attacker' && action.generatesAdvantage !== false && action.grantAdvantage !== false) {
        const advantageResult = grantAdvantage(currentState, attacker.side, 1, {
            reason: 'opposedTestWin',
            sourceCombatantId: attacker.id,
        });
        events.push(...advantageResult.events);
        return { state: advantageResult.state, events };
    }

    return { state: currentState, events };
}

function resolveOpposedRoll(input: OpposedRollInput, character: Character, state: CombatState, rng: Rng): ResolvedOpposedRoll {
    const rollResult = input.rollResult ?? rolld100(rng);
    const targetNumber = input.targetNumber + (input.testModifier ?? 0);
    const successLevel = input.successLevel ?? calculateSuccessLevel(rollResult, targetNumber);

    return {
        skillId: input.skillId,
        skillName: input.skillName,
        rollResult,
        targetNumber,
        successLevel,
        roundedSuccessLevel: Math.round(successLevel),
        weaponName: input.weaponName,
        weaponDamage: input.weaponDamage,
        weaponId: input.weaponId,
        weaponDamageFormula: input.weaponDamageFormula,
        usedTalents: input.usedTalents || [],
    };
}

function determineOutcome(attackerRoll: ResolvedOpposedRoll, defenderRoll: ResolvedOpposedRoll): 'attacker' | 'defender' | 'tie' {
    if (
        attackerRoll.roundedSuccessLevel > defenderRoll.roundedSuccessLevel
        || (attackerRoll.roundedSuccessLevel === defenderRoll.roundedSuccessLevel && attackerRoll.targetNumber > defenderRoll.targetNumber)
    ) {
        return 'attacker';
    }

    if (
        attackerRoll.roundedSuccessLevel < defenderRoll.roundedSuccessLevel
        || (attackerRoll.roundedSuccessLevel === defenderRoll.roundedSuccessLevel && attackerRoll.targetNumber < defenderRoll.targetNumber)
    ) {
        return 'defender';
    }

    return 'tie';
}

export function decayEngagementsEndOfRound(state: CombatState): CombatEngineResult {
    const staleKeys = Object.entries(state.engagements)
        .filter(([, engagement]) => state.round - engagement.lastAttackRound >= 1)
        .map(([key]) => key);

    if (staleKeys.length === 0) return { state, events: [] };

    let combatants = state.combatants;
    for (const key of staleKeys) {
        const engagement = state.engagements[key];
        const a = combatants[engagement.aId];
        const b = combatants[engagement.bId];
        if (a) combatants = { ...combatants, [a.id]: { ...a, engagementIds: a.engagementIds.filter(id => id !== b?.id) } };
        if (b) combatants = { ...combatants, [b.id]: { ...b, engagementIds: b.engagementIds.filter(id => id !== a?.id) } };
    }

    const engagements = { ...state.engagements };
    staleKeys.forEach(key => delete engagements[key]);
    return { state: { ...state, combatants, engagements }, events: [] };
}

export function initiativeOrder(combatants: Combatant[], rng: Rng = mathRandomRng, talents: CombatState['talents'] = []): Array<{
    combatant: Combatant;
    initiative: number;
    roll: number;
}> {
    const stateForTalents = createCombatState(combatants, { talents });
    return combatants
        .map(combatant => {
            const roll = Math.floor(rng.next() * 10) + 1;
            return {
                combatant,
                roll,
                initiative: characteristicValue(combatant.character.characteristics.ag) + roll + getTalentInitiativeModifier(combatant, stateForTalents),
            };
        })
        .sort((a, b) => (
            b.initiative - a.initiative
            || characteristicValue(b.combatant.character.characteristics.ag) - characteristicValue(a.combatant.character.characteristics.ag)
            || characteristicValue(b.combatant.character.characteristics.i) - characteristicValue(a.combatant.character.characteristics.i)
            || a.combatant.name.localeCompare(b.combatant.name)
            || a.combatant.id.localeCompare(b.combatant.id)
        ));
}

export function determineSurprise<TCombatant extends Pick<Combatant, 'id' | 'conditions'>>(
    combatants: TCombatant[],
    setup: { surprisedIds?: string[]; unsurprisedIds?: string[]; surprisedSide?: SideId; sides?: Record<string, SideId> }
): TCombatant[] {
    const surprisedIds = new Set(setup.surprisedIds || []);
    const unsurprisedIds = new Set(setup.unsurprisedIds || []);
    return combatants.map(combatant => {
        const side = setup.sides?.[combatant.id];
        const surprised = surprisedIds.has(combatant.id) || (!!setup.surprisedSide && side === setup.surprisedSide);
        if (!surprised || unsurprisedIds.has(combatant.id) || combatant.conditions.includes('condition_surprised')) return combatant;
        return { ...combatant, conditions: [...combatant.conditions, 'condition_surprised'] };
    });
}

function normalizeHooks(hooks: Partial<MeleeResolutionHooks> | undefined, rng: Rng): MeleeResolutionHooks {
    const qualityHooks = createQualityHooks();
    const talentHooks = createTalentHooks();
    return {
        preRollModifiers: context => [
            ...(qualityHooks.preRollModifiers?.(context) ?? []),
            ...(talentHooks.preRollModifiers?.(context) ?? []),
            ...(hooks?.preRollModifiers?.(context) ?? []),
        ],
        slModifiers: context => (qualityHooks.slModifiers?.(context) ?? 0) + (talentHooks.slModifiers?.(context) ?? 0) + (hooks?.slModifiers?.(context) ?? 0),
        damageModifiers: context => (qualityHooks.damageModifiers?.(context) ?? 0) + (talentHooks.damageModifiers?.(context) ?? 0) + (hooks?.damageModifiers?.(context) ?? 0),
        apModifiers: context => (qualityHooks.apModifiers?.(context) ?? 0) + (hooks?.apModifiers?.(context) ?? 0),
        onHitEffects: context => mergeHookResult(context.state, qualityHooks.onHitEffects?.(context), talentHooks.onHitEffects?.(context), hooks?.onHitEffects?.(context)),
        critTriggerExtensions: context => !!qualityHooks.critTriggerExtensions?.(context) || !!hooks?.critTriggerExtensions?.(context),
        critIgnoreConditions: context => !!qualityHooks.critIgnoreConditions?.(context) || !!hooks?.critIgnoreConditions?.(context),
        critApModifiers: context => (qualityHooks.critApModifiers?.(context) ?? 0) + (hooks?.critApModifiers?.(context) ?? 0),
        onCritEffects: context => mergeHookResult(context.state, qualityHooks.onCritEffects?.(context), talentHooks.onCritEffects?.(context), hooks?.onCritEffects?.(context)),
        fumbleTriggers: context => !!qualityHooks.fumbleTriggers?.(context) || !!hooks?.fumbleTriggers?.(context),
        critResolver: hooks?.critResolver ?? ((context: CritResolverContext) => criticalRoll(context, { rng })),
    };
}

function mergeHookResult(
    initialState: CombatState,
    first: ReturnType<MeleeResolutionHooks['onHitEffects']> | undefined,
    second: ReturnType<MeleeResolutionHooks['onHitEffects']> | undefined,
    third?: ReturnType<MeleeResolutionHooks['onHitEffects']> | undefined
) {
    const normalize = (result: ReturnType<MeleeResolutionHooks['onHitEffects']> | undefined, state: CombatState) => {
        if (!result) return { state, events: [], suppressNormalDamage: false };
        if (Array.isArray(result)) return { state, events: result, suppressNormalDamage: false };
        return { state: result.state, events: result.events, suppressNormalDamage: !!result.suppressNormalDamage };
    };
    const firstResult = normalize(first, initialState);
    const secondResult = normalize(second, firstResult.state);
    const thirdResult = normalize(third, secondResult.state);
    return {
        state: thirdResult.state,
        events: [...firstResult.events, ...secondResult.events, ...thirdResult.events],
        suppressNormalDamage: firstResult.suppressNormalDamage || secondResult.suppressNormalDamage || thirdResult.suppressNormalDamage,
    };
}

function withSlModifier(roll: ResolvedOpposedRoll, modifier: number): ResolvedOpposedRoll {
    if (modifier === 0) return roll;
    const successLevel = roll.successLevel + modifier;
    return { ...roll, successLevel, roundedSuccessLevel: Math.round(successLevel) };
}

function autoDefenderRoll(input: OpposedRollInput): ResolvedOpposedRoll {
    return {
        skillId: input.skillId,
        skillName: input.skillName,
        rollResult: input.rollResult ?? 0,
        targetNumber: input.targetNumber + (input.testModifier ?? 0),
        successLevel: Number.NEGATIVE_INFINITY,
        roundedSuccessLevel: Number.NEGATIVE_INFINITY,
        weaponName: input.weaponName,
        weaponDamage: input.weaponDamage,
        weaponId: input.weaponId,
        weaponDamageFormula: input.weaponDamageFormula,
        usedTalents: input.usedTalents || [],
    };
}

function isMeleeDefense(skillId: string): boolean {
    return skillId.toLowerCase().startsWith('melee');
}

function isCriticalRoll(roll: number, targetNumber: number): boolean {
    return roll <= targetNumber && isD100Double(roll);
}

function isFumbleRoll(roll: number, targetNumber: number): boolean {
    return roll > targetNumber && isD100Double(roll);
}

function isD100Double(roll: number): boolean {
    return roll === 100 || (roll >= 11 && roll <= 99 && roll % 11 === 0);
}

function shouldTriggerCritical(hooks: MeleeResolutionHooks, context: CritResolverContext, roll: number, targetNumber: number): boolean {
    if (hooks.critIgnoreConditions(context)) return false;
    return isCriticalRoll(roll, targetNumber) || hooks.critTriggerExtensions(context);
}

function resolveCritHook(hooks: MeleeResolutionHooks, context: CritResolverContext): CombatEngineResult {
    hooks.critApModifiers({ ...context });
    const resolved = hooks.critResolver(context);
    const baseResult = Array.isArray(resolved) ? { state: context.state, events: resolved } : resolved;
    const followUp = hooks.onCritEffects({ ...context, state: baseResult.state });
    if (Array.isArray(followUp)) {
        return { state: baseResult.state, events: [...baseResult.events, ...followUp] };
    }

    return {
        state: followUp.state,
        events: [...baseResult.events, ...followUp.events],
    };
}

function parseMeleeWeaponDamage(roll: ResolvedOpposedRoll, attacker: Combatant, state: CombatState, defenderId?: string, hand: 'primary' | 'secondary' = 'primary'): number {
    if (roll.weaponDamage !== undefined) return roll.weaponDamage;

    const formula = roll.weaponDamageFormula
        ?? (roll.weaponId ? state.weapons.find(weapon => weapon.id === roll.weaponId)?.damage : undefined)
        ?? resolveEffectiveWeapon(attacker, state, defenderId, hand)?.damage
        ?? equippedWeapon(attacker, state, defenderId, hand)?.damage
        ?? '+SB';
    const strengthBonus = calculateCharacteristicBonus(attacker.character.characteristics.s);
    const normalized = String(formula).toUpperCase().replace(/\s+/g, '');
    const withoutBonus = normalized.replace('SB', String(strengthBonus));
    const terms = withoutBonus.match(/[+-]?\d+/g) || [];
    return terms.reduce((total, term) => total + Number(term), 0);
}

function weaponHasQuality(roll: ResolvedOpposedRoll, state: CombatState, quality: string): boolean {
    const weapon = roll.weaponId ? state.weapons.find(candidate => candidate.id === roll.weaponId) : undefined;
    return (weapon?.qualities || []).some(candidate => candidate.toLowerCase().replace(/\*.*/, '') === quality.toLowerCase());
}

function equippedWeapon(attacker: Combatant, state: CombatState, defenderId?: string, hand: 'primary' | 'secondary' = 'primary') {
    const effective = resolveEffectiveWeapon(attacker, state, defenderId, hand);
    if (effective) return effective;

    const equippedId = Object.entries(attacker.character.inventory.equippedWeapons || {}).find(([, equipped]) => equipped)?.[0];
    const fallbackId = Object.entries(attacker.character.inventory.weapons || {}).find(([, count]) => count > 0)?.[0];
    const weaponId = equippedId ?? fallbackId;
    return weaponId ? state.weapons.find(weapon => weapon.id === weaponId) : undefined;
}

function rollFromDamageHit(hit: DamageHit): ResolvedOpposedRoll {
    return {
        skillId: hit.skillId,
        rollResult: hit.attackRoll ?? 0,
        targetNumber: 0,
        successLevel: hit.sl ?? hit.slDifference,
        roundedSuccessLevel: Math.round(hit.sl ?? hit.slDifference),
        weaponDamage: hit.weaponDamage,
        usedTalents: hit.usedTalents || [],
    };
}

function critContext(input: {
    state: CombatState;
    attacker: Combatant;
    defender: Combatant;
    hit?: DamageHit;
    hitLocation: string;
    trigger: CritResolverContext['trigger'];
    combatantId: string;
    role?: CritResolverContext['role'];
    roll?: number;
    targetNumber?: number;
    woundsBeyondZero?: number;
    damageDealt?: number;
    woundsBefore?: number;
    woundsAfter?: number;
    rawWeaponDamage: number;
    armourPoints?: number;
}): CritResolverContext {
    const attackerRoll = input.hit ? rollFromDamageHit(input.hit) : {
        skillId: 'melee_basic',
        rollResult: input.roll ?? 0,
        targetNumber: input.targetNumber ?? 0,
        successLevel: 0,
        roundedSuccessLevel: 0,
        usedTalents: [],
    };
    return {
        state: input.state,
        action: {
            attackerId: input.attacker.id,
            defenderId: input.defender.id,
            attacker: { skillId: attackerRoll.skillId, targetNumber: attackerRoll.targetNumber },
            defender: { skillId: 'melee_basic', targetNumber: 0 },
        },
        attacker: input.attacker,
        defender: input.defender,
        attackerRoll,
        hitLocation: input.hitLocation,
        weaponDamage: input.rawWeaponDamage,
        attackerSuccessLevel: attackerRoll.roundedSuccessLevel,
        armourPoints: input.armourPoints ?? 0,
        damageDealt: input.damageDealt ?? 0,
        woundsBefore: input.woundsBefore ?? input.defender.currentWounds,
        woundsAfter: input.woundsAfter ?? input.defender.currentWounds,
        trigger: input.trigger,
        combatantId: input.combatantId,
        role: input.role,
        roll: input.roll,
        targetNumber: input.targetNumber,
        woundsBeyondZero: input.woundsBeyondZero,
    };
}

function resolveFumble(
    state: CombatState,
    combatantId: string,
    role: 'attacker' | 'defender',
    roll: ResolvedOpposedRoll,
    hooks: MeleeResolutionHooks,
    rng: Rng
): CombatEngineResult {
    const fumbleRoll = rolld100(rng);
    const result = fumbleResult(fumbleRoll);
    let currentState = state;
    const events: CombatEvent[] = [
        {
            type: 'FumbleRolled',
            i18nKey: 'combat.fumble.roll',
            data: { combatantId, role, roll: roll.rollResult, targetNumber: roll.targetNumber, fumbleRoll },
        },
        {
            type: 'FumbleResolved',
            i18nKey: `combat.fumble.effect.${result.effect}`,
            data: { combatantId, role, roll: fumbleRoll, effect: result.effect, description: result.description },
        },
    ];

    const combatant = getCombatant(state, combatantId);
    if (result.effect === 'wounds_minus_1') {
        currentState = replaceCombatant(currentState, woundCombatant(combatant, Math.max(0, combatant.currentWounds - 1)));
    } else if (result.effect === 'lose_next_move') {
        currentState = replaceCombatant(currentState, { ...combatant, budget: { ...combatant.budget, moves: 0 } });
    } else if (result.effect === 'lose_next_action') {
        currentState = replaceCombatant(currentState, { ...combatant, budget: { ...combatant.budget, actions: 0 } });
    } else if (result.effect === 'hit_ally_or_stunned_self') {
        currentState = replaceCombatant(currentState, { ...combatant, conditions: addCondition(combatant.conditions, 'condition_stunned') });
        events.push({ type: 'ConditionApplied', i18nKey: 'combat.condition.applied', data: { targetId: combatantId, conditionId: 'condition_stunned', stacks: 1 } });
    } else if (result.effect === 'torn_muscle_minor_critical_wound') {
        const critical = resolveCritHook(hooks, critContext({
            state,
            attacker: combatant,
            defender: combatant,
            hitLocation: 'Body',
            trigger: 'fumbleInjury',
            combatantId,
            role,
            roll: roll.rollResult,
            targetNumber: roll.targetNumber,
            rawWeaponDamage: 0,
        }));
        currentState = critical.state;
        events.push(...critical.events);
    }

    return { state: currentState, events };
}

function fumbleResult(roll: number): { effect: string; description: string } {
    if (roll <= 20) return { effect: 'wounds_minus_1', description: 'Lose 1 Wound, ignoring Toughness Bonus or Armour Points.' };
    if (roll <= 40) return { effect: 'weapon_1_damage_act_last', description: 'Weapon suffers 1 Damage and the combatant acts last next round.' };
    if (roll <= 60) return { effect: 'action_penalty_minus_10', description: 'Next round, the combatant suffers -10 to their Action.' };
    if (roll <= 70) return { effect: 'lose_next_move', description: 'Lose your next Move.' };
    if (roll <= 80) return { effect: 'lose_next_action', description: 'Miss your next Action.' };
    if (roll <= 90) return { effect: 'torn_muscle_minor_critical_wound', description: 'Suffer a Torn Muscle (Minor) injury.' };
    return { effect: 'hit_ally_or_stunned_self', description: 'Hit an ally if possible; otherwise gain Stunned.' };
}

function stampAttackEngagement(state: CombatState, attackerId: string, defenderId: string): CombatState {
    const attacker = getCombatant(state, attackerId);
    const defender = getCombatant(state, defenderId);
    const key = engagementKey(attackerId, defenderId);
    return {
        ...state,
        combatants: {
            ...state.combatants,
            [attackerId]: { ...attacker, engagementIds: addUnique(attacker.engagementIds, defenderId) },
            [defenderId]: { ...defender, engagementIds: addUnique(defender.engagementIds, attackerId) },
        },
        engagements: {
            ...state.engagements,
            [key]: { aId: attackerId, bId: defenderId, lastAttackRound: state.round },
        },
    };
}

function applyLoserActionEnd(state: CombatState, loserId?: string): CombatState {
    if (!loserId) return state;
    const loser = getCombatant(state, loserId);
    return replaceCombatant(state, { ...loser, budget: { ...loser.budget, actions: 0 } });
}

function clearChargeFlag(state: CombatState, combatantId: string): CombatState {
    return {
        ...state,
        turnFlags: {
            ...state.turnFlags,
            chargedCombatantIds: state.turnFlags.chargedCombatantIds.filter(id => id !== combatantId),
        },
    };
}

function removeConditions(state: CombatState, combatantId: string, conditionIds: string[]): CombatState {
    if (conditionIds.length === 0) return state;
    const combatant = getCombatant(state, combatantId);
    let conditions = [...combatant.conditions];
    for (const conditionId of conditionIds) {
        const index = conditions.indexOf(conditionId);
        if (index >= 0) conditions = [...conditions.slice(0, index), ...conditions.slice(index + 1)];
    }
    return replaceCombatant(state, { ...combatant, conditions });
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

function characteristicValue(characteristic: Character['characteristics']['ag']): number {
    return characteristic.initial + characteristic.advances + characteristic.talents + characteristic.modifier;
}

function addCondition(conditions: string[], conditionId: string): string[] {
    if (['condition_prone', 'condition_surprised', 'condition_unconscious'].includes(conditionId) && conditions.includes(conditionId)) {
        return conditions;
    }
    return [...conditions, conditionId];
}

function addUnique(ids: string[], id: string): string[] {
    return [...new Set([...ids, id])];
}

function engagementKey(aId: string, bId: string): string {
    return [aId, bId].sort().join('::');
}

function getCombatant(state: CombatState, combatantId: string): Combatant {
    const combatant = state.combatants[combatantId];
    if (!combatant) {
        throw new Error(`Combatant not found: ${combatantId}`);
    }

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
