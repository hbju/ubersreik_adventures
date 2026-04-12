/**
 * Map, token, and pin CRUD queries
 */
import { getSupabase } from '../client';
import { assembleMapData, assembleMapToken, assembleUserMapPin } from './assemblers';
import type { MapData, MapToken, UserMapPin, MapPinState } from '../../types/wfrp.types';

// ─── Campaign Maps ──────────────────────────────────────────────────────────

export async function getMaps(campaignId: string): Promise<Record<string, MapData>> {
  const sb = getSupabase();
  const { data: maps, error } = await sb.from('campaign_maps')
    .select('*, campaign_map_locations(*)')
    .eq('campaign_id', campaignId);
  if (error) throw error;

  const result: Record<string, MapData> = {};
  for (const m of (maps ?? [])) {
    const mapData = assembleMapData(m, m.campaign_map_locations ?? []);
    result[mapData.id] = mapData;
  }
  return result;
}

export async function upsertMap(campaignId: string, mapData: MapData) {
  const sb = getSupabase();
  const { data, error } = await sb.from('campaign_maps').upsert({
    campaign_id: campaignId,
    map_key: mapData.id,
    name: mapData.name,
    image_path: mapData.imagePath,
    grid_size: mapData.gridSize,
    spawn_point_x: mapData.spawnPoint?.x ?? null,
    spawn_point_y: mapData.spawnPoint?.y ?? null,
  }, { onConflict: 'campaign_id,map_key' }).select().single();
  if (error) throw error;

  // Upsert locations (delete + insert for simplicity)
  await sb.from('campaign_map_locations').delete().eq('map_id', data.id);
  if (mapData.locations.length) {
    await sb.from('campaign_map_locations').insert(
      mapData.locations.map(loc => ({
        map_id: data.id,
        location_key: loc.id,
        name: loc.name,
        coords_x: loc.coords.x,
        coords_y: loc.coords.y,
        player_description: loc.playerDescription || null,
        gm_notes: loc.gmNotes || null,
        image: loc.image || null,
        music: loc.music || null,
        hooks: loc.hooks ?? [],
        tag: loc.tag || null,
        controlling_faction_id: loc.controllingFactionId ?? null,
        influence_weight: loc.influenceWeight ?? null,
      }))
    );
  }

  return data;
}

// ─── Map Pin Discoveries ────────────────────────────────────────────────────

export async function getMapPinStates(campaignId: string): Promise<Record<string, MapPinState>> {
  const sb = getSupabase();
  const { data, error } = await sb.from('map_pin_discoveries')
    .select('*')
    .eq('campaign_id', campaignId);
  if (error) throw error;

  const result: Record<string, MapPinState> = {};
  for (const row of (data ?? [])) {
    if (!result[row.location_key]) {
      result[row.location_key] = { playerDiscovered: [] };
    }
    result[row.location_key].playerDiscovered.push(row.character_id);
  }
  return result;
}

export async function discoverPin(campaignId: string, locationKey: string, characterId: string) {
  const sb = getSupabase();
  const { error } = await sb.from('map_pin_discoveries').upsert({
    campaign_id: campaignId,
    location_key: locationKey,
    character_id: characterId,
  }, { onConflict: 'campaign_id,location_key,character_id' });
  if (error) throw error;
}

export async function undiscoverPin(campaignId: string, locationKey: string, characterId: string) {
  const sb = getSupabase();
  const { error } = await sb.from('map_pin_discoveries')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('location_key', locationKey)
    .eq('character_id', characterId);
  if (error) throw error;
}

// ─── Map Tokens ─────────────────────────────────────────────────────────────

export async function getTokens(campaignId: string): Promise<MapToken[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from('map_tokens')
    .select('*')
    .eq('campaign_id', campaignId);
  if (error) throw error;
  return (data ?? []).map(assembleMapToken);
}

export async function upsertToken(campaignId: string, token: MapToken) {
  const sb = getSupabase();
  const { error } = await sb.from('map_tokens').upsert({
    id: token.id,
    campaign_id: campaignId,
    character_id: token.characterId,
    character_name: token.characterName ?? null,
    map_id: token.mapId,
    x: token.x,
    y: token.y,
  });
  if (error) throw error;
}

export async function deleteToken(id: string) {
  const sb = getSupabase();
  const { error } = await sb.from('map_tokens').delete().eq('id', id);
  if (error) throw error;
}

// ─── User Map Pins ──────────────────────────────────────────────────────────

export async function getUserPins(campaignId: string): Promise<UserMapPin[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from('user_map_pins')
    .select('*')
    .eq('campaign_id', campaignId);
  if (error) throw error;
  return (data ?? []).map(assembleUserMapPin);
}

export async function createUserPin(campaignId: string, pin: Omit<UserMapPin, 'id'>) {
  const sb = getSupabase();
  const { data, error } = await sb.from('user_map_pins').insert({
    campaign_id: campaignId,
    user_id: pin.playerId,
    character_id: pin.characterId,
    map_id: pin.mapId,
    x: pin.x,
    y: pin.y,
    label: pin.label,
    color: pin.color ?? null,
  }).select().single();
  if (error) throw error;
  return assembleUserMapPin(data);
}

export async function updateUserPin(id: string, updates: { x?: number; y?: number; label?: string; color?: string }) {
  const sb = getSupabase();
  const { error } = await sb.from('user_map_pins').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteUserPin(id: string) {
  const sb = getSupabase();
  const { error } = await sb.from('user_map_pins').delete().eq('id', id);
  if (error) throw error;
}
