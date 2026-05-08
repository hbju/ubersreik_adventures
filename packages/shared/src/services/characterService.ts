import type { TypedSupabaseClient } from '../lib/supabase';
import type { Database, Json } from '../types/database.types';
import { ErrorCode, failure, success, type ServiceResult } from '../types/errors';
import { mapSupabaseError } from './baseService';

// --- Types ---

type CharacterRow = Database['public']['Tables']['characters']['Row'];
type CharacterInsert = Database['public']['Tables']['characters']['Insert'];
type CharacterUpdate = Database['public']['Tables']['characters']['Update'];
type TemplateRow = Database['public']['Tables']['character_templates']['Row'];

export type { CharacterRow, CharacterInsert, CharacterUpdate };

export interface CharacterFilters {
  userId?: string;
  tags?: string[];
  isMinion?: boolean;
}

// JSONB fields that support deep merge on update
const JSONB_FIELDS: ReadonlySet<string> = new Set([
  'characteristics',
  'skills',
  'talents',
  'inventory',
  'conditions',
  'currency',
  'details',
  'status',
  'career_history',
  'reputations',
  'lore',
  'action_bar',
]);

// --- Service Functions ---

/**
 * Get all characters for a campaign, with optional filters.
 */
export async function getCharacters(
  client: TypedSupabaseClient,
  campaignId: string,
  filters?: CharacterFilters
): Promise<ServiceResult<CharacterRow[]>> {
  let query = client
    .from('characters')
    .select('*')
    .eq('campaign_id', campaignId);

  if (filters?.userId !== undefined) {
    query = query.eq('user_id', filters.userId);
  }
  if (filters?.isMinion !== undefined) {
    query = query.eq('is_minion', filters.isMinion);
  }
  if (filters?.tags && filters.tags.length > 0) {
    query = query.overlaps('tags', filters.tags);
  }

  const { data, error } = await query;

  if (error) return mapSupabaseError<CharacterRow[]>(error);
  return success((data ?? []) as CharacterRow[]);
}

/**
 * Get a single character by ID.
 */
export async function getCharacterById(
  client: TypedSupabaseClient,
  characterId: string
): Promise<ServiceResult<CharacterRow>> {
  const { data, error } = await client
    .from('characters')
    .select('*')
    .eq('id', characterId)
    .single();

  if (error) return mapSupabaseError<CharacterRow>(error);
  return success(data as CharacterRow);
}

/**
 * Create a new character in a campaign.
 */
export async function createCharacter(
  client: TypedSupabaseClient,
  campaignId: string,
  characterData: Omit<CharacterInsert, 'campaign_id'>
): Promise<ServiceResult<CharacterRow>> {
  const { data, error } = await client
    .from('characters')
    .insert({ ...characterData, campaign_id: campaignId })
    .select()
    .single();

  if (error) return mapSupabaseError<CharacterRow>(error);
  return success(data as CharacterRow);
}

/**
 * Partially update a character. JSONB fields are deep-merged with existing values;
 * scalar fields are replaced directly.
 */
export async function updateCharacter(
  client: TypedSupabaseClient,
  characterId: string,
  updates: CharacterUpdate
): Promise<ServiceResult<CharacterRow>> {
  // Separate JSONB fields that need merging from scalar fields
  const jsonbUpdates: Record<string, Json> = {};
  const scalarUpdates: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (JSONB_FIELDS.has(key) && value !== null && typeof value === 'object') {
      jsonbUpdates[key] = value as Json;
    } else {
      scalarUpdates[key] = value;
    }
  }

  // If there are JSONB fields to merge, fetch current values first
  if (Object.keys(jsonbUpdates).length > 0) {
    const { data: current, error: fetchError } = await client
      .from('characters')
      .select('*')
      .eq('id', characterId)
      .single();

    if (fetchError) return mapSupabaseError<CharacterRow>(fetchError);

    // Merge each JSONB field
    for (const [key, incoming] of Object.entries(jsonbUpdates)) {
      const existing = (current as Record<string, unknown>)[key];
      if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
        scalarUpdates[key] = { ...(existing as Record<string, unknown>), ...(incoming as Record<string, unknown>) };
      } else {
        scalarUpdates[key] = incoming;
      }
    }
  }

  const { data, error } = await client
    .from('characters')
    .update(scalarUpdates as CharacterUpdate)
    .eq('id', characterId)
    .select()
    .single();

  if (error) return mapSupabaseError<CharacterRow>(error);
  return success(data as CharacterRow);
}

/**
 * Delete a character by ID.
 */
export async function deleteCharacter(
  client: TypedSupabaseClient,
  characterId: string
): Promise<ServiceResult<void>> {
  const { error } = await client
    .from('characters')
    .delete()
    .eq('id', characterId);

  if (error) return mapSupabaseError<void>(error);
  return success(undefined as void);
}

/**
 * Assign a character to a user.
 */
export async function assignCharacterToUser(
  client: TypedSupabaseClient,
  characterId: string,
  userId: string
): Promise<ServiceResult<CharacterRow>> {
  const { data, error } = await client
    .from('characters')
    .update({ user_id: userId })
    .eq('id', characterId)
    .select()
    .single();

  if (error) return mapSupabaseError<CharacterRow>(error);
  return success(data as CharacterRow);
}

/**
 * Unassign a character (set user_id to null).
 */
export async function unassignCharacter(
  client: TypedSupabaseClient,
  characterId: string
): Promise<ServiceResult<CharacterRow>> {
  const { data, error } = await client
    .from('characters')
    .update({ user_id: null })
    .eq('id', characterId)
    .select()
    .single();

  if (error) return mapSupabaseError<CharacterRow>(error);
  return success(data as CharacterRow);
}

/**
 * Create a character from a template, with optional field overrides.
 */
export async function createFromTemplate(
  client: TypedSupabaseClient,
  campaignId: string,
  templateId: string,
  overrides?: Partial<CharacterInsert>
): Promise<ServiceResult<CharacterRow>> {
  // Fetch the template
  const { data: template, error: tmplError } = await client
    .from('character_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (tmplError) return mapSupabaseError<CharacterRow>(tmplError);

  const templateData = (template as TemplateRow).template_data as Record<string, unknown>;

  const characterData: CharacterInsert = {
    ...(templateData as unknown as Omit<CharacterInsert, 'campaign_id'>),
    campaign_id: campaignId,
    template_id: templateId,
    ...overrides,
  };

  const { data, error } = await client
    .from('characters')
    .insert(characterData)
    .select()
    .single();

  if (error) return mapSupabaseError<CharacterRow>(error);
  return success(data as CharacterRow);
}

/**
 * Bulk-create minions from a template.
 */
export async function batchCreateMinions(
  client: TypedSupabaseClient,
  campaignId: string,
  templateId: string,
  count: number
): Promise<ServiceResult<CharacterRow[]>> {
  if (count < 1 || count > 100) {
    return failure<CharacterRow[]>(
      ErrorCode.VALIDATION_ERROR,
      `Count must be between 1 and 100, got ${count}`
    );
  }

  // Fetch the template
  const { data: template, error: tmplError } = await client
    .from('character_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (tmplError) return mapSupabaseError<CharacterRow[]>(tmplError);

  const templateData = (template as TemplateRow).template_data as Record<string, unknown>;
  const baseName = (templateData as { name?: string }).name ?? 'Minion';

  const rows: CharacterInsert[] = Array.from({ length: count }, (_, i) => ({
    ...(templateData as unknown as Omit<CharacterInsert, 'campaign_id'>),
    campaign_id: campaignId,
    template_id: templateId,
    is_minion: true,
    name: `${baseName} ${i + 1}`,
  }));

  const { data, error } = await client
    .from('characters')
    .insert(rows)
    .select();

  if (error) return mapSupabaseError<CharacterRow[]>(error);
  return success((data ?? []) as CharacterRow[]);
}
