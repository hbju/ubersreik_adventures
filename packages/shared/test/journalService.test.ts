import { describe, it, expect, vi } from 'vitest';
import {
  getVisibleEntries,
  getAllEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  shareEntry,
} from '../src/services/journalService';
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
    or: vi.fn().mockReturnThis(),
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
const USER_ID = 'user-1';

const sampleEntry = {
  id: 'j1',
  campaign_id: CAMPAIGN_ID,
  title: 'Session 1',
  content: 'The party arrived...',
  is_public: false,
  shared_with: [USER_ID],
  image_data: null,
  session_date: '2526-01-01',
  created_at: '',
  updated_at: '',
};

// --- Tests ---

describe('journalService', () => {
  describe('getVisibleEntries', () => {
    it('returns entries using or filter for is_public and shared_with', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: [sampleEntry], error: null });
      const client = makeMockClient(chain);

      const result = await getVisibleEntries(client, CAMPAIGN_ID, USER_ID);

      expect(result.data).toHaveLength(1);
      expect(result.error).toBeNull();
      expect(chain.or).toHaveBeenCalledWith(
        expect.stringContaining('is_public.eq.true')
      );
      expect(chain.or).toHaveBeenCalledWith(
        expect.stringContaining(USER_ID)
      );
    });

    it('returns empty array when no visible entries', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: [], error: null });
      const client = makeMockClient(chain);

      const result = await getVisibleEntries(client, CAMPAIGN_ID, USER_ID);

      expect(result.data).toEqual([]);
    });

    it('returns error on failure', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: { message: 'fail', code: '42000' } });
      const client = makeMockClient(chain);

      const result = await getVisibleEntries(client, CAMPAIGN_ID, USER_ID);

      expect(result.error?.code).toBe(ErrorCode.DATABASE_ERROR);
    });
  });

  describe('getAllEntries', () => {
    it('returns all entries without visibility filter', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: [sampleEntry, { ...sampleEntry, id: 'j2' }], error: null });
      const client = makeMockClient(chain);

      const result = await getAllEntries(client, CAMPAIGN_ID);

      expect(result.data).toHaveLength(2);
      // or() should NOT have been called
      expect(chain.or).not.toHaveBeenCalled();
    });
  });

  describe('createEntry', () => {
    it('creates entry with campaign_id', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: sampleEntry, error: null });
      const client = makeMockClient(chain);

      const result = await createEntry(client, CAMPAIGN_ID, {
        title: 'Session 1',
        content: 'The party arrived...',
      });

      expect(result.data).toEqual(sampleEntry);
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ campaign_id: CAMPAIGN_ID, title: 'Session 1' })
      );
    });
  });

  describe('updateEntry', () => {
    it('updates entry fields', async () => {
      const updated = { ...sampleEntry, title: 'Renamed' };
      const chain = createChainMock();
      chain._setResolve({ data: updated, error: null });
      const client = makeMockClient(chain);

      const result = await updateEntry(client, 'j1', { title: 'Renamed' });

      expect(result.data?.title).toBe('Renamed');
    });
  });

  describe('deleteEntry', () => {
    it('deletes entry successfully', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: null });
      const client = makeMockClient(chain);

      const result = await deleteEntry(client, 'j1');

      expect(result.error).toBeNull();
    });
  });

  describe('shareEntry', () => {
    it('updates shared_with array', async () => {
      const shared = { ...sampleEntry, shared_with: ['user-1', 'user-2'] };
      const chain = createChainMock();
      chain._setResolve({ data: shared, error: null });
      const client = makeMockClient(chain);

      const result = await shareEntry(client, 'j1', ['user-1', 'user-2']);

      expect(result.data?.shared_with).toEqual(['user-1', 'user-2']);
      expect(chain.update).toHaveBeenCalledWith({ shared_with: ['user-1', 'user-2'] });
    });

    it('returns error if entry not found', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: { message: 'not found', code: 'PGRST116' } });
      const client = makeMockClient(chain);

      const result = await shareEntry(client, 'nope', ['user-1']);

      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
    });
  });
});
