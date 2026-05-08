export interface FooterPresenceInputs {
  presenceChannelConnected: boolean;
  presenceOnlinePlayerCount: number;
  legacySocketClientCount: number;
}

/**
 * Players-online figure shown in the GM footer: when Realtime is up, surface at least as many
 * clients as legacy Socket.io reports during migration (whichever is higher).
 */
export function playersOnlineDisplayCount(input: FooterPresenceInputs): number {
  const { presenceChannelConnected, presenceOnlinePlayerCount, legacySocketClientCount } = input;
  return presenceChannelConnected
    ? Math.max(presenceOnlinePlayerCount, legacySocketClientCount)
    : legacySocketClientCount;
}

/** Green status dot when either Presence channel or legacy sockets show activity. */
export function footerConnectionActive(input: FooterPresenceInputs): boolean {
  const { presenceChannelConnected, legacySocketClientCount } = input;
  return presenceChannelConnected || legacySocketClientCount > 0;
}
