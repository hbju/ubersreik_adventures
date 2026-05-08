import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Character, MapData, MapPinState, MapToken, UserMapPin } from '@wfrp/shared';
import {
  getMaps,
  setActiveMap,
  updatePinState as svcUpdatePinState,
  createToken as svcCreateToken,
  moveToken as svcMoveToken,
  removeToken as svcRemoveToken,
  addUserPin as svcAddUserPin,
  removeUserPin as svcRemoveUserPin,
  getMapWithDetails,
  type MapRow,
} from '@wfrp/shared';
import { useAppContext } from '../context/AppContext';

type PinStatesByMap = Record<string, Record<string, MapPinState>>;

function rowToMapData(row: MapRow): MapData {
  const locations = Array.isArray(row.locations) ? (row.locations as MapData['locations']) : [];
  const spawnPoint = row.spawn_point && typeof row.spawn_point === 'object'
    ? row.spawn_point as { x: number; y: number }
    : undefined;
  return {
    id: row.id,
    name: row.name,
    imagePath: row.image_path,
    mapImage: row.image_path,
    gridSize: row.grid_size ?? 1,
    spawnPoint,
    locations,
  };
}

export function useMap() {
  const { serviceContext, currentCampaignId } = useAppContext();
  const [maps, setMaps] = useState<MapData[]>([]);
  const [activeMapId, setActiveMapId] = useState<string>('');
  const [pinStatesByMap, setPinStatesByMap] = useState<PinStatesByMap>({});
  const [tokens, setTokens] = useState<MapToken[]>([]);
  const [userPins, setUserPins] = useState<UserMapPin[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hydrateMapDetails = useCallback(async (mapId: string) => {
    if (!serviceContext) return;
    const result = await getMapWithDetails(serviceContext.client, mapId);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    const details = result.data;
    const states: Record<string, MapPinState> = {};
    details.pin_states.forEach((state) => {
      states[state.location_id] = { playerDiscovered: state.player_discovered ?? [] };
    });

    setPinStatesByMap((prev) => ({ ...prev, [mapId]: states }));

    const detailTokens: MapToken[] = details.tokens.map((t) => ({
      id: t.id,
      characterId: t.character_id,
      mapId: t.map_id,
      x: t.x,
      y: t.y,
    }));

    const detailPins: UserMapPin[] = details.user_pins.map((p) => ({
      id: p.id,
      playerId: p.user_id,
      characterId: p.character_id,
      mapId: p.map_id,
      x: p.x,
      y: p.y,
      label: p.label ?? '',
      color: p.color ?? undefined,
    }));

    setTokens((prev) => {
      const withoutMap = prev.filter((t) => t.mapId !== mapId);
      return [...withoutMap, ...detailTokens];
    });
    setUserPins((prev) => {
      const withoutMap = prev.filter((p) => p.mapId !== mapId);
      return [...withoutMap, ...detailPins];
    });
  }, [serviceContext]);

  const fetchMaps = useCallback(async () => {
    if (!serviceContext) return;
    setIsLoading(true);
    setError(null);
    const [mapsResult, campaignResult] = await Promise.all([
      getMaps(serviceContext.client, serviceContext.campaignId),
      serviceContext.client
        .from('campaigns')
        .select('active_map_id')
        .eq('id', serviceContext.campaignId)
        .single(),
    ]);
    if (mapsResult.error) {
      setError(mapsResult.error.message);
      setIsLoading(false);
      return;
    }

    const nextMaps = mapsResult.data.map(rowToMapData);
    setMaps(nextMaps);

    const campaignActiveMapId = campaignResult.data?.active_map_id ?? '';
    const defaultMapId = campaignActiveMapId || activeMapId || nextMaps[0]?.id || '';
    if (defaultMapId) {
      setActiveMapId(defaultMapId);
      await hydrateMapDetails(defaultMapId);
    }
    setIsLoading(false);
  }, [serviceContext, activeMapId, hydrateMapDetails]);

  useEffect(() => {
    fetchMaps();
  }, [fetchMaps]);

  const switchMap = useCallback(async (mapId: string, _moveTokens = false) => {
    if (!serviceContext) return;
    const result = await setActiveMap(serviceContext.client, serviceContext.campaignId, mapId);
    if (result.error) {
      setError(result.error.message);
      return result;
    }
    setActiveMapId(mapId);
    await hydrateMapDetails(mapId);
    setError(null);
    return result;
  }, [serviceContext, hydrateMapDetails]);

  const updatePinState = useCallback(async (locationId: string, characterIds: string[]) => {
    if (!serviceContext || !activeMapId) return;
    const current = pinStatesByMap[activeMapId]?.[locationId] ?? { playerDiscovered: [] };
    const nextDiscovered = [...current.playerDiscovered];
    characterIds.forEach((characterId) => {
      const idx = nextDiscovered.indexOf(characterId);
      if (idx >= 0) nextDiscovered.splice(idx, 1);
      else nextDiscovered.push(characterId);
    });

    // Optimistic update for snappy context-menu UX
    setPinStatesByMap((prev) => ({
      ...prev,
      [activeMapId]: {
        ...(prev[activeMapId] ?? {}),
        [locationId]: { playerDiscovered: nextDiscovered },
      },
    }));

    const result = await svcUpdatePinState(
      serviceContext.client,
      serviceContext.campaignId,
      activeMapId,
      locationId,
      nextDiscovered
    );
    if (result.error) {
      setError(result.error.message);
      // Roll back optimistic pin discovery update.
      setPinStatesByMap((prev) => ({
        ...prev,
        [activeMapId]: {
          ...(prev[activeMapId] ?? {}),
          [locationId]: current,
        },
      }));
      return result;
    }
    setError(null);
    return result;
  }, [serviceContext, activeMapId, pinStatesByMap]);

  const addToken = useCallback(async (character: Character, x: number, y: number) => {
    if (!serviceContext || !activeMapId) return;
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimisticToken: MapToken = {
      id: tempId,
      characterId: character.id,
      characterName: character.name,
      mapId: activeMapId,
      x,
      y,
    };
    setTokens((prev) => [...prev, optimisticToken]);

    const result = await svcCreateToken(
      serviceContext.client,
      serviceContext.campaignId,
      activeMapId,
      character.id,
      x,
      y
    );
    if (result.error) {
      setError(result.error.message);
      // Roll back optimistic token creation.
      setTokens((prev) => prev.filter((t) => t.id !== tempId));
      return result;
    }

    setTokens((prev) =>
      prev.map((t) => t.id === tempId
        ? {
        id: result.data.id,
        characterId: result.data.character_id,
        characterName: character.name,
        mapId: result.data.map_id,
        x: result.data.x,
        y: result.data.y,
      }
        : t)
    );
    setError(null);
    return result;
  }, [serviceContext, activeMapId]);

  const moveToken = useCallback(async (tokenId: string, x: number, y: number) => {
    if (!serviceContext) return;
    const previousToken = tokens.find((t) => t.id === tokenId);
    if (!previousToken) return;
    // Optimistic drag/move update.
    setTokens((prev) => prev.map((t) => (t.id === tokenId ? { ...t, x, y } : t)));

    const result = await svcMoveToken(serviceContext.client, tokenId, x, y);
    if (result.error) {
      setError(result.error.message);
      // Roll back token position.
      setTokens((prev) => prev.map((t) => (t.id === tokenId ? previousToken : t)));
      return result;
    }
    setError(null);
    return result;
  }, [serviceContext, tokens]);

  const removeToken = useCallback(async (tokenId: string) => {
    if (!serviceContext) return;
    const previousToken = tokens.find((t) => t.id === tokenId);
    if (!previousToken) return;
    // Optimistic remove.
    setTokens((prev) => prev.filter((t) => t.id !== tokenId));

    const result = await svcRemoveToken(serviceContext.client, tokenId);
    if (result.error) {
      setError(result.error.message);
      // Roll back token deletion.
      setTokens((prev) => [...prev, previousToken]);
      return result;
    }
    setError(null);
    return result;
  }, [serviceContext, tokens]);

  const addUserPin = useCallback(async (
    userId: string,
    characterId: string,
    x: number,
    y: number,
    label: string,
    color?: string
  ) => {
    if (!serviceContext || !activeMapId) return;
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimisticPin: UserMapPin = {
      id: tempId,
      playerId: userId,
      characterId,
      mapId: activeMapId,
      x,
      y,
      label,
      color,
    };
    setUserPins((prev) => [...prev, optimisticPin]);

    const result = await svcAddUserPin(
      serviceContext.client,
      serviceContext.campaignId,
      activeMapId,
      userId,
      x,
      y,
      label,
      color
    );
    if (result.error) {
      setError(result.error.message);
      // Roll back optimistic user pin add.
      setUserPins((prev) => prev.filter((p) => p.id !== tempId));
      return result;
    }
    setUserPins((prev) => prev.map((p) => p.id === tempId
      ? {
        id: result.data.id,
        playerId: result.data.user_id,
        characterId: result.data.character_id,
        mapId: result.data.map_id,
        x: result.data.x,
        y: result.data.y,
        label: result.data.label ?? '',
        color: result.data.color ?? undefined,
      }
      : p));
    setError(null);
    return result;
  }, [serviceContext, activeMapId]);

  const removeUserPin = useCallback(async (pinId: string) => {
    if (!serviceContext) return;
    const previousPin = userPins.find((p) => p.id === pinId);
    if (!previousPin) return;
    // Optimistic remove.
    setUserPins((prev) => prev.filter((p) => p.id !== pinId));

    const result = await svcRemoveUserPin(serviceContext.client, pinId);
    if (result.error) {
      setError(result.error.message);
      // Roll back failed remove.
      setUserPins((prev) => [...prev, previousPin]);
      return result;
    }
    setError(null);
    return result;
  }, [serviceContext, userPins]);

  const activeMap = useMemo(
    () => maps.find((m) => m.id === activeMapId) ?? null,
    [maps, activeMapId]
  );
  const pinStates = useMemo(
    () => (activeMapId ? pinStatesByMap[activeMapId] ?? {} : {}),
    [pinStatesByMap, activeMapId]
  );
  const activeTokens = useMemo(
    () => tokens.filter((t) => t.mapId === activeMapId),
    [tokens, activeMapId]
  );
  const activeUserPins = useMemo(
    () => userPins.filter((p) => p.mapId === activeMapId),
    [userPins, activeMapId]
  );

  return {
    maps,
    activeMap,
    activeMapId,
    pinStates,
    tokens,
    activeTokens,
    userPins,
    activeUserPins,
    isLoading,
    error,
    campaignId: currentCampaignId,
    fetchMaps,
    switchMap,
    updatePinState,
    moveToken,
    addToken,
    removeToken,
    addUserPin,
    removeUserPin,
  };
}
