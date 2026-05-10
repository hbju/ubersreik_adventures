import { useCallback, useEffect, useRef, useState } from 'react';
import type { MapPinState } from '../../types/wfrp.types';
import type { MapToken } from '../../types/wfrp.types';
import type { UserMapPin } from '../../types/wfrp.types';
import type { ServiceContext } from '../../services/serviceContext';
import { getMaps } from '../../services/mapService';
import {
  addUserPin as svcAddUserPin,
  moveToken as svcMoveToken,
  removeUserPin as svcRemoveUserPin,
} from '../../services/mapInteractionService';
import { onMapChange, subscribeToTable } from '../../lib/realtime';

export function usePlayerMap(serviceContext: ServiceContext | null, characterId: string | null) {
  const [mapPinStates, setMapPinStates] = useState<Record<string, MapPinState>>({});
  const [tokens, setTokens] = useState<MapToken[]>([]);
  const [userPins, setUserPins] = useState<UserMapPin[]>([]);
  const [activeMapId, setActiveMapId] = useState<string>('ubersreik_city');
  const [isMapTransitioning, setIsMapTransitioning] = useState(false);
  const activeMapIdRef = useRef(activeMapId);
  activeMapIdRef.current = activeMapId;

  const refreshMaps = useCallback(async () => {
    if (!serviceContext || !serviceContext.userId) return;

    const [mapsRes, campaignRes, pinsRes, tokensRes, pinsUserRes] = await Promise.all([
      getMaps(serviceContext.client, serviceContext.campaignId),
      serviceContext.client
        .from('campaigns')
        .select('active_map_id')
        .eq('id', serviceContext.campaignId)
        .single(),
      serviceContext.client
        .from('map_pin_states')
        .select('*')
        .eq('campaign_id', serviceContext.campaignId),
      serviceContext.client
        .from('map_tokens')
        .select('*')
        .eq('campaign_id', serviceContext.campaignId),
      serviceContext.client
        .from('user_map_pins')
        .select('*')
        .eq('campaign_id', serviceContext.campaignId)
        .eq('user_id', serviceContext.userId),
    ]);

    if (mapsRes.error) return;

    const nextActive =
      (campaignRes.data?.active_map_id as string | null) ||
      mapsRes.data?.[0]?.id ||
      activeMapIdRef.current;

    if (campaignRes.data?.active_map_id) {
      setActiveMapId(campaignRes.data.active_map_id);
    }

    const pinStatesForActive: Record<string, MapPinState> = {};
    if (!pinsRes.error && pinsRes.data && characterId) {
      for (const row of pinsRes.data as {
        map_id: string;
        location_id: string;
        player_discovered: string[];
      }[]) {
        if (row.map_id !== nextActive) continue;
        if (row.player_discovered?.includes(characterId)) {
          pinStatesForActive[row.location_id] = { playerDiscovered: [characterId] };
        }
      }
    }
    setMapPinStates(pinStatesForActive);

    if (!tokensRes.error && tokensRes.data) {
      setTokens(
        (
          tokensRes.data as {
            id: string;
            character_id: string;
            map_id: string;
            x: number;
            y: number;
          }[]
        ).map((t) => ({
          id: t.id,
          characterId: t.character_id,
          mapId: t.map_id,
          x: t.x,
          y: t.y,
        }))
      );
    }

    if (!pinsUserRes.error && pinsUserRes.data) {
      setUserPins(
        (
          pinsUserRes.data as {
            id: string;
            user_id: string;
            character_id: string | null;
            map_id: string;
            x: number;
            y: number;
            label: string | null;
            color: string | null;
          }[]
        ).map((p) => ({
          id: p.id,
          playerId: p.user_id,
          characterId: p.character_id ?? '',
          mapId: p.map_id,
          x: p.x,
          y: p.y,
          label: p.label ?? '',
          color: p.color ?? undefined,
        }))
      );
    }
  }, [serviceContext, characterId]);

  useEffect(() => {
    void refreshMaps();
  }, [refreshMaps]);

  useEffect(() => {
    if (!serviceContext) return undefined;

    const shared = {
      supabase: serviceContext.client,
      campaignId: serviceContext.campaignId,
    };

    const unsubs: Array<() => void> = [
      onMapChange(shared, () => {
        void refreshMaps();
      }),
      subscribeToTable({
        supabase: serviceContext.client,
        table: 'map_pin_states',
        filter: `campaign_id=eq.${serviceContext.campaignId}`,
        callback: () => {
          void refreshMaps();
        },
      }),
      subscribeToTable({
        supabase: serviceContext.client,
        table: 'map_tokens',
        filter: `campaign_id=eq.${serviceContext.campaignId}`,
        callback: () => {
          void refreshMaps();
        },
      }),
      subscribeToTable({
        supabase: serviceContext.client,
        table: 'user_map_pins',
        filter: `campaign_id=eq.${serviceContext.campaignId}`,
        callback: () => {
          void refreshMaps();
        },
      }),
      subscribeToTable({
        supabase: serviceContext.client,
        table: 'campaigns',
        filter: `id=eq.${serviceContext.campaignId}`,
        callback: () => {
          void refreshMaps();
        },
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, [serviceContext, refreshMaps]);

  const moveMyToken = useCallback(
    async (tokenId: string, x: number, y: number) => {
      if (!serviceContext) return;
      await svcMoveToken(serviceContext.client, tokenId, x, y);
      await refreshMaps();
    },
    [serviceContext, refreshMaps]
  );

  const addPin = useCallback(
    async (input: { mapId: string; x: number; y: number; label?: string; color?: string }) => {
      if (!serviceContext) return;
      await svcAddUserPin(
        serviceContext.client,
        serviceContext.campaignId,
        input.mapId,
        serviceContext.userId,
        input.x,
        input.y,
        input.label ?? null,
        input.color ?? null
      );
      await refreshMaps();
    },
    [serviceContext, refreshMaps]
  );

  const removePin = useCallback(
    async (pinId: string) => {
      if (!serviceContext) return;
      await svcRemoveUserPin(serviceContext.client, pinId);
      await refreshMaps();
    },
    [serviceContext, refreshMaps]
  );

  return {
    mapPinStates,
    tokens,
    userPins,
    activeMapId,
    setActiveMapId,
    isMapTransitioning,
    setIsMapTransitioning,
    refreshMaps,
    moveMyToken,
    addPin,
    removePin,
  };
}
