import { describe, it, expect, vi } from 'vitest';
import {
  getCombatState,
  updateCombatState,
  clearCombatState,
} from '../src/services/combatService';
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
    };
    return chain;
  };
  return { from: vi.fn(() => makeChain()) } as any;
}

// --- Fixtures ---

const CAMPAIGN_ID = 'camp-1';
const sampleCombat = {
  id: 'cs-1',
  campaign_id: CAMPAIGN_ID,
  combatants: [],
  current_turn_index: 0,
  round_number: 1,
  is_active: false,
  player_advantage: 0,
  enemy_advantage: 0,
  updated_at: '',
};

// --- Tests ---

describe('combatService', () => {
  describe('getCombatState', () => {
    it('returns existing combat state', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: sampleCombat, error: null });
      const client = makeMockClient(chain);

      const result = await getCombatState(client, CAMPAIGN_ID);

      expect(result.data).toEqual(sampleCombat);
      expect(result.error).toBeNull();
    });

    it('creates default state when none exists (PGRST116)', async () => {
      const client = createSequentialClient([
        // First: select returns PGRST116
        { data: null, error: { message: 'not found', code: 'PGRST116' } },
        // Second: insert returns newly created
        { data: sampleCombat, error: null },
      ]);

      const result = await getCombatState(client, CAMPAIGN_ID);

      expect(result.data).toEqual(sampleCombat);
      expect(result.error).toBeNull();
    });

    it('returns error on non-PGRST116 failure', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: { message: 'timeout', code: '57014' } });
      const client = makeMockClient(chain);

      const result = await getCombatState(client, CAMPAIGN_ID);

      expect(result.error?.code).toBe(ErrorCode.DATABASE_ERROR);
    });
  });

  describe('updateCombatState', () => {
    it('upserts combat state', async () => {
      const updated = { ...sampleCombat, is_active: true, round_number: 3 };
      const chain = createChainMock();
      chain._setResolve({ data: updated, error: null });
      const client = makeMockClient(chain);

      const result = await updateCombatState(client, CAMPAIGN_ID, {
        is_active: true,
        round_number: 3,
      });

      expect(result.data?.is_active).toBe(true);
      expect(result.data?.round_number).toBe(3);
      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ campaign_id: CAMPAIGN_ID, is_active: true }),
        { onConflict: 'campaign_id' }
      );
    });

    it('returns error on failure', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: { message: 'rls', code: '42501' } });
      const client = makeMockClient(chain);

      const result = await updateCombatState(client, CAMPAIGN_ID, { is_active: true });

      expect(result.error?.code).toBe(ErrorCode.UNAUTHORIZED);
    });
  });

  describe('clearCombatState', () => {
    it('resets to defaults', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: sampleCombat, error: null });
      const client = makeMockClient(chain);

      const result = await clearCombatState(client, CAMPAIGN_ID);

      expect(result.data).toEqual(sampleCombat);
      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          campaign_id: CAMPAIGN_ID,
          combatants: [],
          current_turn_index: 0,
          round_number: 1,
          is_active: false,
          player_advantage: 0,
          enemy_advantage: 0,
        }),
        { onConflict: 'campaign_id' }
      );
    });
  });
});
