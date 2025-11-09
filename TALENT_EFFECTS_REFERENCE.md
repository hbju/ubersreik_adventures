# Talent Effect Types - Quick Reference

## Effect Types

### SL_BONUS_ON_SUCCESS
Adds bonus Success Levels to successful tests.
- **Value:** Number of SL to add per rank
- **Applied:** Only when base SL >= 0 (successful test)
- **Examples:** Combat Aware, Strike to Injure, Marksman, Lightning Reflexes

```json
{
  "type": "SL_BONUS_ON_SUCCESS",
  "value": 1,
  "appliesTo": ["Perception"],
  "condition": "during melee"
}
```

### WOUNDS_BONUS
Adds to maximum wounds.
- **Value:** Number or formula (e.g., "TB" for Toughness Bonus)
- **Applied:** To character's max wounds
- **Examples:** Hardy

```json
{
  "type": "WOUNDS_BONUS",
  "value": "TB"
}
```

### TEST_BONUS
Adds bonus to the test target number.
- **Value:** Flat bonus (typically +10)
- **Applied:** Before rolling
- **Examples:** Acute Sense

```json
{
  "type": "TEST_BONUS",
  "value": 10,
  "appliesTo": ["Perception"]
}
```

### DAMAGE_BONUS
Adds bonus damage.
- **Value:** Damage to add per rank
- **Applied:** When calculating damage
- **Examples:** Accurate Shot (ranged), Strike Mighty Blow (melee)

```json
{
  "type": "DAMAGE_BONUS",
  "value": 1,
  "appliesTo": ["ranged"]
}
```

### INITIATIVE_BONUS
Adds bonus to initiative.
- **Value:** Initiative to add per rank (typically +10)
- **Applied:** When determining combat initiative
- **Examples:** Combat Reflexes

```json
{
  "type": "INITIATIVE_BONUS",
  "value": 10
}
```

### PASSIVE
Describes a passive effect that requires special handling.
- **Value:** Description string
- **Applied:** Special logic needed in code
- **Examples:** Ambidextrous, Beat Blade, Beneath Notice

```json
{
  "type": "PASSIVE",
  "value": "Reduce off-hand penalty",
  "appliesTo": ["secondary hand"]
}
```

### CONDITIONAL
Effect that depends on specific conditions.
- **Value:** Number or description
- **Condition:** String describing when effect applies
- **Applied:** Only when condition is met
- **Examples:** Sharpshooter (when aiming), Attractive (target attracted)

```json
{
  "type": "SL_BONUS_ON_SUCCESS",
  "value": 1,
  "appliesTo": ["Ranged"],
  "condition": "aiming"
}
```

## Common appliesTo Values

### Combat Skills
- `"Melee"` - Any melee skill
- `"Melee (Basic)"` - Specific melee specialization
- `"Ranged"` - Any ranged attack
- `"Dodge"` - Dodge skill

### Test Categories
- `"Perception"` - Perception tests
- `"Endurance"` - Endurance tests
- `"Athletics"` - Athletics tests
- `"Stealth"` - Stealth tests
- `"Charm"` - Charm tests
- `"Intimidate"` - Intimidate tests
- `"Leadership"` - Leadership tests

### Attack Types
- `"melee"` - All melee attacks
- `"ranged"` - All ranged attacks
- `"inanimate objects"` - Breaking objects

### Magic
- `"Channelling"` - Channelling tests
- `"magic"` - All magic-related actions

### Special
- `"all"` - Applies to everything
- `"combat"` - General combat situations

## Value Formulas

### Characteristic Bonus
- `"TB"` - Toughness Bonus (T / 10)
- `"SB"` - Strength Bonus (S / 10)
- `"IB"` - Intelligence Bonus (Int / 10)
- `"WPB"` - Willpower Bonus (WP / 10)

Example:
```json
{
  "type": "WOUNDS_BONUS",
  "value": "TB"  // Adds Toughness Bonus * rank to max wounds
}
```

## Adding New Talent Effects

1. **Identify the mechanical effect** from the talent description
2. **Choose the appropriate effect type**
3. **Define the value** (number or formula)
4. **Specify appliesTo** array (if applicable)
5. **Add condition** (if the effect is situational)

### Example Process

Talent: "Mighty Aim"
Description: "You add +1 SL to Ranged tests when aiming."

```json
{
  "id": "mighty-aim",
  "effects": [
    {
      "type": "SL_BONUS_ON_SUCCESS",
      "value": 1,
      "appliesTo": ["Ranged"],
      "condition": "aiming"
    }
  ]
}
```

## Utility Function Usage

### Get Applicable Talents
```typescript
const talents = getApplicableTalents(character, "Melee (Basic)");
// Returns talents with appliesTo: ["Melee"] or ["Melee (Basic)"]
```

### Calculate Bonuses
```typescript
// SL Bonuses
const finalSL = applyTalentSLBonuses(baseSL, usedTalents);

// Test Bonuses
const testBonus = getTalentTestBonus(character, "Perception");

// Damage Bonuses
const damageBonus = getTalentDamageBonus(character, "ranged");

// Initiative Bonuses
const initBonus = getTalentInitiativeBonus(character);

// Wounds
const maxWounds = calculateEffectiveMaxWounds(character);
```

## Effect Processing Priority

1. **Before Test:** TEST_BONUS effects added to target number
2. **During Test:** Roll d100
3. **After Roll:** Calculate base SL
4. **If Successful:** Apply SL_BONUS_ON_SUCCESS
5. **If Attack:** Add DAMAGE_BONUS
6. **Initiative:** Add INITIATIVE_BONUS
7. **Passive:** Applied continuously or as needed

## Common Patterns

### "+X SL" talents
```json
{ "type": "SL_BONUS_ON_SUCCESS", "value": 1, "appliesTo": ["Skill"] }
```

### "+X Damage" talents
```json
{ "type": "DAMAGE_BONUS", "value": 1, "appliesTo": ["melee"] }
```

### "+10 to tests" talents
```json
{ "type": "TEST_BONUS", "value": 10, "appliesTo": ["Skill"] }
```

### "Per characteristic bonus" talents
```json
{ "type": "WOUNDS_BONUS", "value": "TB" }
```

### Conditional talents
```json
{
  "type": "SL_BONUS_ON_SUCCESS",
  "value": 1,
  "appliesTo": ["Charm"],
  "condition": "target attracted"
}
```

### Complex passive talents
```json
{
  "type": "PASSIVE",
  "value": "Description of special effect",
  "appliesTo": ["relevant skills"]
}
```

## Notes

- **Multiple effects:** A talent can have multiple effects
- **Stacking:** Effects from the same talent stack with ranks
- **Different talents:** Effects from different talents stack
- **Same talent twice:** If allowed by max_ranks
- **Conditions:** Require manual checking in UI (for now)
- **Passive talents:** Need special implementation in game logic

## See Also

- `PBI1_IMPLEMENTATION_GUIDE.md` - Full implementation guide
- `packages/shared/src/utils/talents.ts` - Utility functions
- `packages/shared/src/data/talentEffectsMapping.ts` - Complete mapping
