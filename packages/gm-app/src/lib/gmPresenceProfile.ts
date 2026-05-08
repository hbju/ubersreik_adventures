import type { CampaignPresenceTrackPayload } from '@wfrp/shared';

/** Minimal Supabase auth user snapshot needed for GM Presence tracking. */
export interface GmAuthUserSnapshot {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}

export type PresenceClock = () => string;

/**
 * Builds the payload tracked on the campaign ephemeral channel for the GM.
 * When {@link clock} is omitted, `online_at` uses the current time (inject for tests).
 */
export function buildGmPresenceProfile(
  user: GmAuthUserSnapshot | null,
  campaignId: string | null,
  clock: PresenceClock = () => new Date().toISOString()
): CampaignPresenceTrackPayload | null {
  if (!user?.id || !campaignId) return null;

  const meta = user.user_metadata as { display_name?: string } | undefined;
  const fromMeta =
    typeof meta?.display_name === 'string' && meta.display_name.trim().length > 0
      ? meta.display_name.trim()
      : null;
  const displayName =
    fromMeta ?? (typeof user.email === 'string' && user.email.length > 0 ? user.email : null) ?? 'GM';

  return {
    userId: user.id,
    displayName,
    characterId: null,
    role: 'gm',
    online_at: clock(),
  };
}
