# PBI 1: Advanced Rules Automation - Implementation Summary

## Overview
This PBI implements automated talent effects, critical hits, and fumbles detection for the WFRP application. The system provides machine-readable talent data and utility functions to automatically apply mechanical effects during gameplay.

## Completed Tasks

### ✅ Task 1.1: Restructured talents.json
**Location:** `packages/shared/src/data/talents.json`

Added an `effects` array to 66+ key talents. Each effect has:
- `type`: The kind of effect (SL_BONUS_ON_SUCCESS, WOUNDS_BONUS, TEST_BONUS, DAMAGE_BONUS, INITIATIVE_BONUS, PASSIVE, CONDITIONAL)
- `value`: The numeric value or formula (e.g., 1, 10, "TB")
- `appliesTo`: Array of skills/characteristics/descriptors the effect applies to
- `condition` (optional): When the effect applies

**Examples:**
```json
{
  "id": "accurate-shot",
  "effects": [
    { "type": "DAMAGE_BONUS", "value": 1, "appliesTo": ["ranged"] }
  ]
}

{
  "id": "hardy",
  "effects": [
    { "type": "WOUNDS_BONUS", "value": "TB" }
  ]
}

{
  "id": "combat-aware",
  "effects": [
    { "type": "SL_BONUS_ON_SUCCESS", "value": 1, "appliesTo": ["Perception"], "condition": "during melee" }
  ]
}
```

### ✅ Task 1.2: Updated Talent Type Definition
**Location:** `packages/shared/src/types/wfrp.types.ts`

Added new interfaces:
```typescript
export interface Talent {
  id: string;
  name: string;
  description: string;
  tests: keyof Character['characteristics'][] | Skill[] | null;
  max_ranks: number | keyof Character['characteristics'];
  effects?: TalentEffect[];  // NEW
}

export interface TalentEffect {  // NEW
  type: 'SL_BONUS_ON_SUCCESS' | 'WOUNDS_BONUS' | 'TEST_BONUS' | 'DAMAGE_BONUS' | 'INITIATIVE_BONUS' | 'PASSIVE' | 'CONDITIONAL';
  value: number | string;
  appliesTo?: string[];
  condition?: string;
}
```

### ✅ Task 1.3: Updated TestResultMessage Protocol
**Location:** `packages/shared/src/types/messaging.types.ts`

Added `usedTalents` field to track which talents were used in a test:
```typescript
export type TestResultMessage = BaseMessage<'TEST_RESULT', {
  characterName: string;
  testName: string;
  targetNumber: number;
  rollResult: number;
  successLevel: number;
  usedTalents?: { name: string; rank: number; }[];  // NEW
}>;
```

### ✅ Task 1.4: Created Rules Calculation Utilities
**Location:** `packages/shared/src/utils/talents.ts`

New utility functions:

#### 1. `getApplicableTalents(character, testName)`
Returns all talents a character has that could apply to a specific skill test.

**Usage:**
```typescript
const applicableTalents = getApplicableTalents(character, "Melee (Basic)");
// Returns: [{ talent: {...}, rank: 2 }, ...]
```

#### 2. `calculateEffectiveMaxWounds(character)`
Calculates max wounds including talent bonuses like Hardy (TB bonus).

**Usage:**
```typescript
const maxWounds = calculateEffectiveMaxWounds(character);
// Automatically adds TB * rank for Hardy talent
```

#### 3. `applyTalentSLBonuses(baseSL, usedTalents, character?)`
Applies +1 SL per rank for selected talents on successful tests.

**Usage:**
```typescript
const finalSL = applyTalentSLBonuses(2, [
  { name: "Combat Aware", rank: 1 },
  { name: "Warrior Born", rank: 1 }
]);
// Returns: 4 (2 base + 1 + 1)
```

#### 4. `getTalentTestBonus(character, testName)`
Gets test bonuses (like +10 from Acute Sense) for a skill.

**Usage:**
```typescript
const bonus = getTalentTestBonus(character, "Perception");
// Returns: 10 (if character has Acute Sense rank 1)
```

#### 5. `getTalentDamageBonus(character, attackType)`
Gets damage bonuses for ranged or melee attacks.

**Usage:**
```typescript
const damage = getTalentDamageBonus(character, "ranged");
// Returns: rank value for Accurate Shot
```

#### 6. `getTalentInitiativeBonus(character)`
Gets initiative bonuses from talents like Combat Reflexes.

**Usage:**
```typescript
const initBonus = getTalentInitiativeBonus(character);
// Returns: 10 * rank for Combat Reflexes
```

#### 7. `checkCriticalResult(roll, target)`
Checks if a roll is a critical success or fumble.

**Usage:**
```typescript
const result = checkCriticalResult(roll, target);
// Returns: { isCritical: boolean, isFumble: boolean }
```

### ✅ Task 1.5: Added Critical Hits & Fumbles Data
**Locations:**
- `packages/shared/src/data/critical_hits.json`
- `packages/shared/src/data/fumbles.json`

#### Critical Hits Data
Organized by hit location (head, arm, body, leg) with wound thresholds and effects:
```json
{
  "location": "head",
  "results": [
    {
      "minWounds": 7,
      "maxWounds": 8,
      "description": "Cracked Skull: You suffer a Fractured Skull and gain 2 Bleeding Conditions.",
      "effect": "fractured_skull_bleeding_2"
    }
  ]
}
```

#### Fumbles Data
Complete fumble table with roll ranges and effects:
```json
{
  "roll": "96-00",
  "description": "Catastrophe!: Roll 1d10 and consult the appropriate Critical Table...",
  "effect": "roll_critical_or_bleeding_3",
  "duration": "immediate"
}
```

## How to Use in Your Application

### Player-Side Roll Implementation

```typescript
import { getApplicableTalents, applyTalentSLBonuses, checkCriticalResult } from '@shared';

function performSkillTest(character: Character, skillName: string, modifier: number) {
  // 1. Get applicable talents
  const applicableTalents = getApplicableTalents(character, skillName);
  
  // 2. Show UI for player to select which talents to use
  const selectedTalents = showTalentSelectionModal(applicableTalents);
  
  // 3. Calculate target number
  const targetNumber = calculateTargetNumber(character, skillName) + modifier;
  
  // 4. Roll
  const roll = rolld100();
  const baseSL = calculateSuccessLevel(roll, targetNumber);
  
  // 5. Apply talent bonuses
  const finalSL = applyTalentSLBonuses(baseSL, selectedTalents, character);
  
  // 6. Check for critical/fumble
  const { isCritical, isFumble } = checkCriticalResult(roll, targetNumber);
  
  // 7. Send result to server
  sendTestResult({
    characterName: character.name,
    testName: skillName,
    targetNumber,
    rollResult: roll,
    successLevel: finalSL,
    usedTalents: selectedTalents
  });
}
```

### GM-Side Roll Implementation

```typescript
import { getApplicableTalents, applyTalentSLBonuses } from '@shared';

function initiateGMTest(character: Character, skillName: string, modifier: number) {
  // 1. Get applicable talents (pre-selected by default)
  const applicableTalents = getApplicableTalents(character, skillName);
  
  // 2. Show UI with talents pre-checked (GM can override)
  const selectedTalents = showGMTalentModal(applicableTalents, true);
  
  // 3. Request test from player
  requestTest(character, skillName, modifier, selectedTalents);
}
```

### Character Wounds Calculation

```typescript
import { calculateEffectiveMaxWounds } from '@shared';

function updateCharacterWounds(character: Character) {
  // Automatically includes Hardy and other wound-modifying talents
  character.status.wounds.max = calculateEffectiveMaxWounds(character);
}
```

### Critical/Fumble Lookup

```typescript
import { criticalHitsData, fumblesData, checkCriticalResult } from '@shared';

function handleRollResult(roll: number, target: number, damage: number) {
  const { isCritical, isFumble } = checkCriticalResult(roll, target);
  
  if (isCritical && damage > 0) {
    const location = getHitLocation(roll);
    const critical = criticalHitsData
      .find(c => c.location === location)
      .results.find(r => damage >= r.minWounds && (r.maxWounds === null || damage <= r.maxWounds));
    
    showCriticalResult(critical);
  }
  
  if (isFumble) {
    const fumbleRoll = rolld100();
    const fumble = fumblesData.find(f => {
      const [min, max] = f.roll.split('-').map(n => parseInt(n));
      return fumbleRoll >= min && fumbleRoll <= max;
    });
    
    showFumbleResult(fumble);
  }
}
```

## UI Components Needed

### 1. Talent Selection Modal (Player)
- Show all applicable talents for the current test
- Checkboxes for each talent with rank displayed
- Clear indication of what each talent does
- Submit button to proceed with roll

### 2. Talent Selection Panel (GM - CombatResolver)
- Similar to player modal but with talents pre-selected
- GM can override selections
- Quick view of character's relevant talents
- Shows which talents were used in GameLog

### 3. Critical/Fumble Result Display
- Modal or panel showing the critical/fumble result
- Description of the effect
- Buttons to apply conditions (Bleeding, Stunned, etc.)
- Link to detailed rules if needed

## Game Log Format

When logging a test result, include talent information:

```
[10:23] Geralt rolled Melee (Basic): 45 vs 67 (Success, +2 SL)
Using Talents: Warrior Born (Rank 1), Strike to Injure (Rank 1)
Final SL: +4
```

## Talents Implemented (66 total)

**Combat:** accurate-shot, berserk-charge, beat-blade, careful-strike, combat-aware, combat-master, combat-reflexes, dual-wielder, in-fighter, menacing, reversal, riposte, strike-mighty-blow, strike-to-injure, strike-to-stun, warrior-born

**Defense:** hardy, lightning-reflexes, resilient, resistance, magic-resistance

**Ranged:** marksman, rapid-reload, sharpshooter, sure-shot

**Movement:** cat-fall, fleet-footed, nimble-fingered, scale-sheer-surface, sprint, crack-the-whip

**Social:** attractive, blather, briber, cat-tongued, commanding-presence, dealmaker, etiquette

**Knowledge:** bookish, linguistics, numismatics, read-write, savant

**Magic:** aethyric-attunement, arcane-magic, fast-hands, instinctive-diction, magical-sense, petty-magic

**Stealth:** alley-cat, beneath-notice, criminal, shadow

**Crafting:** artistic, craftsman, tinker

**Animal:** animal-affinity, animal-husbandry

**Survival:** break-and-enter, field-dressing, fisherman, hunter-gatherer, seasoned-traveler, strider

**Special:** luck, coolheaded, savvy, suave, very-resilient, very-strong, night-vision, ambidextrous, acute-sense

## Next Steps for Full Implementation

1. **Update UI Components:**
   - Create TalentSelectionModal component for player app
   - Add talent selection to GM's CombatResolver
   - Add critical/fumble display modals

2. **Update Roll Handlers:**
   - Modify player roll function to use getApplicableTalents
   - Update GM test request to include talent info
   - Integrate applyTalentSLBonuses into SL calculation

3. **Update Character Sheet:**
   - Use calculateEffectiveMaxWounds for displaying max wounds
   - Show talent-derived bonuses with tooltips

4. **Update GameLog:**
   - Format test results to show used talents
   - Add critical/fumble result entries

5. **Add More Talents:**
   - Continue adding effects to remaining talents in talents.json
   - Use the talentEffectsMapping.ts as a reference

## Testing Checklist

- [ ] Player can see applicable talents when making a skill test
- [ ] Selected talents correctly modify Success Level
- [ ] GM can override talent selections for NPC/PC tests
- [ ] Hardy correctly increases max wounds
- [ ] Combat Reflexes adds +10 per rank to initiative
- [ ] Accurate Shot adds damage to ranged attacks
- [ ] Critical hits are detected and appropriate table shown
- [ ] Fumbles are detected and appropriate result shown
- [ ] GameLog shows which talents were used
- [ ] Passive talents (e.g., Beneath Notice) documented in tooltips

## Files Modified/Created

### Created:
- `packages/shared/src/utils/talents.ts` - All talent automation utilities
- `packages/shared/src/data/critical_hits.json` - Critical hits lookup table
- `packages/shared/src/data/fumbles.json` - Fumbles lookup table
- `packages/shared/src/data/talentEffectsMapping.ts` - Reference mapping for talent effects

### Modified:
- `packages/shared/src/types/wfrp.types.ts` - Added TalentEffect interface
- `packages/shared/src/types/messaging.types.ts` - Added usedTalents to TestResultMessage
- `packages/shared/src/data/talents.json` - Added effects to 66+ talents
- `packages/shared/src/index.ts` - Exported new utilities and data

## Support

All utility functions include TypeScript documentation and can be imported from the shared package:

```typescript
import {
  getApplicableTalents,
  calculateEffectiveMaxWounds,
  applyTalentSLBonuses,
  getTalentTestBonus,
  getTalentDamageBonus,
  getTalentInitiativeBonus,
  checkCriticalResult,
  criticalHitsData,
  fumblesData
} from '@shared';
```
