import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../../types/chat.types';
import MessageItem from './MessageItem';
import styles from './ChatBox.module.css';

export interface ChatBoxProps {
    /** Array of chat messages to display */
    messages: ChatMessage[];
    /** Callback when user sends a message */
    onSendMessage: (content: string) => void;
    /** Display name for the current user */
    senderName: string;
    /** Optional callback to close the chat */
    onClose?: () => void;
    /** Whether to show the header with close button */
    showHeader?: boolean;
    /** Placeholder text for input */
    placeholder?: string;
}

/**
 * ChatBox component - A collapsible chat interface for party communication
 * Supports text messages and slash commands like /roll
 */
export const ChatBox: React.FC<ChatBoxProps> = ({
    messages,
    onSendMessage,
    senderName,
    onClose,
    showHeader = true,
    placeholder = 'Type a message or /roll 1d100...'
}) => {
    const [inputValue, setInputValue] = useState('');
    const messageListRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (messageListRef.current) {
            messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = inputValue.trim();
        if (trimmed) {
            onSendMessage(trimmed);
            setInputValue('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Allow Shift+Enter for multiline (future enhancement)
        if (e.key === 'Enter' && !e.shiftKey) {
            handleSubmit(e);
        }
    };

    return (
        <div className={styles.chatBox}>
            {showHeader && (
                <div className={styles.chatHeader}>
                    <span className={styles.chatTitle}>Chat</span>
                    {onClose && (
                        <button
                            className={styles.closeButton}
                            onClick={onClose}
                            aria-label="Close chat"
                        >
                            ×
                        </button>
                    )}
                </div>
            )}

            <div className={styles.messageList} ref={messageListRef}>
                {messages.length === 0 ? (
                    <div className={styles.emptyState}>
                        <span>No messages yet</span>
                        <span>Start the conversation!</span>
                    </div>
                ) : (
                    messages.map((message) => (
                        <MessageItem key={message.id} message={message} />
                    ))
                )}
            </div>

            <div className={styles.inputContainer}>
                <form className={styles.inputForm} onSubmit={handleSubmit}>
                    <input
                        ref={inputRef}
                        type="text"
                        className={styles.chatInput}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        aria-label="Chat message"
                    />
                    <button
                        type="submit"
                        className={styles.sendButton}
                        disabled={!inputValue.trim()}
                    >
                        Send
                    </button>
                </form>
                <div className={styles.commandHint}>
                    Tip: Use /roll or /r followed by dice notation (e.g., /roll 2d10+5)
                </div>
            </div>
        </div>
    );
};

export default ChatBox;
