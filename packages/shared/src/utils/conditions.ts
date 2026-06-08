import { Combatant, Character, ConditionInstance } from '../types/wfrp.types';
import { calculateCharacteristicBonus, calculateCharacteristicValue, calculateSkillValue } from './skills';
import { calculateSuccessLevel, rolld100, rollDice } from './mechanics';
import { mathRandomRng, type Rng } from '../combat/rng';
import { applyReloadInterruptGuardToCombatant } from '../combat/reload-interrupts';

export type ConditionTestCategory = 'all' | 'sight' | 'hearing' | 'movement';

export interface ConditionTestContext {
  category: ConditionTestCategory;
  tags?: string[];
}

export interface ConditionSubject {
  name?: string;
  conditions?: string[];
  conditionInstances?: ConditionInstance[];
  currentWounds?: number;
  maxWounds?: number;
  character?: Character;
}

export interface AttackerConditionModifiers {
  toHitModifier: number;
  advantageToAttacker: number;
  sources: Array<{
    conditionId: string;
    value: number;
    kind: 'toHit' | 'advantage';
    stacks: number;
  }>;
}

export type OpposedTestCollapse =
  | { mode: 'opposed'; canDefend: true }
  | { mode: 'unopposed'; canDefend: false; reason: 'condition_surprised' }
  | {
    mode: 'autoHit';
    canDefend: false;
    reason: 'condition_unconscious';
    autoCritical: true;
    maxSuccessLevel?: number;
    hitLocation?: string;
  };

export interface CombatantCapabilities {
  canAct: boolean;
  canMove: boolean;
  canDefend: boolean;
  canTakeTurn: boolean;
  halfMove: boolean;
  movementPenalty: number;
  mustFlee: boolean;
  moveRestriction?: 'standOrCrawl' | 'flee' | 'none';
  actionRestriction?: 'none' | 'noAction' | 'flee';
  blocksRegainingConsciousness: boolean;
}

export interface ConditionTestOutcome {
  roll?: number;
  targetNumber?: number;
  successLevel: number;
}

export interface EndOfRoundConditionOptions {
  rng?: Rng;
  toughnessBonus?: number;
  armourPoints?: number;
  conditionRemovalTests?: Partial<Record<TestRemovalConditionId, ConditionTestOutcome>>;
  poisonedUnconsciousEnduranceTest?: ConditionTestOutcome;
}

export interface EndOfTurnConditionOptions {
  enduranceTest?: ConditionTestOutcome;
}

export interface ConditionEffectEvent {
  type:
  | 'ConditionDamage'
  | 'ConditionRemoved'
  | 'ConditionGained'
  | 'ConditionDeath'
  | 'ConditionClotted'
  | 'ConditionPendingTest'
  | 'ConditionConsciousnessBlocked'
  | 'AmmoStateChanged';
  i18nKey: string;
  data: Record<string, number | string | boolean | undefined>;
}

export interface ConditionApplicationResult<TCombatant extends ConditionSubject = ConditionSubject> {
  combatant: TCombatant;
  log: string[];
  conditionsToRemove: string[];
  conditionsToAdd: string[];
  events: ConditionEffectEvent[];
  pendingTests: Array<{
    conditionId: string;
    testType: NonNullable<ConditionCheckResult['testType']>;
    difficulty?: number;
    reason: 'endOfTurn' | 'endOfRound' | 'unconsciousPoisoned';
  }>;
  dead?: boolean;
}

export type TestRemovalConditionId =
  | 'condition_ablaze'
  | 'condition_bleeding'
  | 'condition_blinded'
  | 'condition_broken'
  | 'condition_deafened'
  | 'condition_entangled'
  | 'condition_poisoned'
  | 'condition_stunned'
  | 'condition_surprised'
  | 'condition_unconscious';

const NON_STACKING_CONDITIONS = new Set(['condition_prone', 'condition_surprised', 'condition_unconscious']);
const FATIGUE_ON_FULL_REMOVAL = new Set(['condition_bleeding', 'condition_broken', 'condition_poisoned', 'condition_stunned']);
const TEST_REMOVAL_DIFFICULTY: Partial<Record<TestRemovalConditionId, number>> = {
  condition_bleeding: 20,
  condition_stunned: 0,
  condition_poisoned: 0,
  condition_ablaze: 0,
  condition_entangled: 0,
  condition_broken: 0,
};
const TEST_REMOVAL_TYPE: Partial<Record<TestRemovalConditionId, NonNullable<ConditionCheckResult['testType']>>> = {
  condition_bleeding: 'heal',
  condition_stunned: 'endurance',
  condition_poisoned: 'endurance',
  condition_ablaze: 'athletics',
  condition_entangled: 'strength',
  condition_broken: 'cool',
};

export interface ConditionEffect {
  type: 'damage' | 'remove_automatic' | 'test_to_remove' | 'penalty' | 'advantage_modifier' | 'movement_restriction' | 'action_restriction' | 'death_check';
  value?: number | string;
  description: string;
}

export interface ConditionCheckResult {
  needsTest: boolean;
  testType?: 'athletics' | 'cool' | 'endurance' | 'strength' | 'heal';
  testDifficulty?: number; // Modifier to test (+20, +0, -10, etc.)
  automaticEffect?: {
    type: 'damage' | 'remove' | 'death_check' | 'gain_condition';
    value?: number;
    rollFormula?: string; // e.g., "1d10"
    targetCondition?: string;
  };
  penalties?: {
    allTests?: number;
    sightTests?: number;
    hearingTests?: number;
    movementTests?: number;
  };
  combatModifiers?: {
    enemyHitBonus?: number;
    advantageForEnemies?: number;
  };
  restrictions?: {
    noMove?: boolean;
    noAction?: boolean;
    mustFlee?: boolean;
    cantDefend?: boolean;
    halfMove?: boolean;
  };
  description: string;
}

/**
 * Checks if a condition should be automatically removed based on rounds elapsed
 * @param conditionId The condition to check
 * @param roundApplied The round when the condition was applied
 * @param currentRound The current combat round
 * @returns true if the condition should be removed
 */
export function shouldAutoRemoveCondition(
  conditionId: string,
  roundApplied: number,
  currentRound: number
): boolean {
  const roundsElapsed = currentRound - roundApplied;

  switch (conditionId) {
    case 'condition_blinded':
    case 'condition_deafened':
      // Remove after 2 rounds (end of round 2)
      return roundsElapsed >= 2;

    case 'condition_surprised':
      // Remove at end of round
      return roundsElapsed >= 1;

    case 'condition_prone':
      // Not auto-removed, must stand up
      return false;

    default:
      return false;
  }
}

/**
 * Checks what effects and tests are needed for a condition at the start of a turn
 */
export function checkConditionEffects(
  conditionId: string,
  combatant: Combatant,
  character?: Character
): ConditionCheckResult {
  const conditionCount = (combatant.conditions || []).filter(c => c === conditionId).length;

  switch (conditionId) {
    case 'condition_ablaze':
      return {
        needsTest: true,
        testType: 'athletics',
        testDifficulty: 0, // Varies by circumstances (mentioned in description)
        automaticEffect: {
          type: 'damage',
          rollFormula: '1d10',
          value: conditionCount - 1 // +1 per extra condition
        },
        penalties: {},
        description: `At end of round: Take 1d10+${conditionCount - 1} damage (modified by TB and AP, minimum 1). Athletics Test removes 1 condition (+ 1 per SL).`
      };

    case 'condition_bleeding':
      return {
        needsTest: true,
        testType: 'heal',
        testDifficulty: 0,
        automaticEffect: {
          type: 'damage',
          value: 1 // Always 1 wound per round, ignoring modifiers
        },
        penalties: {
          allTests: 0 // -10 to specific infection tests, not general
        },
        description: `At end of round: Lose 1 wound (ignores modifiers). Heal Test or healing magic removes 1 condition (+ 1 per SL). At 0 wounds: unconscious and 10% death chance per condition (${conditionCount * 10}% currently).`
      };

    case 'condition_blinded':
      return {
        needsTest: false,
        automaticEffect: {
          type: 'remove',
          value: 1 // Removed at end of every other round
        },
        penalties: {
          sightTests: -10
        },
        combatModifiers: {
          enemyHitBonus: 10
        },
        description: `-10 to sight tests. Enemies gain +10 to hit you in close combat. Removed automatically after 2 rounds.`
      };

    case 'condition_broken':
      return {
        needsTest: true,
        testType: 'cool',
        testDifficulty: 0, // Varies by circumstances (+20 to -30)
        penalties: {
          allTests: -10 // For non-running/hiding tests
        },
        restrictions: {
          mustFlee: true
        },
        description: `Must use Move and Action to flee and hide. -10 to all tests not involving running/hiding. Cool Test at end of round to remove 1 condition (+ 1 per SL). Full round hiding removes 1 condition. When removed, gain 1 Fatigued.`
      };

    case 'condition_deafened':
      return {
        needsTest: false,
        automaticEffect: {
          type: 'remove',
          value: 1 // Removed at end of every other round
        },
        penalties: {
          hearingTests: -10
        },
        description: `-10 to hearing tests. Removed automatically after 2 rounds.`
      };

    case 'condition_entangled':
      return {
        needsTest: true,
        testType: 'strength',
        testDifficulty: 0, // Opposed test vs source
        penalties: {
          movementTests: -10
        },
        restrictions: {
          noMove: true
        },
        description: `Cannot Move. -10 to actions involving movement. Opposed Strength Test vs source removes 1 condition (+ 1 per SL).`
      };

    case 'condition_fatigued':
      return {
        needsTest: false,
        penalties: {
          allTests: -10
        },
        description: `-10 to all tests. Removed by rest, spell, or changing circumstances.`
      };

    case 'condition_poisoned':
      return {
        needsTest: true,
        testType: 'endurance',
        testDifficulty: 0, // Varies by poison
        automaticEffect: {
          type: 'damage',
          value: 1 // Always 1 wound per round
        },
        penalties: {
          allTests: -10
        },
        description: `At end of round: Lose 1 wound (ignores modifiers). -10 to all tests. Endurance or Heal Test removes 1 condition (+ 1 per SL). At 0 wounds: can't heal until removed. If unconscious: Endurance Test after TB rounds or die. When removed, gain 1 Fatigued.`
      };

    case 'condition_prone':
      return {
        needsTest: false,
        penalties: {
          movementTests: -20
        },
        combatModifiers: {
          enemyHitBonus: 20
        },
        restrictions: {
          halfMove: true // Can only stand or crawl at half movement
        },
        description: `-20 to movement tests. Enemies gain +20 to hit you. Move only for standing up or crawling at half Movement. Removed when you stand up.`
      };

    case 'condition_stunned':
      return {
        needsTest: true,
        testType: 'endurance',
        testDifficulty: 0, // Challenging (+0)
        penalties: {
          allTests: -10
        },
        combatModifiers: {
          advantageForEnemies: 1 // +1 Advantage before rolling attack
        },
        restrictions: {
          noAction: true,
          halfMove: true
        },
        description: `No Action, only half Move. -10 to all tests. Can't use Language (Magick). Enemies gain +1 Advantage before attacking. Challenging (+0) Endurance Test removes 1 condition (+ 1 per SL). When removed, gain 1 Fatigued if you don't have it.`
      };

    case 'condition_surprised':
      return {
        needsTest: false,
        automaticEffect: {
          type: 'remove',
          value: 1 // Removed at end of round or after first attack
        },
        combatModifiers: {
          enemyHitBonus: 20
        },
        restrictions: {
          noAction: true,
          noMove: true,
          cantDefend: true
        },
        description: `No Action or Move. Cannot defend. Enemies gain +20 to hit you. Removed at end of round or after first attack attempt.`
      };

    case 'condition_unconscious':
      return {
        needsTest: false,
        combatModifiers: {
          enemyHitBonus: 999 // Auto-hit with max SL and critical
        },
        restrictions: {
          noAction: true,
          noMove: true,
          cantDefend: true
        },
        description: `Completely incapacitated. Auto-hit with maximum SL and Critical. Requires resolving cause to remove. Spend Resolve to attempt removal. When removed, gain Prone and Fatigued.`
      };

    default:
      return {
        needsTest: false,
        description: 'Unknown condition'
      };
  }
}

export function effectivePenalty(combatant: ConditionSubject, testContext: ConditionTestContext | ConditionTestCategory): number {
  const context = normalizeTestContext(testContext);
  const penalties = Array.from(conditionCounts(combatant).entries())
    .map(([conditionId, count]) => stackedPenaltyFor(conditionId, count, context))
    .filter(penalty => penalty < 0);

  return penalties.length > 0 ? Math.min(...penalties) : 0;
}

export function attackerModifiersFor(target: ConditionSubject): AttackerConditionModifiers {
  const counts = conditionCounts(target);
  const sources: AttackerConditionModifiers['sources'] = [];

  const blinded = effectiveStackCount('condition_blinded', counts.get('condition_blinded') || 0);
  if (blinded > 0) {
    sources.push({ conditionId: 'condition_blinded', value: blinded * 10, kind: 'toHit', stacks: blinded });
  }

  if (effectiveStackCount('condition_prone', counts.get('condition_prone') || 0) > 0) {
    sources.push({ conditionId: 'condition_prone', value: 20, kind: 'toHit', stacks: 1 });
  }

  if (effectiveStackCount('condition_surprised', counts.get('condition_surprised') || 0) > 0) {
    sources.push({ conditionId: 'condition_surprised', value: 20, kind: 'toHit', stacks: 1 });
  }

  if ((counts.get('condition_stunned') || 0) > 0) {
    sources.push({ conditionId: 'condition_stunned', value: 1, kind: 'advantage', stacks: 1 });
  }

  return {
    toHitModifier: sumSources(sources, 'toHit'),
    advantageToAttacker: sumSources(sources, 'advantage'),
    sources,
  };
}

export function opposedTestCollapseFor(
  defender: ConditionSubject,
  options: { attackTargetNumber?: number; chosenHitLocation?: string } = {}
): OpposedTestCollapse {
  if (hasCondition(defender, 'condition_unconscious')) {
    return {
      mode: 'autoHit',
      canDefend: false,
      reason: 'condition_unconscious',
      autoCritical: true,
      maxSuccessLevel: options.attackTargetNumber === undefined
        ? undefined
        : Math.round(calculateSuccessLevel(1, options.attackTargetNumber)),
      hitLocation: options.chosenHitLocation,
    };
  }

  if (hasCondition(defender, 'condition_surprised')) {
    return { mode: 'unopposed', canDefend: false, reason: 'condition_surprised' };
  }

  return { mode: 'opposed', canDefend: true };
}

export function combatantCapabilities(combatant: ConditionSubject): CombatantCapabilities {
  const conditions = combatant.conditions || [];
  const unconscious = conditions.includes('condition_unconscious');
  const surprised = conditions.includes('condition_surprised');
  const stunned = conditions.includes('condition_stunned');
  const entangled = conditions.includes('condition_entangled');
  const prone = conditions.includes('condition_prone');
  const broken = conditions.includes('condition_broken');

  if (unconscious) {
    return {
      canAct: false,
      canMove: false,
      canDefend: false,
      canTakeTurn: false,
      halfMove: false,
      movementPenalty: effectivePenalty(combatant, 'movement'),
      mustFlee: false,
      moveRestriction: 'none',
      actionRestriction: 'noAction',
      blocksRegainingConsciousness: hasCondition(combatant, 'condition_bleeding'),
    };
  }

  const noAction = stunned || surprised;
  const noMove = surprised || entangled;

  return {
    canAct: !noAction,
    canMove: !noMove,
    canDefend: !surprised,
    canTakeTurn: !(noAction && noMove),
    halfMove: stunned || prone,
    movementPenalty: effectivePenalty(combatant, 'movement'),
    mustFlee: broken,
    moveRestriction: broken ? 'flee' : prone ? 'standOrCrawl' : 'none',
    actionRestriction: broken ? 'flee' : noAction ? 'noAction' : 'none',
    blocksRegainingConsciousness: false,
  };
}

export function canRegainConsciousness(combatant: ConditionSubject): boolean {
  return hasCondition(combatant, 'condition_unconscious') && !hasCondition(combatant, 'condition_bleeding');
}

export function conditionsRemovedAfterAttack(target: ConditionSubject): string[] {
  return hasCondition(target, 'condition_surprised') ? ['condition_surprised'] : [];
}

export function applyConditionRemovalTest<TCombatant extends ConditionSubject>(
  combatant: TCombatant,
  conditionId: TestRemovalConditionId,
  test: ConditionTestOutcome
): ConditionApplicationResult<TCombatant> {
  if (test.successLevel < 0) {
    return emptyConditionResult(combatant);
  }

  const stacksToRemove = 1 + Math.max(0, Math.floor(test.successLevel));
  return removeConditionStacks(combatant, conditionId, stacksToRemove);
}

export function resolveConditionPendingTest<TCombatant extends ConditionSubject>(
  combatant: TCombatant,
  pendingTest: ConditionApplicationResult<TCombatant>['pendingTests'][number],
  rng: Rng
): ConditionApplicationResult<TCombatant> {
  const { conditionId, testType, difficulty, reason } = pendingTest;
  const roll = rolld100(rng);
  if (!combatant.character) {
    throw new Error('Cannot resolve condition pending test without character');
  }
  const targetNumber = testType === 'strength' ? 
    calculateCharacteristicValue(combatant.character.characteristics.s) : 
    calculateSkillValue(combatant.character.skills.find(s => s.id === testType)!, combatant.character);

  const successLevel = calculateSuccessLevel(roll, targetNumber + (difficulty ?? 0));
  const testOutcome: ConditionTestOutcome = { roll, targetNumber, successLevel };
  return applyConditionRemovalTest(combatant, conditionId as TestRemovalConditionId, testOutcome);
}

export function applyEndOfTurnConditionEffects<TCombatant extends ConditionSubject>(
  combatant: TCombatant,
  options: EndOfTurnConditionOptions = {}
): ConditionApplicationResult<TCombatant> {
  if (!hasCondition(combatant, 'condition_bleeding') || hasCondition(combatant, 'condition_unconscious')) {
    return emptyConditionResult(combatant);
  }

  if (!options.enduranceTest) {
    const result = emptyConditionResult(combatant);
    result.pendingTests.push({
      conditionId: 'condition_bleeding',
      testType: 'endurance',
      difficulty: 0,
      reason: 'endOfTurn',
    });
    result.events.push(conditionEvent('ConditionPendingTest', 'combat.condition.effect.pendingTest', {
      conditionId: 'condition_bleeding',
      testType: 'Endurance',
      reason: 'endOfTurn',
    }));
    return result;
  }

  if (options.enduranceTest.successLevel >= 0) {
    return emptyConditionResult(combatant);
  }

  return addConditionStacks(combatant, 'condition_unconscious', 1);
}

/**
 * Applies automatic end-of-round effects for conditions.
 * The returned combatant is a new object; the input combatant is never mutated.
 */
export function applyEndOfRoundConditionEffects<TCombatant extends ConditionSubject>(
  combatant: TCombatant,
  currentRound: number,
  character?: Character,
  options: EndOfRoundConditionOptions = {}
): ConditionApplicationResult<TCombatant> {
  const rng = options.rng ?? mathRandomRng;
  const subject = character ? ({ ...combatant, character } as TCombatant) : combatant;
  let working = cloneConditionSubject(subject);
  const result = emptyConditionResult(working);
  const originalCounts = conditionCounts(working);
  const name = working.name || 'Combatant';

  for (const [conditionId, amount] of automaticConditionRemovals(working, currentRound).entries()) {
    const removal = removeConditionStacks(working, conditionId as TestRemovalConditionId, amount);
    working = removal.combatant;
    mergeConditionResult(result, removal);
    result.log.push(`${name}'s ${getConditionName(conditionId)} condition automatically removed.`);
  }

  const ablazeCount = originalCounts.get('condition_ablaze') || 0;
  if (ablazeCount > 0) {
    const baseDamage = rollDice(1, 10, rng);
    const extraDamage = ablazeCount - 1;
    const toughnessBonus = options.toughnessBonus ?? toughnessBonusFor(working);
    const armourPoints = options.armourPoints ?? 0;
    const damage = Math.max(1, baseDamage + extraDamage - toughnessBonus - armourPoints);
    working = setWounds(working, Math.max(0, (working.currentWounds ?? 0) - damage));
    result.log.push(`${name} takes ${damage} damage from Ablaze.`);
    result.events.push(conditionEvent('ConditionDamage', 'combat.condition.effect.damage', {
      conditionId: 'condition_ablaze',
      damage,
      baseDamage,
      extraDamage,
      toughnessBonus,
      armourPoints,
    }));
  }

  const bleedingCount = originalCounts.get('condition_bleeding') || 0;
  const bleedingIgnored = Math.min(bleedingCount, talentRank(working, 'implacable'));
  if (bleedingCount > bleedingIgnored && (working.currentWounds ?? 0) > 0) {
    working = setWounds(working, Math.max(0, (working.currentWounds ?? 0) - 1));
    result.log.push(`${name} loses 1 wound from Bleeding.`);
    result.events.push(conditionEvent('ConditionDamage', 'combat.condition.effect.damage', {
      conditionId: 'condition_bleeding',
      damage: 1,
      ignoresModifiers: true,
    }));
  }

  if (bleedingCount > 0 && hasCondition(working, 'condition_unconscious')) {
    const deathRoll = rolld100(rng);
    const deathChance = bleedingCount * 10;
    if (isD100Double(deathRoll)) {
      const removal = removeConditionStacks(working, 'condition_bleeding', 1);
      working = removal.combatant;
      mergeConditionResult(result, removal);
      result.log.push(`${name}'s wound clots and removes 1 Bleeding condition.`);
      result.events.push(conditionEvent('ConditionClotted', 'combat.condition.effect.clotted', {
        conditionId: 'condition_bleeding',
        roll: deathRoll,
      }));
    } else if (deathRoll <= deathChance) {
      result.dead = true;
      result.log.push(`${name} dies from blood loss.`);
      result.events.push(conditionEvent('ConditionDeath', 'combat.condition.effect.death', {
        conditionId: 'condition_bleeding',
        roll: deathRoll,
        deathChance,
      }));
    }
  }

  const poisonedCount = originalCounts.get('condition_poisoned') || 0;
  if (poisonedCount > 0) {
    working = setWounds(working, Math.max(0, (working.currentWounds ?? 0) - 1));
    result.log.push(`${name} loses 1 wound from Poisoned.`);
    result.events.push(conditionEvent('ConditionDamage', 'combat.condition.effect.damage', {
      conditionId: 'condition_poisoned',
      damage: 1,
      ignoresModifiers: true,
    }));

    if (hasCondition(working, 'condition_unconscious') && poisonedDeathTestDue(working, currentRound)) {
      if (!options.poisonedUnconsciousEnduranceTest) {
        result.pendingTests.push({
          conditionId: 'condition_poisoned',
          testType: 'endurance',
          difficulty: TEST_REMOVAL_DIFFICULTY.condition_poisoned,
          reason: 'unconsciousPoisoned',
        });
        result.events.push(conditionEvent('ConditionPendingTest', 'combat.condition.effect.pendingTest', {
          conditionId: 'condition_poisoned',
          testType: 'Endurance',
          reason: 'unconsciousPoisoned',
        }));
      } else if (options.poisonedUnconsciousEnduranceTest.successLevel < 0) {
        result.dead = true;
        result.log.push(`${name} dies from Poisoned while Unconscious.`);
        result.events.push(conditionEvent('ConditionDeath', 'combat.condition.effect.death', {
          conditionId: 'condition_poisoned',
          successLevel: options.poisonedUnconsciousEnduranceTest.successLevel,
        }));
      }
    }
  }

  queueMissingEndOfRoundRemovalTests(working, options.conditionRemovalTests || {}, result);

  for (const [conditionId, test] of Object.entries(options.conditionRemovalTests || {}) as Array<[TestRemovalConditionId, ConditionTestOutcome]>) {
    const removal = applyConditionRemovalTest(working, conditionId, test);
    working = removal.combatant;
    mergeConditionResult(result, removal);
  }

  const guarded = applyReloadInterruptGuardToCombatant(working, result.events);
  result.combatant = guarded.combatant;
  result.events = guarded.events as ConditionEffectEvent[];
  return result;
}

/**
 * Calculates total test penalty from active conditions using WFRP stacking:
 * stack identical conditions first, then keep only the worst different-condition penalty.
 */
export function getConditionTestPenalty(conditions: string[], testType: 'all' | 'sight' | 'hearing' | 'movement'): number {
  return effectivePenalty({ conditions }, testType);
}

/**
 * Gets attacker modifiers from active target conditions.
 */
export function getConditionCombatModifiers(conditions: string[]): {
  enemyHitBonus: number;
  advantageForEnemies: number;
} {
  const modifiers = attackerModifiersFor({ conditions });
  return { enemyHitBonus: modifiers.toHitModifier, advantageForEnemies: modifiers.advantageToAttacker };
}

/**
 * Checks if a combatant has any movement or action restrictions.
 */
export function getConditionRestrictions(conditions: string[]): {
  canMove: boolean;
  canAct: boolean;
  canDefend: boolean;
  mustFlee: boolean;
  halfMove: boolean;
} {
  const capabilities = combatantCapabilities({ conditions });
  return {
    canMove: capabilities.canMove,
    canAct: capabilities.canAct,
    canDefend: capabilities.canDefend,
    mustFlee: capabilities.mustFlee,
    halfMove: capabilities.halfMove,
  };
}

function normalizeTestContext(testContext: ConditionTestContext | ConditionTestCategory): ConditionTestContext {
  return typeof testContext === 'string' ? { category: testContext } : testContext;
}

function conditionCounts(combatant: ConditionSubject): Map<string, number> {
  return (combatant.conditions || []).reduce((counts, conditionId) => {
    counts.set(conditionId, (counts.get(conditionId) || 0) + 1);
    return counts;
  }, new Map<string, number>());
}

function hasCondition(combatant: ConditionSubject, conditionId: string): boolean {
  return (combatant.conditions || []).includes(conditionId);
}

function effectiveStackCount(conditionId: string, count: number): number {
  if (count <= 0) return 0;
  return NON_STACKING_CONDITIONS.has(conditionId) ? 1 : count;
}

function stackedPenaltyFor(conditionId: string, count: number, context: ConditionTestContext): number {
  const stacks = effectiveStackCount(conditionId, count);
  if (stacks <= 0) return 0;

  if (conditionId === 'condition_broken' && context.tags?.some(tag => tag === 'running' || tag === 'hiding')) {
    return 0;
  }

  const perStackPenalty = penaltyPerStackFor(conditionId, context.category);
  return perStackPenalty * stacks;
}

function penaltyPerStackFor(conditionId: string, category: ConditionTestCategory): number {
  switch (conditionId) {
    case 'condition_blinded':
      return category === 'sight' ? -10 : 0;
    case 'condition_deafened':
      return category === 'hearing' ? -10 : 0;
    case 'condition_entangled':
      return category === 'movement' ? -10 : 0;
    case 'condition_prone':
      return category === 'movement' ? -20 : 0;
    case 'condition_broken':
    case 'condition_fatigued':
    case 'condition_poisoned':
    case 'condition_stunned':
      return -10;
    default:
      return 0;
  }
}

function sumSources(sources: AttackerConditionModifiers['sources'], kind: 'toHit' | 'advantage'): number {
  return sources
    .filter(source => source.kind === kind)
    .reduce((total, source) => total + source.value, 0);
}

function emptyConditionResult<TCombatant extends ConditionSubject>(combatant: TCombatant): ConditionApplicationResult<TCombatant> {
  return {
    combatant,
    log: [],
    conditionsToRemove: [],
    conditionsToAdd: [],
    events: [],
    pendingTests: [],
  };
}

function mergeConditionResult<TCombatant extends ConditionSubject>(
  target: ConditionApplicationResult<TCombatant>,
  source: ConditionApplicationResult<TCombatant>
): void {
  target.combatant = source.combatant;
  target.log.push(...source.log);
  target.conditionsToRemove.push(...source.conditionsToRemove);
  target.conditionsToAdd.push(...source.conditionsToAdd);
  target.events.push(...source.events);
  target.pendingTests.push(...source.pendingTests);
  target.dead = target.dead || source.dead;
}

function cloneConditionSubject<TCombatant extends ConditionSubject>(combatant: TCombatant): TCombatant {
  return {
    ...combatant,
    conditions: [...(combatant.conditions || [])],
    conditionInstances: combatant.conditionInstances ? [...combatant.conditionInstances] : undefined,
  };
}

function addConditionStacks<TCombatant extends ConditionSubject>(
  combatant: TCombatant,
  conditionId: string,
  amount: number
): ConditionApplicationResult<TCombatant> {
  const result = emptyConditionResult(combatant);
  let nextConditions = [...(combatant.conditions || [])];
  let added = 0;

  for (let index = 0; index < amount; index++) {
    if (NON_STACKING_CONDITIONS.has(conditionId) && nextConditions.includes(conditionId)) {
      continue;
    }
    nextConditions = [...nextConditions, conditionId];
    added += 1;
  }

  if (added === 0) return result;

  result.combatant = setConditions(combatant, nextConditions);
  result.conditionsToAdd.push(...Array.from({ length: added }, () => conditionId));
  result.events.push(conditionEvent('ConditionGained', 'combat.condition.effect.gained', {
    conditionId,
    stacks: added,
  }));
  return result;
}

function removeConditionStacks<TCombatant extends ConditionSubject>(
  combatant: TCombatant,
  conditionId: TestRemovalConditionId,
  amount: number
): ConditionApplicationResult<TCombatant> {
  const result = emptyConditionResult(combatant);
  const before = combatant.conditions || [];
  const beforeCount = before.filter(condition => condition === conditionId).length;
  const removeCount = Math.min(beforeCount, amount);
  if (removeCount <= 0) return result;

  let removed = 0;
  let nextConditions = before.filter(condition => {
    if (condition === conditionId && removed < removeCount) {
      removed += 1;
      return false;
    }
    return true;
  });

  result.conditionsToRemove.push(...Array.from({ length: removed }, () => conditionId));
  result.events.push(conditionEvent('ConditionRemoved', 'combat.condition.effect.removed', {
    conditionId,
    stacks: removed,
  }));

  if (!nextConditions.includes(conditionId)) {
    if (FATIGUE_ON_FULL_REMOVAL.has(conditionId)) {
      nextConditions = addChainedCondition(nextConditions, 'condition_fatigued', result);
    }

    if (conditionId === 'condition_unconscious') {
      nextConditions = addChainedCondition(nextConditions, 'condition_prone', result);
      nextConditions = addChainedCondition(nextConditions, 'condition_fatigued', result);
    }
  }

  result.combatant = setConditions(combatant, nextConditions);
  return result;
}

function addChainedCondition<TCombatant extends ConditionSubject>(
  conditions: string[],
  conditionId: string,
  result: ConditionApplicationResult<TCombatant>
): string[] {
  if (NON_STACKING_CONDITIONS.has(conditionId) && conditions.includes(conditionId)) {
    return conditions;
  }

  if (conditionId === 'condition_fatigued' && conditions.includes(conditionId)) {
    return conditions;
  }

  result.conditionsToAdd.push(conditionId);
  result.events.push(conditionEvent('ConditionGained', 'combat.condition.effect.gained', {
    conditionId,
    stacks: 1,
  }));
  return [...conditions, conditionId];
}

function setConditions<TCombatant extends ConditionSubject>(combatant: TCombatant, conditions: string[]): TCombatant {
  return { ...combatant, conditions } as TCombatant;
}

function setWounds<TCombatant extends ConditionSubject>(combatant: TCombatant, currentWounds: number): TCombatant {
  const next: any = { ...combatant, currentWounds };
  if (combatant.character) {
    next.character = {
      ...combatant.character,
      status: {
        ...combatant.character.status,
        wounds: {
          ...combatant.character.status.wounds,
          current: currentWounds,
        },
      },
    };
  }

  if ('resources' in combatant && (combatant as any).resources?.wounds) {
    next.resources = {
      ...(combatant as any).resources,
      wounds: {
        ...(combatant as any).resources.wounds,
        current: currentWounds,
      },
    };
  }

  return next as TCombatant;
}

function automaticConditionRemovals(combatant: ConditionSubject, currentRound: number): Map<string, number> {
  const counts = conditionCounts(combatant);
  const removals = new Map<string, number>();

  for (const conditionId of ['condition_blinded', 'condition_deafened']) {
    const count = counts.get(conditionId) || 0;
    if (count === 0) continue;

    const earliestRound = earliestAppliedRound(combatant, conditionId);
    if (earliestRound === undefined) continue;

    const elapsed = Math.max(0, currentRound - earliestRound);
    const amount = Math.min(count, Math.floor(elapsed / 2));
    if (amount > 0) removals.set(conditionId, amount);
  }

  const surprisedCount = counts.get('condition_surprised') || 0;
  if (surprisedCount > 0) {
    removals.set('condition_surprised', effectiveStackCount('condition_surprised', surprisedCount));
  }

  return removals;
}

function queueMissingEndOfRoundRemovalTests<TCombatant extends ConditionSubject>(
  combatant: TCombatant,
  suppliedTests: Partial<Record<TestRemovalConditionId, ConditionTestOutcome>>,
  result: ConditionApplicationResult<TCombatant>
): void {
  const testToRemoveIds: TestRemovalConditionId[] = [
    'condition_ablaze',
    'condition_broken',
    'condition_entangled',
    'condition_poisoned',
    'condition_stunned',
  ];

  for (const conditionId of testToRemoveIds) {
    if (!hasCondition(combatant, conditionId) || suppliedTests[conditionId]) continue;

    result.pendingTests.push({
      conditionId,
      testType: TEST_REMOVAL_TYPE[conditionId]!,
      difficulty: TEST_REMOVAL_DIFFICULTY[conditionId],
      reason: 'endOfRound',
    });
    result.events.push(conditionEvent('ConditionPendingTest', 'combat.condition.effect.pendingTest', {
      conditionId,
      testType: TEST_REMOVAL_TYPE[conditionId],
      reason: 'endOfRound',
    }));
  }
}

function earliestAppliedRound(combatant: ConditionSubject, conditionId: string): number | undefined {
  const rounds = (combatant.conditionInstances || [])
    .filter(instance => instance.id === conditionId)
    .map(instance => instance.roundApplied);
  return rounds.length > 0 ? Math.min(...rounds) : undefined;
}

function toughnessBonusFor(combatant: ConditionSubject): number {
  return combatant.character ? calculateCharacteristicBonus(combatant.character.characteristics.t) : 0;
}

function talentRank(combatant: ConditionSubject, talentId: string): number {
  return combatant.character?.talents?.[talentId] ?? 0;
}

function poisonedDeathTestDue(combatant: ConditionSubject, currentRound: number): boolean {
  const unconsciousRound = earliestAppliedRound(combatant, 'condition_unconscious');
  if (unconsciousRound === undefined) return false;
  return currentRound - unconsciousRound >= toughnessBonusFor(combatant);
}

function isD100Double(roll: number): boolean {
  return roll === 100 || (roll >= 11 && roll <= 99 && roll % 11 === 0);
}

function conditionEvent(
  type: ConditionEffectEvent['type'],
  i18nKey: string,
  data: ConditionEffectEvent['data']
): ConditionEffectEvent {
  return { type, i18nKey, data };
}

/**
 * Gets a human-readable summary of all active condition effects
 */
export function getConditionsSummary(conditions: string[]): string {
  const uniqueConditions = Array.from(new Set(conditions));
  const summaries: string[] = [];

  uniqueConditions.forEach(condId => {
    const count = conditions.filter(c => c === condId).length;
    const effect = checkConditionEffects(condId, { conditions } as Combatant);

    summaries.push(`${getConditionName(condId)}${count > 1 ? ` (x${count})` : ''}: ${effect.description}`);
  });

  return summaries.join('\n\n');
}

/**
 * Helper to get clean condition name
 */
function getConditionName(conditionId: string): string {
  return conditionId.replace('condition_', '').split('_').map(w =>
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ');
}
