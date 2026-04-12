/**
 * Character CRUD queries
 */
import { getSupabase } from '../client';
import { assembleCharacter, decomposeCharacter } from './assemblers';
import type { Character } from '../../types/wfrp.types';

/**
 * Get a single character with all sub-tables via the get_full_character RPC.
 */
export async function getCharacter(id: string): Promise<Character | null> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('get_full_character', { p_character_id: id });
  if (error) throw error;
  if (!data) return null;
  return assembleCharacter(data as Record<string, any>);
}

/**
 * Save (upsert) a character and all its sub-tables atomically via RPC.
 */
export async function saveCharacter(campaignId: string, character: Character): Promise<string> {
  const sb = getSupabase();
  const payload = decomposeCharacter(character, campaignId);
  const { data, error } = await sb.rpc('save_character', { p_data: payload });
  if (error) {
    throw error;
  }
  return data as string;
}

export async function saveCharacterRelationships(characterId: string, character: Character): Promise<void> {
  const sb = getSupabase();
  const relationships = (character.lore?.relationships ?? []).map(r => ({
    target_character_id: r.targetCharacterId,
    type: r.type,
    description: r.description,
  }));
  const { error } = await sb.rpc('save_character_relationships', {
    p_character_id: characterId,
    p_relationships: relationships,
  });
  if (error) throw error;
}

/**
 * List all characters in a campaign (lightweight — no sub-table joins).
 */
export async function listCharacters(campaignId: string) {
  const sb = getSupabase();
  const { data, error } = await sb.from('characters')
    .select('id, name, species, class, current_career_id, user_id, is_minion, template_id, image_path')
    .eq('campaign_id', campaignId);
  if (error) throw error;
  return data;
}

/**
 * Load all characters in a campaign with full data (for GM initial load).
 */
export async function getAllCharacters(campaignId: string): Promise<Character[]> {
  const sb = getSupabase();
  const { data: charRows, error } = await sb.from('characters')
    .select('id')
    .eq('campaign_id', campaignId);
  if (error) throw error;
  if (!charRows?.length) return [];

  // Load each via RPC (could be optimised with a batch RPC later)
  const characters: Character[] = [];
  for (const row of charRows) {
    const char = await getCharacter(row.id);
    if (char) characters.push(char);
  }
  return characters;
}

/**
 * Delete a character (cascades to all sub-tables).
 */
export async function deleteCharacter(id: string) {
  const sb = getSupabase();
  const { error } = await sb.from('characters').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Quick-update specific fields on a character (e.g. wounds, conditions in combat).
 */
export async function updateCharacterFields(id: string, fields: Record<string, any>) {
  const sb = getSupabase();
  const { error } = await sb.from('characters').update(fields as any).eq('id', id);
  if (error) throw error;
}
