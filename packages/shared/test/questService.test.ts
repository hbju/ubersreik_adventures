import { describe, it, expect, vi } from 'vitest';
import {
  getQuests,
  createQuest,
  updateQuest,
  toggleObjective,
  deleteQuest,
} from '../src/services/questService';
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
      then(resolve: (v: unknown) => void, reject: (v: unknown) => void) {
        const resp = responses[callIndex] ?? responses[responses.length - 1];
        callIndex++;
        return Promise.resolve(resp).then(resolve, reject);
      },
    };
    return chain;
  };
  return { from: vi.fn(() => makeChain()) } as any;
}

// --- Fixtures ---

const CAMPAIGN_ID = 'camp-1';

const sampleQuest = {
  id: 'q1',
  campaign_id: CAMPAIGN_ID,
  title: 'Find the artifact',
  description: 'A mysterious quest',
  status: 'active',
  character_id: null,
  objectives: [
    { text: 'Talk to the innkeeper', completed: false },
    { text: 'Explore the ruins', completed: false },
  ],
  created_at: '',
  updated_at: '',
};

// --- Tests ---

describe('questService', () => {
  describe('getQuests', () => {
    it('returns all quests for a campaign', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: [sampleQuest], error: null });
      const client = makeMockClient(chain);

      const result = await getQuests(client, CAMPAIGN_ID);

      expect(result.data).toHaveLength(1);
      expect(result.error).toBeNull();
    });

    it('applies status filter when provided', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: [], error: null });
      const client = makeMockClient(chain);

      await getQuests(client, CAMPAIGN_ID, 'completed');

      expect(chain.eq).toHaveBeenCalledWith('status', 'completed');
    });

    it('returns error on failure', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: { message: 'fail', code: '42000' } });
      const client = makeMockClient(chain);

      const result = await getQuests(client, CAMPAIGN_ID);

      expect(result.error?.code).toBe(ErrorCode.DATABASE_ERROR);
    });
  });

  describe('createQuest', () => {
    it('creates quest with campaign_id', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: sampleQuest, error: null });
      const client = makeMockClient(chain);

      const result = await createQuest(client, CAMPAIGN_ID, {
        title: 'Find the artifact',
        description: 'A mysterious quest',
      });

      expect(result.data).toEqual(sampleQuest);
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ campaign_id: CAMPAIGN_ID, title: 'Find the artifact' })
      );
    });
  });

  describe('updateQuest', () => {
    it('updates quest fields', async () => {
      const updated = { ...sampleQuest, status: 'completed' };
      const chain = createChainMock();
      chain._setResolve({ data: updated, error: null });
      const client = makeMockClient(chain);

      const result = await updateQuest(client, 'q1', { status: 'completed' });

      expect(result.data?.status).toBe('completed');
    });
  });

  describe('toggleObjective', () => {
    it('toggles an objective from false to true', async () => {
      const toggled = {
        ...sampleQuest,
        objectives: [
          { text: 'Talk to the innkeeper', completed: true },
          { text: 'Explore the ruins', completed: false },
        ],
      };
      const client = createSequentialClient([
        // fetch
        { data: { objectives: sampleQuest.objectives }, error: null },
        // update
        { data: toggled, error: null },
      ]);

      const result = await toggleObjective(client, 'q1', 0);

      expect(result.data).toBeDefined();
      expect(result.error).toBeNull();
      // Verify the update was called with toggled objectives
      const updateCall = client.from.mock.results[1].value.update.mock.calls[0][0];
      expect(updateCall.objectives[0].completed).toBe(true);
      expect(updateCall.objectives[1].completed).toBe(false);
    });

    it('toggles an objective from true to false', async () => {
      const objectives = [
        { text: 'Done', completed: true },
        { text: 'Not done', completed: false },
      ];
      const client = createSequentialClient([
        { data: { objectives }, error: null },
        { data: { objectives: [{ text: 'Done', completed: false }, objectives[1]] }, error: null },
      ]);

      const result = await toggleObjective(client, 'q1', 0);

      expect(result.error).toBeNull();
      const updateCall = client.from.mock.results[1].value.update.mock.calls[0][0];
      expect(updateCall.objectives[0].completed).toBe(false);
    });

    it('returns VALIDATION_ERROR for out-of-bounds index', async () => {
      const client = createSequentialClient([
        { data: { objectives: sampleQuest.objectives }, error: null },
      ]);

      const result = await toggleObjective(client, 'q1', 5);

      expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('returns VALIDATION_ERROR when objectives is not an array', async () => {
      const client = createSequentialClient([
        { data: { objectives: 'not-an-array' }, error: null },
      ]);

      const result = await toggleObjective(client, 'q1', 0);

      expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('returns error if quest not found', async () => {
      const client = createSequentialClient([
        { data: null, error: { message: 'not found', code: 'PGRST116' } },
      ]);

      const result = await toggleObjective(client, 'nope', 0);

      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
    });
  });

  describe('deleteQuest', () => {
    it('deletes quest successfully', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: null });
      const client = makeMockClient(chain);

      const result = await deleteQuest(client, 'q1');

      expect(result.error).toBeNull();
    });
  });
});
