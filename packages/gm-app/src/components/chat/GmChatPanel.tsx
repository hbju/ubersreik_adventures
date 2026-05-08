import React from 'react';
import { ChatBox } from '@wfrp/shared';
import { useChatContext } from '../../context/ChatContext';

interface GmChatPanelProps {
  onClose: () => void;
}

export default function GmChatPanel({ onClose }: GmChatPanelProps) {
  const { messages, sendChatMessage, isLoading, error } = useChatContext();

  return (
    <div>
      {error && <div style={{ color: '#ff6b6b', padding: '6px 10px', backgroundColor: '#1a1a2e' }}>{error}</div>}
      {isLoading && <div style={{ color: '#aaa', padding: '6px 10px', backgroundColor: '#1a1a2e' }}>Loading chat…</div>}
      <ChatBox
        messages={messages}
        onSendMessage={sendChatMessage}
        senderName="GM"
        onClose={onClose}
        showHeader={true}
      />
    </div>
  );
}
