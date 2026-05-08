import React, { createContext, useContext } from 'react';
import { useCharacters } from '../hooks/useCharacters';
import type { Character } from '@wfrp/shared';

interface CharacterContextValue {
  characters: Character[];
  selectedCharacterId: string | null;
  isLoading: boolean;
  error: string | null;
  fetchCharacters: () => void;
  createCharacter: (character: Character) => Promise<any>;
  updateCharacter: (id: string, partial: Partial<Character>) => Promise<any>;
  replaceCharacter: (character: Character) => Promise<any>;
  deleteCharacter: (id: string) => Promise<any>;
  assignCharacter: (characterId: string, userId: string) => Promise<any>;
  unassignCharacter: (characterId: string) => Promise<any>;
  selectCharacter: (id: string | null) => void;
  updateLocalCharacter: (id: string, updater: (c: Character) => Character) => void;
}

const CharacterContext = createContext<CharacterContextValue | null>(null);

export function useCharacterContext(): CharacterContextValue {
  const ctx = useContext(CharacterContext);
  if (!ctx) throw new Error('useCharacterContext must be used within CharacterProvider');
  return ctx;
}

export function CharacterProvider({ children }: { children: React.ReactNode }) {
  const value = useCharacters();
  return <CharacterContext.Provider value={value}>{children}</CharacterContext.Provider>;
}
