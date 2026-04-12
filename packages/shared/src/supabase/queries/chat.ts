/**
 * Chat message queries
 */
import { getSupabase } from '../client';
import { assembleChatMessage } from './assemblers';
import type { ChatMessage } from '../../types/chat.types';

export async function getMessages(campaignId: string, limit = 100, before?: string): Promise<ChatMessage[]> {
  const sb = getSupabase();
  let query = sb.from('chat_messages')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(assembleChatMessage).reverse(); // chronological order
}

export async function sendMessage(campaignId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
  const sb = getSupabase();
  const { data, error } = await sb.from('chat_messages').insert({
    campaign_id: campaignId,
    sender_id: message.senderId || null,
    sender_name: message.senderName,
    sender_color: message.senderColor ?? null,
    type: message.type,
    content: message.content,
    is_private: message.isPrivate ?? false,
    data: (message.data ?? null) as any,
  }).select().single();
  if (error) throw error;
  return assembleChatMessage(data);
}

export async function deleteMessages(campaignId: string) {
  const sb = getSupabase();
  const { error } = await sb.from('chat_messages')
    .delete()
    .eq('campaign_id', campaignId);
  if (error) throw error;
}
