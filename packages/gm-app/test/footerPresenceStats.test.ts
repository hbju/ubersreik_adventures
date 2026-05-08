import { describe, it, expect } from 'vitest';
import {
  footerConnectionActive,
  playersOnlineDisplayCount,
} from '../src/lib/footerPresenceStats';

describe('playersOnlineDisplayCount', () => {
  it('uses legacy socket count when Presence channel is disconnected', () => {
    expect(
      playersOnlineDisplayCount({
        presenceChannelConnected: false,
        presenceOnlinePlayerCount: 3,
        legacySocketClientCount: 2,
      }),
    ).toBe(2);
  });

  it('takes the higher of Presence players and legacy sockets when connected', () => {
    expect(
      playersOnlineDisplayCount({
        presenceChannelConnected: true,
        presenceOnlinePlayerCount: 1,
        legacySocketClientCount: 4,
      }),
    ).toBe(4);

    expect(
      playersOnlineDisplayCount({
        presenceChannelConnected: true,
        presenceOnlinePlayerCount: 5,
        legacySocketClientCount: 2,
      }),
    ).toBe(5);
  });
});

describe('footerConnectionActive', () => {
  it('is true when legacy sockets exist even if Presence is down', () => {
    expect(
      footerConnectionActive({
        presenceChannelConnected: false,
        presenceOnlinePlayerCount: 0,
        legacySocketClientCount: 1,
      }),
    ).toBe(true);
  });

  it('is true when Presence is connected even with zero legacy sockets', () => {
    expect(
      footerConnectionActive({
        presenceChannelConnected: true,
        presenceOnlinePlayerCount: 0,
        legacySocketClientCount: 0,
      }),
    ).toBe(true);
  });

  it('is false when neither channel reports connectivity', () => {
    expect(
      footerConnectionActive({
        presenceChannelConnected: false,
        presenceOnlinePlayerCount: 2,
        legacySocketClientCount: 0,
      }),
    ).toBe(false);
  });
});
