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

export interface Character {
  id: string;
  name: string;
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

export interface Character {
  id: string;
  name: string;
  career: string;
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
  talents: Record<string, number>;
  inventory: string[];
}

export interface GameData {
  mapImage: string;
  locations: Location[];
  characters: Character[];
}