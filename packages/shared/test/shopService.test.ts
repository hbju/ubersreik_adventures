import { describe, it, expect, vi } from 'vitest';
import {
  getShops,
  getShopById,
  createShop,
  updateShop,
  deleteShop,
  updateInventory,
  removeInventoryItem,
} from '../src/services/shopService';
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

function createSequentialClient(responses: Array<{ data?: unknown; error?: unknown }>) {
  let callIndex = 0;
  const makeChain = (): any => {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(() => {
        const resp = responses[callIndex] ?? responses[responses.length - 1];
        callIndex++;
        return Promise.resolve(resp);
      }),
    };
    return chain;
  };
  return { from: vi.fn(() => makeChain()) } as any;
}

// --- Fixtures ---

const CAMPAIGN_ID = 'camp-1';
const sampleShop = {
  id: 'shop-1',
  campaign_id: CAMPAIGN_ID,
  name: 'General Store',
  category: 'general',
  inventory: [{ name: 'Rope', price: 5 }, { name: 'Torch', price: 1 }],
  base_stock: [],
  is_custom: false,
  location_id: null,
  player_access: [],
  last_restock_date: null,
  created_at: '',
  updated_at: '',
};

// --- Tests ---

describe('shopService', () => {
  describe('getShops', () => {
    it('returns all shops for a campaign', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: [sampleShop], error: null });
      const client = makeMockClient(chain);

      const result = await getShops(client, CAMPAIGN_ID);

      expect(result.data).toHaveLength(1);
      expect(result.data![0].name).toBe('General Store');
    });

    it('returns empty array when no shops', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: [], error: null });
      const client = makeMockClient(chain);

      const result = await getShops(client, CAMPAIGN_ID);

      expect(result.data).toEqual([]);
    });
  });

  describe('getShopById', () => {
    it('returns shop on success', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: sampleShop, error: null });
      const client = makeMockClient(chain);

      const result = await getShopById(client, 'shop-1');

      expect(result.data?.name).toBe('General Store');
    });

    it('returns NOT_FOUND when missing', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: { message: 'not found', code: 'PGRST116' } });
      const client = makeMockClient(chain);

      const result = await getShopById(client, 'nope');

      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
    });
  });

  describe('createShop', () => {
    it('creates shop with campaign_id', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: sampleShop, error: null });
      const client = makeMockClient(chain);

      const result = await createShop(client, CAMPAIGN_ID, {
        name: 'General Store',
        category: 'general',
      });

      expect(result.data).toEqual(sampleShop);
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ campaign_id: CAMPAIGN_ID })
      );
    });
  });

  describe('updateShop', () => {
    it('updates shop fields', async () => {
      const updated = { ...sampleShop, name: 'Renamed' };
      const chain = createChainMock();
      chain._setResolve({ data: updated, error: null });
      const client = makeMockClient(chain);

      const result = await updateShop(client, 'shop-1', { name: 'Renamed' });

      expect(result.data?.name).toBe('Renamed');
    });
  });

  describe('deleteShop', () => {
    it('deletes shop successfully', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: null });
      const client = makeMockClient(chain);

      const result = await deleteShop(client, 'shop-1');

      expect(result.error).toBeNull();
    });
  });

  describe('updateInventory', () => {
    it('replaces inventory JSONB', async () => {
      const newInventory = [{ name: 'Shield', price: 15 }];
      const updated = { ...sampleShop, inventory: newInventory };
      const chain = createChainMock();
      chain._setResolve({ data: updated, error: null });
      const client = makeMockClient(chain);

      const result = await updateInventory(client, 'shop-1', newInventory);

      expect(result.data?.inventory).toEqual(newInventory);
      expect(chain.update).toHaveBeenCalledWith({ inventory: newInventory });
    });
  });

  describe('removeInventoryItem', () => {
    it('removes item by index', async () => {
      const afterRemove = { ...sampleShop, inventory: [{ name: 'Torch', price: 1 }] };
      const client = createSequentialClient([
        // fetch
        { data: { inventory: sampleShop.inventory }, error: null },
        // update
        { data: afterRemove, error: null },
      ]);

      const result = await removeInventoryItem(client, 'shop-1', 0);

      expect(result.data).toBeDefined();
      expect(result.error).toBeNull();
      const updateCall = client.from.mock.results[1].value.update.mock.calls[0][0];
      expect(updateCall.inventory).toHaveLength(1);
      expect(updateCall.inventory[0].name).toBe('Torch');
    });

    it('returns VALIDATION_ERROR for out-of-bounds index', async () => {
      const client = createSequentialClient([
        { data: { inventory: sampleShop.inventory }, error: null },
      ]);

      const result = await removeInventoryItem(client, 'shop-1', 5);

      expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('returns VALIDATION_ERROR when inventory is not an array', async () => {
      const client = createSequentialClient([
        { data: { inventory: 'not-an-array' }, error: null },
      ]);

      const result = await removeInventoryItem(client, 'shop-1', 0);

      expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('returns error if shop not found', async () => {
      const client = createSequentialClient([
        { data: null, error: { message: 'not found', code: 'PGRST116' } },
      ]);

      const result = await removeInventoryItem(client, 'nope', 0);

      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
    });
  });
});
