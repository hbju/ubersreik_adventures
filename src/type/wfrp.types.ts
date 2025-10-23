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

export interface GameData {
  mapImage: string;
  locations: Location[];
  //characters: Character[]; 
}