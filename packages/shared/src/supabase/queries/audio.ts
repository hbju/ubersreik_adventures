/**
 * Audio library queries (tracks, playlists)
 */
import { getSupabase } from '../client';
import { assembleAudioTrack, assemblePlaylist } from './assemblers';
import type { AudioTrack, Playlist } from '../../types/audio.types';

// ─── Tracks ─────────────────────────────────────────────────────────────────

export async function getTracks(campaignId: string): Promise<AudioTrack[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from('audio_tracks')
    .select('*')
    .eq('campaign_id', campaignId);
  if (error) throw error;
  return (data ?? []).map(assembleAudioTrack);
}

export async function upsertTrack(campaignId: string, track: AudioTrack) {
  const sb = getSupabase();
  const { data, error } = await sb.from('audio_tracks').upsert({
    id: track.id,
    campaign_id: campaignId,
    filename: track.filename,
    path: track.path,
    tags: track.tags,
    duration: track.duration ?? null,
    is_missing: track.isMissing ?? false,
    display_name: track.displayName ?? null,
    last_modified: track.lastModified ?? null,
  }).select().single();
  if (error) throw error;
  return assembleAudioTrack(data);
}

export async function upsertTracks(campaignId: string, tracks: AudioTrack[]) {
  if (!tracks.length) return;
  const sb = getSupabase();
  const { error } = await sb.from('audio_tracks').upsert(
    tracks.map(t => ({
      id: t.id,
      campaign_id: campaignId,
      filename: t.filename,
      path: t.path,
      tags: t.tags,
      duration: t.duration ?? null,
      is_missing: t.isMissing ?? false,
      display_name: t.displayName ?? null,
      last_modified: t.lastModified ?? null,
    }))
  );
  if (error) throw error;
}

export async function deleteTrack(id: string) {
  const sb = getSupabase();
  const { error } = await sb.from('audio_tracks').delete().eq('id', id);
  if (error) throw error;
}

// ─── Playlists ──────────────────────────────────────────────────────────────

export async function getPlaylists(campaignId: string): Promise<Playlist[]> {
  const sb = getSupabase();
  const { data: playlists, error } = await sb.from('audio_playlists')
    .select('*, playlist_tracks(track_id, position)')
    .eq('campaign_id', campaignId);
  if (error) throw error;

  return (playlists ?? []).map(p => {
    const sorted = (p.playlist_tracks ?? []).sort((a: any, b: any) => a.position - b.position);
    return assemblePlaylist(p, sorted.map((pt: any) => pt.track_id));
  });
}

export async function createPlaylist(campaignId: string, playlist: Omit<Playlist, 'id'>) {
  const sb = getSupabase();
  const { data, error } = await sb.from('audio_playlists').insert({
    campaign_id: campaignId,
    name: playlist.name,
    description: playlist.description ?? null,
  }).select().single();
  if (error) throw error;

  // Add tracks
  if (playlist.trackIds.length) {
    await sb.from('playlist_tracks').insert(
      playlist.trackIds.map((trackId, i) => ({
        playlist_id: data.id,
        track_id: trackId,
        position: i,
      }))
    );
  }

  return assemblePlaylist(data, playlist.trackIds);
}

export async function updatePlaylist(id: string, updates: Partial<Pick<Playlist, 'name' | 'description' | 'trackIds'>>) {
  const sb = getSupabase();

  if (updates.name !== undefined || updates.description !== undefined) {
    const dbUpdates: Record<string, any> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    const { error } = await sb.from('audio_playlists').update(dbUpdates as any).eq('id', id);
    if (error) throw error;
  }

  if (updates.trackIds !== undefined) {
    await sb.from('playlist_tracks').delete().eq('playlist_id', id);
    if (updates.trackIds.length) {
      const { error } = await sb.from('playlist_tracks').insert(
        updates.trackIds.map((trackId, i) => ({
          playlist_id: id,
          track_id: trackId,
          position: i,
        }))
      );
      if (error) throw error;
    }
  }
}

export async function deletePlaylist(id: string) {
  const sb = getSupabase();
  const { error } = await sb.from('audio_playlists').delete().eq('id', id);
  if (error) throw error;
}
