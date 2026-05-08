import { describe, it, expect, vi } from 'vitest';
import {
  getFactions,
  createFaction,
  updateFaction,
  deleteFaction,
  getTerritories,
  setTerritory,
  getCharacterReputations,
  updateCharacterReputation,
} from '../src/services/factionService';
import { ErrorCode } from '../src/types/errors';

// --- Mock helpers ---

function createChainMock() {
  let resolveValue: { data?: unknown; error?: unknown } = { data: null, error: null };

  const mock: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(() => Promise.resolve(resolveValue)),
    _setResolve(val: { data?: unknown; error?: unknown }) { resolveValue = val; },
    then(resolve: (v: unknown) => void, reject: (v: unknown) => void) {
      return Promise.resolve(resolveValue).then(resolve, reject);
    },
  };
  return mock;
}

function makeMockClient(chain: ReturnType<typeof createChainMock>) {
  return { from: vi.fn().mockReturnValue(chain) } as any;
}

function createMockClientMultiTable() {
  const chains: Record<string, ReturnType<typeof createChainMock>> = {};
  function getChain(table: string) {
    if (!chains[table]) chains[table] = createChainMock();
    return chains[table];
  }
  const from = vi.fn((table: string) => getChain(table));
  return { client: { from } as any, getChain };
}

function createSequentialClient(responses: Array<{ data?: unknown; error?: unknown }>) {
  let callIndex = 0;
  const makeChain = (): any => {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(() => {
        const resp = responses[callIndex] ?? responses[responses.length - 1];
        callIndex++;
        return Promise.resolve(resp);
      }),
      then(resolve: (v: unknown) => void, reject: (v: unknown) => void) {
        const resp = responses[callIndex] ?? responses[responses.length - 1];
        callIndex++;
        return Promise.resolve(resp).then(resolve, reject);
      },
    };
    return chain;
  };
  return { from: vi.fn(() => makeChain()) } as any;
}

// --- Fixtures ---

const CAMPAIGN_ID = 'camp-1';

const sampleFaction = {
  id: 'f1',
  campaign_id: CAMPAIGN_ID,
  name: 'Merchants Guild',
  description: 'Rich traders',
  category: 'guild',
  color: '#gold',
  default_reputation: 0,
  head: 'Guildmaster Hans',
  hq: 'Market Square',
  icon: null,
};

const sampleTerritory = {
  id: 't1',
  campaign_id: CAMPAIGN_ID,
  location_id: 'loc-1',
  faction_id: 'f1',
  control_level: 3,
};

// --- Tests ---

describe('factionService', () => {
  describe('getFactions', () => {
    it('returns all factions for a campaign', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: [sampleFaction], error: null });
      const client = makeMockClient(chain);

      const result = await getFactions(client, CAMPAIGN_ID);

      expect(result.data).toHaveLength(1);
      expect(result.data![0].name).toBe('Merchants Guild');
      expect(result.error).toBeNull();
    });

    it('returns empty array when no factions', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: [], error: null });
      const client = makeMockClient(chain);

      const result = await getFactions(client, CAMPAIGN_ID);

      expect(result.data).toEqual([]);
    });
  });

  describe('createFaction', () => {
    it('creates faction with campaign_id', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: sampleFaction, error: null });
      const client = makeMockClient(chain);

      const result = await createFaction(client, CAMPAIGN_ID, { name: 'Merchants Guild' });

      expect(result.data).toEqual(sampleFaction);
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ campaign_id: CAMPAIGN_ID, name: 'Merchants Guild' })
      );
    });
  });

  describe('updateFaction', () => {
    it('updates faction fields', async () => {
      const updated = { ...sampleFaction, name: 'Renamed Guild' };
      const chain = createChainMock();
      chain._setResolve({ data: updated, error: null });
      const client = makeMockClient(chain);

      const result = await updateFaction(client, 'f1', { name: 'Renamed Guild' });

      expect(result.data?.name).toBe('Renamed Guild');
    });
  });

  describe('deleteFaction', () => {
    it('deletes faction successfully', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: null });
      const client = makeMockClient(chain);

      const result = await deleteFaction(client, 'f1');

      expect(result.error).toBeNull();
    });

    it('returns error on failure', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: { message: 'fk violation', code: '23503' } });
      const client = makeMockClient(chain);

      const result = await deleteFaction(client, 'f1');

      expect(result.error?.code).toBe(ErrorCode.DATABASE_ERROR);
    });
  });

  describe('getTerritories', () => {
    it('returns all territories for a campaign', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: [sampleTerritory], error: null });
      const client = makeMockClient(chain);

      const result = await getTerritories(client, CAMPAIGN_ID);

      expect(result.data).toHaveLength(1);
      expect(result.data![0].location_id).toBe('loc-1');
    });
  });

  describe('setTerritory', () => {
    it('upserts territory for a location', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: sampleTerritory, error: null });
      const client = makeMockClient(chain);

      const result = await setTerritory(client, CAMPAIGN_ID, 'loc-1', 'f1', 3);

      expect(result.data).toEqual(sampleTerritory);
      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          campaign_id: CAMPAIGN_ID,
          location_id: 'loc-1',
          faction_id: 'f1',
          control_level: 3,
        }),
        { onConflict: 'campaign_id,location_id' }
      );
    });

    it('allows null factionId to clear territory', async () => {
      const cleared = { ...sampleTerritory, faction_id: null };
      const chain = createChainMock();
      chain._setResolve({ data: cleared, error: null });
      const client = makeMockClient(chain);

      const result = await setTerritory(client, CAMPAIGN_ID, 'loc-1', null, 0);

      expect(result.data?.faction_id).toBeNull();
    });
  });

  describe('getCharacterReputations', () => {
    it('returns reputations map', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: { reputations: { f1: 5, f2: -2 } }, error: null });
      const client = makeMockClient(chain);

      const result = await getCharacterReputations(client, 'char-1');

      expect(result.data).toEqual({ f1: 5, f2: -2 });
    });

    it('returns empty object when reputations is null', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: { reputations: null }, error: null });
      const client = makeMockClient(chain);

      const result = await getCharacterReputations(client, 'char-1');

      expect(result.data).toEqual({});
    });

    it('returns NOT_FOUND when character missing', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: { message: 'not found', code: 'PGRST116' } });
      const client = makeMockClient(chain);

      const result = await getCharacterReputations(client, 'nope');

      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
    });
  });

  describe('updateCharacterReputation', () => {
    it('merges new reputation into existing', async () => {
      const client = createSequentialClient([
        // fetch current
        { data: { reputations: { f1: 5 } }, error: null },
        // update
        { data: null, error: null },
      ]);

      const result = await updateCharacterReputation(client, 'char-1', 'f2', 3);

      expect(result.data).toEqual({ f1: 5, f2: 3 });
      expect(result.error).toBeNull();
    });

    it('overwrites existing faction value', async () => {
      const client = createSequentialClient([
        { data: { reputations: { f1: 5 } }, error: null },
        { data: null, error: null },
      ]);

      const result = await updateCharacterReputation(client, 'char-1', 'f1', -1);

      expect(result.data).toEqual({ f1: -1 });
    });

    it('handles null existing reputations', async () => {
      const client = createSequentialClient([
        { data: { reputations: null }, error: null },
        { data: null, error: null },
      ]);

      const result = await updateCharacterReputation(client, 'char-1', 'f1', 10);

      expect(result.data).toEqual({ f1: 10 });
    });

    it('returns error if fetch fails', async () => {
      const client = createSequentialClient([
        { data: null, error: { message: 'not found', code: 'PGRST116' } },
      ]);

      const result = await updateCharacterReputation(client, 'nope', 'f1', 1);

      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('returns error if update fails', async () => {
      const client = createSequentialClient([
        { data: { reputations: {} }, error: null },
        { data: null, error: { message: 'rls', code: '42501' } },
      ]);

      const result = await updateCharacterReputation(client, 'char-1', 'f1', 1);

      expect(result.error?.code).toBe(ErrorCode.UNAUTHORIZED);
    });
  });
});
