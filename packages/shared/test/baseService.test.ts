import { describe, it, expect, vi } from 'vitest';
import { getById, getAll, insert, update, remove } from '../src/services/baseService';
import { createServiceContext, type ServiceContext } from '../src/services/serviceContext';
import { ErrorCode } from '../src/types/errors';

// --- Mock Supabase Client Factory ---

function createMockClient(response: { data?: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(response),
  };

  // For operations that don't call .single() (getAll, remove)
  // We need the last method in the chain to resolve
  if (Array.isArray(response.data)) {
    chain.eq = vi.fn().mockImplementation(() => ({
      ...chain,
      eq: chain.eq,
    }));
    // Final eq resolves the promise for getAll
    const eqMock = vi.fn().mockResolvedValue(response);
    // We need the second .eq() call (campaign_id) to resolve
    let callCount = 0;
    chain.eq = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount >= 2) return Promise.resolve(response);
      return chain;
    });
  }

  const from = vi.fn().mockReturnValue(chain);
  return { from } as unknown as ReturnType<typeof import('../src/lib/supabase').createSupabaseClient>;
}

function createChainMock() {
  let resolveValue: { data?: unknown; error?: unknown } = { data: null, error: null };

  const mock = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(() => Promise.resolve(resolveValue)),
    // Allow setting what the chain resolves to
    _setResolve(val: { data?: unknown; error?: unknown }) {
      resolveValue = val;
    },
    // Make the chain itself thenable for getAll / remove (no .single())
    then: undefined as unknown,
  };

  // Make it thenable so `await chain.eq(...)` works for getAll/remove
  mock.then = (resolve: (v: unknown) => void, reject: (v: unknown) => void) =>
    Promise.resolve(resolveValue).then(resolve, reject);

  return mock;
}

function makeMockClient(chainMock: ReturnType<typeof createChainMock>) {
  const from = vi.fn().mockReturnValue(chainMock);
  return { from } as unknown as ReturnType<typeof import('../src/lib/supabase').createSupabaseClient>;
}

// --- Tests ---

describe('baseService', () => {
  const campaignId = 'campaign-123';
  const userId = 'user-456';

  describe('getById', () => {
    it('returns data on success', async () => {
      const row = { id: 'abc', campaign_id: campaignId, name: 'Test' };
      const chain = createChainMock();
      chain._setResolve({ data: row, error: null });
      const client = makeMockClient(chain);
      const ctx = createServiceContext(client, campaignId, userId);

      const result = await getById(ctx, 'characters', 'abc');

      expect(result.data).toEqual(row);
      expect(result.error).toBeNull();
    });

    it('returns NOT_FOUND on PGRST116', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: { message: 'not found', code: 'PGRST116' } });
      const client = makeMockClient(chain);
      const ctx = createServiceContext(client, campaignId, userId);

      const result = await getById(ctx, 'characters', 'missing');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
    });
  });

  describe('getAll', () => {
    it('returns array on success', async () => {
      const rows = [{ id: '1', campaign_id: campaignId }, { id: '2', campaign_id: campaignId }];
      const chain = createChainMock();
      chain._setResolve({ data: rows, error: null });
      const client = makeMockClient(chain);
      const ctx = createServiceContext(client, campaignId, userId);

      const result = await getAll(ctx, 'characters');

      expect(result.data).toEqual(rows);
      expect(result.error).toBeNull();
    });

    it('returns empty array when no rows', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: null });
      const client = makeMockClient(chain);
      const ctx = createServiceContext(client, campaignId, userId);

      const result = await getAll(ctx, 'characters');

      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
    });

    it('returns DATABASE_ERROR on generic error', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: { message: 'connection failed', code: '08001' } });
      const client = makeMockClient(chain);
      const ctx = createServiceContext(client, campaignId, userId);

      const result = await getAll(ctx, 'characters');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe(ErrorCode.DATABASE_ERROR);
    });
  });

  describe('insert', () => {
    it('injects campaign_id and returns inserted row', async () => {
      const insertedRow = { id: 'new-1', campaign_id: campaignId, name: 'New' };
      const chain = createChainMock();
      chain._setResolve({ data: insertedRow, error: null });
      const client = makeMockClient(chain);
      const ctx = createServiceContext(client, campaignId, userId);

      const result = await insert(ctx, 'characters', { id: 'new-1', name: 'New' });

      expect(result.data).toEqual(insertedRow);
      expect(result.error).toBeNull();
      // Verify campaign_id was passed to insert
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ campaign_id: campaignId })
      );
    });
  });

  describe('update', () => {
    it('returns updated row on success', async () => {
      const updated = { id: 'abc', campaign_id: campaignId, name: 'Updated' };
      const chain = createChainMock();
      chain._setResolve({ data: updated, error: null });
      const client = makeMockClient(chain);
      const ctx = createServiceContext(client, campaignId, userId);

      const result = await update(ctx, 'characters', 'abc', { name: 'Updated' });

      expect(result.data).toEqual(updated);
      expect(result.error).toBeNull();
    });

    it('returns UNAUTHORIZED on permission error', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: { message: 'permission denied', code: '42501' } });
      const client = makeMockClient(chain);
      const ctx = createServiceContext(client, campaignId, userId);

      const result = await update(ctx, 'characters', 'abc', { name: 'Nope' });

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe(ErrorCode.UNAUTHORIZED);
    });
  });

  describe('remove', () => {
    it('returns success on delete', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: null });
      const client = makeMockClient(chain);
      const ctx = createServiceContext(client, campaignId, userId);

      const result = await remove(ctx, 'characters', 'abc');

      expect(result.error).toBeNull();
    });

    it('returns DATABASE_ERROR on failure', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: { message: 'fk violation', code: '23503' } });
      const client = makeMockClient(chain);
      const ctx = createServiceContext(client, campaignId, userId);

      const result = await remove(ctx, 'characters', 'abc');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe(ErrorCode.DATABASE_ERROR);
    });
  });
});

describe('serviceContext', () => {
  it('creates context with provided values', () => {
    const mockClient = {} as any;
    const ctx = createServiceContext(mockClient, 'camp-1', 'user-1');

    expect(ctx.client).toBe(mockClient);
    expect(ctx.campaignId).toBe('camp-1');
    expect(ctx.userId).toBe('user-1');
  });
});
