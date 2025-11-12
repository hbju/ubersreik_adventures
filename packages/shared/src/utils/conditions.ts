import { Combatant, Character } from '../types/wfrp.types';
import { calculateCharacteristicBonus } from './skills';
import { rollDice } from './mechanics';

export interface ConditionEffect {
  type: 'damage' | 'remove_automatic' | 'test_to_remove' | 'penalty' | 'advantage_modifier' | 'movement_restriction' | 'action_restriction' | 'death_check';
  value?: number | string;
  description: string;
}

export interface ConditionCheckResult {
  needsTest: boolean;
  testType?: 'Athletics' | 'Cool' | 'Endurance' | 'Strength' | 'Heal';
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
        testType: 'Athletics',
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
        testType: 'Heal',
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
        testType: 'Cool',
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
        combatModifiers: {
          enemyHitBonus: 10 // From flank/rear only, but simplified
        },
        description: `-10 to hearing tests. Enemies gain +10 to hit from flank/rear. Removed automatically after 2 rounds.`
      };

    case 'condition_entangled':
      return {
        needsTest: true,
        testType: 'Strength',
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
        testType: 'Endurance',
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
        testType: 'Endurance',
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

/**
 * Applies automatic end-of-round effects for conditions
 * @param combatant The combatant with conditions
 * @param currentRound The current combat round number
 * @param character The character data (if available)
 */
export function applyEndOfRoundConditionEffects(
  combatant: Combatant,
  currentRound: number,
  character?: Character
): {
  combatant: Combatant;
  log: string[];
  conditionsToRemove: string[];
  conditionsToAdd: string[];
} {
  const log: string[] = [];
  const conditionsToRemove: string[] = [];
  const conditionsToAdd: string[] = [];
  let updatedCombatant = { ...combatant };

  const conditions = combatant.conditions || [];
  const conditionInstances = combatant.conditionInstances || [];
  const conditionCounts = new Map<string, number>();
  conditions.forEach(c => conditionCounts.set(c, (conditionCounts.get(c) || 0) + 1));

  // Check for automatic removal based on rounds
  conditionInstances.forEach(instance => {
    if (shouldAutoRemoveCondition(instance.id, instance.roundApplied, currentRound)) {
      conditionsToRemove.push(instance.id);
      const conditionName = getConditionName(instance.id);
      log.push(`${combatant.name}'s ${conditionName} condition automatically removed after ${currentRound - instance.roundApplied} rounds.`);
    }
  });

  // Process Ablaze
  if (conditionCounts.has('condition_ablaze')) {
    const ablazeCount = conditionCounts.get('condition_ablaze')!;
    const baseDamage = rollDice(1, 10);
    const extraDamage = ablazeCount - 1;
    const minusDamage = character ? calculateCharacteristicBonus(character.characteristics.t) : 0;
    const totalDamage = baseDamage + extraDamage - minusDamage;

    // Would be modified by TB and AP in real implementation
    const finalDamage = Math.max(1, totalDamage);
    updatedCombatant.currentWounds = Math.max(0, updatedCombatant.currentWounds - finalDamage);

    log.push(`${combatant.name} takes ${finalDamage} damage from Ablaze (${baseDamage} + ${extraDamage})`);
  }

  // Process Bleeding
  if (conditionCounts.has('condition_bleeding')) {
    const bleedingCount = conditionCounts.get('condition_bleeding')!;
    updatedCombatant.currentWounds = Math.max(0, updatedCombatant.currentWounds - 1);
    log.push(`${combatant.name} loses 1 wound from Bleeding`);

    // Check for death if at 0 wounds
    if (updatedCombatant.currentWounds === 0) {
      const deathChance = bleedingCount * 10;
      const deathRoll = rollDice(1, 100);
      if (deathRoll <= deathChance) {
        log.push(`⚠️ ${combatant.name} has died from blood loss! (Rolled ${deathRoll}, needed ${deathChance} or less)`);
      } else {
        log.push(`${combatant.name} is unconscious but survives (Rolled ${deathRoll}, death chance was ${deathChance}%)`);
        if (!conditions.includes('condition_unconscious')) {
          conditionsToAdd.push('condition_unconscious');
        }
      }
    }
  }

  // Process Poisoned
  if (conditionCounts.has('condition_poisoned')) {
    updatedCombatant.currentWounds = Math.max(0, updatedCombatant.currentWounds - 1);
    log.push(`${combatant.name} loses 1 wound from Poison`);
  }

  // Auto-remove Surprised at end of round (if not already removed)
  if (conditionCounts.has('condition_surprised') && !conditionsToRemove.includes('condition_surprised')) {
    conditionsToRemove.push('condition_surprised');
    log.push(`${combatant.name} is no longer Surprised`);
  }

  return {
    combatant: updatedCombatant,
    log,
    conditionsToRemove,
    conditionsToAdd
  };
}

/**
 * Calculates total test penalty from active conditions
 */
export function getConditionTestPenalty(conditions: string[], testType: 'all' | 'sight' | 'hearing' | 'movement'): number {
  let penalty = 0;

  conditions.forEach(condId => {
    const effect = checkConditionEffects(condId, { conditions } as Combatant);

    if (testType === 'all' && effect.penalties?.allTests) {
      penalty += effect.penalties.allTests;
    } else if (testType === 'sight' && effect.penalties?.sightTests) {
      penalty += effect.penalties.sightTests;
    } else if (testType === 'hearing' && effect.penalties?.hearingTests) {
      penalty += effect.penalties.hearingTests;
    } else if (testType === 'movement' && effect.penalties?.movementTests) {
      penalty += effect.penalties.movementTests;
    }
  });

  return penalty;
}

/**
 * Gets combat modifiers from active conditions
 */
export function getConditionCombatModifiers(conditions: string[]): {
  enemyHitBonus: number;
  advantageForEnemies: number;
} {
  let enemyHitBonus = 0;
  let advantageForEnemies = 0;

  conditions.forEach(condId => {
    const effect = checkConditionEffects(condId, { conditions } as Combatant);

    if (effect.combatModifiers?.enemyHitBonus) {
      enemyHitBonus += effect.combatModifiers.enemyHitBonus;
    }
    if (effect.combatModifiers?.advantageForEnemies) {
      advantageForEnemies += effect.combatModifiers.advantageForEnemies;
    }
  });

  return { enemyHitBonus, advantageForEnemies };
}

/**
 * Checks if a combatant has any movement or action restrictions
 */
export function getConditionRestrictions(conditions: string[]): {
  canMove: boolean;
  canAct: boolean;
  canDefend: boolean;
  mustFlee: boolean;
  halfMove: boolean;
} {
  let canMove = true;
  let canAct = true;
  let canDefend = true;
  let mustFlee = false;
  let halfMove = false;

  conditions.forEach(condId => {
    const effect = checkConditionEffects(condId, { conditions } as Combatant);

    if (effect.restrictions) {
      if (effect.restrictions.noMove) canMove = false;
      if (effect.restrictions.noAction) canAct = false;
      if (effect.restrictions.cantDefend) canDefend = false;
      if (effect.restrictions.mustFlee) mustFlee = true;
      if (effect.restrictions.halfMove) halfMove = true;
    }
  });

  return { canMove, canAct, canDefend, mustFlee, halfMove };
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
