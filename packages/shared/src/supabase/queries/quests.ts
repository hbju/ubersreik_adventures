/**
 * Quest CRUD queries
 */
import { getSupabase } from '../client';
import { assembleQuest } from './assemblers';
import type { Quest, QuestObjective } from '../../types/wfrp.types';

export async function getQuests(campaignId: string): Promise<Quest[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from('quests')
    .select('*, quest_objectives(*)')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map(q => assembleQuest({
    ...q,
    objectives: q.quest_objectives ?? [],
  }));
}

export async function createQuest(campaignId: string, quest: Omit<Quest, 'id' | 'createdAt' | 'updatedAt'>): Promise<Quest> {
  const sb = getSupabase();
  const { data, error } = await sb.from('quests').insert({
    campaign_id: campaignId,
    character_id: quest.characterId,
    title: quest.title,
    description: quest.description,
    status: quest.status,
  }).select().single();
  if (error) throw error;

  // Insert objectives
  if (quest.objectives?.length) {
    await sb.from('quest_objectives').insert(
      quest.objectives.map(o => ({
        quest_id: data.id,
        text: o.text,
        is_completed: o.isCompleted,
        location_id: o.locationId ?? null,
      }))
    );
  }

  // Re-fetch to get objectives with IDs
  return (await getQuestById(data.id))!;
}

export async function getQuestById(id: string): Promise<Quest | null> {
  const sb = getSupabase();
  const { data, error } = await sb.from('quests')
    .select('*, quest_objectives(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  if (!data) return null;
  return assembleQuest({ ...data, objectives: data.quest_objectives ?? [] });
}

export async function updateQuest(id: string, updates: Partial<Pick<Quest, 'title' | 'description' | 'status'>>) {
  const sb = getSupabase();
  const dbUpdates: Record<string, any> = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.status !== undefined) dbUpdates.status = updates.status;

  const { error } = await sb.from('quests').update(dbUpdates as any).eq('id', id);
  if (error) throw error;
}

export async function deleteQuest(id: string) {
  const sb = getSupabase();
  const { error } = await sb.from('quests').delete().eq('id', id);
  if (error) throw error;
}

// Objective operations

export async function addObjective(questId: string, objective: Omit<QuestObjective, 'id'>) {
  const sb = getSupabase();
  const { data, error } = await sb.from('quest_objectives').insert({
    quest_id: questId,
    text: objective.text,
    is_completed: objective.isCompleted,
    location_id: objective.locationId ?? null,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateObjective(id: string, updates: { text?: string; is_completed?: boolean; location_id?: string | null }) {
  const sb = getSupabase();
  const { error } = await sb.from('quest_objectives').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteObjective(id: string) {
  const sb = getSupabase();
  const { error } = await sb.from('quest_objectives').delete().eq('id', id);
  if (error) throw error;
}
