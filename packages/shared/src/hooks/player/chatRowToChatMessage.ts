import type { ChatMessage } from '../../types/chat.types';
import type { ChatMessageRow } from '../../services/chatService';

export function chatRowToChatMessage(row: ChatMessageRow): ChatMessage {
  const uiType: ChatMessage['type'] =
    row.message_type === 'dice_roll'
      ? 'roll'
      : row.message_type === 'system'
        ? 'system'
        : row.message_type === 'whisper'
          ? 'chat'
          : 'chat';

  return {
    id: row.id,
    timestamp: new Date(row.created_at).getTime(),
    senderId: row.sender_id ?? 'system',
    senderName: row.sender_name,
    type: uiType,
    content: row.content,
    isPrivate: row.message_type === 'whisper' || Boolean(row.target_user_id),
    data: (row.roll_data ?? undefined) as ChatMessage['data'],
  };
}
