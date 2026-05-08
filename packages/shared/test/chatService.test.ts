import { describe, it, expect, vi } from 'vitest';
import {
  getRecentMessages,
  sendMessage,
  getChatHistory,
} from '../src/services/chatService';
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
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
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

const sampleMessages = [
  { id: 'm1', campaign_id: CAMPAIGN_ID, sender_id: 'user-2', sender_name: 'Alice', content: 'Hello', message_type: 'chat', roll_data: null, target_user_id: null, created_at: '2026-01-01T10:00:00Z' },
  { id: 'm2', campaign_id: CAMPAIGN_ID, sender_id: USER_ID, sender_name: 'Bob', content: 'Hi', message_type: 'chat', roll_data: null, target_user_id: null, created_at: '2026-01-01T10:01:00Z' },
];

// --- Tests ---

describe('chatService', () => {
  describe('getRecentMessages', () => {
    it('returns messages in chronological order (reversed)', async () => {
      // Supabase returns desc order, service reverses to asc
      const chain = createChainMock();
      chain._setResolve({ data: [...sampleMessages].reverse(), error: null });
      const client = makeMockClient(chain);

      const result = await getRecentMessages(client, CAMPAIGN_ID, USER_ID);

      expect(result.data).toHaveLength(2);
      // Should be reversed to chronological
      expect(result.data![0].id).toBe('m1');
      expect(result.data![1].id).toBe('m2');
    });

    it('filters with or clause for whisper visibility', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: [], error: null });
      const client = makeMockClient(chain);

      await getRecentMessages(client, CAMPAIGN_ID, USER_ID);

      expect(chain.or).toHaveBeenCalledWith(
        expect.stringContaining('target_user_id.is.null')
      );
      expect(chain.or).toHaveBeenCalledWith(
        expect.stringContaining(USER_ID)
      );
    });

    it('applies limit', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: [], error: null });
      const client = makeMockClient(chain);

      await getRecentMessages(client, CAMPAIGN_ID, USER_ID, 25);

      expect(chain.limit).toHaveBeenCalledWith(25);
    });

    it('applies before cursor for pagination', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: [], error: null });
      const client = makeMockClient(chain);

      await getRecentMessages(client, CAMPAIGN_ID, USER_ID, 50, '2026-01-01T10:00:00Z');

      expect(chain.lt).toHaveBeenCalledWith('created_at', '2026-01-01T10:00:00Z');
    });

    it('returns error on failure', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: { message: 'fail', code: '42000' } });
      const client = makeMockClient(chain);

      const result = await getRecentMessages(client, CAMPAIGN_ID, USER_ID);

      expect(result.error?.code).toBe(ErrorCode.DATABASE_ERROR);
    });
  });

  describe('sendMessage', () => {
    it('inserts a chat message', async () => {
      const sent = { ...sampleMessages[0], id: 'm-new' };
      const chain = createChainMock();
      chain._setResolve({ data: sent, error: null });
      const client = makeMockClient(chain);

      const result = await sendMessage(client, CAMPAIGN_ID, USER_ID, 'Bob', 'Hello world');

      expect(result.data).toBeDefined();
      expect(result.error).toBeNull();
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          campaign_id: CAMPAIGN_ID,
          sender_id: USER_ID,
          sender_name: 'Bob',
          content: 'Hello world',
          message_type: 'chat',
        })
      );
    });

    it('sends a whisper with target_user_id', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: { id: 'm-w' }, error: null });
      const client = makeMockClient(chain);

      await sendMessage(client, CAMPAIGN_ID, USER_ID, 'Bob', 'Secret', 'whisper', null, 'user-2');

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          target_user_id: 'user-2',
          message_type: 'whisper',
        })
      );
    });

    it('sends a roll message with roll_data', async () => {
      const rollData = { dice: '2d10', result: 15 };
      const chain = createChainMock();
      chain._setResolve({ data: { id: 'm-r' }, error: null });
      const client = makeMockClient(chain);

      await sendMessage(client, CAMPAIGN_ID, USER_ID, 'Bob', 'Rolled!', 'roll', rollData);

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          roll_data: rollData,
          message_type: 'roll',
        })
      );
    });

    it('defaults optional fields to null', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: { id: 'm-d' }, error: null });
      const client = makeMockClient(chain);

      await sendMessage(client, CAMPAIGN_ID, USER_ID, 'Bob', 'Hi');

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          roll_data: null,
          target_user_id: null,
          message_type: 'chat',
        })
      );
    });
  });

  describe('getChatHistory', () => {
    it('returns messages in chronological order', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: sampleMessages, error: null });
      const client = makeMockClient(chain);

      const result = await getChatHistory(client, CAMPAIGN_ID, USER_ID);

      expect(result.data).toHaveLength(2);
      expect(result.data![0].id).toBe('m1');
    });

    it('applies since filter when provided', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: [], error: null });
      const client = makeMockClient(chain);

      await getChatHistory(client, CAMPAIGN_ID, USER_ID, '2026-01-01T10:00:00Z');

      expect(chain.gte).toHaveBeenCalledWith('created_at', '2026-01-01T10:00:00Z');
    });

    it('uses default limit of 100', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: [], error: null });
      const client = makeMockClient(chain);

      await getChatHistory(client, CAMPAIGN_ID, USER_ID);

      expect(chain.limit).toHaveBeenCalledWith(100);
    });

    it('filters whispers for the requesting user', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: [], error: null });
      const client = makeMockClient(chain);

      await getChatHistory(client, CAMPAIGN_ID, USER_ID);

      expect(chain.or).toHaveBeenCalledWith(
        expect.stringContaining('target_user_id.is.null')
      );
    });
  });
});
