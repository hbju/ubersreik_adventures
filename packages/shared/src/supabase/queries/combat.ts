/**
 * Combat state & combatant CRUD queries
 */
import { getSupabase } from '../client';
import { assembleCombatant, assembleAdvantages } from './assemblers';
import type { Combatant, Advantages } from '../../types/wfrp.types';

export async function getCombatState(campaignId: string) {
  const sb = getSupabase();
  const { data, error } = await sb.from('combat_state')
    .select('*')
    .eq('campaign_id', campaignId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ? {
    isActive: data.is_active,
    currentTurnId: data.current_turn_id,
    ...assembleAdvantages(data),
  } : null;
}

export async function updateCombatState(campaignId: string, updates: {
  is_active?: boolean;
  current_turn_id?: string | null;
  player_advantage?: number;
  enemy_advantage?: number;
}) {
  const sb = getSupabase();
  const { error } = await sb.from('combat_state')
    .upsert({ campaign_id: campaignId, ...updates }, { onConflict: 'campaign_id' });
  if (error) throw error;
}

export async function getCombatants(campaignId: string): Promise<Combatant[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from('combatants')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('initiative', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map(assembleCombatant);
}

export async function setCombatants(campaignId: string, combatants: Combatant[]) {
  const sb = getSupabase();

  // Replace all combatants
  await sb.from('combatants').delete().eq('campaign_id', campaignId);

  if (combatants.length) {
    const { error } = await sb.from('combatants').insert(
      combatants.map(c => ({
        id: c.id,
        campaign_id: campaignId,
        source_id: c.sourceId,
        name: c.name,
        initiative: c.initiative,
        current_wounds: c.currentWounds,
        max_wounds: c.maxWounds,
        base_initiative: c.baseInitiative,
        base_ag: c.baseAg,
        is_player: c.isPlayer,
        conditions: c.conditions as any,
        condition_instances: (c.conditionInstances ?? []) as any,
      }))
    );
    if (error) throw error;
  }
}

export async function updateCombatant(id: string, updates: Partial<{
  initiative: number | null;
  current_wounds: number;
  conditions: string[];
  condition_instances: any[];
}>) {
  const sb = getSupabase();
  const { error } = await sb.from('combatants').update(updates).eq('id', id);
  if (error) throw error;
}

export async function clearCombat(campaignId: string) {
  const sb = getSupabase();
  await sb.from('combatants').delete().eq('campaign_id', campaignId);
  await sb.from('combat_state').update({
    is_active: false,
    current_turn_id: null,
    player_advantage: 0,
    enemy_advantage: 0,
  }).eq('campaign_id', campaignId);
}
