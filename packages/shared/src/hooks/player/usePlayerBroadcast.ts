import type { CampaignPresenceTrackPayload } from '../../lib/broadcast';
import type { UseBroadcastParams } from '../useBroadcast';
import { useBroadcast } from '../useBroadcast';
import type { ServiceContext } from '../../services/serviceContext';

export type PlayerBroadcastParams = Omit<UseBroadcastParams, 'supabase' | 'campaignId' | 'userId'> & {
  serviceContext: ServiceContext | null;
};

/**
 * Player-facing campaign ephemeral channel: same as {@link useBroadcast}, wired from {@link ServiceContext}.
 */
export function usePlayerBroadcast({
  serviceContext,
  presenceProfile,
  handlers,
}: PlayerBroadcastParams) {
  return useBroadcast({
    supabase: serviceContext?.client ?? null,
    campaignId: serviceContext?.campaignId ?? null,
    userId: serviceContext?.userId,
    presenceProfile: presenceProfile as CampaignPresenceTrackPayload | null | undefined,
    handlers,
  });
}
