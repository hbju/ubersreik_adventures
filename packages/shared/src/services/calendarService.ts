import type { TypedSupabaseClient } from '../lib/supabase';
import type { Json } from '../types/database.types';
import { success, type ServiceResult } from '../types/errors';
import { mapSupabaseError } from './baseService';

// --- Service Functions ---

/**
 * Get the calendar state for a campaign.
 * Returns null if no calendar state has been set.
 */
export async function getCalendarState(
  client: TypedSupabaseClient,
  campaignId: string
): Promise<ServiceResult<Json | null>> {
  const { data, error } = await client
    .from('campaigns')
    .select('calendar_state')
    .eq('id', campaignId)
    .single();

  if (error) return mapSupabaseError<Json | null>(error);
  return success((data as { calendar_state: Json | null }).calendar_state);
}

/**
 * Update the calendar state for a campaign.
 */
export async function updateCalendarState(
  client: TypedSupabaseClient,
  campaignId: string,
  calendarState: Json
): Promise<ServiceResult<Json>> {
  const { data, error } = await client
    .from('campaigns')
    .update({ calendar_state: calendarState })
    .eq('id', campaignId)
    .select('calendar_state')
    .single();

  if (error) return mapSupabaseError<Json>(error);
  return success((data as { calendar_state: Json }).calendar_state);
}
