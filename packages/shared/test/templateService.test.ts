import { describe, it, expect, vi } from 'vitest';
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '../src/services/templateService';
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
const sampleTemplate = {
  id: 'tmpl-1',
  campaign_id: CAMPAIGN_ID,
  name: 'Bandit',
  category: 'npc',
  template_data: { name: 'Bandit', characteristics: { ws: 35 }, status: { tier: 'Brass', standing: 2 } },
};

// --- Tests ---

describe('templateService', () => {
  describe('getTemplates', () => {
    it('returns all templates for a campaign', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: [sampleTemplate], error: null });
      const client = makeMockClient(chain);

      const result = await getTemplates(client, CAMPAIGN_ID);

      expect(result.data).toHaveLength(1);
      expect(result.data![0].name).toBe('Bandit');
    });

    it('returns empty array when no templates', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: [], error: null });
      const client = makeMockClient(chain);

      const result = await getTemplates(client, CAMPAIGN_ID);

      expect(result.data).toEqual([]);
    });

    it('returns error on failure', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: { message: 'fail', code: '42000' } });
      const client = makeMockClient(chain);

      const result = await getTemplates(client, CAMPAIGN_ID);

      expect(result.error?.code).toBe(ErrorCode.DATABASE_ERROR);
    });
  });

  describe('createTemplate', () => {
    it('creates template with campaign_id', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: sampleTemplate, error: null });
      const client = makeMockClient(chain);

      const result = await createTemplate(client, CAMPAIGN_ID, {
        name: 'Bandit',
        template_data: sampleTemplate.template_data,
      });

      expect(result.data).toEqual(sampleTemplate);
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ campaign_id: CAMPAIGN_ID, name: 'Bandit' })
      );
    });
  });

  describe('updateTemplate', () => {
    it('updates template fields', async () => {
      const updated = { ...sampleTemplate, name: 'Elite Bandit' };
      const chain = createChainMock();
      chain._setResolve({ data: updated, error: null });
      const client = makeMockClient(chain);

      const result = await updateTemplate(client, 'tmpl-1', { name: 'Elite Bandit' });

      expect(result.data?.name).toBe('Elite Bandit');
    });

    it('returns NOT_FOUND when template missing', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: { message: 'not found', code: 'PGRST116' } });
      const client = makeMockClient(chain);

      const result = await updateTemplate(client, 'nope', { name: 'x' });

      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
    });
  });

  describe('deleteTemplate', () => {
    it('deletes template successfully', async () => {
      const chain = createChainMock();
      chain._setResolve({ data: null, error: null });
      const client = makeMockClient(chain);

      const result = await deleteTemplate(client, 'tmpl-1');

      expect(result.error).toBeNull();
    });
  });
});
