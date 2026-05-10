import { useCallback, useEffect, useState } from 'react';
import type { ChatMessage } from '../../types/chat.types';
import type { ServiceContext } from '../../services/serviceContext';
import { getChatHistory } from '../../services/chatService';
import { subscribeToTable } from '../../lib/realtime';
import { chatRowToChatMessage } from './chatRowToChatMessage';

export function usePlayerChat(serviceContext: ServiceContext | null) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const refreshChat = useCallback(async () => {
    if (!serviceContext) {
      setChatMessages([]);
      return;
    }
    const res = await getChatHistory(
      serviceContext.client,
      serviceContext.campaignId,
      serviceContext.userId
    );
    if (res.error || !res.data) return;
    setChatMessages(res.data.map(chatRowToChatMessage));
  }, [serviceContext]);

  useEffect(() => {
    void refreshChat();
  }, [refreshChat]);

  useEffect(() => {
    if (!serviceContext) return undefined;

    return subscribeToTable({
      supabase: serviceContext.client,
      table: 'chat_messages',
      filter: `campaign_id=eq.${serviceContext.campaignId}`,
      callback: () => {
        void refreshChat();
      },
    });
  }, [serviceContext, refreshChat]);

  return {
    chatMessages,
    setChatMessages,
    refreshChat,
  };
}
