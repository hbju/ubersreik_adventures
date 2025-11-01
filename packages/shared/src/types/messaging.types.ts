import { Character } from './wfrp.types';

interface BaseMessage<T extends string, P> {
  type: T;
  payload: P;
}

// == GM to Player Messages ==

export type AssignCharacterMessage = BaseMessage<'ASSIGN_CHARACTER', { character: Character }>;
export type RequestTestMessage = BaseMessage<'REQUEST_TEST', { skillName: string; characteristicName: string; modifier: number; }>;
export type AwardXpMessage = BaseMessage<'AWARD_XP', { amount: number }>;

export type ServerToClientMessage = AssignCharacterMessage | RequestTestMessage | AwardXpMessage;

// == Player to GM Messages ==

export type TestResultMessage = BaseMessage<'TEST_RESULT', {
  characterName: string;
  testName: string; // e.g., "Perception" or "Melee (Basic)"
  targetNumber: number;
  rollResult: number;
  successLevel: number;
}>;
export type CharacterUpdateMessage = BaseMessage<'CHARACTER_UPDATE', { character: Character }>;

export type ClientToServerMessage = TestResultMessage | CharacterUpdateMessage;
