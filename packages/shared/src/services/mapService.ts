import type { TypedSupabaseClient } from '../lib/supabase';
import type { Database } from '../types/database.types';
import { success, type ServiceResult } from '../types/errors';
import { mapSupabaseError } from './baseService';

// --- Types ---

type MapRow = Database['public']['Tables']['maps']['Row'];
type MapInsert = Database['public']['Tables']['maps']['Insert'];
type MapUpdate = Database['public']['Tables']['maps']['Update'];
type MapPinStateRow = Database['public']['Tables']['map_pin_states']['Row'];
type MapTokenRow = Database['public']['Tables']['map_tokens']['Row'];
type UserMapPinRow = Database['public']['Tables']['user_map_pins']['Row'];

export type { MapRow, MapInsert, MapUpdate };

export interface MapWithDetails extends MapRow {
  pin_states: MapPinStateRow[];
  tokens: MapTokenRow[];
  user_pins: UserMapPinRow[];
}

// --- Service Functions ---

/**
 * Get all maps for a campaign (metadata only, no related entities).
 */
export async function getMaps(
  client: TypedSupabaseClient,
  campaignId: string
): Promise<ServiceResult<MapRow[]>> {
  const { data, error } = await client
    .from('maps')
    .select('*')
    .eq('campaign_id', campaignId);

  if (error) return mapSupabaseError<MapRow[]>(error);
  return success((data ?? []) as MapRow[]);
}

/**
 * Get a map with all its related data: pin states, tokens, and user pins.
 */
export async function getMapWithDetails(
  client: TypedSupabaseClient,
  mapId: string
): Promise<ServiceResult<MapWithDetails>> {
  const { data: map, error: mapError } = await client
    .from('maps')
    .select('*')
    .eq('id', mapId)
    .single();

  if (mapError) return mapSupabaseError<MapWithDetails>(mapError);

  // Fetch related entities in parallel
  const [pinStatesResult, tokensResult, userPinsResult] = await Promise.all([
    client.from('map_pin_states').select('*').eq('map_id', mapId),
    client.from('map_tokens').select('*').eq('map_id', mapId),
    client.from('user_map_pins').select('*').eq('map_id', mapId),
  ]);

  if (pinStatesResult.error) return mapSupabaseError<MapWithDetails>(pinStatesResult.error);
  if (tokensResult.error) return mapSupabaseError<MapWithDetails>(tokensResult.error);
  if (userPinsResult.error) return mapSupabaseError<MapWithDetails>(userPinsResult.error);

  return success({
    ...(map as MapRow),
    pin_states: (pinStatesResult.data ?? []) as MapPinStateRow[],
    tokens: (tokensResult.data ?? []) as MapTokenRow[],
    user_pins: (userPinsResult.data ?? []) as UserMapPinRow[],
  });
}

/**
 * Create a new map.
 */
export async function createMap(
  client: TypedSupabaseClient,
  campaignId: string,
  mapData: Omit<MapInsert, 'campaign_id'>
): Promise<ServiceResult<MapRow>> {
  const { data, error } = await client
    .from('maps')
    .insert({ ...mapData, campaign_id: campaignId })
    .select()
    .single();

  if (error) return mapSupabaseError<MapRow>(error);
  return success(data as MapRow);
}

/**
 * Update a map (name, locations JSONB, grid_size, spawn_point, etc.).
 */
export async function updateMap(
  client: TypedSupabaseClient,
  mapId: string,
  updates: MapUpdate
): Promise<ServiceResult<MapRow>> {
  const { data, error } = await client
    .from('maps')
    .update(updates)
    .eq('id', mapId)
    .select()
    .single();

  if (error) return mapSupabaseError<MapRow>(error);
  return success(data as MapRow);
}

/**
 * Delete a map (cascading via FK constraints removes pin_states, tokens, user_pins).
 */
export async function deleteMap(
  client: TypedSupabaseClient,
  mapId: string
): Promise<ServiceResult<void>> {
  const { error } = await client
    .from('maps')
    .delete()
    .eq('id', mapId);

  if (error) return mapSupabaseError<void>(error);
  return success(undefined as void);
}

/**
 * Set the active map for a campaign.
 */
export async function setActiveMap(
  client: TypedSupabaseClient,
  campaignId: string,
  mapId: string | null
): Promise<ServiceResult<void>> {
  const { error } = await client
    .from('campaigns')
    .update({ active_map_id: mapId })
    .eq('id', campaignId);

  if (error) return mapSupabaseError<void>(error);
  return success(undefined as void);
}
