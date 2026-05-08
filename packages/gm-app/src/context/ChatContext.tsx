import React, { createContext, useContext } from 'react';
import { useChat } from '../hooks/useChat';

type ChatContextValue = ReturnType<typeof useChat>;

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const value = useChat();
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
