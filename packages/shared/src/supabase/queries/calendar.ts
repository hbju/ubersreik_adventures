/**
 * Calendar state & event CRUD queries
 */
import { getSupabase } from '../client';
import { assembleCalendarState } from './assemblers';
import type { CalendarState, TimelineEvent, GameDate } from '../../data/calendar';

export async function getCalendarState(campaignId: string): Promise<CalendarState | null> {
  const sb = getSupabase();
  const { data: stateRow, error: stateErr } = await sb.from('calendar_state')
    .select('*')
    .eq('campaign_id', campaignId)
    .single();
  if (stateErr) {
    if (stateErr.code === 'PGRST116') return null; // not found
    throw stateErr;
  }

  const { data: events, error: evtErr } = await sb.from('calendar_events')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('date_year')
    .order('date_month_index')
    .order('date_day');
  if (evtErr) throw evtErr;

  return assembleCalendarState(stateRow, events ?? []);
}

export async function updateCalendarDate(campaignId: string, date: GameDate, weather?: string) {
  const sb = getSupabase();
  const { error } = await sb.from('calendar_state').upsert({
    campaign_id: campaignId,
    current_year: date.year,
    current_month_index: date.monthIndex,
    current_day: date.day,
    current_weather: weather ?? null,
  }, { onConflict: 'campaign_id' });
  if (error) throw error;
}

export async function createCalendarEvent(campaignId: string, event: Omit<TimelineEvent, 'id'>) {
  const sb = getSupabase();
  const { data, error } = await sb.from('calendar_events').insert({
    campaign_id: campaignId,
    title: event.title,
    description: event.description,
    date_year: event.date.year,
    date_month_index: event.date.monthIndex,
    date_day: event.date.day,
    is_visible_to_players: event.isVisibleToPlayers,
    category: event.color ?? null,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateCalendarEvent(id: string, updates: Partial<TimelineEvent>) {
  const sb = getSupabase();
  const dbUpdates: Record<string, any> = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.date) {
    dbUpdates.date_year = updates.date.year;
    dbUpdates.date_month_index = updates.date.monthIndex;
    dbUpdates.date_day = updates.date.day;
  }
  if (updates.isVisibleToPlayers !== undefined) dbUpdates.is_visible_to_players = updates.isVisibleToPlayers;
  if (updates.color !== undefined) dbUpdates.category = updates.color;

  const { error } = await sb.from('calendar_events').update(dbUpdates as any).eq('id', id);
  if (error) throw error;
}

export async function deleteCalendarEvent(id: string) {
  const sb = getSupabase();
  const { error } = await sb.from('calendar_events').delete().eq('id', id);
  if (error) throw error;
}
