export interface Coordinates {
  x: number;
  y: number;
}

export interface Location {
  id: string;
  name: string;
  coords: Coordinates;
  playerDescription: string;
  gmNotes: string;
  image: string;
  music: string;
  hooks: string[]; 
  tag: string;
}

export interface ConditionInstance {
  id: string; // condition_blinded, etc.
  roundApplied: number; // combat round when this was applied
}

export interface Combatant {
  id: string; 
  sourceId: string; 
  name: string;
  initiative: number | null;
  currentWounds: number;
  maxWounds: number;
  baseInitiative: number; 
  baseAg: number;
  isPlayer: boolean;
  conditions: string[]; 
  conditionInstances?: ConditionInstance[];
}

export interface Advantages {
  playerAdvantage: number;
  enemyAdvantage: number;
}

export interface Condition {
  id: string;
  name: string;
  description: string;
  stack: number; // current number of stacks
}

export interface XP {
  current: number;
  spent: number;
}

export interface Characteristic {
  initial: number;
  advances: number;
  talents: number;
  modifier: number;
}

export interface Status {
  current: number;
  max: number;
}

export interface Skill {
  id: string;
  name: string;
  characteristic: string;
  advances: number;
  talents: number;
  modifier: number;
}

export interface SkillCharDefinition {
  id: string;
  name: string;
  characteristic: keyof Character['characteristics'];
  type: 'skill' | 'characteristic';
  classification?: 'basic' | 'advanced';
}

export interface Talent {
  id: string,
  name: string,
  description: string,
  tests: string[],
  max_ranks: number | string | keyof Character['characteristics'],
  careers?: Record<string, string | undefined>,
  racial?: string[],
  effects?: TalentEffect[]
}

export interface TalentEffect {
  type:
    'SL_BONUS_ON_SUCCESS' |
    'WOUNDS_BONUS' |
    'ENCUMBRANCE_BONUS' |
    'TEST_BONUS' |
    'DAMAGE_BONUS' |
    'INITIATIVE_BONUS' |
    'PASSIVE' |
    'REVERSE_ROLL_ON_FAIL' |
    'SL_DICES_UNITS' |
    'OPPONENT_ADVANTAGE_MODIFIER' |
    'CONDITIONAL' |
    'ATTRIBUTE_BONUS' |
    'CHARACTERISTIC_BONUS' |
    'FEAR_RATING' |
    'BLEEDING_CONDITION_IGNORE';
  value: number | string; // number for fixed values, string for formulas like "TB" (Toughness Bonus)
  appliesTo?: string[]; // skill names, characteristic names, or descriptors like "ranged", "melee"
  condition?: string; // optional condition for when the effect applies
}

interface BaseItem {
  id: string;
  name: string;
  price: string; // Keep as string for display (e.g., "1 GC", "10 S")
  enc: number;
  availability: 'Common' | 'Scarce' | 'Rare' | 'Exotic' | 'Unique';
}

export interface Armor extends BaseItem {
  type: 'Soft Leather' | 'Boiled Leather' | 'Mail' | 'Plate';
  penalty: string;
  locations: string[];
  ap: number;
  qualities: string[];
}

export interface Weapon extends BaseItem {
  group: string;
  reach: string;
  damage: string;
  qualities: string[];
}

export interface Item extends BaseItem {}

export interface Currency {
  gc: number; // Gold Crowns
  ss: number; // Silver Shillings
  bp: number; // Brass Pennies
}

export interface User {
  id: string;
  username: string;
  passwordHash: string; 
  characterId: string | null;
  createdAt: string;
}

// Career System Types
export interface CareerLevel {
  id: string;
  name: string;
  lvl: number;
  characteristic_advances: string[];
  talent_ids: string[];
  skills_ids: string[];
  trappings: string[];
  status: string;
}

export interface Career {
  id: string;
  name: string;
  description: string;
  class: string;
  races: string[];
  career_level: CareerLevel[];
}

export interface CareerHistoryEntry {
  careerId: string;
  careerLevelId: string;
  careerName: string;
  levelName: string;
  level: number;
  xpSpent: number;
  advancementType: 'characteristic' | 'skill' | 'talent';
  advancementId: string; // characteristic key, skill id, or talent id
  advancementName: string;
  timestamp: string;
}

export interface Character {
  id: string;
  name: string;
  currentCareerId: string;
  currentCareerLevelId: string;
  userId: string | null; // null if unassigned
  xp: XP;
  careerHistory: CareerHistoryEntry[]; // full history of all XP spent
  unlockedCharacteristicIds: string[]; // GM-granted unlocks
  unlockedSkillIds: string[]; // GM-granted unlocks
  unlockedTalentIds: string[]; // GM-granted unlocks
  characteristics: {
    ws: Characteristic;
    bs: Characteristic;
    s: Characteristic;
    t: Characteristic;
    i: Characteristic;
    ag: Characteristic;
    dex: Characteristic;
    int: Characteristic;
    wp: Characteristic;
    fel: Characteristic;
  };
  skills: Skill[];
  status: {
    wounds: Status;
    fate: Status;
    fortune: Status;
    resilience: Status;
    resolve: Status;
    corruption: Status;
  };
  conditions: Condition[]; 
  talents: Record<string, number>;
  inventory: {
    weapons: Record<string, number>;
    armor: Record<string, number>;
    items: Record<string, number>;
  };
  currency: Currency;
}

export interface GameData {
  mapImage: string;
  locations: Location[];
}

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  imageData?: string; // Base64 encoded image data (data:image/...;base64,...)
  sharedWith: ('all' | string)[]; // Array of character IDs or 'all'
}

export interface MapPinState {
  playerDiscovered: string[]; // Array of character IDs who have discovered this location
}

export interface CampaignState {
  characters: Character[];
  users: User[]; 
  journal: JournalEntry[];
  mapPinStates: Record<string, MapPinState>; // locationId -> MapPinState
  version: string;
  lastModified: string;
}