/**
 * Supabase Realtime subscription hook.
 *
 * Listens for Postgres changes on campaign-scoped tables and re-fetches
 * the affected data slice. This allows the player-web app to stay in sync
 * with GM writes even when there is no live Socket.io session.
 *
 * When a live Socket.io session is connected the hook is paused so that
 * the two channels don't produce duplicate state updates.
 */
import { useEffect, useRef } from 'react';
import { supabase } from '@wfrp/shared';
import type { RealtimeChannel } from '@supabase/supabase-js';

// All re-fetch callbacks mirror the updaters exposed by useSupabaseData
export interface RealtimeSyncCallbacks {
  onCharactersChanged: () => Promise<void>;
  onJournalChanged: () => Promise<void>;
  onQuestsChanged: () => Promise<void>;
  onFactionsChanged: () => Promise<void>;
  onMapPinsChanged: () => Promise<void>;
  onTokensChanged: () => Promise<void>;
  onUserPinsChanged: () => Promise<void>;
  onShopsChanged: () => Promise<void>;
  onCombatChanged: () => Promise<void>;
  onCalendarChanged: () => Promise<void>;
  onChatChanged: () => Promise<void>;
  onCampaignChanged: () => Promise<void>;
}

/**
 * Subscribe to Supabase Realtime Postgres changes for a campaign.
 *
 * @param campaignId  - The campaign to watch
 * @param paused      - Set to `true` while a Socket.io live session is handling updates
 * @param callbacks   - Functions that re-fetch each data slice
 */
export function useRealtimeSync(
  campaignId: string | null,
  paused: boolean,
  callbacks: RealtimeSyncCallbacks,
) {
  // Keep a stable ref to callbacks so the channel doesn't need to re-subscribe
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    if (!campaignId) return;

    const sb = supabase.getSupabase();

    // Debounce helper: collapse rapid changes on the same table into one re-fetch
    const pending = new Map<string, ReturnType<typeof setTimeout>>();
    const DEBOUNCE_MS = 500;

    function debounced(key: string, fn: () => Promise<void>) {
      if (pausedRef.current) return; // Skip when live session is active
      const existing = pending.get(key);
      if (existing) clearTimeout(existing);
      pending.set(key, setTimeout(() => {
        pending.delete(key);
        fn().catch(err => console.error(`[REALTIME] Error re-fetching ${key}:`, err));
      }, DEBOUNCE_MS));
    }

    // ── Build the channel with postgres_changes listeners ────────────────

    const channel: RealtimeChannel = sb
      .channel(`campaign-${campaignId}`)

      // Characters table
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'characters', filter: `campaign_id=eq.${campaignId}` },
        () => debounced('characters', () => cbRef.current.onCharactersChanged()),
      )

      // Journal entries
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'journal_entries', filter: `campaign_id=eq.${campaignId}` },
        () => debounced('journal', () => cbRef.current.onJournalChanged()),
      )

      // Quests
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'quests', filter: `campaign_id=eq.${campaignId}` },
        () => debounced('quests', () => cbRef.current.onQuestsChanged()),
      )

      // Factions
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'factions', filter: `campaign_id=eq.${campaignId}` },
        () => debounced('factions', () => cbRef.current.onFactionsChanged()),
      )

      // Location territories
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'location_territories', filter: `campaign_id=eq.${campaignId}` },
        () => debounced('factions', () => cbRef.current.onFactionsChanged()),
      )

      // Map pin discoveries
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'map_pin_discoveries', filter: `campaign_id=eq.${campaignId}` },
        () => debounced('map_pins', () => cbRef.current.onMapPinsChanged()),
      )

      // Map tokens
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'map_tokens', filter: `campaign_id=eq.${campaignId}` },
        () => debounced('tokens', () => cbRef.current.onTokensChanged()),
      )

      // User map pins
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'user_map_pins', filter: `campaign_id=eq.${campaignId}` },
        () => debounced('user_pins', () => cbRef.current.onUserPinsChanged()),
      )

      // Shop definitions
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'shop_definitions', filter: `campaign_id=eq.${campaignId}` },
        () => debounced('shops', () => cbRef.current.onShopsChanged()),
      )

      // Combat state
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'combat_state', filter: `campaign_id=eq.${campaignId}` },
        () => debounced('combat', () => cbRef.current.onCombatChanged()),
      )

      // Combatants
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'combatants', filter: `campaign_id=eq.${campaignId}` },
        () => debounced('combat', () => cbRef.current.onCombatChanged()),
      )

      // Calendar state
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'calendar_state', filter: `campaign_id=eq.${campaignId}` },
        () => debounced('calendar', () => cbRef.current.onCalendarChanged()),
      )

      // Calendar events
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'calendar_events', filter: `campaign_id=eq.${campaignId}` },
        () => debounced('calendar', () => cbRef.current.onCalendarChanged()),
      )

      // Chat messages
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `campaign_id=eq.${campaignId}` },
        () => debounced('chat', () => cbRef.current.onChatChanged()),
      )

      // Campaign metadata (active_map_id changes etc.)
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'campaigns', filter: `id=eq.${campaignId}` },
        () => debounced('campaign', () => cbRef.current.onCampaignChanged()),
      );

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[REALTIME] Subscribed to campaign ${campaignId}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[REALTIME] Channel error — will retry automatically');
      }
    });

    return () => {
      // Cleanup: clear pending debounces and remove channel
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
      sb.removeChannel(channel);
      console.log(`[REALTIME] Unsubscribed from campaign ${campaignId}`);
    };
  }, [campaignId]);
}
