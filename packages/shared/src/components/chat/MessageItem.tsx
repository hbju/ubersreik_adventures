import React from 'react';
import { ChatMessage, DiceRollData } from '../../types/chat.types';
import styles from './MessageItem.module.css';

export interface MessageItemProps {
    message: ChatMessage;
}

/**
 * Format timestamp for display
 */
function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Render a dice roll result card
 */
const RollCard: React.FC<{ data: DiceRollData; senderName: string; isPrivate: boolean; senderColor?: string }> = ({
    data,
    senderName,
    isPrivate,
    senderColor
}) => {
    return (
        <div className={styles.rollCard}>
            {
                isPrivate && <span className={styles.privateLabel}>Private Roll</span>
            }
            <div className={styles.rollHeader}>
                <span className={styles.diceIcon}>🎲</span>
                <span
                    className={styles.senderName}
                    style={senderColor ? { color: senderColor } : undefined}
                >
                    {senderName}
                </span>
                <span className={styles.rollFormula}>rolled {data.formula}</span>
            </div>

            <div className={styles.rollDetails}>
                <div className={styles.diceResults}>
                    {data.rolls.map((roll, index) => (
                        <span key={index} className={styles.dieResult}>
                            {roll}
                        </span>
                    ))}
                </div>

                {data.modifier !== 0 && (
                    <span className={`${styles.modifier} ${data.modifier > 0 ? styles.modifierPositive : styles.modifierNegative
                        }`}>
                        {data.modifier > 0 ? '+' : ''}{data.modifier}
                    </span>
                )}
            </div>

            <div className={styles.rollTotal}>
                <span className={styles.totalLabel}>=</span>
                <span className={styles.totalValue}>{data.total}</span>
            </div>
        </div>
    );
};

/**
 * MessageItem component - Renders different message types with appropriate styling
 */
export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
    const { type, content, senderName, senderColor, timestamp, data } = message;

    if (type === 'system') {
        return (
            <div className={`${styles.messageItem} ${styles.systemMessage}`}>
                <span className={styles.messageContent}>{content}</span>
            </div>
        );
    }

    if (type === 'error') {
        return (
            <div className={'styles.messageItem ${styles.errorMessage}'}>
                <span className={styles.messageContent}>⚠️ {content}</span>
            </div>
        );
    }

    if (type === 'roll' && data) {
        return (
            <div className={styles.messageItem + (message.isPrivate ? ` ${styles.privateRoll}` : ` ${styles.rollMessage}`)}>
                <RollCard
                    data={data}
                    senderName={senderName}
                    senderColor={senderColor}
                    isPrivate={message.isPrivate}
                />
            </div>
        );
    }

    return (
        <div className={`${styles.messageItem} ${styles.chatMessage}`}>
            <div className={styles.messageHeader}>
                <span
                    className={styles.senderName}
                    style={senderColor ? { color: senderColor } : undefined}
                >
                    {senderName}
                </span>
                <span className={styles.timestamp}>{formatTime(timestamp)}</span>
            </div>
            <div className={styles.messageContent}>{content}</div>
        </div>
    );
};

export default MessageItem;
