/**
 * Journal entry CRUD queries
 */
import { getSupabase } from '../client';
import { assembleJournalEntry } from './assemblers';
import type { JournalEntry } from '../../types/wfrp.types';

export async function getJournalEntries(campaignId: string): Promise<JournalEntry[]> {
  const sb = getSupabase();
  const { data: entries, error } = await sb.from('journal_entries')
    .select('*, journal_shared_with(target)')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (entries ?? []).map(e => assembleJournalEntry({
    ...e,
    shared_with: (e.journal_shared_with ?? []).map((jsw: any) => jsw.target),
  }));
}

export async function createJournalEntry(
  campaignId: string,
  entry: Omit<JournalEntry, 'id'>
): Promise<JournalEntry> {
  const sb = getSupabase();
  const { data, error } = await sb.from('journal_entries').insert({
    campaign_id: campaignId,
    title: entry.title,
    content: entry.content,
    image_data: entry.imageData ?? null,
  }).select().single();
  if (error) throw error;

  // Set shared_with
  if (entry.sharedWith?.length) {
    await sb.from('journal_shared_with').insert(
      entry.sharedWith.map(target => ({ journal_id: data.id, target: String(target) }))
    );
  }

  return assembleJournalEntry({ ...data, shared_with: entry.sharedWith ?? [] });
}

export async function updateJournalEntry(
  id: string,
  updates: Partial<Pick<JournalEntry, 'title' | 'content' | 'imageData' | 'sharedWith'>>
) {
  const sb = getSupabase();
  const dbUpdates: Record<string, any> = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.content !== undefined) dbUpdates.content = updates.content;
  if (updates.imageData !== undefined) dbUpdates.image_data = updates.imageData;

  if (Object.keys(dbUpdates).length) {
    const { error } = await sb.from('journal_entries').update(dbUpdates as any).eq('id', id);
    if (error) throw error;
  }

  // Replace shared_with if provided
  if (updates.sharedWith !== undefined) {
    await sb.from('journal_shared_with').delete().eq('journal_id', id);
    if (updates.sharedWith.length) {
      await sb.from('journal_shared_with').insert(
        updates.sharedWith.map(target => ({ journal_id: id, target: String(target) }))
      );
    }
  }
}

export async function deleteJournalEntry(id: string) {
  const sb = getSupabase();
  const { error } = await sb.from('journal_entries').delete().eq('id', id);
  if (error) throw error;
}
