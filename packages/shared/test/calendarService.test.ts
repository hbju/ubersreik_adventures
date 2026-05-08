import { describe, it, expect, vi } from 'vitest';
import {
  getCalendarState,
  updateCalendarState,
} from '../src/services/calendarService';
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

// --- Fixtures ---

const CAMPAIGN_ID = 'camp-1';
const sampleCalendar = { year: 2522, month: 3, day: 15, weather: 'cloudy' };

// --- Tests ---

describe('calendarService', () => {
  describe('getCalendarState', () => {
    it('returns calendar state from campaign', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: { calendar_state: sampleCalendar }, error: null });
      const client = makeMockClient(chain);

      const result = await getCalendarState(client, CAMPAIGN_ID);

      expect(result.data).toEqual(sampleCalendar);
      expect(result.error).toBeNull();
    });

    it('returns null when no calendar state set', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: { calendar_state: null }, error: null });
      const client = makeMockClient(chain);

      const result = await getCalendarState(client, CAMPAIGN_ID);

      expect(result.data).toBeNull();
    });

    it('returns NOT_FOUND when campaign missing', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: { message: 'not found', code: 'PGRST116' } });
      const client = makeMockClient(chain);

      const result = await getCalendarState(client, 'nope');

      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
    });
  });

  describe('updateCalendarState', () => {
    it('updates calendar state on campaign', async () => {
      const updated = { ...sampleCalendar, day: 16 };
      const chain = createChainMock();
      chain._setResolve({ data: { calendar_state: updated }, error: null });
      const client = makeMockClient(chain);

      const result = await updateCalendarState(client, CAMPAIGN_ID, updated);

      expect(result.data).toEqual(updated);
      expect(chain.update).toHaveBeenCalledWith({ calendar_state: updated });
    });

    it('returns error on failure', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: { message: 'rls', code: '42501' } });
      const client = makeMockClient(chain);

      const result = await updateCalendarState(client, CAMPAIGN_ID, sampleCalendar);

      expect(result.error?.code).toBe(ErrorCode.UNAUTHORIZED);
    });
  });
});
