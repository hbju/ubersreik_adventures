import { useEffect, useRef, useState } from 'react';
import type { ServiceContext } from '../services/serviceContext';
import {
  onCalendarChange,
  onCharacterChange,
  onCombatChange,
  onFactionChange,
  onJournalChange,
  onMapChange,
  onQuestChange,
  onShopChange,
  subscribeToTable,
  type RealtimeConnectionState,
} from '../lib/realtime';

type RefreshCallback = () => void | Promise<void>;

export interface RealtimeSyncCallbacks {
  characters?: RefreshCallback;
  quests?: RefreshCallback;
  journal?: RefreshCallback;
  factions?: RefreshCallback;
  maps?: RefreshCallback;
  shops?: RefreshCallback;
  combat?: RefreshCallback;
  calendar?: RefreshCallback;
  chat?: RefreshCallback;
}

interface UseRealtimeSyncParams {
  serviceContext: ServiceContext | null;
  callbacks: RealtimeSyncCallbacks;
}

const COALESCE_MS = 120;

export function useRealtimeSync({ serviceContext, callbacks }: UseRealtimeSyncParams) {
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>('DISCONNECTED');
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});

  useEffect(() => {
    if (!serviceContext) {
      setConnectionState('DISCONNECTED');
      return undefined;
    }

    const trigger = (key: keyof RealtimeSyncCallbacks) => {
      const cb = callbacks[key];
      if (!cb) return;

      const timerKey = String(key);
      const existing = timersRef.current[timerKey];
      if (existing) clearTimeout(existing);

      timersRef.current[timerKey] = setTimeout(() => {
        timersRef.current[timerKey] = null;
        void cb();
      }, COALESCE_MS);
    };

    const shared = {
      supabase: serviceContext.client,
      campaignId: serviceContext.campaignId,
      onConnectionStateChange: setConnectionState,
    };

    const unsubscribers: Array<() => void> = [
      onCharacterChange(shared, () => trigger('characters')),
      onQuestChange(shared, () => trigger('quests')),
      onJournalChange(shared, () => trigger('journal')),
      onFactionChange(shared, () => trigger('factions')),
      onMapChange(shared, () => trigger('maps')),
      onShopChange(shared, () => trigger('shops')),
      onCombatChange(shared, () => trigger('combat')),
      onCalendarChange(shared, () => trigger('calendar')),
      // Additional map domain tables
      subscribeToTable({
        supabase: serviceContext.client,
        table: 'map_pin_states',
        filter: `campaign_id=eq.${serviceContext.campaignId}`,
        callback: () => trigger('maps'),
        onConnectionStateChange: setConnectionState,
      }),
      subscribeToTable({
        supabase: serviceContext.client,
        table: 'map_tokens',
        filter: `campaign_id=eq.${serviceContext.campaignId}`,
        callback: () => trigger('maps'),
        onConnectionStateChange: setConnectionState,
      }),
      subscribeToTable({
        supabase: serviceContext.client,
        table: 'user_map_pins',
        filter: `campaign_id=eq.${serviceContext.campaignId}`,
        callback: () => trigger('maps'),
        onConnectionStateChange: setConnectionState,
      }),
      // Territories are faction-domain but separate table
      subscribeToTable({
        supabase: serviceContext.client,
        table: 'location_territories',
        filter: `campaign_id=eq.${serviceContext.campaignId}`,
        callback: () => trigger('factions'),
        onConnectionStateChange: setConnectionState,
      }),
      subscribeToTable({
        supabase: serviceContext.client,
        table: 'campaigns',
        filter: `id=eq.${serviceContext.campaignId}`,
        callback: () => trigger('maps'),
        onConnectionStateChange: setConnectionState,
      }),
      subscribeToTable({
        supabase: serviceContext.client,
        table: 'chat_messages',
        filter: `campaign_id=eq.${serviceContext.campaignId}`,
        callback: () => trigger('chat'),
        onConnectionStateChange: setConnectionState,
      }),
    ];

    return () => {
      Object.values(timersRef.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
      timersRef.current = {};
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [
    callbacks.calendar,
    callbacks.chat,
    callbacks.characters,
    callbacks.combat,
    callbacks.factions,
    callbacks.journal,
    callbacks.maps,
    callbacks.quests,
    callbacks.shops,
    serviceContext,
  ]);

  return {
    connectionState,
  };
}
