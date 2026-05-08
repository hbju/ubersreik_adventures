import { useCallback, useEffect, useState } from 'react';
import type { ChatMessage } from '@wfrp/shared';
import {
  executeDiceRoll,
  getChatHistory,
  parseChatCommand,
  sendMessage,
  type ChatMessageRow,
} from '@wfrp/shared';
import { useAppContext } from '../context/AppContext';

function rowToChatMessage(row: ChatMessageRow): ChatMessage {
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

export function useChat() {
  const { serviceContext, user } = useAppContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!serviceContext || !user) return;
    setIsLoading(true);
    setError(null);
    const result = await getChatHistory(
      serviceContext.client,
      serviceContext.campaignId,
      user.id
    );
    if (result.error) {
      setError(result.error.message);
      setIsLoading(false);
      return;
    }
    setMessages(result.data.map(rowToChatMessage));
    setIsLoading(false);
  }, [serviceContext, user]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const sendChatMessage = useCallback(async (content: string) => {
    if (!serviceContext || !user) return;
    const parsed = parseChatCommand(content);

    let messageType: 'text' | 'dice_roll' | 'system' | 'whisper' = 'text';
    let messageContent = content;
    let rollData: unknown;

    if (parsed.isRollCommand && parsed.diceRequest) {
      const rollResult = executeDiceRoll(parsed.diceRequest);
      messageType = 'dice_roll';
      messageContent = `Rolling ${rollResult.formula}`;
      rollData = rollResult as unknown;
    } else if (parsed.isRollCommand && !parsed.diceRequest) {
      setMessages((prev) => [
        ...prev,
        {
          id: `chat-error-${Date.now()}`,
          timestamp: Date.now(),
          senderId: 'system',
          senderName: 'System',
          type: 'error',
          content: parsed.errorMessage ?? 'Invalid dice command',
          isPrivate: Boolean(parsed.isPrivate),
        },
      ]);
      return;
    }

    if (parsed.isPrivate) {
      messageType = 'whisper';
    }

    const result = await sendMessage(
      serviceContext.client,
      serviceContext.campaignId,
      user.id,
      user.email ?? 'GM',
      messageContent,
      messageType,
      (rollData ?? null) as any,
      parsed.isPrivate ? user.id : null
    );

    if (result.error) {
      setError(result.error.message);
      return result;
    }

    setMessages((prev) => [...prev, rowToChatMessage(result.data)]);
    setError(null);
    return result;
  }, [serviceContext, user]);

  return {
    messages,
    isLoading,
    error,
    loadHistory,
    sendChatMessage,
  };
}
