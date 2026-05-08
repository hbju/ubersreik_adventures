export { default as CharacterCreationWizard } from './components/CharacterCreationWizard';
export { default as CharacterSheet } from './components/CharacterSheet';
export { ChatBox, default as ChatBoxDefault } from './components/chat/ChatBox';
export { default as MessageItem } from './components/chat/MessageItem';
export { default as PlayerCharacterSheet } from './components/PlayerCharacterSheet/PlayerCharacterSheet';
export { default as EditableField } from './components/EditableField';
export { default as InventoryView } from './components/InventoryView';
export { default as MapDisplay } from './components/MapDisplay';
export { default as MapView } from './components/MapView';
export { default as MapToken } from './components/MapToken';
export { default as MapControls } from './components/MapControls';
export { default as UserPin } from './components/UserPin';
export type { MapFilters } from './components/MapControls';
export { default as DiscoveredLocationsList } from './components/DiscoveredLocationsList';
export { default as LocationPin } from './components/LocationPin';
export { default as LocationInfoPanel } from './components/LocationInfoPanel';
export { default as TerritoryLayer } from './components/TerritoryLayer';
export { default as TalentSelectionModal } from './components/TalentSelectionModal';
export { CriticalHitModal } from './components/CriticalHitModal';
export { FumbleModal } from './components/FumbleModal';
export { ConditionPromptModal } from './components/ConditionPromptModal';
export { LanguageSwitcher } from './components/LanguageSwitcher';
export { Tooltip } from './components/ui/Tooltip';
export { QualityTooltip } from './components/ui/QualityTooltip';
export * from './components/GameLog';
export * from './hooks/useGameData';
export * from './hooks/useDebounce';
export * from './i18n';
export * from './types/wfrp.types';
export * from './types/messaging.types';
export * from './types/chat.types';
export * from './types/audio.types';
export * from './utils/advancement';
export * from './utils/generator';
export * from './utils/inventory';
export * from './utils/mechanics';
export * from './utils/skills';
export * from './utils/socket';
export * from './utils/talents';
export * from './utils/conditions';
export * from './utils/career';
export * from './utils/reputation';
export * from './utils/qualities';
export * from './utils/shopGenerator';
export * from './utils/diceParser';
export * from './utils/graph';

export { default as criticalHitsData } from './data/critical_hits.json';
export { default as fumblesData } from './data/fumbles.json';
export { default as speciesData } from './data/species.json';
export { default as motivationsEnData } from './data/motivations_en.json';
export { default as motivationsFrData } from './data/motivations_fr.json';

// Calendar System
export * from './data/calendar';
export { PlayerCalendarGrid } from './components/calendar/PlayerCalendarGrid';
export type { PlayerNote } from './components/calendar/PlayerCalendarGrid';
export { DateWeatherWidget } from './components/calendar/DateWeatherWidget';

// Codex System
export * from './types/codex.types';
export * from './utils/codexIndex';
export * from './utils/codexSearch';
export { CodexProvider, useCodex } from './hooks/useCodex';
export { useCodexBookmarks } from './hooks/useCodexBookmarks';
export { CommandPalette } from './components/codex/CommandPalette';
export { CodexViewer } from './components/codex/CodexViewer';
export { CodexPopupTrigger, CodexPopupModal } from './components/codex/CodexPopup';
export { TalentCodexDisplay } from './components/codex/renderers/TalentCodexDisplay';
export { SkillCodexDisplay } from './components/codex/renderers/SkillCodexDisplay';
export { CareerCodexDisplay } from './components/codex/renderers/CareerCodexDisplay';
export { ConditionCodexDisplay } from './components/codex/renderers/ConditionCodexDisplay';
export { QualityCodexDisplay } from './components/codex/renderers/QualityCodexDisplay';

// Supabase
export * from './types/database.types';
export * from './types/errors';
export { createSupabaseClient, getSupabaseClient, resetSupabaseClient } from './lib/supabase';
export type { TypedSupabaseClient } from './lib/supabase';

// Service Layer
export { createServiceContext } from './services/serviceContext';
export type { ServiceContext } from './services/serviceContext';
export { getById, getAll, insert, update, remove, campaignQuery, mapSupabaseError } from './services/baseService';
export {
  createCampaign,
  getCampaignsForUser,
  getCampaignWithMembers,
  updateCampaign,
  deleteCampaign,
  addMember,
  removeMember,
  updateMemberColor,
} from './services/campaignService';
export type {
  Campaign,
  CampaignMember,
  CampaignMemberWithProfile,
  CampaignWithMembers,
  CampaignUpdate,
} from './services/campaignService';
export {
  getCharacters,
  getCharacterById,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  assignCharacterToUser,
  unassignCharacter,
  createFromTemplate,
  batchCreateMinions,
} from './services/characterService';
export type {
  CharacterRow,
  CharacterInsert,
  CharacterUpdate,
  CharacterFilters,
} from './services/characterService';
export {
  getVisibleEntries,
  getAllEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  shareEntry,
} from './services/journalService';
export type {
  JournalEntryRow,
  JournalEntryInsert,
  JournalEntryUpdate,
} from './services/journalService';
export {
  getQuests,
  createQuest,
  updateQuest,
  toggleObjective,
  deleteQuest,
} from './services/questService';
export type {
  QuestRow,
  QuestInsert,
  QuestUpdate,
  QuestObjective,
} from './services/questService';
export {
  getFactions,
  createFaction,
  updateFaction,
  deleteFaction,
  getTerritories,
  setTerritory,
  getCharacterReputations,
  updateCharacterReputation,
} from './services/factionService';
export type {
  FactionRow,
  FactionInsert,
  FactionUpdate,
  TerritoryRow,
} from './services/factionService';
export {
  getMaps,
  getMapWithDetails,
  createMap,
  updateMap,
  deleteMap,
  setActiveMap,
} from './services/mapService';
export type {
  MapRow,
  MapInsert,
  MapUpdate,
  MapWithDetails,
} from './services/mapService';
export {
  updatePinState,
  createToken,
  moveToken,
  removeToken,
  getUserPins,
  addUserPin,
  removeUserPin,
} from './services/mapInteractionService';
export type {
  MapPinStateRow,
  MapTokenRow,
  UserMapPinRow,
} from './services/mapInteractionService';
export {
  getShops,
  getShopById,
  createShop,
  updateShop,
  deleteShop,
  updateInventory,
  removeInventoryItem,
} from './services/shopService';
export type {
  ShopRow,
  ShopInsert,
  ShopUpdate,
} from './services/shopService';
export {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from './services/templateService';
export type {
  TemplateRow,
  TemplateInsert,
  TemplateUpdate,
} from './services/templateService';
export {
  getCombatState,
  updateCombatState,
  clearCombatState,
} from './services/combatService';
export type {
  CombatStateRow,
  CombatStateUpdate,
} from './services/combatService';
export {
  getCalendarState,
  updateCalendarState,
} from './services/calendarService';
export {
  getRecentMessages,
  sendMessage,
  getChatHistory,
} from './services/chatService';
export type { ChatMessageRow } from './services/chatService';
export {
  signUp,
  signIn,
  signOut,
  getSession,
  getCurrentUserId,
  getProfile,
  updateProfile,
  onAuthStateChange,
} from './lib/auth';
export type { Profile } from './lib/auth';
export { getSupabaseEnvFromVite, getSupabaseEnvFromProcess } from './lib/env';
export type { SupabaseEnv } from './lib/env';

