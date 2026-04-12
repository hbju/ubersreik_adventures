import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@wfrp/shared';
import type {
  Character,
  JournalEntry,
  Quest,
  Faction,
  LocationTerritory,
  MapPinState,
  UserMapPin,
  ShopState,
  Combatant,
} from '@wfrp/shared';
import type { MapToken } from '@wfrp/shared/src/types/wfrp.types';
import type { GameDate, TimelineEvent } from '@wfrp/shared';
import type { ChatMessage } from '@wfrp/shared';

interface CampaignData {
  characters: Character[];
  myCharacter: Character | null;
  journalEntries: JournalEntry[];
  quests: Quest[];
  factions: Faction[];
  locationTerritories: Record<string, LocationTerritory>;
  mapPinStates: Record<string, MapPinState>;
  tokens: MapToken[];
  userPins: UserMapPin[];
  shops: ShopState[];
  chatMessages: ChatMessage[];
  activeMapId: string;
  calendarDate: GameDate | null;
  calendarEvents: TimelineEvent[];
  calendarWeather: string | undefined;
  combatants: Combatant[];
  currentTurnId: string | null;
  currentAdvantage: { playerAdvantage: number; enemyAdvantage: number };
}

const emptyData: CampaignData = {
  characters: [],
  myCharacter: null,
  journalEntries: [],
  quests: [],
  factions: [],
  locationTerritories: {},
  mapPinStates: {},
  tokens: [],
  userPins: [],
  shops: [],
  chatMessages: [],
  activeMapId: 'ubersreik_city',
  calendarDate: null,
  calendarEvents: [],
  calendarWeather: undefined,
  combatants: [],
  currentTurnId: null,
  currentAdvantage: { playerAdvantage: 0, enemyAdvantage: 0 },
};

export function useSupabaseData(campaignId: string | null) {
  const [data, setData] = useState<CampaignData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all campaign data in parallel
  const loadCampaignData = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);

    try {
      const sb = supabase.getSupabase();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const [
        characters,
        journalEntries,
        quests,
        factions,
        territories,
        mapPinStates,
        tokens,
        userPins,
        shopInventory,
        chatMessages,
        calendarState,
        combatState,
        combatants,
        campaign,
      ] = await Promise.all([
        supabase.characterQueries.getAllCharacters(campaignId),
        supabase.journalQueries.getJournalEntries(campaignId),
        supabase.questQueries.getQuests(campaignId),
        supabase.factionQueries.getFactions(campaignId),
        supabase.factionQueries.getTerritories(campaignId),
        supabase.mapQueries.getMapPinStates(campaignId),
        supabase.mapQueries.getTokens(campaignId),
        supabase.mapQueries.getUserPins(campaignId),
        supabase.shopQueries.getShopInventoryState(campaignId),
        supabase.chatQueries.getMessages(campaignId),
        supabase.calendarQueries.getCalendarState(campaignId),
        supabase.combatQueries.getCombatState(campaignId),
        supabase.combatQueries.getCombatants(campaignId),
        supabase.campaignQueries.getCampaign(campaignId),
      ]);

      // Find the character assigned to this user
      const myCharacter = characters.find(c => c.userId === user.id) ?? null;

      // Build shops from inventory state
      const shops: ShopState[] = shopInventory?.shops
        ? Object.values(shopInventory.shops)
        : [];

      setData({
        characters,
        myCharacter,
        journalEntries,
        quests,
        factions,
        locationTerritories: territories,
        mapPinStates,
        tokens,
        userPins,
        shops,
        chatMessages,
        activeMapId: campaign?.active_map_id || 'ubersreik_city',
        calendarDate: calendarState?.currentDate ?? null,
        calendarEvents: calendarState?.events ?? [],
        calendarWeather: calendarState?.currentWeather,
        combatants,
        currentTurnId: combatState?.currentTurnId ?? null,
        currentAdvantage: {
          playerAdvantage: combatState?.playerAdvantage ?? 0,
          enemyAdvantage: combatState?.enemyAdvantage ?? 0,
        },
      });
    } catch (err: unknown) {
      console.error('[SUPABASE] Failed to load campaign data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load campaign data');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    loadCampaignData();
  }, [loadCampaignData]);

  // Granular updaters (called from Socket.io live session or Realtime)
  const updateCharacter = useCallback((character: Character) => {
    setData(prev => ({
      ...prev,
      myCharacter: prev.myCharacter?.id === character.id ? character : prev.myCharacter,
      characters: prev.characters.map(c => c.id === character.id ? character : c),
    }));
  }, []);

  const updateJournalEntries = useCallback((entries: JournalEntry[]) => {
    setData(prev => ({ ...prev, journalEntries: entries }));
  }, []);

  const updateQuests = useCallback((quests: Quest[]) => {
    setData(prev => ({ ...prev, quests }));
  }, []);

  const updateFactions = useCallback((factions: Faction[], locationTerritories?: Record<string, LocationTerritory>) => {
    setData(prev => ({
      ...prev,
      factions,
      ...(locationTerritories ? { locationTerritories } : {}),
    }));
  }, []);

  const updateMapPinStates = useCallback((pinStates: Record<string, MapPinState>) => {
    setData(prev => ({ ...prev, mapPinStates: pinStates }));
  }, []);

  const updateTokens = useCallback((tokens: MapToken[]) => {
    setData(prev => ({ ...prev, tokens }));
  }, []);

  const updateUserPins = useCallback((pins: UserMapPin[]) => {
    setData(prev => ({ ...prev, userPins: pins }));
  }, []);

  const updateShops = useCallback((shops: ShopState[]) => {
    setData(prev => ({ ...prev, shops }));
  }, []);

  const updateCombat = useCallback((combatants: Combatant[], currentTurnId: string | null, currentAdvantage: { playerAdvantage: number; enemyAdvantage: number }) => {
    setData(prev => ({ ...prev, combatants, currentTurnId, currentAdvantage }));
  }, []);

  const updateCalendar = useCallback((calendarDate: GameDate, calendarEvents: TimelineEvent[], calendarWeather?: string) => {
    setData(prev => ({
      ...prev,
      calendarDate,
      calendarEvents,
      calendarWeather,
    }));
  }, []);

  const updateChatMessages = useCallback((messages: ChatMessage[]) => {
    setData(prev => ({ ...prev, chatMessages: messages }));
  }, []);

  const addChatMessage = useCallback((message: ChatMessage) => {
    setData(prev => ({ ...prev, chatMessages: [...prev.chatMessages, message] }));
  }, []);

  const updateActiveMapId = useCallback((mapId: string) => {
    setData(prev => ({ ...prev, activeMapId: mapId }));
  }, []);

  // ── Re-fetch helpers (used by Realtime subscriptions) ────────────────────

  const refetchCharacters = useCallback(async () => {
    if (!campaignId) return;
    const sb = supabase.getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    const characters = await supabase.characterQueries.getAllCharacters(campaignId);
    const myCharacter = user ? (characters.find(c => c.userId === user.id) ?? null) : null;
    setData(prev => ({ ...prev, characters, myCharacter }));
  }, [campaignId]);

  const refetchJournal = useCallback(async () => {
    if (!campaignId) return;
    const entries = await supabase.journalQueries.getJournalEntries(campaignId);
    setData(prev => ({ ...prev, journalEntries: entries }));
  }, [campaignId]);

  const refetchQuests = useCallback(async () => {
    if (!campaignId) return;
    const quests = await supabase.questQueries.getQuests(campaignId);
    setData(prev => ({ ...prev, quests }));
  }, [campaignId]);

  const refetchFactions = useCallback(async () => {
    if (!campaignId) return;
    const [factions, territories] = await Promise.all([
      supabase.factionQueries.getFactions(campaignId),
      supabase.factionQueries.getTerritories(campaignId),
    ]);
    setData(prev => ({ ...prev, factions, locationTerritories: territories }));
  }, [campaignId]);

  const refetchMapPins = useCallback(async () => {
    if (!campaignId) return;
    const pinStates = await supabase.mapQueries.getMapPinStates(campaignId);
    setData(prev => ({ ...prev, mapPinStates: pinStates }));
  }, [campaignId]);

  const refetchTokens = useCallback(async () => {
    if (!campaignId) return;
    const tokens = await supabase.mapQueries.getTokens(campaignId);
    setData(prev => ({ ...prev, tokens }));
  }, [campaignId]);

  const refetchUserPins = useCallback(async () => {
    if (!campaignId) return;
    const pins = await supabase.mapQueries.getUserPins(campaignId);
    setData(prev => ({ ...prev, userPins: pins }));
  }, [campaignId]);

  const refetchShops = useCallback(async () => {
    if (!campaignId) return;
    const shopInventory = await supabase.shopQueries.getShopInventoryState(campaignId);
    const shops: ShopState[] = shopInventory?.shops
      ? Object.values(shopInventory.shops)
      : [];
    setData(prev => ({ ...prev, shops }));
  }, [campaignId]);

  const refetchCombat = useCallback(async () => {
    if (!campaignId) return;
    const [combatState, combatants] = await Promise.all([
      supabase.combatQueries.getCombatState(campaignId),
      supabase.combatQueries.getCombatants(campaignId),
    ]);
    setData(prev => ({
      ...prev,
      combatants,
      currentTurnId: combatState?.currentTurnId ?? null,
      currentAdvantage: {
        playerAdvantage: combatState?.playerAdvantage ?? 0,
        enemyAdvantage: combatState?.enemyAdvantage ?? 0,
      },
    }));
  }, [campaignId]);

  const refetchCalendar = useCallback(async () => {
    if (!campaignId) return;
    const calendarState = await supabase.calendarQueries.getCalendarState(campaignId);
    setData(prev => ({
      ...prev,
      calendarDate: calendarState?.currentDate ?? null,
      calendarEvents: calendarState?.events ?? [],
      calendarWeather: calendarState?.currentWeather,
    }));
  }, [campaignId]);

  const refetchChat = useCallback(async () => {
    if (!campaignId) return;
    const messages = await supabase.chatQueries.getMessages(campaignId);
    setData(prev => ({ ...prev, chatMessages: messages }));
  }, [campaignId]);

  const refetchCampaign = useCallback(async () => {
    if (!campaignId) return;
    const campaign = await supabase.campaignQueries.getCampaign(campaignId);
    setData(prev => ({
      ...prev,
      activeMapId: campaign?.active_map_id || prev.activeMapId,
    }));
  }, [campaignId]);

  return {
    ...data,
    loading,
    error,
    reload: loadCampaignData,
    // Immediate state setters (for Socket.io / direct updates)
    updateCharacter,
    updateJournalEntries,
    updateQuests,
    updateFactions,
    updateMapPinStates,
    updateTokens,
    updateUserPins,
    updateShops,
    updateCombat,
    updateCalendar,
    updateChatMessages,
    addChatMessage,
    updateActiveMapId,
    // Async re-fetchers (for Realtime subscriptions)
    refetchCharacters,
    refetchJournal,
    refetchQuests,
    refetchFactions,
    refetchMapPins,
    refetchTokens,
    refetchUserPins,
    refetchShops,
    refetchCombat,
    refetchCalendar,
    refetchChat,
    refetchCampaign,
  };
}
