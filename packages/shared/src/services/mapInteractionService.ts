import type { TypedSupabaseClient } from '../lib/supabase';
import type { Database } from '../types/database.types';
import { success, type ServiceResult } from '../types/errors';
import { mapSupabaseError } from './baseService';

// --- Types ---

type MapPinStateRow = Database['public']['Tables']['map_pin_states']['Row'];
type MapTokenRow = Database['public']['Tables']['map_tokens']['Row'];
type UserMapPinRow = Database['public']['Tables']['user_map_pins']['Row'];

export type { MapPinStateRow, MapTokenRow, UserMapPinRow };

// --- Pin State Management ---

/**
 * Upsert a pin state for a specific location on a map.
 * Uses campaign_id + map_id + location_id as the conflict key.
 */
export async function updatePinState(
  client: TypedSupabaseClient,
  campaignId: string,
  mapId: string,
  locationId: string,
  playerDiscovered: string[]
): Promise<ServiceResult<MapPinStateRow>> {
  const { data, error } = await client
    .from('map_pin_states')
    .upsert(
      {
        campaign_id: campaignId,
        map_id: mapId,
        location_id: locationId,
        player_discovered: playerDiscovered,
      },
      { onConflict: 'campaign_id,map_id,location_id' }
    )
    .select()
    .single();

  if (error) return mapSupabaseError<MapPinStateRow>(error);
  return success(data as MapPinStateRow);
}

// --- Token Management ---

/**
 * Create a token on a map for a character.
 */
export async function createToken(
  client: TypedSupabaseClient,
  campaignId: string,
  mapId: string,
  characterId: string,
  x: number,
  y: number
): Promise<ServiceResult<MapTokenRow>> {
  const { data, error } = await client
    .from('map_tokens')
    .insert({
      campaign_id: campaignId,
      map_id: mapId,
      character_id: characterId,
      x,
      y,
    })
    .select()
    .single();

  if (error) return mapSupabaseError<MapTokenRow>(error);
  return success(data as MapTokenRow);
}

/**
 * Move a token to a new position.
 */
export async function moveToken(
  client: TypedSupabaseClient,
  tokenId: string,
  x: number,
  y: number
): Promise<ServiceResult<MapTokenRow>> {
  const { data, error } = await client
    .from('map_tokens')
    .update({ x, y })
    .eq('id', tokenId)
    .select()
    .single();

  if (error) return mapSupabaseError<MapTokenRow>(error);
  return success(data as MapTokenRow);
}

/**
 * Remove a token from the map.
 */
export async function removeToken(
  client: TypedSupabaseClient,
  tokenId: string
): Promise<ServiceResult<void>> {
  const { error } = await client
    .from('map_tokens')
    .delete()
    .eq('id', tokenId);

  if (error) return mapSupabaseError<void>(error);
  return success(undefined as void);
}

// --- User Pin Management ---

/**
 * Get all user pins for a map.
 */
export async function getUserPins(
  client: TypedSupabaseClient,
  mapId: string
): Promise<ServiceResult<UserMapPinRow[]>> {
  const { data, error } = await client
    .from('user_map_pins')
    .select('*')
    .eq('map_id', mapId);

  if (error) return mapSupabaseError<UserMapPinRow[]>(error);
  return success((data ?? []) as UserMapPinRow[]);
}

/**
 * Add a user pin to a map.
 */
export async function addUserPin(
  client: TypedSupabaseClient,
  campaignId: string,
  mapId: string,
  userId: string,
  x: number,
  y: number,
  label?: string | null,
  color?: string | null
): Promise<ServiceResult<UserMapPinRow>> {
  const { data, error } = await client
    .from('user_map_pins')
    .insert({
      campaign_id: campaignId,
      map_id: mapId,
      user_id: userId,
      x,
      y,
      label: label ?? null,
      color: color ?? null,
    })
    .select()
    .single();

  if (error) return mapSupabaseError<UserMapPinRow>(error);
  return success(data as UserMapPinRow);
}

/**
 * Remove a user pin.
 */
export async function removeUserPin(
  client: TypedSupabaseClient,
  pinId: string
): Promise<ServiceResult<void>> {
  const { error } = await client
    .from('user_map_pins')
    .delete()
    .eq('id', pinId);

  if (error) return mapSupabaseError<void>(error);
  return success(undefined as void);
}
