import { describe, it, expect, vi } from 'vitest';
import {
  updatePinState,
  createToken,
  moveToken,
  removeToken,
  getUserPins,
  addUserPin,
  removeUserPin,
} from '../src/services/mapInteractionService';
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

// --- Fixtures ---

const CAMPAIGN_ID = 'camp-1';
const MAP_ID = 'map-1';

// --- Tests ---

describe('mapInteractionService', () => {
  describe('updatePinState', () => {
    it('upserts pin state with conflict key', async () => {
      const pinState = { id: 'ps1', campaign_id: CAMPAIGN_ID, map_id: MAP_ID, location_id: 'loc-1', player_discovered: ['u1', 'u2'] };
      const chain = createChainMock();
      chain._setResolve({ data: pinState, error: null });
      const client = makeMockClient(chain);

      const result = await updatePinState(client, CAMPAIGN_ID, MAP_ID, 'loc-1', ['u1', 'u2']);

      expect(result.data).toEqual(pinState);
      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          campaign_id: CAMPAIGN_ID,
          map_id: MAP_ID,
          location_id: 'loc-1',
          player_discovered: ['u1', 'u2'],
        }),
        { onConflict: 'campaign_id,map_id,location_id' }
      );
    });

    it('returns error on failure', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: { message: 'fail', code: '42000' } });
      const client = makeMockClient(chain);

      const result = await updatePinState(client, CAMPAIGN_ID, MAP_ID, 'loc-1', []);

      expect(result.error?.code).toBe(ErrorCode.DATABASE_ERROR);
    });
  });

  describe('createToken', () => {
    it('creates a token on the map', async () => {
      const token = { id: 'tk1', campaign_id: CAMPAIGN_ID, map_id: MAP_ID, character_id: 'c1', x: 100, y: 200, visible: true };
      const chain = createChainMock();
      chain._setResolve({ data: token, error: null });
      const client = makeMockClient(chain);

      const result = await createToken(client, CAMPAIGN_ID, MAP_ID, 'c1', 100, 200);

      expect(result.data).toEqual(token);
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ character_id: 'c1', x: 100, y: 200 })
      );
    });
  });

  describe('moveToken', () => {
    it('updates token position', async () => {
      const moved = { id: 'tk1', x: 50, y: 75 };
      const chain = createChainMock();
      chain._setResolve({ data: moved, error: null });
      const client = makeMockClient(chain);

      const result = await moveToken(client, 'tk1', 50, 75);

      expect(result.data?.x).toBe(50);
      expect(result.data?.y).toBe(75);
      expect(chain.update).toHaveBeenCalledWith({ x: 50, y: 75 });
    });

    it('returns NOT_FOUND when token missing', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: { message: 'not found', code: 'PGRST116' } });
      const client = makeMockClient(chain);

      const result = await moveToken(client, 'nope', 0, 0);

      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
    });
  });

  describe('removeToken', () => {
    it('removes token successfully', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: null });
      const client = makeMockClient(chain);

      const result = await removeToken(client, 'tk1');

      expect(result.error).toBeNull();
    });
  });

  describe('getUserPins', () => {
    it('returns all user pins for a map', async () => {
      const pins = [
        { id: 'up1', map_id: MAP_ID, user_id: 'u1', x: 10, y: 20, label: 'Camp', color: '#red' },
        { id: 'up2', map_id: MAP_ID, user_id: 'u2', x: 30, y: 40, label: null, color: null },
      ];
      const chain = createChainMock();
      chain._setResolve({ data: pins, error: null });
      const client = makeMockClient(chain);

      const result = await getUserPins(client, MAP_ID);

      expect(result.data).toHaveLength(2);
      expect(result.data![0].label).toBe('Camp');
    });

    it('returns empty array when no pins', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: [], error: null });
      const client = makeMockClient(chain);

      const result = await getUserPins(client, MAP_ID);

      expect(result.data).toEqual([]);
    });
  });

  describe('addUserPin', () => {
    it('creates a user pin with label and color', async () => {
      const pin = { id: 'up1', campaign_id: CAMPAIGN_ID, map_id: MAP_ID, user_id: 'u1', x: 10, y: 20, label: 'Camp', color: '#ff0000', character_id: null };
      const chain = createChainMock();
      chain._setResolve({ data: pin, error: null });
      const client = makeMockClient(chain);

      const result = await addUserPin(client, CAMPAIGN_ID, MAP_ID, 'u1', 10, 20, 'Camp', '#ff0000');

      expect(result.data).toEqual(pin);
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          campaign_id: CAMPAIGN_ID,
          map_id: MAP_ID,
          user_id: 'u1',
          x: 10,
          y: 20,
          label: 'Camp',
          color: '#ff0000',
        })
      );
    });

    it('defaults label and color to null', async () => {
      const pin = { id: 'up2', campaign_id: CAMPAIGN_ID, map_id: MAP_ID, user_id: 'u1', x: 5, y: 5, label: null, color: null, character_id: null };
      const chain = createChainMock();
      chain._setResolve({ data: pin, error: null });
      const client = makeMockClient(chain);

      const result = await addUserPin(client, CAMPAIGN_ID, MAP_ID, 'u1', 5, 5);

      expect(result.data?.label).toBeNull();
      expect(result.data?.color).toBeNull();
    });
  });

  describe('removeUserPin', () => {
    it('removes a user pin', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: null });
      const client = makeMockClient(chain);

      const result = await removeUserPin(client, 'up1');

      expect(result.error).toBeNull();
    });

    it('returns error on failure', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: { message: 'rls', code: '42501' } });
      const client = makeMockClient(chain);

      const result = await removeUserPin(client, 'up1');

      expect(result.error?.code).toBe(ErrorCode.UNAUTHORIZED);
    });
  });
});
