/**
 * Game log queries
 */
import { getSupabase } from '../client';

export interface GameLogEntry {
  id: string;
  type: string;
  actorName?: string;
  content: string;
  data?: any;
  createdAt: string;
}

export async function getLogEntries(campaignId: string, limit = 200, before?: string): Promise<GameLogEntry[]> {
  const sb = getSupabase();
  let query = sb.from('game_log_entries')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map(row => ({
    id: row.id,
    type: row.type,
    actorName: row.actor_name ?? undefined,
    content: row.content,
    data: row.data ?? undefined,
    createdAt: row.created_at,
  })).reverse();
}

export async function addLogEntry(campaignId: string, entry: Omit<GameLogEntry, 'id' | 'createdAt'>) {
  const sb = getSupabase();
  const { data, error } = await sb.from('game_log_entries').insert({
    campaign_id: campaignId,
    type: entry.type,
    actor_name: entry.actorName ?? null,
    content: entry.content,
    data: entry.data ?? null,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function clearLog(campaignId: string) {
  const sb = getSupabase();
  const { error } = await sb.from('game_log_entries')
    .delete()
    .eq('campaign_id', campaignId);
  if (error) throw error;
}
