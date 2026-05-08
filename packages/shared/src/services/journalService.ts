import type { TypedSupabaseClient } from '../lib/supabase';
import type { Database } from '../types/database.types';
import { success, type ServiceResult } from '../types/errors';
import { mapSupabaseError } from './baseService';

// --- Types ---

type JournalEntryRow = Database['public']['Tables']['journal_entries']['Row'];
type JournalEntryInsert = Database['public']['Tables']['journal_entries']['Insert'];
type JournalEntryUpdate = Database['public']['Tables']['journal_entries']['Update'];

export type { JournalEntryRow, JournalEntryInsert, JournalEntryUpdate };

// --- Service Functions ---

/**
 * Get journal entries visible to a specific user.
 * Returns entries that are public OR where the user is in shared_with.
 */
export async function getVisibleEntries(
  client: TypedSupabaseClient,
  campaignId: string,
  userId: string
): Promise<ServiceResult<JournalEntryRow[]>> {
  const { data, error } = await client
    .from('journal_entries')
    .select('*')
    .eq('campaign_id', campaignId)
    .or(`is_public.eq.true,shared_with.cs.{${userId}}`);

  if (error) return mapSupabaseError<JournalEntryRow[]>(error);
  return success((data ?? []) as JournalEntryRow[]);
}

/**
 * Get all journal entries for a campaign (GM-only, no visibility filtering).
 */
export async function getAllEntries(
  client: TypedSupabaseClient,
  campaignId: string
): Promise<ServiceResult<JournalEntryRow[]>> {
  const { data, error } = await client
    .from('journal_entries')
    .select('*')
    .eq('campaign_id', campaignId);

  if (error) return mapSupabaseError<JournalEntryRow[]>(error);
  return success((data ?? []) as JournalEntryRow[]);
}

/**
 * Create a new journal entry.
 */
export async function createEntry(
  client: TypedSupabaseClient,
  campaignId: string,
  entryData: Omit<JournalEntryInsert, 'campaign_id'>
): Promise<ServiceResult<JournalEntryRow>> {
  const { data, error } = await client
    .from('journal_entries')
    .insert({ ...entryData, campaign_id: campaignId })
    .select()
    .single();

  if (error) return mapSupabaseError<JournalEntryRow>(error);
  return success(data as JournalEntryRow);
}

/**
 * Update a journal entry.
 */
export async function updateEntry(
  client: TypedSupabaseClient,
  entryId: string,
  updates: JournalEntryUpdate
): Promise<ServiceResult<JournalEntryRow>> {
  const { data, error } = await client
    .from('journal_entries')
    .update(updates)
    .eq('id', entryId)
    .select()
    .single();

  if (error) return mapSupabaseError<JournalEntryRow>(error);
  return success(data as JournalEntryRow);
}

/**
 * Delete a journal entry.
 */
export async function deleteEntry(
  client: TypedSupabaseClient,
  entryId: string
): Promise<ServiceResult<void>> {
  const { error } = await client
    .from('journal_entries')
    .delete()
    .eq('id', entryId);

  if (error) return mapSupabaseError<void>(error);
  return success(undefined as void);
}

/**
 * Update the shared_with list for a journal entry.
 */
export async function shareEntry(
  client: TypedSupabaseClient,
  entryId: string,
  userIds: string[]
): Promise<ServiceResult<JournalEntryRow>> {
  const { data, error } = await client
    .from('journal_entries')
    .update({ shared_with: userIds })
    .eq('id', entryId)
    .select()
    .single();

  if (error) return mapSupabaseError<JournalEntryRow>(error);
  return success(data as JournalEntryRow);
}
