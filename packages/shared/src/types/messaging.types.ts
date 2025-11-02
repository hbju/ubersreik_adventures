import { Character, Currency, Item, Weapon, Armor } from './wfrp.types';

interface BaseMessage<T extends string, P> {
  type: T;
  payload: P;
}

// == GM to Player Messages ==

export type AssignCharacterMessage = BaseMessage<'ASSIGN_CHARACTER', { character: Character }>;
export type RequestTestMessage = BaseMessage<'REQUEST_TEST', { skillName: string; characteristicName: string; modifier: number; }>;
export type AwardXpMessage = BaseMessage<'AWARD_XP', { amount: number }>;
export type AwardCurrencyMessage = BaseMessage<'AWARD_CURRENCY', { currency: Currency }>;
export type UpdateShopInventoryMessage = BaseMessage<'UPDATE_SHOP_INVENTORY', { items: Record<string, number> }>;
export type PurchaseResponseMessage = BaseMessage<'PURCHASE_RESPONSE', { success: boolean; item: Armor | Weapon | Item; reason?: string }>;

export type ServerToClientMessage = AssignCharacterMessage | RequestTestMessage | AwardXpMessage | CharacterUpdateMessage | AwardCurrencyMessage | UpdateShopInventoryMessage | PurchaseResponseMessage;

// == Player to GM Messages ==

export type TestResultMessage = BaseMessage<'TEST_RESULT', {
  characterName: string;
  testName: string; // e.g., "Perception" or "Melee (Basic)"
  targetNumber: number;
  rollResult: number;
  successLevel: number;
}>;
export type CharacterUpdateMessage = BaseMessage<'CHARACTER_UPDATE', { character: Character }>;
export type RequestPurchaseMessage = BaseMessage<'REQUEST_PURCHASE', { item: Armor | Weapon | Item, characterId: string }>;

export type ClientToServerMessage = TestResultMessage | CharacterUpdateMessage | RequestPurchaseMessage;
