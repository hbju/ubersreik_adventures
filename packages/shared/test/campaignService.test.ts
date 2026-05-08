import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createCampaign,
  getCampaignsForUser,
  getCampaignWithMembers,
  updateCampaign,
  deleteCampaign,
  addMember,
  removeMember,
  updateMemberColor,
} from '../src/services/campaignService';
import { ErrorCode } from '../src/types/errors';

// --- Mock Supabase Client ---

function createChainMock() {
  let resolveValue: { data?: unknown; error?: unknown } = { data: null, error: null };

  const mock: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(() => Promise.resolve(resolveValue)),
    _setResolve(val: { data?: unknown; error?: unknown }) {
      resolveValue = val;
    },
    then(resolve: (v: unknown) => void, reject: (v: unknown) => void) {
      return Promise.resolve(resolveValue).then(resolve, reject);
    },
  };

  return mock;
}

/**
 * Creates a mock client where each .from(table) call returns a fresh chain.
 * Use `getChain(table)` to configure return values per table.
 */
function createMockClientMultiTable() {
  const chains: Record<string, ReturnType<typeof createChainMock>> = {};

  function getChain(table: string) {
    if (!chains[table]) {
      chains[table] = createChainMock();
    }
    return chains[table];
  }

  const from = vi.fn((table: string) => getChain(table));
  const client = { from } as any;

  return { client, getChain };
}

// --- Tests ---

describe('campaignService', () => {
  describe('createCampaign', () => {
    it('creates campaign and adds GM as member', async () => {
      const campaign = { id: 'camp-1', name: 'Test', gm_user_id: 'gm-1', created_at: '', updated_at: '', version: '1' };
      const { client, getChain } = createMockClientMultiTable();

      // campaigns insert returns the campaign
      getChain('campaigns')._setResolve({ data: campaign, error: null });
      // campaign_members insert succeeds
      getChain('campaign_members')._setResolve({ data: null, error: null });

      const result = await createCampaign(client, 'Test', 'gm-1');

      expect(result.data).toEqual(campaign);
      expect(result.error).toBeNull();
      expect(client.from).toHaveBeenCalledWith('campaigns');
      expect(client.from).toHaveBeenCalledWith('campaign_members');
    });

    it('returns error if campaign insert fails', async () => {
      const { client, getChain } = createMockClientMultiTable();
      getChain('campaigns')._setResolve({ data: null, error: { message: 'dup', code: '23505' } });

      const result = await createCampaign(client, 'Test', 'gm-1');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe(ErrorCode.DATABASE_ERROR);
    });

    it('cleans up campaign if member insert fails', async () => {
      const campaign = { id: 'camp-1', name: 'Test', gm_user_id: 'gm-1' };
      const { client, getChain } = createMockClientMultiTable();

      getChain('campaigns')._setResolve({ data: campaign, error: null });
      getChain('campaign_members')._setResolve({ data: null, error: { message: 'failed', code: '23503' } });

      const result = await createCampaign(client, 'Test', 'gm-1');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe(ErrorCode.DATABASE_ERROR);
      // Verify delete was called for cleanup (from('campaigns') called again)
      expect(client.from).toHaveBeenCalledWith('campaigns');
    });
  });

  describe('getCampaignsForUser', () => {
    it('returns campaigns for user', async () => {
      const campaigns = [
        { campaign_id: 'c1', campaigns: { id: 'c1', name: 'Camp 1' } },
        { campaign_id: 'c2', campaigns: { id: 'c2', name: 'Camp 2' } },
      ];
      const { client, getChain } = createMockClientMultiTable();
      getChain('campaign_members')._setResolve({ data: campaigns, error: null });

      const result = await getCampaignsForUser(client, 'user-1');

      expect(result.data).toHaveLength(2);
      expect(result.data![0].id).toBe('c1');
      expect(result.error).toBeNull();
    });

    it('returns empty array when user has no campaigns', async () => {
      const { client, getChain } = createMockClientMultiTable();
      getChain('campaign_members')._setResolve({ data: [], error: null });

      const result = await getCampaignsForUser(client, 'user-1');

      expect(result.data).toEqual([]);
    });

    it('returns error on failure', async () => {
      const { client, getChain } = createMockClientMultiTable();
      getChain('campaign_members')._setResolve({ data: null, error: { message: 'timeout', code: '57014' } });

      const result = await getCampaignsForUser(client, 'user-1');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe(ErrorCode.DATABASE_ERROR);
    });
  });

  describe('getCampaignWithMembers', () => {
    it('returns campaign with member profiles', async () => {
      const campaign = { id: 'c1', name: 'Test', gm_user_id: 'gm-1' };
      const members = [
        { campaign_id: 'c1', user_id: 'gm-1', role: 'gm', color: null, profiles: { display_name: 'GM Bob' } },
        { campaign_id: 'c1', user_id: 'p-1', role: 'player', color: '#ff0000', profiles: { display_name: 'Alice' } },
      ];

      const { client, getChain } = createMockClientMultiTable();
      getChain('campaigns')._setResolve({ data: campaign, error: null });
      getChain('campaign_members')._setResolve({ data: members, error: null });

      const result = await getCampaignWithMembers(client, 'c1');

      expect(result.data?.id).toBe('c1');
      expect(result.data?.members).toHaveLength(2);
      expect(result.data?.members[0].display_name).toBe('GM Bob');
      expect(result.data?.members[1].color).toBe('#ff0000');
    });

    it('returns NOT_FOUND when campaign does not exist', async () => {
      const { client, getChain } = createMockClientMultiTable();
      getChain('campaigns')._setResolve({ data: null, error: { message: 'not found', code: 'PGRST116' } });

      const result = await getCampaignWithMembers(client, 'nope');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
    });
  });

  describe('updateCampaign', () => {
    it('updates and returns campaign', async () => {
      const updated = { id: 'c1', name: 'Renamed' };
      const { client, getChain } = createMockClientMultiTable();
      getChain('campaigns')._setResolve({ data: updated, error: null });

      const result = await updateCampaign(client, 'c1', { name: 'Renamed' });

      expect(result.data).toEqual(updated);
      expect(result.error).toBeNull();
    });
  });

  describe('deleteCampaign', () => {
    it('deletes campaign successfully', async () => {
      const { client, getChain } = createMockClientMultiTable();
      getChain('campaigns')._setResolve({ data: null, error: null });

      const result = await deleteCampaign(client, 'c1');

      expect(result.error).toBeNull();
    });

    it('returns error on failure', async () => {
      const { client, getChain } = createMockClientMultiTable();
      getChain('campaigns')._setResolve({ data: null, error: { message: 'fk', code: '23503' } });

      const result = await deleteCampaign(client, 'c1');

      expect(result.error?.code).toBe(ErrorCode.DATABASE_ERROR);
    });
  });

  describe('addMember', () => {
    it('adds member with role and color', async () => {
      const member = { campaign_id: 'c1', user_id: 'u1', role: 'player', color: '#00ff00' };
      const { client, getChain } = createMockClientMultiTable();
      getChain('campaign_members')._setResolve({ data: member, error: null });

      const result = await addMember(client, 'c1', 'u1', 'player', '#00ff00');

      expect(result.data).toEqual(member);
      expect(result.error).toBeNull();
    });

    it('defaults color to null', async () => {
      const member = { campaign_id: 'c1', user_id: 'u1', role: 'player', color: null };
      const { client, getChain } = createMockClientMultiTable();
      getChain('campaign_members')._setResolve({ data: member, error: null });

      const result = await addMember(client, 'c1', 'u1', 'player');

      expect(result.data?.color).toBeNull();
    });
  });

  describe('removeMember', () => {
    it('removes member successfully', async () => {
      const { client, getChain } = createMockClientMultiTable();
      getChain('campaign_members')._setResolve({ data: null, error: null });

      const result = await removeMember(client, 'c1', 'u1');

      expect(result.error).toBeNull();
    });
  });

  describe('updateMemberColor', () => {
    it('updates color and returns member', async () => {
      const member = { campaign_id: 'c1', user_id: 'u1', role: 'player', color: '#blue' };
      const { client, getChain } = createMockClientMultiTable();
      getChain('campaign_members')._setResolve({ data: member, error: null });

      const result = await updateMemberColor(client, 'c1', 'u1', '#blue');

      expect(result.data?.color).toBe('#blue');
      expect(result.error).toBeNull();
    });

    it('returns error if member not found', async () => {
      const { client, getChain } = createMockClientMultiTable();
      getChain('campaign_members')._setResolve({ data: null, error: { message: 'not found', code: 'PGRST116' } });

      const result = await updateMemberColor(client, 'c1', 'ghost', '#red');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
    });
  });
});
