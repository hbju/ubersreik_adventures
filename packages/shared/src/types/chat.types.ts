/**
 * Chat & Messaging Types for Party Communication
 */

export type MessageType = 'chat' | 'roll' | 'system' | 'error';

/**
 * Parsed dice roll request from command parser
 */
export interface DiceRequest {
    count: number;      // Number of dice (e.g., 2 in "2d10")
    sides: number;      // Sides per die (e.g., 10 in "2d10")
    modifier: number;   // Optional modifier (e.g., +5 or -3)
}

/**
 * Result data for dice rolls
 */
export interface DiceRollData {
    formula: string;        // Original formula (e.g., "2d10+5")
    rolls: number[];        // Individual roll results
    modifier: number;       // Applied modifier
    total: number;          // Final total
}

/**
 * Chat message structure
 */
export interface ChatMessage {
    id: string;
    timestamp: number;
    senderId: string;
    senderName: string;
    senderColor?: string;
    type: MessageType;
    content: string;        // "Hello" or "Rolled 45"
    data?: DiceRollData;    // Optional payload for rolls
}
