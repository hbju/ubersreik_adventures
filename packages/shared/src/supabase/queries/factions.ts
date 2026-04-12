/**
 * Faction & territory CRUD queries
 */
import { getSupabase } from '../client';
import { assembleFaction } from './assemblers';
import type { Faction, LocationTerritory } from '../../types/wfrp.types';

export async function getFactions(campaignId: string): Promise<Faction[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from('factions')
    .select('*')
    .eq('campaign_id', campaignId);
  if (error) throw error;
  return (data ?? []).map(assembleFaction);
}

export async function upsertFaction(campaignId: string, faction: Faction) {
  const sb = getSupabase();
  const { data, error } = await sb.from('factions').upsert({
    campaign_id: campaignId,
    faction_key: faction.id,
    name: faction.name,
    description: faction.description,
    category: faction.category,
    icon: faction.icon ?? null,
    hq: faction.hq,
    head: faction.head,
    default_reputation: faction.defaultReputation,
    color: faction.color ?? null,
  }, { onConflict: 'campaign_id,faction_key' }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteFaction(campaignId: string, factionKey: string) {
  const sb = getSupabase();
  const { error } = await sb.from('factions')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('faction_key', factionKey);
  if (error) throw error;
}

// Territories

export async function getTerritories(campaignId: string): Promise<Record<string, LocationTerritory>> {
  const sb = getSupabase();
  const { data, error } = await sb.from('location_territories')
    .select('*')
    .eq('campaign_id', campaignId);
  if (error) throw error;

  const result: Record<string, LocationTerritory> = {};
  for (const row of (data ?? [])) {
    result[row.location_id] = {
      controllingFactionId: row.controlling_faction_id,
      influenceWeight: row.influence_weight ?? 1,
    };
  }
  return result;
}

export async function setTerritory(campaignId: string, locationId: string, factionDbId: string, weight: number) {
  const sb = getSupabase();
  const { error } = await sb.from('location_territories').upsert({
    campaign_id: campaignId,
    location_id: locationId,
    controlling_faction_id: factionDbId,
    influence_weight: weight,
  }, { onConflict: 'campaign_id,location_id' });
  if (error) throw error;
}

export async function removeTerritory(campaignId: string, locationId: string) {
  const sb = getSupabase();
  const { error } = await sb.from('location_territories')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('location_id', locationId);
  if (error) throw error;
}
