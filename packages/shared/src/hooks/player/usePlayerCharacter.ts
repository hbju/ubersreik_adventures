import { useCallback, useEffect, useState } from 'react';
import type { Character } from '../../types/wfrp.types';
import type { ServiceContext } from '../../services/serviceContext';
import type { Database } from '../../types/database.types';
import { getCharacters, updateCharacter as svcUpdateCharacter } from '../../services/characterService';
import { characterRowToCharacter, characterToUpdate } from '../../utils/characterConverter';
import { onCharacterChange } from '../../lib/realtime';

type CharacterRow = Database['public']['Tables']['characters']['Row'];

export function usePlayerCharacter(serviceContext: ServiceContext | null) {
  const [character, setCharacter] = useState<Character | null>(null);

  const refreshCharacter = useCallback(async () => {
    if (!serviceContext) {
      setCharacter(null);
      return;
    }
    const res = await getCharacters(serviceContext.client, serviceContext.campaignId, {
      userId: serviceContext.userId,
    });
    if (res.error || !res.data?.[0]) {
      setCharacter(null);
      return;
    }
    setCharacter(characterRowToCharacter(res.data[0]));
  }, [serviceContext]);

  useEffect(() => {
    void refreshCharacter();
  }, [refreshCharacter]);

  useEffect(() => {
    if (!serviceContext) return undefined;

    return onCharacterChange(
      {
        supabase: serviceContext.client,
        campaignId: serviceContext.campaignId,
      },
      (payload) => {
        const row = (payload.new ?? payload.old) as CharacterRow | undefined;
        if (!row) return;
        if (row.user_id !== serviceContext.userId) return;
        void refreshCharacter();
      }
    );
  }, [serviceContext, refreshCharacter]);

  const updateCharacter = useCallback(
    async (partial: Partial<Character>) => {
      if (!serviceContext || !character) return;
      const patch = characterToUpdate(partial);
      const res = await svcUpdateCharacter(serviceContext.client, character.id, patch as never);
      if (!res.error && res.data) {
        setCharacter(characterRowToCharacter(res.data));
      }
    },
    [serviceContext, character]
  );

  return {
    character,
    setCharacter,
    refreshCharacter,
    updateCharacter,
  };
}
