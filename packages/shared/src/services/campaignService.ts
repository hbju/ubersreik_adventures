import type { TypedSupabaseClient } from '../lib/supabase';
import type { Json } from '../types/database.types';
import { ErrorCode, failure, success, type ServiceResult } from '../types/errors';
import { mapSupabaseError } from './baseService';

// --- Interfaces ---

export interface Campaign {
  id: string;
  name: string;
  gm_user_id: string;
  active_map_id: string | null;
  calendar_state: Json | null;
  last_global_restock: string | null;
  version: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignMember {
  campaign_id: string;
  user_id: string;
  role: string;
  color: string | null;
}

export interface CampaignMemberWithProfile extends CampaignMember {
  display_name: string;
}

export interface CampaignWithMembers extends Campaign {
  members: CampaignMemberWithProfile[];
}

export interface CampaignUpdate {
  name?: string;
  active_map_id?: string | null;
  calendar_state?: Json | null;
  last_global_restock?: string | null;
}

// --- Service Functions ---

/**
 * Create a new campaign and add the GM as the first member.
 */
export async function createCampaign(
  client: TypedSupabaseClient,
  name: string,
  gmUserId: string
): Promise<ServiceResult<Campaign>> {
  const { data, error } = await client
    .from('campaigns')
    .insert({ name, gm_user_id: gmUserId })
    .select()
    .single();

  if (error) return mapSupabaseError<Campaign>(error);

  // Add the GM as a member with role 'gm'
  const { error: memberError } = await client
    .from('campaign_members')
    .insert({ campaign_id: data.id, user_id: gmUserId, role: 'gm' });

  if (memberError) {
    // Attempt cleanup: delete the campaign we just created
    await client.from('campaigns').delete().eq('id', data.id);
    return mapSupabaseError<Campaign>(memberError);
  }

  return success(data as Campaign);
}

/**
 * Get all campaigns a user is a member of.
 */
export async function getCampaignsForUser(
  client: TypedSupabaseClient,
  userId: string
): Promise<ServiceResult<Campaign[]>> {
  const { data, error } = await client
    .from('campaign_members')
    .select('campaign_id, campaigns(*)')
    .eq('user_id', userId);

  if (error) return mapSupabaseError<Campaign[]>(error);

  const campaigns = (data ?? [])
    .map((row: any) => row.campaigns)
    .filter(Boolean) as Campaign[];

  return success(campaigns);
}

/**
 * Get a campaign with its full member list including display names.
 */
export async function getCampaignWithMembers(
  client: TypedSupabaseClient,
  campaignId: string
): Promise<ServiceResult<CampaignWithMembers>> {
  // Fetch campaign
  const { data: campaign, error: campError } = await client
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (campError) return mapSupabaseError<CampaignWithMembers>(campError);

  // Fetch members with profile display names
  const { data: members, error: memError } = await client
    .from('campaign_members')
    .select('campaign_id, user_id, role, color, profiles(display_name)')
    .eq('campaign_id', campaignId);

  if (memError) return mapSupabaseError<CampaignWithMembers>(memError);

  const membersWithProfiles: CampaignMemberWithProfile[] = (members ?? []).map((m: any) => ({
    campaign_id: m.campaign_id,
    user_id: m.user_id,
    role: m.role,
    color: m.color,
    display_name: m.profiles?.display_name ?? 'Unknown',
  }));

  return success({ ...(campaign as Campaign), members: membersWithProfiles });
}

/**
 * Update campaign fields.
 */
export async function updateCampaign(
  client: TypedSupabaseClient,
  campaignId: string,
  updates: CampaignUpdate
): Promise<ServiceResult<Campaign>> {
  const { data, error } = await client
    .from('campaigns')
    .update(updates)
    .eq('id', campaignId)
    .select()
    .single();

  if (error) return mapSupabaseError<Campaign>(error);
  return success(data as Campaign);
}

/**
 * Delete a campaign (cascades via FK constraints).
 */
export async function deleteCampaign(
  client: TypedSupabaseClient,
  campaignId: string
): Promise<ServiceResult<void>> {
  const { error } = await client
    .from('campaigns')
    .delete()
    .eq('id', campaignId);

  if (error) return mapSupabaseError<void>(error);
  return success(undefined as void);
}

/**
 * Add a member to a campaign.
 */
export async function addMember(
  client: TypedSupabaseClient,
  campaignId: string,
  userId: string,
  role: string,
  color?: string | null
): Promise<ServiceResult<CampaignMember>> {
  const { data, error } = await client
    .from('campaign_members')
    .insert({ campaign_id: campaignId, user_id: userId, role, color: color ?? null })
    .select()
    .single();

  if (error) return mapSupabaseError<CampaignMember>(error);
  return success(data as CampaignMember);
}

/**
 * Remove a member from a campaign.
 */
export async function removeMember(
  client: TypedSupabaseClient,
  campaignId: string,
  userId: string
): Promise<ServiceResult<void>> {
  const { error } = await client
    .from('campaign_members')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('user_id', userId);

  if (error) return mapSupabaseError<void>(error);
  return success(undefined as void);
}

/**
 * Update a member's color.
 */
export async function updateMemberColor(
  client: TypedSupabaseClient,
  campaignId: string,
  userId: string,
  color: string
): Promise<ServiceResult<CampaignMember>> {
  const { data, error } = await client
    .from('campaign_members')
    .update({ color })
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) return mapSupabaseError<CampaignMember>(error);
  return success(data as CampaignMember);
}
