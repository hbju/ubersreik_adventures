import type { TypedSupabaseClient } from '../lib/supabase';
import type { Database, Json } from '../types/database.types';
import { success, type ServiceResult } from '../types/errors';
import { mapSupabaseError } from './baseService';

// --- Types ---

type ChatMessageRow = Database['public']['Tables']['chat_messages']['Row'];

export type { ChatMessageRow };

// --- Service Functions ---

/**
 * Get recent messages for a campaign, with pagination support.
 * Messages are returned in ascending chronological order.
 * Whispers (target_user_id set) are filtered to only show messages
 * sent by or targeted at the requesting user.
 */
export async function getRecentMessages(
  client: TypedSupabaseClient,
  campaignId: string,
  userId: string,
  limit: number = 50,
  before?: string
): Promise<ServiceResult<ChatMessageRow[]>> {
  let query = client
    .from('chat_messages')
    .select('*')
    .eq('campaign_id', campaignId)
    .or(`target_user_id.is.null,target_user_id.eq.${userId},sender_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;

  if (error) return mapSupabaseError<ChatMessageRow[]>(error);
  // Reverse to chronological order
  return success(((data ?? []) as ChatMessageRow[]).reverse());
}

/**
 * Send a chat message.
 */
export async function sendMessage(
  client: TypedSupabaseClient,
  campaignId: string,
  senderId: string | null,
  senderName: string,
  content: string,
  messageType: string = 'chat',
  rollData?: Json | null,
  targetUserId?: string | null
): Promise<ServiceResult<ChatMessageRow>> {
  const { data, error } = await client
    .from('chat_messages')
    .insert({
      campaign_id: campaignId,
      sender_id: senderId,
      sender_name: senderName,
      content,
      message_type: messageType,
      roll_data: rollData ?? null,
      target_user_id: targetUserId ?? null,
    })
    .select()
    .single();

  if (error) return mapSupabaseError<ChatMessageRow>(error);
  return success(data as ChatMessageRow);
}

/**
 * Get chat history for initial load. Returns messages since a given timestamp,
 * or the most recent messages if no timestamp is provided.
 * Respects whisper visibility.
 */
export async function getChatHistory(
  client: TypedSupabaseClient,
  campaignId: string,
  userId: string,
  since?: string,
  limit: number = 100
): Promise<ServiceResult<ChatMessageRow[]>> {
  let query = client
    .from('chat_messages')
    .select('*')
    .eq('campaign_id', campaignId)
    .or(`target_user_id.is.null,target_user_id.eq.${userId},sender_id.eq.${userId}`)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (since) {
    query = query.gte('created_at', since);
  }

  const { data, error } = await query;

  if (error) return mapSupabaseError<ChatMessageRow[]>(error);
  return success((data ?? []) as ChatMessageRow[]);
}
