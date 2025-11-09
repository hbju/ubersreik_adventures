import { Character, Currency, Item, Weapon, Armor, Combatant, Advantages, JournalEntry, MapPinState } from './wfrp.types';

interface BaseMessage<T extends string, P> {
  type: T;
  payload: P;
}

// == GM to Player Messages ==

export type LoginSuccessMessage = BaseMessage<'LOGIN_SUCCESS', { character: Character | null; username: string }>;
export type LoginFailureMessage = BaseMessage<'LOGIN_FAILURE', { reason: string }>;
export type AssignCharacterMessage = BaseMessage<'ASSIGN_CHARACTER', { character: Character }>;
export type RequestTestMessage = BaseMessage<'REQUEST_TEST', { skillName: string; characteristicName: string; modifier: number; }>;
export type UpdateShopInventoryMessage = BaseMessage<'UPDATE_SHOP_INVENTORY', { items: Record<string, number> }>;
export type PurchaseResponseMessage = BaseMessage<'PURCHASE_RESPONSE', { success: boolean; item: Armor | Weapon | Item; reason?: string }>;
export type UpdateInitiativeTrackerMessage = BaseMessage<'UPDATE_INITIATIVE_TRACKER', { combatants: Combatant[]; currentTurnId: string | null; currentAdvantage: Advantages }>;
export type RequestOpposedTestMessage = BaseMessage<'REQUEST_OPPOSED_TEST', { 
  testId: string;
  role: 'attacker' | 'defender';
  skillName: string;
  targetNumber: number;
  modifier: number;
}>;
export type JournalUpdateMessage = BaseMessage<'JOURNAL_UPDATE', { entries: JournalEntry[] }>;
export type MapStateUpdateMessage = BaseMessage<'MAP_STATE_UPDATE', { pinStates: Record<string, MapPinState> }>;

export type ServerToClientMessage = LoginSuccessMessage | LoginFailureMessage | AssignCharacterMessage | RequestTestMessage | CharacterUpdateMessage | UpdateShopInventoryMessage | PurchaseResponseMessage | UpdateInitiativeTrackerMessage | RequestOpposedTestMessage | JournalUpdateMessage | MapStateUpdateMessage;

// == Player to GM Messages ==

export type LoginRequestMessage = BaseMessage<'LOGIN_REQUEST', { username: string; password: string }>;
export type LogoutMessage = BaseMessage<'LOGOUT', {}>;
export type TestResultMessage = BaseMessage<'TEST_RESULT', {
  characterName: string;
  testName: string; // e.g., "Perception" or "Melee (Basic)"
  targetNumber: number;
  rollResult: number;
  successLevel: number;
  usedTalents?: { name: string; rank: number; }[];
}>;
export type CharacterUpdateMessage = BaseMessage<'CHARACTER_UPDATE', { character: Character }>;
export type RequestPurchaseMessage = BaseMessage<'REQUEST_PURCHASE', { item: Armor | Weapon | Item, characterId: string }>;
export type OpposedTestResultMessage = BaseMessage<'OPPOSED_TEST_RESULT', {
  testId: string;
  role: 'attacker' | 'defender';
  rollResult: number;
  successLevel: number;
  characterId: string;
}>;

export type ClientToServerMessage = LoginRequestMessage | LogoutMessage | TestResultMessage | CharacterUpdateMessage | RequestPurchaseMessage | OpposedTestResultMessage;
