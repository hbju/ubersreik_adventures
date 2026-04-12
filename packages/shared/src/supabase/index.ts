// Supabase client and types
export { initSupabase, getSupabase, resetSupabase } from './client';
export type { SupabaseClient, Database } from './client';
export type { Json, Tables, TablesInsert, TablesUpdate } from './types';

// Query modules
export * as campaignQueries from './queries/campaigns';
export * as characterQueries from './queries/characters';
export * as journalQueries from './queries/journal';
export * as questQueries from './queries/quests';
export * as factionQueries from './queries/factions';
export * as mapQueries from './queries/maps';
export * as shopQueries from './queries/shops';
export * as calendarQueries from './queries/calendar';
export * as chatQueries from './queries/chat';
export * as gameLogQueries from './queries/gameLog';
export * as combatQueries from './queries/combat';
export * as audioQueries from './queries/audio';

// Assemblers
export * from './queries/assemblers';
