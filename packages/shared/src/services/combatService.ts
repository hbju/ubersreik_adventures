import type { TypedSupabaseClient } from '../lib/supabase';
import type { Database, Json } from '../types/database.types';
import { success, type ServiceResult } from '../types/errors';
import { mapSupabaseError } from './baseService';

// --- Types ---

type CombatStateRow = Database['public']['Tables']['combat_state']['Row'];
type CombatStateUpdate = Database['public']['Tables']['combat_state']['Update'];

export type { CombatStateRow, CombatStateUpdate };

const DEFAULT_COMBAT_STATE = {
  combatants: [] as Json,
  current_turn_index: 0,
  round_number: 1,
  is_active: false,
  player_advantage: 0,
  enemy_advantage: 0,
};

// --- Service Functions ---

/**
 * Get the combat state for a campaign. Creates a default if none exists.
 */
export async function getCombatState(
  client: TypedSupabaseClient,
  campaignId: string
): Promise<ServiceResult<CombatStateRow>> {
  const { data, error } = await client
    .from('combat_state')
    .select('*')
    .eq('campaign_id', campaignId)
    .single();

  if (error && error.code === 'PGRST116') {
    // No combat state exists yet — create default
    const { data: created, error: createError } = await client
      .from('combat_state')
      .insert({ campaign_id: campaignId, ...DEFAULT_COMBAT_STATE })
      .select()
      .single();

    if (createError) return mapSupabaseError<CombatStateRow>(createError);
    return success(created as CombatStateRow);
  }

  if (error) return mapSupabaseError<CombatStateRow>(error);
  return success(data as CombatStateRow);
}

/**
 * Update the combat state for a campaign. Uses upsert for idempotency.
 */
export async function updateCombatState(
  client: TypedSupabaseClient,
  campaignId: string,
  updates: CombatStateUpdate
): Promise<ServiceResult<CombatStateRow>> {
  const { data, error } = await client
    .from('combat_state')
    .upsert(
      { campaign_id: campaignId, ...updates },
      { onConflict: 'campaign_id' }
    )
    .select()
    .single();

  if (error) return mapSupabaseError<CombatStateRow>(error);
  return success(data as CombatStateRow);
}

/**
 * Reset combat state to defaults for a campaign.
 */
export async function clearCombatState(
  client: TypedSupabaseClient,
  campaignId: string
): Promise<ServiceResult<CombatStateRow>> {
  const { data, error } = await client
    .from('combat_state')
    .upsert(
      { campaign_id: campaignId, ...DEFAULT_COMBAT_STATE },
      { onConflict: 'campaign_id' }
    )
    .select()
    .single();

  if (error) return mapSupabaseError<CombatStateRow>(error);
  return success(data as CombatStateRow);
}
