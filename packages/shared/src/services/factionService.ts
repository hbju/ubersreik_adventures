import type { TypedSupabaseClient } from '../lib/supabase';
import type { Database } from '../types/database.types';
import { success, type ServiceResult } from '../types/errors';
import { mapSupabaseError } from './baseService';

// --- Types ---

type FactionRow = Database['public']['Tables']['factions']['Row'];
type FactionInsert = Database['public']['Tables']['factions']['Insert'];
type FactionUpdate = Database['public']['Tables']['factions']['Update'];
type TerritoryRow = Database['public']['Tables']['location_territories']['Row'];

export type { FactionRow, FactionInsert, FactionUpdate, TerritoryRow };

// --- Faction CRUD ---

/**
 * Get all factions for a campaign.
 */
export async function getFactions(
  client: TypedSupabaseClient,
  campaignId: string
): Promise<ServiceResult<FactionRow[]>> {
  const { data, error } = await client
    .from('factions')
    .select('*')
    .eq('campaign_id', campaignId);

  if (error) return mapSupabaseError<FactionRow[]>(error);
  return success((data ?? []) as FactionRow[]);
}

/**
 * Create a new faction.
 */
export async function createFaction(
  client: TypedSupabaseClient,
  campaignId: string,
  factionData: Omit<FactionInsert, 'campaign_id'>
): Promise<ServiceResult<FactionRow>> {
  const { data, error } = await client
    .from('factions')
    .insert({ ...factionData, campaign_id: campaignId })
    .select()
    .single();

  if (error) return mapSupabaseError<FactionRow>(error);
  return success(data as FactionRow);
}

/**
 * Update a faction.
 */
export async function updateFaction(
  client: TypedSupabaseClient,
  factionId: string,
  updates: FactionUpdate
): Promise<ServiceResult<FactionRow>> {
  const { data, error } = await client
    .from('factions')
    .update(updates)
    .eq('id', factionId)
    .select()
    .single();

  if (error) return mapSupabaseError<FactionRow>(error);
  return success(data as FactionRow);
}

/**
 * Delete a faction.
 */
export async function deleteFaction(
  client: TypedSupabaseClient,
  factionId: string
): Promise<ServiceResult<void>> {
  const { error } = await client
    .from('factions')
    .delete()
    .eq('id', factionId);

  if (error) return mapSupabaseError<void>(error);
  return success(undefined as void);
}

// --- Territories ---

/**
 * Get all location territories for a campaign.
 */
export async function getTerritories(
  client: TypedSupabaseClient,
  campaignId: string
): Promise<ServiceResult<TerritoryRow[]>> {
  const { data, error } = await client
    .from('location_territories')
    .select('*')
    .eq('campaign_id', campaignId);

  if (error) return mapSupabaseError<TerritoryRow[]>(error);
  return success((data ?? []) as TerritoryRow[]);
}

/**
 * Upsert a territory assignment for a location.
 * If a territory for this campaign+location already exists, it is updated;
 * otherwise a new row is inserted.
 */
export async function setTerritory(
  client: TypedSupabaseClient,
  campaignId: string,
  locationId: string,
  factionId: string | null,
  controlLevel: number
): Promise<ServiceResult<TerritoryRow>> {
  const { data, error } = await client
    .from('location_territories')
    .upsert(
      {
        campaign_id: campaignId,
        location_id: locationId,
        faction_id: factionId,
        control_level: controlLevel,
      },
      { onConflict: 'campaign_id,location_id' }
    )
    .select()
    .single();

  if (error) return mapSupabaseError<TerritoryRow>(error);
  return success(data as TerritoryRow);
}

// --- Character Reputation ---

/**
 * Get a character's reputation map from their reputations JSONB.
 * Returns a Record<factionId, reputationValue>.
 */
export async function getCharacterReputations(
  client: TypedSupabaseClient,
  characterId: string
): Promise<ServiceResult<Record<string, number>>> {
  const { data, error } = await client
    .from('characters')
    .select('reputations')
    .eq('id', characterId)
    .single();

  if (error) return mapSupabaseError<Record<string, number>>(error);

  const reputations = (data as { reputations: unknown }).reputations;
  if (reputations && typeof reputations === 'object' && !Array.isArray(reputations)) {
    return success(reputations as Record<string, number>);
  }
  return success({});
}

/**
 * Update a single faction reputation value on a character.
 * Merges into the existing reputations JSONB.
 */
export async function updateCharacterReputation(
  client: TypedSupabaseClient,
  characterId: string,
  factionId: string,
  value: number
): Promise<ServiceResult<Record<string, number>>> {
  // Fetch current reputations
  const { data: current, error: fetchError } = await client
    .from('characters')
    .select('reputations')
    .eq('id', characterId)
    .single();

  if (fetchError) return mapSupabaseError<Record<string, number>>(fetchError);

  const existing = (current as { reputations: unknown }).reputations;
  const merged: Record<string, number> = {
    ...(existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, number>)
      : {}),
    [factionId]: value,
  };

  const { error: updateError } = await client
    .from('characters')
    .update({ reputations: merged as any })
    .eq('id', characterId);

  if (updateError) return mapSupabaseError<Record<string, number>>(updateError);
  return success(merged);
}
