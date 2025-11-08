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
}

export interface Talent {
  id: string,
  name: string,
  description: string, 
  tests: keyof Character['characteristics'][] | Skill[] | null,
  max_ranks: number | keyof Character['characteristics']
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

export interface Character {
  id: string;
  name: string;
  career: string;
  xp: XP;
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
    weapons: string[];
    armor: string[];
    items: string[];
  };
  currency: Currency;
}

export interface GameData {
  mapImage: string;
  locations: Location[];
  characters: Character[];
}

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  sharedWith: ('all' | string)[]; // Array of character IDs or 'all'
}

export interface MapPinState {
  playerDiscovered: string[]; // Array of character IDs who have discovered this location
}

export interface CampaignState {
  characters: Character[];
  journal: JournalEntry[];
  mapPinStates: Record<string, MapPinState>; // locationId -> MapPinState
  version: string;
  lastModified: string;
}