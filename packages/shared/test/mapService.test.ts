import { describe, it, expect, vi } from 'vitest';
import {
  getMaps,
  getMapWithDetails,
  createMap,
  updateMap,
  deleteMap,
  setActiveMap,
} from '../src/services/mapService';
import { ErrorCode } from '../src/types/errors';

// --- Mock helpers ---

function createChainMock() {
  let resolveValue: { data?: unknown; error?: unknown } = { data: null, error: null };
  const mock: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
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
  return { client: { from: vi.fn((t: string) => getChain(t)) } as any, getChain };
}

// --- Fixtures ---

const CAMPAIGN_ID = 'camp-1';
const sampleMap = {
  id: 'map-1',
  campaign_id: CAMPAIGN_ID,
  name: 'Ubersreik',
  image_path: '/maps/ubersreik.png',
  locations: [],
  grid_size: null,
  spawn_point: null,
};

// --- Tests ---

describe('mapService', () => {
  describe('getMaps', () => {
    it('returns all maps for a campaign', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: [sampleMap], error: null });
      const client = makeMockClient(chain);

      const result = await getMaps(client, CAMPAIGN_ID);

      expect(result.data).toHaveLength(1);
      expect(result.data![0].name).toBe('Ubersreik');
      expect(result.error).toBeNull();
    });

    it('returns empty array when no maps', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: [], error: null });
      const client = makeMockClient(chain);

      const result = await getMaps(client, CAMPAIGN_ID);

      expect(result.data).toEqual([]);
    });

    it('returns error on failure', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: { message: 'fail', code: '42000' } });
      const client = makeMockClient(chain);

      const result = await getMaps(client, CAMPAIGN_ID);

      expect(result.error?.code).toBe(ErrorCode.DATABASE_ERROR);
    });
  });

  describe('getMapWithDetails', () => {
    it('returns map with pin_states, tokens, and user_pins', async () => {
      const pinStates = [{ id: 'ps1', map_id: 'map-1', location_id: 'loc-1', player_discovered: ['u1'] }];
      const tokens = [{ id: 'tk1', map_id: 'map-1', character_id: 'c1', x: 10, y: 20 }];
      const userPins = [{ id: 'up1', map_id: 'map-1', user_id: 'u1', x: 5, y: 5, label: 'Camp' }];

      const { client, getChain } = createMockClientMultiTable();
      getChain('maps')._setResolve({ data: sampleMap, error: null });
      getChain('map_pin_states')._setResolve({ data: pinStates, error: null });
      getChain('map_tokens')._setResolve({ data: tokens, error: null });
      getChain('user_map_pins')._setResolve({ data: userPins, error: null });

      const result = await getMapWithDetails(client, 'map-1');

      expect(result.data?.id).toBe('map-1');
      expect(result.data?.pin_states).toHaveLength(1);
      expect(result.data?.tokens).toHaveLength(1);
      expect(result.data?.user_pins).toHaveLength(1);
    });

    it('returns NOT_FOUND when map does not exist', async () => {
      const { client, getChain } = createMockClientMultiTable();
      getChain('maps')._setResolve({ data: null, error: { message: 'not found', code: 'PGRST116' } });

      const result = await getMapWithDetails(client, 'nope');

      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('returns error if a related query fails', async () => {
      const { client, getChain } = createMockClientMultiTable();
      getChain('maps')._setResolve({ data: sampleMap, error: null });
      getChain('map_pin_states')._setResolve({ data: null, error: { message: 'fail', code: '42000' } });
      getChain('map_tokens')._setResolve({ data: [], error: null });
      getChain('user_map_pins')._setResolve({ data: [], error: null });

      const result = await getMapWithDetails(client, 'map-1');

      expect(result.error?.code).toBe(ErrorCode.DATABASE_ERROR);
    });
  });

  describe('createMap', () => {
    it('creates map with campaign_id', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: sampleMap, error: null });
      const client = makeMockClient(chain);

      const result = await createMap(client, CAMPAIGN_ID, {
        name: 'Ubersreik',
        image_path: '/maps/ubersreik.png',
      });

      expect(result.data).toEqual(sampleMap);
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ campaign_id: CAMPAIGN_ID, name: 'Ubersreik' })
      );
    });
  });

  describe('updateMap', () => {
    it('updates map fields', async () => {
      const updated = { ...sampleMap, name: 'Renamed Map' };
      const chain = createChainMock();
      chain._setResolve({ data: updated, error: null });
      const client = makeMockClient(chain);

      const result = await updateMap(client, 'map-1', { name: 'Renamed Map' });

      expect(result.data?.name).toBe('Renamed Map');
    });
  });

  describe('deleteMap', () => {
    it('deletes map successfully', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: null });
      const client = makeMockClient(chain);

      const result = await deleteMap(client, 'map-1');

      expect(result.error).toBeNull();
    });
  });

  describe('setActiveMap', () => {
    it('updates campaigns.active_map_id', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: null });
      const client = makeMockClient(chain);

      const result = await setActiveMap(client, CAMPAIGN_ID, 'map-1');

      expect(result.error).toBeNull();
      expect(client.from).toHaveBeenCalledWith('campaigns');
      expect(chain.update).toHaveBeenCalledWith({ active_map_id: 'map-1' });
    });

    it('allows null to clear active map', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: null });
      const client = makeMockClient(chain);

      const result = await setActiveMap(client, CAMPAIGN_ID, null);

      expect(result.error).toBeNull();
      expect(chain.update).toHaveBeenCalledWith({ active_map_id: null });
    });

    it('returns error on failure', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: { message: 'rls', code: '42501' } });
      const client = makeMockClient(chain);

      const result = await setActiveMap(client, CAMPAIGN_ID, 'map-1');

      expect(result.error?.code).toBe(ErrorCode.UNAUTHORIZED);
    });
  });
});
