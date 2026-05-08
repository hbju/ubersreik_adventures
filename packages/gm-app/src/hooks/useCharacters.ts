import { useCallback, useEffect, useState } from 'react';
import {
  getCharacters,
  createCharacter as svcCreateCharacter,
  updateCharacter as svcUpdateCharacter,
  deleteCharacter as svcDeleteCharacter,
  assignCharacterToUser,
  unassignCharacter,
  characterRowToCharacter,
  characterToInsert,
  characterToUpdate,
  type Character,
} from '@wfrp/shared';
import { useAppContext } from '../context/AppContext';

export function useCharacters() {
  const { serviceContext } = useAppContext();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all characters for the current campaign
  const fetchCharacters = useCallback(async () => {
    if (!serviceContext) return;
    setIsLoading(true);
    setError(null);
    const result = await getCharacters(serviceContext.client, serviceContext.campaignId);
    if (result.error) {
      setError(result.error.message);
    } else {
      setCharacters(result.data.map(characterRowToCharacter));
    }
    setIsLoading(false);
  }, [serviceContext]);

  useEffect(() => {
    fetchCharacters();
  }, [fetchCharacters]);

  // Create a character from the app-domain Character type
  const createCharacter = useCallback(async (character: Character) => {
    if (!serviceContext) return;
    const insert = characterToInsert(character);
    const result = await svcCreateCharacter(serviceContext.client, serviceContext.campaignId, insert);
    if (!result.error && result.data) {
      setCharacters((prev) => [...prev, characterRowToCharacter(result.data)]);
    }
    console.log('Create character result:', result);
    return result;
  }, [serviceContext]);

  // Update a character with a partial app-domain Character
  const updateCharacter = useCallback(async (id: string, partial: Partial<Character>) => {
    if (!serviceContext) return;
    const update = characterToUpdate(partial);
    const result = await svcUpdateCharacter(serviceContext.client, id, update);
    if (!result.error && result.data) {
      setCharacters((prev) => prev.map((c) => (c.id === id ? characterRowToCharacter(result.data!) : c)));
    }
    return result;
  }, [serviceContext]);

  // Replace a full character in local state and persist to Supabase
  const replaceCharacter = useCallback(async (character: Character) => {
    if (!serviceContext) return;
    const update = characterToUpdate(character);
    const result = await svcUpdateCharacter(serviceContext.client, character.id, update);
    if (!result.error && result.data) {
      setCharacters((prev) => prev.map((c) => (c.id === character.id ? characterRowToCharacter(result.data!) : c)));
    }
    return result;
  }, [serviceContext]);

  const deleteCharacter = useCallback(async (id: string) => {
    if (!serviceContext) return;
    console.log('Deleting character with id:', id);
    const result = await svcDeleteCharacter(serviceContext.client, id);
    if (!result.error) {
      setCharacters((prev) => prev.filter((c) => c.id !== id));
    }
    return result;
  }, [serviceContext]);

  const assignCharacter = useCallback(async (characterId: string, userId: string) => {
    if (!serviceContext) return;
    const result = await assignCharacterToUser(serviceContext.client, characterId, userId);
    if (!result.error && result.data) {
      setCharacters((prev) => prev.map((c) => (c.id === characterId ? characterRowToCharacter(result.data!) : c)));
    }
    return result;
  }, [serviceContext]);

  const unassignCharacterAction = useCallback(async (characterId: string) => {
    if (!serviceContext) return;
    const result = await unassignCharacter(serviceContext.client, characterId);
    if (!result.error && result.data) {
      setCharacters((prev) => prev.map((c) => (c.id === characterId ? characterRowToCharacter(result.data!) : c)));
    }
    return result;
  }, [serviceContext]);

  const selectCharacter = useCallback((id: string | null) => {
    setSelectedCharacterId(id);
  }, []);

  // Update local state only (for optimistic UI without a server round-trip)
  const updateLocalCharacter = useCallback((id: string, updater: (c: Character) => Character) => {
    setCharacters((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  }, []);

  return {
    characters,
    selectedCharacterId,
    isLoading,
    error,
    fetchCharacters,
    createCharacter,
    updateCharacter,
    replaceCharacter,
    deleteCharacter,
    assignCharacter,
    unassignCharacter: unassignCharacterAction,
    selectCharacter,
    updateLocalCharacter,
  };
}
