import type { Armor, Character } from '../types/wfrp.types';
import { normalizeArmorLocations } from '../utils/armorLocations';
import { calculateSuccessLevel, getHitLocation, rolld100 } from '../utils/mechanics';
import { calculateCharacteristicBonus } from '../utils/skills';
import { applyTalentSLBonuses, checkCriticalResult, getTalentDamageBonus } from '../utils/talents';
import { createAdvantagePools, grantAdvantage } from './advantage';
import { mathRandomRng, type Rng } from './rng';
import { createMovementBudget } from './spatial';
import type {
    CombatEngineResult,
    CombatEvent,
    CombatState,
    Combatant,
    DamageDealtEvent,
    DamageHit,
    MeleeAttackAction,
    OpposedRollInput,
    ResolvedOpposedRoll,
} from './types';

export function createCombatantFromCharacter(
    character: Character,
    options: Partial<Pick<Combatant, 'id' | 'side' | 'currentWounds' | 'maxWounds' | 'position' | 'movementBudget' | 'engagementIds' | 'budget' | 'conditions'>> = {}
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
    options: { armor?: Armor[]; talents?: CombatState['talents']; weapons?: CombatState['weapons']; advantagePools?: CombatState['advantagePools']; tacticalDominantSide?: CombatState['tacticalDominantSide']; turnFlags?: CombatState['turnFlags']; round?: number } = {}
): CombatState {
    return {
        combatants: Object.fromEntries(combatants.map(combatant => [combatant.id, combatant])),
        round: options.round ?? 0,
        armor: options.armor ?? [],
        weapons: options.weapons ?? [],
        talents: options.talents ?? [],
        advantagePools: createAdvantagePools(options.advantagePools),
        tacticalDominantSide: options.tacticalDominantSide,
        turnFlags: options.turnFlags ?? { additionalActionCombatantIds: [] },
    };
}

export function getArmorPointsAtLocation(character: Character, location: string, armorData: Armor[]): number {
    const armorById: Record<string, Armor> = Object.fromEntries(armorData.map(armor => [armor.id, armor]));
    const normalizedLocation = normalizeArmorLocations([location])[0];
    let totalArmourPoints = 0;

    Object.entries(character.inventory?.equippedArmor || {}).forEach(([armorId, equipped]) => {
        if (!equipped) return;

        const armor = armorById[armorId];
        if (!armor) return;

        const armorLocations = normalizeArmorLocations(armor.locations);
        if (armorLocations.some(armorLocation => armorLocation.includes(normalizedLocation) || normalizedLocation.includes(armorLocation))) {
            totalArmourPoints += armor.ap;
        }
    });

    return totalArmourPoints;
}

export function resolveDamage(state: CombatState, hit: DamageHit, rng: Rng = mathRandomRng): CombatEngineResult {
    const attacker = getCombatant(state, hit.attackerId);
    const defender = getCombatant(state, hit.defenderId);
    const hitLocation = hit.hitLocation ?? (hit.attackRoll ? getHitLocation(hit.attackRoll) : 'Unknown');
    const toughnessBonus = calculateCharacteristicBonus(defender.character.characteristics.t);
    const armourPoints = getArmorPointsAtLocation(defender.character, hitLocation, state.armor);
    const talentDamageBonus = getTalentDamageBonus(hit.usedTalents || [], hit.skillId, state.talents);
    const rawDamage = hit.weaponDamage + hit.slDifference + talentDamageBonus;
    const damageDealt = Math.max(rawDamage - toughnessBonus - armourPoints, 0);
    const woundsBefore = defender.currentWounds;
    const woundsAfter = Math.max(0, woundsBefore - damageDealt);

    const updatedDefender: Combatant = {
        ...defender,
        currentWounds: woundsAfter,
        character: {
            ...defender.character,
            status: {
                ...defender.character.status,
                wounds: {
                    ...defender.character.status.wounds,
                    current: woundsAfter,
                },
            },
        },
        resources: {
            ...defender.resources,
            wounds: {
                ...defender.resources.wounds,
                current: woundsAfter,
            },
        },
    };

    const nextState = replaceCombatant(state, updatedDefender);
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
                woundsBefore,
                woundsAfter,
            },
        },
    ];

    if (woundsBefore > 0 && woundsAfter === 0 && damageDealt > 0) {
        events.push({
            type: 'CritRolled',
            i18nKey: 'combat.critical.zeroWounds',
            data: {
                combatantId: defender.id,
                role: 'target',
                trigger: 'zeroWounds',
                critRoll: rolld100(rng),
                hitLocation,
            },
        });
    }

    return { state: nextState, events };
}

export function resolveMeleeAttack(state: CombatState, action: MeleeAttackAction, rng: Rng = mathRandomRng): CombatEngineResult {
    const attacker = getCombatant(state, action.attackerId);
    const defender = getCombatant(state, action.defenderId);
    const attackerRoll = resolveOpposedRoll(action.attacker, attacker.character, state, rng);
    const defenderRoll = resolveOpposedRoll(action.defender, defender.character, state, rng);
    const attackerCriticalCheck = checkCriticalResult(attackerRoll.rollResult, attackerRoll.targetNumber, rng);
    const defenderCriticalCheck = checkCriticalResult(defenderRoll.rollResult, defenderRoll.targetNumber, rng);
    const outcome = determineOutcome(attackerRoll, defenderRoll);
    const slDifference = Math.abs(attackerRoll.roundedSuccessLevel - defenderRoll.roundedSuccessLevel);
    const hitLocation = outcome === 'attacker' && action.combatMode !== false ? getHitLocation(attackerRoll.rollResult) : undefined;

    const events: CombatEvent[] = [
        {
            type: 'AttackResolved',
            i18nKey: `combat.attack.${outcome}`,
            data: {
                attackerId: attacker.id,
                defenderId: defender.id,
                attackerName: attacker.name,
                defenderName: defender.name,
                attackerRoll,
                defenderRoll,
                outcome,
                winnerId: outcome === 'attacker' ? attacker.id : outcome === 'defender' ? defender.id : undefined,
                slDifference: outcome === 'tie' ? 0 : slDifference,
                hitLocation,
            },
        },
    ];

    if (attackerCriticalCheck.isCritical && attackerCriticalCheck.critRoll !== undefined) {
        events.push({
            type: 'CritRolled',
            i18nKey: 'combat.critical.roll',
            data: {
                combatantId: attacker.id,
                role: 'attacker',
                trigger: 'roll',
                roll: attackerRoll.rollResult,
                targetNumber: attackerRoll.targetNumber,
                critRoll: attackerCriticalCheck.critRoll,
                hitLocation,
            },
        });
    }

    if (attackerCriticalCheck.isFumble && attackerCriticalCheck.critRoll !== undefined) {
        events.push({
            type: 'FumbleRolled',
            i18nKey: 'combat.fumble.roll',
            data: {
                combatantId: attacker.id,
                role: 'attacker',
                roll: attackerRoll.rollResult,
                targetNumber: attackerRoll.targetNumber,
                fumbleRoll: attackerCriticalCheck.critRoll,
            },
        });
    }

    if (defenderCriticalCheck.isCritical && defenderCriticalCheck.critRoll !== undefined) {
        events.push({
            type: 'CritRolled',
            i18nKey: 'combat.critical.roll',
            data: {
                combatantId: defender.id,
                role: 'defender',
                trigger: 'roll',
                roll: defenderRoll.rollResult,
                targetNumber: defenderRoll.targetNumber,
                critRoll: defenderCriticalCheck.critRoll,
            },
        });
    }

    if (defenderCriticalCheck.isFumble && defenderCriticalCheck.critRoll !== undefined) {
        events.push({
            type: 'FumbleRolled',
            i18nKey: 'combat.fumble.roll',
            data: {
                combatantId: defender.id,
                role: 'defender',
                roll: defenderRoll.rollResult,
                targetNumber: defenderRoll.targetNumber,
                fumbleRoll: defenderCriticalCheck.critRoll,
            },
        });
    }

    let currentState = state;

    if (outcome === 'attacker' && action.combatMode !== false) {
        const damageResult = resolveDamage(state, {
            attackerId: attacker.id,
            defenderId: defender.id,
            skillId: attackerRoll.skillId,
            slDifference,
            weaponDamage: attackerRoll.weaponDamage || 0,
            attackRoll: attackerRoll.rollResult,
            hitLocation,
            usedTalents: attackerRoll.usedTalents,
        }, rng);

        currentState = damageResult.state;
        events.push(...damageResult.events);
    }

    if (outcome !== 'tie' && action.generatesAdvantage !== false && action.grantAdvantage !== false) {
        const winner = outcome === 'attacker' ? attacker : defender;
        const advantageResult = grantAdvantage(currentState, winner.side, 1, {
            reason: 'opposedTestWin',
            sourceCombatantId: winner.id,
        });
        events.push(...advantageResult.events);
        return { state: advantageResult.state, events };
    }

    return { state: currentState, events };
}

function resolveOpposedRoll(input: OpposedRollInput, character: Character, state: CombatState, rng: Rng): ResolvedOpposedRoll {
    const rollResult = input.rollResult ?? rolld100(rng);
    const targetNumber = input.targetNumber + (input.testModifier ?? 0);
    const successLevel = input.successLevel ?? applyTalentSLBonuses(
        calculateSuccessLevel(rollResult, targetNumber),
        input.usedTalents || [],
        state.talents,
        character
    );

    return {
        skillId: input.skillId,
        skillName: input.skillName,
        rollResult,
        targetNumber,
        successLevel,
        roundedSuccessLevel: Math.round(successLevel),
        weaponName: input.weaponName,
        weaponDamage: input.weaponDamage,
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
