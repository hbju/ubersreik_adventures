# UI Implementation Examples for Talent Automation

## 1. Player Skill Test Modal with Talent Selection

### Component Structure
```
┌─────────────────────────────────────────┐
│  Skill Test: Melee (Basic)              │
├─────────────────────────────────────────┤
│  Target Number: 67                       │
│  Modifier: +10 (Charging)                │
│  Final Target: 77                        │
├─────────────────────────────────────────┤
│  Select Talents to Use:                  │
│                                          │
│  ☑ Warrior Born (Rank 1)                │
│    +1 SL on success                     │
│                                          │
│  ☑ Strike to Injure (Rank 2)            │
│    +2 SL on success                     │
│                                          │
│  ☐ Strike Mighty Blow (Rank 1)          │
│    +1 Damage (not applicable to SL)     │
│                                          │
│  ☐ Combat Reflexes (Rank 2)             │
│    +20 Initiative (passive)             │
├─────────────────────────────────────────┤
│  Expected Bonuses: +3 SL on success     │
│                                          │
│  [Cancel]              [Roll Test]      │
└─────────────────────────────────────────┘
```

### React Component Example
```tsx
import { getApplicableTalents, applyTalentSLBonuses } from '@shared';

function SkillTestModal({ character, skillName, modifier, onResult, onCancel }) {
  const [selectedTalents, setSelectedTalents] = useState([]);
  const applicableTalents = getApplicableTalents(character, skillName);
  
  // Pre-select SL bonus talents by default
  useEffect(() => {
    const autoSelect = applicableTalents
      .filter(t => t.talent.effects?.some(e => e.type === 'SL_BONUS_ON_SUCCESS'))
      .map(t => ({ name: t.talent.name, rank: t.rank }));
    setSelectedTalents(autoSelect);
  }, [applicableTalents]);
  
  const handleRoll = () => {
    const targetNumber = calculateTarget(character, skillName) + modifier;
    const roll = rolld100();
    const baseSL = calculateSuccessLevel(roll, targetNumber);
    const finalSL = applyTalentSLBonuses(baseSL, selectedTalents, character);
    
    onResult({ roll, targetNumber, baseSL, finalSL, usedTalents: selectedTalents });
  };
  
  return (
    <div className="talent-test-modal">
      <h2>Skill Test: {skillName}</h2>
      
      <div className="test-info">
        <div>Target Number: {calculateTarget(character, skillName)}</div>
        <div>Modifier: {modifier > 0 ? '+' : ''}{modifier}</div>
        <div>Final Target: {calculateTarget(character, skillName) + modifier}</div>
      </div>
      
      <div className="talent-selection">
        <h3>Select Talents to Use:</h3>
        {applicableTalents.map(({ talent, rank }) => (
          <TalentCheckbox
            key={talent.id}
            talent={talent}
            rank={rank}
            checked={selectedTalents.some(t => t.name === talent.name)}
            onChange={(checked) => toggleTalent(talent, rank, checked)}
          />
        ))}
      </div>
      
      <div className="expected-bonus">
        Expected Bonuses: +{calculateExpectedBonus(selectedTalents)} SL on success
      </div>
      
      <div className="modal-actions">
        <button onClick={onCancel}>Cancel</button>
        <button onClick={handleRoll} className="primary">Roll Test</button>
      </div>
    </div>
  );
}
```

## 2. GM Combat Resolver Talent Panel

### Component Structure
```
┌─────────────────────────────────────────────────────────────┐
│ Combat Test: Geralt vs Goblin                               │
├─────────────────────────────────────────────────────────────┤
│ Attacker: Geralt (Melee (Basic): 67)                        │
│                                                              │
│ Active Talents (pre-selected):                              │
│ ☑ Warrior Born (Rank 1) - +1 SL                            │
│ ☑ Strike to Injure (Rank 2) - +2 SL                        │
│ ☐ Strike Mighty Blow (Rank 1) - +1 Damage                  │
│                                                              │
│ [Override Selections]  [Request Player Roll]                │
├─────────────────────────────────────────────────────────────┤
│ Defender: Goblin (Dodge: 35)                                │
│ No applicable talents                                        │
└─────────────────────────────────────────────────────────────┘
```

### React Component Example
```tsx
function GMCombatTestPanel({ attacker, defender }) {
  const attackerTalents = getApplicableTalents(attacker, "Melee (Basic)");
  const [selectedTalents, setSelectedTalents] = useState(
    // Pre-select all applicable talents by default
    attackerTalents.map(t => ({ name: t.talent.name, rank: t.rank }))
  );
  
  const requestPlayerRoll = () => {
    // Send request to player with pre-selected talents
    socket.emit('REQUEST_TEST', {
      characterId: attacker.id,
      skillName: "Melee (Basic)",
      modifier: 0,
      suggestedTalents: selectedTalents
    });
  };
  
  return (
    <div className="gm-combat-panel">
      <h3>Combat Test: {attacker.name} vs {defender.name}</h3>
      
      <div className="attacker-section">
        <h4>Attacker: {attacker.name}</h4>
        <div className="talent-list">
          {attackerTalents.map(({ talent, rank }) => (
            <TalentToggle
              key={talent.id}
              talent={talent}
              rank={rank}
              selected={selectedTalents.some(t => t.name === talent.name)}
              onToggle={(selected) => handleTalentToggle(talent, rank, selected)}
            />
          ))}
        </div>
        <button onClick={requestPlayerRoll}>Request Player Roll</button>
      </div>
      
      <div className="defender-section">
        <h4>Defender: {defender.name}</h4>
        {/* Similar talent selection for defender */}
      </div>
    </div>
  );
}
```

## 3. Game Log Entry with Talents

### Display Format
```
┌─────────────────────────────────────────────────────────────┐
│ [10:23:45] Geralt rolled Melee (Basic)                      │
│            Roll: 45 vs Target: 67                            │
│            Base Result: Success (+2 SL)                      │
│            Talents Used:                                     │
│              • Warrior Born (Rank 1): +1 SL                 │
│              • Strike to Injure (Rank 2): +2 SL            │
│            Final Result: Success (+5 SL)                     │
│            Critical Hit! (Roll was 44)                       │
└─────────────────────────────────────────────────────────────┘
```

### Component Example
```tsx
function GameLogEntry({ entry }) {
  const { characterName, testName, roll, target, baseSL, finalSL, usedTalents, isCritical } = entry;
  
  return (
    <div className={`log-entry ${isCritical ? 'critical' : ''}`}>
      <div className="log-header">
        [{entry.timestamp}] {characterName} rolled {testName}
      </div>
      <div className="log-details">
        <div>Roll: {roll} vs Target: {target}</div>
        <div>Base Result: {formatSL(baseSL)}</div>
        {usedTalents && usedTalents.length > 0 && (
          <div className="talents-used">
            Talents Used:
            <ul>
              {usedTalents.map(t => (
                <li key={t.name}>
                  {t.name} (Rank {t.rank}): +{t.rank} SL
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="final-result">
          Final Result: {formatSL(finalSL)}
        </div>
        {isCritical && <div className="critical-badge">Critical Hit!</div>}
      </div>
    </div>
  );
}
```

## 4. Critical Hit Display Modal

### Component Structure
```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️  CRITICAL HIT!                                            │
├─────────────────────────────────────────────────────────────┤
│ Location: Head                                               │
│ Wounds Dealt: 7                                              │
├─────────────────────────────────────────────────────────────┤
│ Result: Cracked Skull                                        │
│                                                              │
│ You suffer a Fractured Skull and gain 2 Bleeding            │
│ Conditions.                                                  │
├─────────────────────────────────────────────────────────────┤
│ Effects to Apply:                                            │
│ ☑ Fractured Skull (Critical Wound)                          │
│ ☑ Bleeding 2                                                 │
│                                                              │
│ [Cancel]  [Apply Effects]  [View Full Rules]               │
└─────────────────────────────────────────────────────────────┘
```

### Component Example
```tsx
import { criticalHitsData } from '@shared';

function CriticalHitModal({ location, wounds, targetCharacter, onClose }) {
  const locationData = criticalHitsData.find(c => c.location === location);
  const result = locationData.results.find(r => 
    wounds >= r.minWounds && (r.maxWounds === null || wounds <= r.maxWounds)
  );
  
  const applyEffects = () => {
    // Parse the effect and apply to character
    const effects = parseCriticalEffect(result.effect);
    effects.forEach(effect => applyEffectToCharacter(targetCharacter, effect));
    onClose();
  };
  
  return (
    <div className="critical-hit-modal">
      <h2>⚠️ CRITICAL HIT!</h2>
      
      <div className="critical-info">
        <div>Location: {location}</div>
        <div>Wounds Dealt: {wounds}</div>
      </div>
      
      <div className="critical-result">
        <h3>{result.description.split(':')[0]}</h3>
        <p>{result.description.split(':')[1]}</p>
      </div>
      
      <div className="effects-to-apply">
        <h4>Effects to Apply:</h4>
        <EffectsList effects={parseCriticalEffect(result.effect)} />
      </div>
      
      <div className="modal-actions">
        <button onClick={onClose}>Cancel</button>
        <button onClick={applyEffects} className="primary">Apply Effects</button>
        <button onClick={() => showRules(result)}>View Full Rules</button>
      </div>
    </div>
  );
}
```

## 5. Fumble Result Display

### Component Structure
```
┌─────────────────────────────────────────────────────────────┐
│ 💥 FUMBLE!                                                   │
├─────────────────────────────────────────────────────────────┤
│ Roll: 98 (Fumble Range: 96-00)                              │
│                                                              │
│ Result: Catastrophe!                                         │
│                                                              │
│ Roll 1d10 and consult the appropriate Critical Table,       │
│ or gain 3 Bleeding Conditions if there is no appropriate    │
│ table.                                                       │
├─────────────────────────────────────────────────────────────┤
│ [Roll d10 for Critical]  [Apply 3 Bleeding]  [Close]       │
└─────────────────────────────────────────────────────────────┘
```

### Component Example
```tsx
import { fumblesData } from '@shared';

function FumbleModal({ fumbleRoll, character, onClose }) {
  const fumble = fumblesData.find(f => {
    const [min, max] = f.roll.split('-').map(n => parseInt(n));
    return fumbleRoll >= min && fumbleRoll <= max;
  });
  
  const handleEffect = () => {
    if (fumble.effect === 'roll_critical_or_bleeding_3') {
      // Special handling for catastrophe
      showCriticalRollDialog();
    } else {
      applyFumbleEffect(character, fumble.effect, fumble.duration);
    }
    onClose();
  };
  
  return (
    <div className="fumble-modal">
      <h2>💥 FUMBLE!</h2>
      
      <div className="fumble-info">
        <div>Roll: {fumbleRoll}</div>
        <div>Result: {fumble.description.split(':')[0]}</div>
      </div>
      
      <div className="fumble-description">
        <p>{fumble.description}</p>
      </div>
      
      <div className="fumble-duration">
        Duration: {formatDuration(fumble.duration)}
      </div>
      
      <div className="modal-actions">
        <button onClick={handleEffect} className="primary">
          Apply Effect
        </button>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
```

## 6. Character Sheet - Talent-Modified Stats Display

### Component Structure
```
┌─────────────────────────────────────────────────────────────┐
│ Wounds: 14 / 16 💭                                           │
│         ↑                                                    │
│         Base: 12, Hardy (Rank 2): +4 (TB×2)                 │
├─────────────────────────────────────────────────────────────┤
│ Initiative: 45 💭                                            │
│             ↑                                                │
│             Base: 25, Combat Reflexes (Rank 2): +20         │
└─────────────────────────────────────────────────────────────┘
```

### Component Example
```tsx
import { calculateEffectiveMaxWounds, getTalentInitiativeBonus } from '@shared';

function CharacterStatsDisplay({ character }) {
  const maxWounds = calculateEffectiveMaxWounds(character);
  const baseWounds = character.status.wounds.max;
  const woundTalents = getWoundModifyingTalents(character);
  
  const initBonus = getTalentInitiativeBonus(character);
  const baseInit = calculateBaseInitiative(character);
  
  return (
    <div className="character-stats">
      <div className="stat-display">
        <label>Wounds:</label>
        <span>{character.status.wounds.current} / {maxWounds}</span>
        <Tooltip content={
          <>
            Base: {baseWounds}
            {woundTalents.map(t => (
              <div key={t.name}>{t.name} (Rank {t.rank}): +{t.bonus}</div>
            ))}
          </>
        } />
      </div>
      
      <div className="stat-display">
        <label>Initiative:</label>
        <span>{baseInit + initBonus}</span>
        {initBonus > 0 && (
          <Tooltip content={
            <>
              Base: {baseInit}
              <div>Combat Reflexes: +{initBonus}</div>
            </>
          } />
        )}
      </div>
    </div>
  );
}
```

## 7. Talent Info Tooltip

### Component Structure
```
┌─────────────────────────────────────────────────────────────┐
│ Warrior Born (Rank 1)                                        │
├─────────────────────────────────────────────────────────────┤
│ You gain a permanent +5 bonus to your starting Weapon       │
│ Skill Characteristic (doesn't count as Advances).           │
├─────────────────────────────────────────────────────────────┤
│ Effects:                                                     │
│ • +1 SL to Melee tests on success                          │
│                                                              │
│ This talent applies to: Melee (Any)                         │
└─────────────────────────────────────────────────────────────┘
```

### Component Example
```tsx
function TalentTooltip({ talent, rank }) {
  return (
    <div className="talent-tooltip">
      <h4>{talent.name} (Rank {rank})</h4>
      <p className="description">{talent.description}</p>
      
      {talent.effects && talent.effects.length > 0 && (
        <div className="effects">
          <h5>Effects:</h5>
          <ul>
            {talent.effects.map((effect, i) => (
              <li key={i}>{formatTalentEffect(effect, rank)}</li>
            ))}
          </ul>
          
          {talent.effects[0].appliesTo && (
            <div className="applies-to">
              This talent applies to: {talent.effects[0].appliesTo.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatTalentEffect(effect: TalentEffect, rank: number): string {
  switch (effect.type) {
    case 'SL_BONUS_ON_SUCCESS':
      return `+${effect.value * rank} SL on success`;
    case 'DAMAGE_BONUS':
      return `+${effect.value * rank} Damage`;
    case 'TEST_BONUS':
      return `+${effect.value * rank} to tests`;
    case 'INITIATIVE_BONUS':
      return `+${effect.value * rank} Initiative`;
    case 'WOUNDS_BONUS':
      return typeof effect.value === 'number' 
        ? `+${effect.value * rank} Wounds`
        : `+${effect.value} × ${rank} Wounds`;
    case 'PASSIVE':
      return effect.value;
    default:
      return 'Special effect';
  }
}
```

## Styling Recommendations

### CSS Classes
```css
.talent-test-modal {
  background: var(--modal-bg);
  border: 2px solid var(--primary-color);
  border-radius: 8px;
  padding: 20px;
  max-width: 500px;
}

.talent-checkbox {
  display: flex;
  align-items: center;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  margin: 4px 0;
  transition: background 0.2s;
}

.talent-checkbox:hover {
  background: var(--hover-bg);
}

.talent-checkbox.selected {
  background: var(--selected-bg);
  border-color: var(--primary-color);
}

.talent-effect-description {
  font-size: 0.9em;
  color: var(--text-secondary);
  margin-left: 24px;
}

.critical-hit-modal {
  background: linear-gradient(135deg, #8B0000, #DC143C);
  color: white;
  border: 3px solid gold;
  animation: pulse 1s infinite;
}

.fumble-modal {
  background: linear-gradient(135deg, #2F4F4F, #696969);
  color: white;
  border: 3px solid #FF6347;
}

.log-entry.critical {
  background: rgba(220, 20, 60, 0.1);
  border-left: 4px solid #DC143C;
}

.talents-used {
  background: rgba(0, 123, 255, 0.1);
  padding: 8px;
  border-radius: 4px;
  margin: 4px 0;
}

.expected-bonus {
  font-weight: bold;
  color: var(--success-color);
  margin: 12px 0;
}
```

## Accessibility Considerations

1. **Keyboard Navigation:** All talent checkboxes should be keyboard accessible
2. **Screen Readers:** Use proper ARIA labels for talent selections
3. **Color Contrast:** Ensure critical/fumble colors have sufficient contrast
4. **Focus Indicators:** Clear focus indicators for all interactive elements
5. **Tooltips:** Keyboard-accessible tooltips with escape to close

## Mobile Considerations

1. **Responsive Layout:** Stack talent selections vertically on mobile
2. **Touch Targets:** Minimum 44x44px touch targets for checkboxes
3. **Scroll Areas:** Ensure talent lists are scrollable if long
4. **Modal Sizing:** Full-screen modals on mobile devices
5. **Gesture Support:** Swipe to dismiss modals

## Performance Considerations

1. **Memoization:** Memoize `getApplicableTalents` results
2. **Debouncing:** Debounce talent selection changes
3. **Lazy Loading:** Load talent descriptions only when tooltip opens
4. **Virtual Scrolling:** For characters with many talents
5. **Caching:** Cache calculated bonuses until character changes
