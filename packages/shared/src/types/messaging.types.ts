import { Character, Currency, Item, Weapon, Armor, Combatant, Advantages, JournalEntry, MapPinState, Faction, ShopState, ShopInventoryItem, Quest, MapToken, UserMapPin, LocationTerritory } from './wfrp.types';
import { ChatMessage } from './chat.types';
import { GameDate, TimelineEvent } from '../data/calendar';
import { Notebook } from './notebook.types';
import type { DecisionRequest, FightStateView } from '../combat/remote-player-controller';
import type { CombatDecision, TurnEnginePhase } from '../combat/turn-engine';

interface BaseMessage<T extends string, P> {
    type: T;
    payload: P;
}

// == GM to Player Messages ==

export type LoginSuccessMessage = BaseMessage<'LOGIN_SUCCESS', { character: Character | null; username: string; playerColor: string }>;
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
export type RequestConditionTestMessage = BaseMessage<'REQUEST_CONDITION_TEST', {
    testId: string;
    conditionId: string;
    conditionName: string;
    testType: string;
    targetNumber: number;
    modifier: number;
    conditionCount: number;
    description: string;
}>;
export type JournalUpdateMessage = BaseMessage<'JOURNAL_UPDATE', { entries: JournalEntry[] }>;
export type MapStateUpdateMessage = BaseMessage<'MAP_STATE_UPDATE', { pinStates: Record<string, MapPinState> }>;
export type MapPingMessage = BaseMessage<'MAP_PING', { x: number; y: number; color: string; userId: string }>;
export type CareerChangeResponseMessage = BaseMessage<'CAREER_CHANGE_RESPONSE', {
    success: boolean;
    character?: Character;
    reason?: string
}>;

export type FactionUpdateMessage = BaseMessage<'FACTION_UPDATE', {
    factions: Faction[];
    locationTerritories?: Record<string, LocationTerritory>;
}>;

// Shop system messages
export type ShopStateUpdateMessage = BaseMessage<'SHOP_STATE_UPDATE', {
    shops: ShopState[]; // Array of shops player has access to
}>;

export type ShopItemRevealedMessage = BaseMessage<'SHOP_ITEM_REVEALED', {
    shopId: string;
    item: ShopInventoryItem;
}>;

export type ShopPurchaseResponseMessage = BaseMessage<'SHOP_PURCHASE_RESPONSE', {
    success: boolean;
    shopId: string;
    item: ShopInventoryItem;
    character?: Character;
    reason?: string;
}>;

// Quest Journal messages
export type QuestSyncMessage = BaseMessage<'QUEST_SYNC', {
    quests: Quest[];
}>;

// Map Token System messages
export type MapTokensUpdateMessage = BaseMessage<'MAP_TOKENS_UPDATE', {
    tokens: MapToken[];
}>;

export type UserPinsUpdateMessage = BaseMessage<'USER_PINS_UPDATE', {
    pins: UserMapPin[];
}>;

// Chat system messages
export type ChatMessageBroadcast = BaseMessage<'CHAT_MESSAGE', {
    message: ChatMessage;
}>;

export type ChatHistoryMessage = BaseMessage<'CHAT_HISTORY', {
    messages: ChatMessage[];
}>;

// Map Scene Management messages
export type MapSwitchMessage = BaseMessage<'MAP_SWITCH', {
    mapId: string;
    mapName: string;
}>;

export type ActiveMapUpdateMessage = BaseMessage<'ACTIVE_MAP_UPDATE', {
    activeMapId: string;
    spawnPoint?: { x: number; y: number };
}>;

// Calendar sync messages
export type CalendarSyncMessage = BaseMessage<'CALENDAR_SYNC', {
    currentDate: GameDate;
    events: TimelineEvent[]; // Pre-filtered: only isVisibleToPlayers events
    currentWeather?: string;
}>;

// Notebook sync (server → player, on login/assign or after update)
export type NotebookSyncMessage = BaseMessage<'NOTEBOOK_SYNC', {
    notebook: Notebook;
}>;

// Live-play: server sends a decision request to the specific player whose turn it is
export type RequestDecisionMessage = BaseMessage<'REQUEST_DECISION', DecisionRequest>;

// Live-play: broadcast to all players after each committed engine step (null = fight ended)
export type FightStateUpdateMessage = {
    type: 'FIGHT_STATE_UPDATE';
    payload: {
        stateView: FightStateView;
        activeCombatantId: string | null;
        phase: TurnEnginePhase;
    } | null;
};

export type ServerToClientMessage = LoginSuccessMessage | LoginFailureMessage | AssignCharacterMessage | RequestTestMessage | CharacterUpdateMessage | UpdateShopInventoryMessage | PurchaseResponseMessage | UpdateInitiativeTrackerMessage | RequestOpposedTestMessage | RequestConditionTestMessage | JournalUpdateMessage | MapStateUpdateMessage | MapPingMessage | CareerChangeResponseMessage | FactionUpdateMessage | ShopStateUpdateMessage | ShopItemRevealedMessage | ShopPurchaseResponseMessage | QuestSyncMessage | MapTokensUpdateMessage | UserPinsUpdateMessage | ChatMessageBroadcast | ChatHistoryMessage | MapSwitchMessage | ActiveMapUpdateMessage | CalendarSyncMessage | NotebookSyncMessage | RequestDecisionMessage | FightStateUpdateMessage;

// == Roll Queue Types ==

export interface QueuedRoll {
    id: string;
    characterId: string;
    characterName: string;
    skillId: string;
    skillName: string;
    rollResult: number;
    targetNumber: number;
    successLevel: number;
    weaponId?: string;
    weaponName?: string;
    weaponDamage?: number;
    timestamp: number;
    usedTalents?: { name: string; rank: number; }[];
    fortuneSpent: number;
    corruptionGained: number;
}

// == Player to GM Messages ==

export type LoginRequestMessage = BaseMessage<'LOGIN_REQUEST', { username: string; password: string }>;
export type LogoutMessage = BaseMessage<'LOGOUT', {}>;
export type TestResultMessage = BaseMessage<'TEST_RESULT', {
    characterId: string;
    testName: string; // e.g., "Perception" or "Melee (Basic)"
    targetNumber: number;
    rollResult: number;
    successLevel: number;
    usedTalents?: { name: string; rank: number; }[];
    fortuneSpent: number;
    corruptionGained: number;
}>;
export type CharacterCreateMessage = BaseMessage<'CHARACTER_CREATE', { character: Character, userId?: string }>;
export type CharacterUpdateMessage = BaseMessage<'CHARACTER_UPDATE', { character: Character }>;
export type RequestPurchaseMessage = BaseMessage<'REQUEST_PURCHASE', { item: Armor | Weapon | Item, characterId: string }>;

// Roll with Intent - for the async roll queue system
export type RollWithIntentMessage = BaseMessage<'ROLL_WITH_INTENT', {
    characterId: string;
    characterName: string;
    skillId: string;
    skillName: string;
    targetNumber: number;
    rollResult: number;
    successLevel: number;
    weaponId?: string;
    weaponName?: string;
    weaponDamage?: number;
    usedTalents?: { name: string; rank: number; }[];
    fortuneSpent: number;
    corruptionGained: number;
}>;

export type OpposedTestResultMessage = BaseMessage<'OPPOSED_TEST_RESULT', {
    testId: string;
    role: 'attacker' | 'defender';
    rollResult: number;
    successLevel: number;
    characterId: string;
    fortuneSpent: number;
    corruptionGained: number;
}>;
export type ConditionTestResultMessage = BaseMessage<'CONDITION_TEST_RESULT', {
    testId: string;
    conditionId: string;
    rollResult: number;
    successLevel: number;
    characterId: string;
    targetNumber: number;
}>;
export type CareerChangeRequestMessage = BaseMessage<'CAREER_CHANGE_REQUEST', {
    characterId: string;
    characterName: string;
    newCareerId: string;
    newCareerLevelId: string;
    newCareerName: string;
    newCareerLevelName: string;
    xpCost: number;
}>;

// Player editing their own character (Edit Mode)
export type PlayerUpdateCharacterMessage = BaseMessage<'PLAYER_UPDATE_CHARACTER', {
    characterId: string;
    updates: Partial<Character>;
}>;

// Shop purchase request from player
export type ShopPurchaseRequestMessage = BaseMessage<'SHOP_PURCHASE_REQUEST', {
    shopId: string;
    instanceId: string; // The specific item instance to purchase
    characterId: string;
    quantity: number;
}>;

// Player requesting to evaluate an item
export type ShopEvaluateRequestMessage = BaseMessage<'SHOP_EVALUATE_REQUEST', {
    shopId: string;
    instanceId: string;
    characterId: string;
    characterName: string;
    rollResult: number;
    successLevel: number;
}>;

// Quest Journal messages (client to server)
export type QuestUpdateMessage = BaseMessage<'QUEST_UPDATE', {
    quest: Quest;
}>;

export type QuestDeleteMessage = BaseMessage<'QUEST_DELETE', {
    questId: string;
}>;

// Map Token & Pin messages (client to server)
export type TokenMoveMessage = BaseMessage<'TOKEN_MOVE', {
    tokenId: string;
    x: number;
    y: number;
}>;

export type MapAddPinMessage = BaseMessage<'MAP_ADD_PIN', {
    pin: UserMapPin;
}>;

export type MapRemovePinMessage = BaseMessage<'MAP_REMOVE_PIN', {
    pinId: string;
}>;

export type MapPingRequestMessage = BaseMessage<'MAP_PING_REQUEST', {
    x: number;
    y: number;
}>;

// Chat messages from client
export type ChatSendMessage = BaseMessage<'CHAT_SEND', {
    content: string;
    senderName: string;
}>;

// Map switch request from GM
export type MapSwitchRequestMessage = BaseMessage<'MAP_SWITCH_REQUEST', {
    mapId: string;
    moveTokens: boolean; // Whether to move all tokens to the new map's spawn point
}>;

// Spawn point configuration
export type SetSpawnPointMessage = BaseMessage<'SET_SPAWN_POINT', {
    mapId: string;
    x: number;
    y: number;
}>;

// Notebook update (player → server, full notebook payload)
export type NotebookUpdateMessage = BaseMessage<'NOTEBOOK_UPDATE', {
    notebook: Notebook;
}>;

// Live-play: player responds to a REQUEST_DECISION with their chosen action
export type DecisionResponseMessage = BaseMessage<'DECISION_RESPONSE', {
    requestId: string;
    decision: CombatDecision;
}>;

export type ClientToServerMessage = LoginRequestMessage | LogoutMessage | TestResultMessage | CharacterCreateMessage |CharacterUpdateMessage | RequestPurchaseMessage | OpposedTestResultMessage | ConditionTestResultMessage | CareerChangeRequestMessage | PlayerUpdateCharacterMessage | ShopPurchaseRequestMessage | ShopEvaluateRequestMessage | QuestUpdateMessage | QuestDeleteMessage | TokenMoveMessage | MapAddPinMessage | MapRemovePinMessage | MapPingRequestMessage | ChatSendMessage | MapSwitchRequestMessage | SetSpawnPointMessage | RollWithIntentMessage | NotebookUpdateMessage | DecisionResponseMessage;
