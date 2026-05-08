import type { TypedSupabaseClient } from '../lib/supabase';
import type { CampaignPresenceTrackPayload } from '../lib/broadcast';
import { useBroadcast } from './useBroadcast';

export interface UsePresenceParams {
  supabase: TypedSupabaseClient | null;
  campaignId: string | null;
  userId?: string | null;
  presenceProfile: CampaignPresenceTrackPayload | null;
}

/**
 * Presence-only subscription on the campaign ephemeral channel (broadcast channel unused).
 * If you need ping/opposed handlers too, use {@link useBroadcast} once and pass `presenceProfile`.
 *
 * **Do not mount two `useBroadcast` / `usePresence` hooks for the same `campaignId`** — Supabase allows
 * only one subscription per channel topic; a second mount throws when registering presence after subscribe.
 */
export function usePresence(params: UsePresenceParams) {
  return useBroadcast({ ...params, handlers: {} });
}
