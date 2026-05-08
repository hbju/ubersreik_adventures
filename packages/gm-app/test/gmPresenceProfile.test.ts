import { describe, it, expect } from 'vitest';
import { buildGmPresenceProfile } from '../src/lib/gmPresenceProfile';

describe('buildGmPresenceProfile', () => {
  const fixedClock = () => '2026-05-08T12:00:00.000Z';

  it('returns null without user id', () => {
    expect(buildGmPresenceProfile(null, 'camp-1', fixedClock)).toBeNull();
    expect(
      buildGmPresenceProfile({ id: '', email: 'a@b.c' }, 'camp-1', fixedClock),
    ).toBeNull();
  });

  it('returns null without campaign id', () => {
    expect(
      buildGmPresenceProfile({ id: 'user-1', email: 'gm@test' }, null, fixedClock),
    ).toBeNull();
    expect(
      buildGmPresenceProfile({ id: 'user-1', email: 'gm@test' }, '', fixedClock),
    ).toBeNull();
  });

  it('prefers trimmed display_name from user_metadata over email', () => {
    const profile = buildGmPresenceProfile(
      {
        id: 'auth-1',
        email: 'hidden@example.com',
        user_metadata: { display_name: '  Ishmael  ' },
      },
      'camp-uuid',
      fixedClock,
    );
    expect(profile).toEqual({
      userId: 'auth-1',
      displayName: 'Ishmael',
      characterId: null,
      role: 'gm',
      online_at: fixedClock(),
    });
  });

  it('falls back to email then GM label', () => {
    expect(
      buildGmPresenceProfile({ id: 'u1', email: 'only@mail.dev' }, 'c1', fixedClock)?.displayName,
    ).toBe('only@mail.dev');

    expect(
      buildGmPresenceProfile({ id: 'u2', email: '' }, 'c1', fixedClock)?.displayName,
    ).toBe('GM');

    expect(
      buildGmPresenceProfile({ id: 'u3', email: null }, 'c1', fixedClock)?.displayName,
    ).toBe('GM');
  });

  it('ignores blank display_name strings', () => {
    expect(
      buildGmPresenceProfile(
        {
          id: 'u',
          email: 'e@e.e',
          user_metadata: { display_name: '   ' },
        },
        'c',
        fixedClock,
      )?.displayName,
    ).toBe('e@e.e');
  });
});
