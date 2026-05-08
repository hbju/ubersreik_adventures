import type { TypedSupabaseClient } from '../lib/supabase';
import type { Database } from '../types/database.types';
import { success, type ServiceResult } from '../types/errors';
import { mapSupabaseError } from './baseService';

// --- Types ---

type TemplateRow = Database['public']['Tables']['character_templates']['Row'];
type TemplateInsert = Database['public']['Tables']['character_templates']['Insert'];
type TemplateUpdate = Database['public']['Tables']['character_templates']['Update'];

export type { TemplateRow, TemplateInsert, TemplateUpdate };

// --- Service Functions ---

/**
 * Get all character templates for a campaign.
 */
export async function getTemplates(
  client: TypedSupabaseClient,
  campaignId: string
): Promise<ServiceResult<TemplateRow[]>> {
  const { data, error } = await client
    .from('character_templates')
    .select('*')
    .eq('campaign_id', campaignId);

  if (error) return mapSupabaseError<TemplateRow[]>(error);
  return success((data ?? []) as TemplateRow[]);
}

/**
 * Create a new character template.
 */
export async function createTemplate(
  client: TypedSupabaseClient,
  campaignId: string,
  templateData: Omit<TemplateInsert, 'campaign_id'>
): Promise<ServiceResult<TemplateRow>> {
  const { data, error } = await client
    .from('character_templates')
    .insert({ ...templateData, campaign_id: campaignId })
    .select()
    .single();

  if (error) return mapSupabaseError<TemplateRow>(error);
  return success(data as TemplateRow);
}

/**
 * Update a character template.
 */
export async function updateTemplate(
  client: TypedSupabaseClient,
  templateId: string,
  updates: TemplateUpdate
): Promise<ServiceResult<TemplateRow>> {
  const { data, error } = await client
    .from('character_templates')
    .update(updates)
    .eq('id', templateId)
    .select()
    .single();

  if (error) return mapSupabaseError<TemplateRow>(error);
  return success(data as TemplateRow);
}

/**
 * Delete a character template.
 */
export async function deleteTemplate(
  client: TypedSupabaseClient,
  templateId: string
): Promise<ServiceResult<void>> {
  const { error } = await client
    .from('character_templates')
    .delete()
    .eq('id', templateId);

  if (error) return mapSupabaseError<void>(error);
  return success(undefined as void);
}
