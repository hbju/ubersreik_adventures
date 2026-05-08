import type { TypedSupabaseClient } from '../lib/supabase';
import type { Database, Json } from '../types/database.types';
import { ErrorCode, failure, success, type ServiceResult } from '../types/errors';
import { mapSupabaseError } from './baseService';

// --- Types ---

type QuestRow = Database['public']['Tables']['quests']['Row'];
type QuestInsert = Database['public']['Tables']['quests']['Insert'];
type QuestUpdate = Database['public']['Tables']['quests']['Update'];

export type { QuestRow, QuestInsert, QuestUpdate };

export interface QuestObjective {
  text: string;
  completed: boolean;
}

// --- Service Functions ---

/**
 * Get quests for a campaign, with optional status filter.
 */
export async function getQuests(
  client: TypedSupabaseClient,
  campaignId: string,
  status?: string
): Promise<ServiceResult<QuestRow[]>> {
  let query = client
    .from('quests')
    .select('*')
    .eq('campaign_id', campaignId);

  if (status !== undefined) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) return mapSupabaseError<QuestRow[]>(error);
  return success((data ?? []) as QuestRow[]);
}

/**
 * Create a new quest.
 */
export async function createQuest(
  client: TypedSupabaseClient,
  campaignId: string,
  questData: Omit<QuestInsert, 'campaign_id'>
): Promise<ServiceResult<QuestRow>> {
  const { data, error } = await client
    .from('quests')
    .insert({ ...questData, campaign_id: campaignId })
    .select()
    .single();

  if (error) return mapSupabaseError<QuestRow>(error);
  return success(data as QuestRow);
}

/**
 * Update a quest (title, description, status).
 */
export async function updateQuest(
  client: TypedSupabaseClient,
  questId: string,
  updates: QuestUpdate
): Promise<ServiceResult<QuestRow>> {
  const { data, error } = await client
    .from('quests')
    .update(updates)
    .eq('id', questId)
    .select()
    .single();

  if (error) return mapSupabaseError<QuestRow>(error);
  return success(data as QuestRow);
}

/**
 * Toggle the completed state of a single objective by index.
 * Fetches current objectives, flips the target, writes back.
 */
export async function toggleObjective(
  client: TypedSupabaseClient,
  questId: string,
  objectiveIndex: number
): Promise<ServiceResult<QuestRow>> {
  // Fetch current quest
  const { data: quest, error: fetchError } = await client
    .from('quests')
    .select('objectives')
    .eq('id', questId)
    .single();

  if (fetchError) return mapSupabaseError<QuestRow>(fetchError);

  const objectives = (quest as { objectives: Json }).objectives;
  if (!Array.isArray(objectives)) {
    return failure<QuestRow>(ErrorCode.VALIDATION_ERROR, 'Objectives is not an array');
  }

  if (objectiveIndex < 0 || objectiveIndex >= objectives.length) {
    return failure<QuestRow>(
      ErrorCode.VALIDATION_ERROR,
      `Objective index ${objectiveIndex} out of bounds (0-${objectives.length - 1})`
    );
  }

  const updated = objectives.map((obj: any, i: number) =>
    i === objectiveIndex ? { ...obj, completed: !obj.completed } : obj
  );

  const { data, error } = await client
    .from('quests')
    .update({ objectives: updated as Json })
    .eq('id', questId)
    .select()
    .single();

  if (error) return mapSupabaseError<QuestRow>(error);
  return success(data as QuestRow);
}

/**
 * Delete a quest.
 */
export async function deleteQuest(
  client: TypedSupabaseClient,
  questId: string
): Promise<ServiceResult<void>> {
  const { error } = await client
    .from('quests')
    .delete()
    .eq('id', questId);

  if (error) return mapSupabaseError<void>(error);
  return success(undefined as void);
}
