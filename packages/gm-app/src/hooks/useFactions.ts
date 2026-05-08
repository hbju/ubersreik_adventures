import { useCallback, useEffect, useState } from 'react';
import type { Character, Faction, LocationTerritory, ReputationEntry } from '@wfrp/shared';
import {
  getFactions as svcGetFactions,
  createFaction as svcCreateFaction,
  updateFaction as svcUpdateFaction,
  deleteFaction as svcDeleteFaction,
  getTerritories as svcGetTerritories,
  setTerritory as svcSetTerritory,
  updateCharacter as svcUpdateCharacter,
  characterToUpdate,
  type FactionRow,
} from '@wfrp/shared';
import { useAppContext } from '../context/AppContext';

function rowToFaction(row: FactionRow): Faction {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    category: (row.category ?? 'other') as Faction['category'],
    icon: row.icon ?? '',
    hq: row.hq ?? '',
    head: row.head ?? '',
    defaultReputation: row.default_reputation ?? 0,
    color: row.color ?? undefined,
  };
}

function factionToCreate(faction: Faction) {
  return {
    id: faction.id,
    name: faction.name,
    description: faction.description,
    category: faction.category,
    icon: faction.icon || null,
    hq: faction.hq || null,
    head: faction.head || null,
    default_reputation: faction.defaultReputation,
    color: faction.color || null,
  };
}

function factionToUpdate(faction: Faction) {
  return {
    name: faction.name,
    description: faction.description,
    category: faction.category,
    icon: faction.icon || null,
    hq: faction.hq || null,
    head: faction.head || null,
    default_reputation: faction.defaultReputation,
    color: faction.color || null,
  };
}

export function useFactions() {
  const { serviceContext } = useAppContext();
  const [factions, setFactions] = useState<Faction[]>([]);
  const [locationTerritories, setLocationTerritories] = useState<Record<string, LocationTerritory>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFactions = useCallback(async () => {
    if (!serviceContext) return;
    setIsLoading(true);
    setError(null);

    const [factionsResult, territoriesResult] = await Promise.all([
      svcGetFactions(serviceContext.client, serviceContext.campaignId),
      svcGetTerritories(serviceContext.client, serviceContext.campaignId),
    ]);

    if (factionsResult.error) {
      setError(factionsResult.error.message);
      setIsLoading(false);
      return;
    }
    if (territoriesResult.error) {
      setError(territoriesResult.error.message);
      setIsLoading(false);
      return;
    }

    setFactions(factionsResult.data.map(rowToFaction));
    const territoryMap: Record<string, LocationTerritory> = {};
    territoriesResult.data.forEach((row) => {
      if (!row.faction_id) return;
      territoryMap[row.location_id] = {
        controllingFactionId: row.faction_id,
        influenceWeight: row.control_level ?? 1,
      };
    });
    setLocationTerritories(territoryMap);
    setIsLoading(false);
  }, [serviceContext]);

  useEffect(() => {
    fetchFactions();
  }, [fetchFactions]);

  const createFaction = useCallback(async (faction: Faction) => {
    if (!serviceContext) return;
    const result = await svcCreateFaction(serviceContext.client, serviceContext.campaignId, factionToCreate(faction));
    if (!result.error && result.data) {
      setFactions((prev) => [...prev, rowToFaction(result.data)]);
      setError(null);
    } else if (result?.error) {
      setError(result.error.message);
    }
    return result;
  }, [serviceContext]);

  const updateFaction = useCallback(async (faction: Faction) => {
    if (!serviceContext) return;
    const result = await svcUpdateFaction(serviceContext.client, faction.id, factionToUpdate(faction));
    if (!result.error && result.data) {
      const updated = rowToFaction(result.data);
      setFactions((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      setError(null);
    } else if (result?.error) {
      setError(result.error.message);
    }
    return result;
  }, [serviceContext]);

  const deleteFaction = useCallback(async (factionId: string) => {
    if (!serviceContext) return;
    const result = await svcDeleteFaction(serviceContext.client, factionId);
    if (!result.error) {
      setFactions((prev) => prev.filter((f) => f.id !== factionId));
      setError(null);
    } else if (result?.error) {
      setError(result.error.message);
    }
    return result;
  }, [serviceContext]);

  const setTerritory = useCallback(async (locationId: string, territory: LocationTerritory | null) => {
    if (!serviceContext) return;
    const factionId = territory?.controllingFactionId ?? null;
    const controlLevel = territory?.influenceWeight ?? 1;
    const result = await svcSetTerritory(
      serviceContext.client,
      serviceContext.campaignId,
      locationId,
      factionId,
      controlLevel
    );

    if (!result.error) {
      setLocationTerritories((prev) => {
        if (!territory) {
          const updated = { ...prev };
          delete updated[locationId];
          return updated;
        }
        return { ...prev, [locationId]: territory };
      });
      setError(null);
    } else if (result?.error) {
      setError(result.error.message);
    }
    return result;
  }, [serviceContext]);

  const updateCharacterReputations = useCallback(async (
    character: Character,
    reputations: ReputationEntry[]
  ) => {
    if (!serviceContext) return;
    const result = await svcUpdateCharacter(
      serviceContext.client,
      character.id,
      characterToUpdate({ reputations })
    );
    if (result.error) {
      setError(result.error.message);
    } else {
      setError(null);
    }
    return result;
  }, [serviceContext]);

  return {
    factions,
    locationTerritories,
    isLoading,
    error,
    fetchFactions,
    createFaction,
    updateFaction,
    deleteFaction,
    setTerritory,
    updateCharacterReputations,
  };
}
