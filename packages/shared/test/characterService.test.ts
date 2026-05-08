import { describe, it, expect, vi } from 'vitest';
import {
  getCharacters,
  getCharacterById,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  assignCharacterToUser,
  unassignCharacter,
  createFromTemplate,
  batchCreateMinions,
} from '../src/services/characterService';
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
    overlaps: vi.fn().mockReturnThis(),
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

function createMockClientMultiTable() {
  const chains: Record<string, ReturnType<typeof createChainMock>> = {};

  function getChain(table: string) {
    if (!chains[table]) chains[table] = createChainMock();
    return chains[table];
  }

  const from = vi.fn((table: string) => getChain(table));
  const client = { from } as any;
  return { client, getChain };
}

/**
 * For updateCharacter we need the characters chain to return different results
 * on successive calls (first: select/single for fetch, second: update/.../single for save).
 * This helper creates a client whose characters chain returns values in sequence.
 */
function createSequentialClient(responses: Array<{ data?: unknown; error?: unknown }>) {
  let callIndex = 0;

  const makeChain = (): any => {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      overlaps: vi.fn().mockReturnThis(),
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

  const from = vi.fn(() => makeChain());
  return { from } as any;
}

// --- Fixtures ---

const CAMPAIGN_ID = 'camp-1';

const sampleCharacter = {
  id: 'char-1',
  campaign_id: CAMPAIGN_ID,
  name: 'Gregor',
  is_minion: false,
  user_id: null,
  tags: ['warrior'],
  characteristics: { ws: 40, bs: 30 },
  skills: {},
  talents: {},
  inventory: {},
  conditions: {},
  currency: { gc: 5, ss: 10, bp: 20 },
  details: { age: '25' },
  status: { tier: 'Gold', standing: 1 },
  career_history: [],
  reputations: {},
  species: 'Human',
  movement: 4,
  xp_current: 100,
  xp_spent: 50,
  created_at: '',
  updated_at: '',
};

// --- Tests ---

describe('characterService', () => {
  describe('getCharacters', () => {
    it('returns all characters for a campaign', async () => {
      const { client, getChain } = createMockClientMultiTable();
      getChain('characters')._setResolve({ data: [sampleCharacter], error: null });

      const result = await getCharacters(client, CAMPAIGN_ID);

      expect(result.data).toHaveLength(1);
      expect(result.data![0].name).toBe('Gregor');
      expect(result.error).toBeNull();
    });

    it('applies userId filter', async () => {
      const { client, getChain } = createMockClientMultiTable();
      const chain = getChain('characters');
      chain._setResolve({ data: [], error: null });

      await getCharacters(client, CAMPAIGN_ID, { userId: 'user-1' });

      // eq should have been called with 'user_id'
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('applies isMinion filter', async () => {
      const { client, getChain } = createMockClientMultiTable();
      const chain = getChain('characters');
      chain._setResolve({ data: [], error: null });

      await getCharacters(client, CAMPAIGN_ID, { isMinion: true });

      expect(chain.eq).toHaveBeenCalledWith('is_minion', true);
    });

    it('applies tags filter with overlaps', async () => {
      const { client, getChain } = createMockClientMultiTable();
      const chain = getChain('characters');
      chain._setResolve({ data: [], error: null });

      await getCharacters(client, CAMPAIGN_ID, { tags: ['warrior', 'npc'] });

      expect(chain.overlaps).toHaveBeenCalledWith('tags', ['warrior', 'npc']);
    });

    it('returns error on failure', async () => {
      const { client, getChain } = createMockClientMultiTable();
      getChain('characters')._setResolve({ data: null, error: { message: 'fail', code: '42000' } });

      const result = await getCharacters(client, CAMPAIGN_ID);

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe(ErrorCode.DATABASE_ERROR);
    });
  });

  describe('getCharacterById', () => {
    it('returns character on success', async () => {
      const { client, getChain } = createMockClientMultiTable();
      getChain('characters')._setResolve({ data: sampleCharacter, error: null });

      const result = await getCharacterById(client, 'char-1');

      expect(result.data?.name).toBe('Gregor');
    });

    it('returns NOT_FOUND when missing', async () => {
      const { client, getChain } = createMockClientMultiTable();
      getChain('characters')._setResolve({ data: null, error: { message: 'not found', code: 'PGRST116' } });

      const result = await getCharacterById(client, 'nope');

      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
    });
  });

  describe('createCharacter', () => {
    it('creates character with campaign_id', async () => {
      const { client, getChain } = createMockClientMultiTable();
      const chain = getChain('characters');
      chain._setResolve({ data: sampleCharacter, error: null });

      const result = await createCharacter(client, CAMPAIGN_ID, {
        name: 'Gregor',
        characteristics: { ws: 40 },
        status: { tier: 'Gold', standing: 1 },
      });

      expect(result.data).toEqual(sampleCharacter);
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ campaign_id: CAMPAIGN_ID, name: 'Gregor' })
      );
    });
  });

  describe('updateCharacter', () => {
    it('merges JSONB fields with existing values', async () => {
      const client = createSequentialClient([
        // First call: fetch current
        { data: sampleCharacter, error: null },
        // Second call: update result
        { data: { ...sampleCharacter, characteristics: { ws: 45, bs: 30 } }, error: null },
      ]);

      const result = await updateCharacter(client, 'char-1', {
        characteristics: { ws: 45 } as any,
      });

      expect(result.data).toBeDefined();
      expect(result.error).toBeNull();
      // The update call should have merged ws:45 into existing {ws:40, bs:30}
      const updateCall = client.from.mock.results[1].value.update.mock.calls[0][0];
      expect(updateCall.characteristics).toEqual({ ws: 45, bs: 30 });
    });

    it('replaces scalar fields directly without fetch', async () => {
      const { client, getChain } = createMockClientMultiTable();
      const chain = getChain('characters');
      chain._setResolve({ data: { ...sampleCharacter, name: 'Renamed' }, error: null });

      const result = await updateCharacter(client, 'char-1', { name: 'Renamed' });

      expect(result.data?.name).toBe('Renamed');
      // No need to fetch for scalar-only updates — single() called once (the update)
      expect(chain.single).toHaveBeenCalledTimes(1);
    });

    it('returns error if fetch fails for JSONB merge', async () => {
      const client = createSequentialClient([
        { data: null, error: { message: 'not found', code: 'PGRST116' } },
      ]);

      const result = await updateCharacter(client, 'char-1', {
        skills: { athletics: 10 } as any,
      });

      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
    });
  });

  describe('deleteCharacter', () => {
    it('deletes successfully', async () => {
      const { client, getChain } = createMockClientMultiTable();
      getChain('characters')._setResolve({ data: null, error: null });

      const result = await deleteCharacter(client, 'char-1');

      expect(result.error).toBeNull();
    });
  });

  describe('assignCharacterToUser / unassignCharacter', () => {
    it('assigns user_id', async () => {
      const { client, getChain } = createMockClientMultiTable();
      const chain = getChain('characters');
      chain._setResolve({ data: { ...sampleCharacter, user_id: 'user-1' }, error: null });

      const result = await assignCharacterToUser(client, 'char-1', 'user-1');

      expect(result.data?.user_id).toBe('user-1');
      expect(chain.update).toHaveBeenCalledWith({ user_id: 'user-1' });
    });

    it('unassigns (sets user_id to null)', async () => {
      const { client, getChain } = createMockClientMultiTable();
      const chain = getChain('characters');
      chain._setResolve({ data: { ...sampleCharacter, user_id: null }, error: null });

      const result = await unassignCharacter(client, 'char-1');

      expect(result.data?.user_id).toBeNull();
      expect(chain.update).toHaveBeenCalledWith({ user_id: null });
    });
  });

  describe('createFromTemplate', () => {
    const template = {
      id: 'tmpl-1',
      campaign_id: CAMPAIGN_ID,
      name: 'Bandit',
      category: 'npc',
      template_data: {
        name: 'Bandit',
        characteristics: { ws: 35 },
        status: { tier: 'Brass', standing: 2 },
      },
    };

    it('creates character from template data', async () => {
      const client = createSequentialClient([
        // template fetch
        { data: template, error: null },
        // character insert
        { data: { ...template.template_data, id: 'char-new', campaign_id: CAMPAIGN_ID, template_id: 'tmpl-1' }, error: null },
      ]);

      const result = await createFromTemplate(client, CAMPAIGN_ID, 'tmpl-1');

      expect(result.data).toBeDefined();
      expect(result.error).toBeNull();
    });

    it('applies overrides', async () => {
      const client = createSequentialClient([
        { data: template, error: null },
        { data: { ...template.template_data, name: 'Boss Bandit', campaign_id: CAMPAIGN_ID }, error: null },
      ]);

      const result = await createFromTemplate(client, CAMPAIGN_ID, 'tmpl-1', { name: 'Boss Bandit' });

      expect(result.error).toBeNull();
      // Verify the insert was called with overridden name
      const insertCall = client.from.mock.results[1].value.insert.mock.calls[0][0];
      expect(insertCall.name).toBe('Boss Bandit');
    });

    it('returns error if template not found', async () => {
      const client = createSequentialClient([
        { data: null, error: { message: 'not found', code: 'PGRST116' } },
      ]);

      const result = await createFromTemplate(client, CAMPAIGN_ID, 'nope');

      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
    });
  });

  describe('batchCreateMinions', () => {
    const template = {
      id: 'tmpl-1',
      campaign_id: CAMPAIGN_ID,
      name: 'Rat',
      template_data: {
        name: 'Giant Rat',
        characteristics: { ws: 25 },
        status: { tier: 'Brass', standing: 0 },
      },
    };

    it('creates multiple minions with numbered names', async () => {
      const minions = [
        { id: 'm1', name: 'Giant Rat 1', is_minion: true },
        { id: 'm2', name: 'Giant Rat 2', is_minion: true },
        { id: 'm3', name: 'Giant Rat 3', is_minion: true },
      ];
      const client = createSequentialClient([
        { data: template, error: null },
        { data: minions, error: null },
      ]);

      const result = await batchCreateMinions(client, CAMPAIGN_ID, 'tmpl-1', 3);

      expect(result.data).toHaveLength(3);
      expect(result.error).toBeNull();

      // Verify insert was called with 3 rows
      const insertCall = client.from.mock.results[1].value.insert.mock.calls[0][0];
      expect(insertCall).toHaveLength(3);
      expect(insertCall[0].name).toBe('Giant Rat 1');
      expect(insertCall[2].name).toBe('Giant Rat 3');
      expect(insertCall[0].is_minion).toBe(true);
    });

    it('rejects count < 1', async () => {
      const { client } = createMockClientMultiTable();

      const result = await batchCreateMinions(client, CAMPAIGN_ID, 'tmpl-1', 0);

      expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects count > 100', async () => {
      const { client } = createMockClientMultiTable();

      const result = await batchCreateMinions(client, CAMPAIGN_ID, 'tmpl-1', 101);

      expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('returns error if template not found', async () => {
      const client = createSequentialClient([
        { data: null, error: { message: 'not found', code: 'PGRST116' } },
      ]);

      const result = await batchCreateMinions(client, CAMPAIGN_ID, 'tmpl-1', 5);

      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
    });
  });
});
