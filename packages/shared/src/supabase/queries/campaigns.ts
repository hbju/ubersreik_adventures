/**
 * Campaign CRUD queries
 */
import { getSupabase } from '../client';

export async function createCampaign(name: string, description?: string) {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  console.log(`[SUPABASE] Creating campaign "${name}" for user ${user.email} with id ${user.id}`);

  const { data, error } = await sb.from('campaigns').insert({
    name,
    description: description ?? null,
    owner_id: user.id,
  }).select().single();

  if (error) {
    console.error('[SUPABASE] Error creating campaign:', error);
    throw error;
  }

  // Add owner as GM member
  const { error: memberError } = await sb.from('campaign_members').insert({
    campaign_id: data.id,
    user_id: user.id,
    role: 'gm',
  });

  if (memberError) {
    console.error('[SUPABASE] Error adding GM member:', memberError);
    throw memberError;
  }

  // Create default combat state + calendar state
  await sb.from('combat_state').insert({ campaign_id: data.id });
  await sb.from('calendar_state').insert({ campaign_id: data.id });

  console.log('[SUPABASE] Campaign created with ID:', data.id);

  return data;
}

export async function listMyCampaigns() {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await sb.from('campaign_members')
    .select('campaign_id, role, campaigns(*)')
    .eq('user_id', user.id);
  if (error) { 
    console.error('[SUPABASE] Error fetching campaigns:', error);
    throw error; 
  }
  console.log(`[SUPABASE] Fetched ${data.length} campaigns for user ${user.email}`);
  return data;
}

export async function getCampaign(id: string) {
  const sb = getSupabase();
  const { data, error } = await sb.from('campaigns').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function updateCampaign(id: string, updates: { name?: string; description?: string; active_map_id?: string }) {
  const sb = getSupabase();
  const { data, error } = await sb.from('campaigns').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCampaign(id: string) {
  const sb = getSupabase();
  const { error } = await sb.from('campaigns').delete().eq('id', id);
  if (error) throw error;
}

export async function invitePlayer(campaignId: string, userId: string) {
  const sb = getSupabase();
  const { data, error } = await sb.from('campaign_members').insert({
    campaign_id: campaignId,
    user_id: userId,
    role: 'player',
  }).select().single();
  if (error) throw error;
  return data;
}

export async function assignCharacter(campaignId: string, userId: string, characterId: string | null) {
  const sb = getSupabase();
  const { error } = await sb.from('campaign_members')
    .update({ character_id: characterId })
    .eq('campaign_id', campaignId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function getMembers(campaignId: string) {
  const sb = getSupabase();
  const { data, error } = await sb.from('campaign_members')
    .select('*')
    .eq('campaign_id', campaignId);
  if (error) throw error;
  return data;
}

export async function removeMember(campaignId: string, userId: string) {
  const sb = getSupabase();
  const { error } = await sb.from('campaign_members')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('user_id', userId);
  if (error) throw error;
}
