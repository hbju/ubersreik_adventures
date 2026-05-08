import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Advantages,
  CalendarState,
  Character,
  ChatMessage,
  ClientToServerMessage,
  Combatant,
  Faction,
  GameDate,
  JournalEntry,
  Json,
  LocationTerritory,
  MapPinState,
  Quest,
  QuestStatus,
  ServerToClientMessage,
  ShopInventoryItem,
  ShopState,
  TimelineEvent,
  UserMapPin,
} from '@wfrp/shared';
import type { MapToken } from '@wfrp/shared/src/types/wfrp.types';
import {
  characterRowToCharacter,
  characterToUpdate,
  createQuest as svcCreateQuest,
  deleteQuest as svcDeleteQuest,
  executeDiceRoll,
  getCalendarState,
  getCharacters,
  getChatHistory,
  getCombatState,
  getFactions as svcGetFactions,
  getMaps,
  getQuests as svcGetQuests,
  getShops as svcGetShops,
  getTerritories as svcGetTerritories,
  getVisibleEntries,
  moveToken as svcMoveToken,
  parseChatCommand,
  playerAccountEmail,
  addUserPin as svcAddUserPin,
  removeUserPin as svcRemoveUserPin,
  sendMessage as chatInsertRow,
  updateCharacter as svcUpdateCharacter,
  updateQuest as svcUpdateQuest,
  useBroadcast,
  useRealtimeSync,
  type FactionRow,
  type QuestRow,
  type ShopRow,
  type ChatMessageRow,
  type JournalEntryRow,
} from '@wfrp/shared';
import { useAppContext } from '@/context/AppContext';

interface OpposedTestRequest {
  testId: string;
  role: 'attacker' | 'defender';
  skillName: string;
  targetNumber: number;
  modifier: number;
}

interface ConditionTestRequest {
  testId: string;
  conditionId: string;
  conditionName: string;
  testType: string;
  targetNumber: number;
  modifier: number;
  conditionCount: number;
  description: string;
}

function rowToChatMessage(row: ChatMessageRow): ChatMessage {
  const uiType: ChatMessage['type'] =
    row.message_type === 'dice_roll'
      ? 'roll'
      : row.message_type === 'system'
        ? 'system'
        : row.message_type === 'whisper'
          ? 'chat'
          : 'chat';

  return {
    id: row.id,
    timestamp: new Date(row.created_at).getTime(),
    senderId: row.sender_id ?? 'system',
    senderName: row.sender_name,
    type: uiType,
    content: row.content,
    isPrivate: row.message_type === 'whisper' || Boolean(row.target_user_id),
    data: (row.roll_data ?? undefined) as ChatMessage['data'],
  };
}

function rowToJournalEntry(row: JournalEntryRow): JournalEntry {
  const hasAll = row.is_public;
  const shared = row.shared_with ?? [];
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    imageData: row.image_data ?? undefined,
    sharedWith: hasAll ? ['all', ...shared] : shared,
  };
}

function rowToFaction(row: FactionRow): Faction {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    category: (row.category ?? 'other') as Faction['category'],
    icon: row.icon ?? '',
    hq: row.hq ?? '',
    head: row.head ?? '',
    defaultReputation: row.default_reputation ?? 0,
    color: row.color ?? undefined,
  };
}

function rowToShopState(row: ShopRow, characterId: string): ShopState | null {
  const access = row.player_access ?? [];
  if (!access.includes(characterId)) return null;

  const inventory = (Array.isArray(row.inventory) ? row.inventory : []) as unknown as ShopInventoryItem[];
  const filteredInventory = inventory.map((item) => {
    if (!item.isIdentified) {
      return {
        ...item,
        modification: 'standard' as const,
        quality: undefined,
        flaw: undefined,
        modifiedPrice: item.basePrice,
      };
    }
    return item;
  });

  return {
    shopId: row.id,
    lastRestockDate: row.last_restock_date ?? row.updated_at,
    inventory: filteredInventory,
    playerAccess: [characterId],
  };
}

type ObjectiveInput = {
  id?: string;
  text?: string;
  isCompleted?: boolean;
  completed?: boolean;
  locationId?: string;
};

function toObjective(input: ObjectiveInput): Quest['objectives'][number] {
  return {
    id: input?.id ?? crypto.randomUUID(),
    text: input?.text ?? '',
    isCompleted: Boolean(input?.isCompleted ?? input?.completed),
    locationId: input?.locationId,
  };
}

function rowToQuest(row: QuestRow): Quest {
  const objectivesInput = Array.isArray(row.objectives) ? row.objectives : [];
  return {
    id: row.id,
    title: row.title,
    characterId: row.character_id ?? '',
    description: row.description ?? '',
    status: (row.status as QuestStatus) ?? 'active',
    objectives: (objectivesInput as ObjectiveInput[]).map(toObjective),
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function objectivesToJson(objectives: Quest['objectives']): Json {
  return objectives.map((obj) => ({
    id: obj.id,
    text: obj.text,
    completed: obj.isCompleted,
    locationId: obj.locationId,
  })) as Json;
}

function isCalendarState(value: unknown): value is CalendarState {
  if (!value || typeof value !== 'object') return false;
  const maybe = value as Partial<CalendarState>;
  return !!maybe.currentDate && Array.isArray(maybe.events) && Array.isArray(maybe.eventTags);
}

export const useSocket = () => {
  const { supabase, user, serviceContext, selectCampaign, clearCampaign, signOut } = useAppContext();

  const [connecting, setConnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [displayUsername, setDisplayUsername] = useState<string | null>(null);
  const [playerColor, setPlayerColor] = useState('#d4af37');

  const [character, setCharacter] = useState<Character | null>(null);
  const [shopItems, setShopItems] = useState<string[]>([]);
  const [shops, setShops] = useState<ShopState[]>([]);
  const [combatants, setCombatants] = useState<Combatant[]>([]);
  const [currentTurnId, setCurrentTurnId] = useState<string | null>(null);
  const [currentAdvantage, setCurrentAdvantage] = useState<Advantages>({ playerAdvantage: 0, enemyAdvantage: 0 });
  const [opposedTestRequest, setOpposedTestRequest] = useState<OpposedTestRequest | null>(null);
  const [conditionTestRequest, setConditionTestRequest] = useState<ConditionTestRequest | null>(null);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [mapPinStates, setMapPinStates] = useState<Record<string, MapPinState>>({});
  const [mapPing, setMapPing] = useState<{ x: number; y: number; color?: string } | null>(null);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [locationTerritories, setLocationTerritories] = useState<Record<string, LocationTerritory>>({});
  const [quests, setQuests] = useState<Quest[]>([]);
  const [tokens, setTokens] = useState<MapToken[]>([]);
  const [userPins, setUserPins] = useState<UserMapPin[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activeMapId, setActiveMapId] = useState<string>('ubersreik_city');
  const [isMapTransitioning, setIsMapTransitioning] = useState(false);
  const [calendarDate, setCalendarDate] = useState<GameDate | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<TimelineEvent[]>([]);
  const [calendarWeather, setCalendarWeather] = useState<string | undefined>(undefined);

  const characterRef = useRef(character);
  useEffect(() => {
    characterRef.current = character;
  }, [character]);

  const isConnected = Boolean(user && serviceContext);
  const isAuthenticated = isConnected;
  const userId = user?.id ?? null;
  const realtimeCampaignId = serviceContext?.campaignId ?? null;

  const presenceProfile = useMemo(() => {
    if (!isAuthenticated || !userId || !realtimeCampaignId) return null;
    return {
      userId,
      displayName: character?.name ?? displayUsername ?? 'Player',
      characterId: character?.id ?? null,
      role: 'player' as const,
      online_at: new Date().toISOString(),
    };
  }, [isAuthenticated, userId, realtimeCampaignId, character?.id, character?.name, displayUsername]);

  const dispatchGmMessage = useCallback((message: ServerToClientMessage) => {
    if (message.type === 'ASSIGN_CHARACTER') {
      setCharacter(message.payload.character);
      return;
    }
    if (message.type === 'UPDATE_SHOP_INVENTORY') {
      const itemIds = Object.keys(message.payload.items);
      setShopItems(itemIds);
      return;
    }
    if (message.type === 'PURCHASE_RESPONSE') {
      if (message.payload.success) {
        alert(`Purchase successful! You received ${message.payload.item.name}`);
      } else {
        alert(`Purchase denied${message.payload.reason ? ': ' + message.payload.reason : ''}`);
      }
      return;
    }
    if (message.type === 'UPDATE_INITIATIVE_TRACKER') {
      setCombatants(message.payload.combatants);
      setCurrentTurnId(message.payload.currentTurnId);
      setCurrentAdvantage(message.payload.currentAdvantage);
      return;
    }
    if (message.type === 'REQUEST_OPPOSED_TEST') {
      setOpposedTestRequest({
        testId: message.payload.testId,
        role: message.payload.role,
        skillName: message.payload.skillName,
        targetNumber: message.payload.targetNumber,
        modifier: message.payload.modifier,
      });
      return;
    }
    if (message.type === 'REQUEST_CONDITION_TEST') {
      setConditionTestRequest({
        testId: message.payload.testId,
        conditionId: message.payload.conditionId,
        conditionName: message.payload.conditionName,
        testType: message.payload.testType,
        targetNumber: message.payload.targetNumber,
        modifier: message.payload.modifier,
        conditionCount: message.payload.conditionCount,
        description: message.payload.description,
      });
      return;
    }
    if (message.type === 'JOURNAL_UPDATE') {
      setJournalEntries(message.payload.entries);
      return;
    }
    if (message.type === 'MAP_STATE_UPDATE') {
      setMapPinStates(message.payload.pinStates);
      return;
    }
    if (message.type === 'MAP_PING') {
      setMapPing({ x: message.payload.x, y: message.payload.y, color: message.payload.color });
      setTimeout(() => setMapPing(null), 100);
      return;
    }
    if (message.type === 'CAREER_CHANGE_RESPONSE') {
      if (message.payload.success && message.payload.character) {
        setCharacter(message.payload.character);
        alert('Career change approved by GM! Your character has been updated.');
      } else {
        alert(`Career change request denied${message.payload.reason ? ': ' + message.payload.reason : '.'}`);
      }
      return;
    }
    if (message.type === 'FACTION_UPDATE') {
      setFactions(message.payload.factions);
      if (message.payload.locationTerritories) {
        setLocationTerritories(message.payload.locationTerritories);
      }
      return;
    }
    if (message.type === 'SHOP_STATE_UPDATE') {
      setShops(message.payload.shops);
      return;
    }
    if (message.type === 'SHOP_ITEM_REVEALED') {
      const { shopId, item } = message.payload;
      setShops((prevShops) =>
        prevShops.map((shop) => {
          if (shop.shopId === shopId) {
            const updatedInventory = shop.inventory.map((i) =>
              i.instanceId === item.instanceId ? item : i
            );
            return { ...shop, inventory: updatedInventory };
          }
          return shop;
        })
      );
      return;
    }
    if (message.type === 'CHARACTER_UPDATE') {
      const updatedChar = message.payload.character;
      setCharacter((prevChar) => {
        if (prevChar && prevChar.id === updatedChar.id) return updatedChar;
        return prevChar;
      });
      return;
    }
    if (message.type === 'QUEST_SYNC') {
      setQuests(message.payload.quests);
      return;
    }
    if (message.type === 'CALENDAR_SYNC') {
      setCalendarDate(message.payload.currentDate);
      setCalendarEvents(message.payload.events);
      setCalendarWeather(message.payload.currentWeather);
      return;
    }
    if (message.type === 'MAP_TOKENS_UPDATE') {
      setTokens(message.payload.tokens);
      return;
    }
    if (message.type === 'USER_PINS_UPDATE') {
      setUserPins(message.payload.pins);
      return;
    }
    if (message.type === 'CHAT_MESSAGE') {
      setChatMessages((prev) => [...prev, message.payload.message]);
      return;
    }
    if (message.type === 'CHAT_HISTORY') {
      setChatMessages(message.payload.messages);
      return;
    }
    if (message.type === 'ACTIVE_MAP_UPDATE') {
      setIsMapTransitioning(true);
      setActiveMapId(message.payload.activeMapId);
      return;
    }
    if (message.type === 'MAP_SWITCH') {
      setIsMapTransitioning(true);
      setActiveMapId(message.payload.mapId);
    }
  }, []);

  const broadcastHandlers = useMemo(
    () => ({
      onGmRelay: (envelope: { payload: { message: ServerToClientMessage } }) => {
        dispatchGmMessage(envelope.payload.message);
      },
      onPing: (envelope: { payload: { mapId: string; position: { x: number; y: number }; color?: string } }) => {
        const p = envelope.payload;
        if (p.mapId !== activeMapId) return;
        setMapPing({ x: p.position.x, y: p.position.y, color: p.color });
        setTimeout(() => setMapPing(null), 100);
      },
    }),
    [dispatchGmMessage, activeMapId]
  );

  const { relayPlayerMessage, sendPing, onlineUsers: campaignOnlineUsers } = useBroadcast({
    supabase,
    campaignId: realtimeCampaignId,
    userId,
    presenceProfile,
    handlers: broadcastHandlers,
  });

  const refreshCharacter = useCallback(async () => {
    if (!serviceContext || !userId) return;
    const res = await getCharacters(serviceContext.client, serviceContext.campaignId, { userId });
    if (res.error || !res.data[0]) {
      characterRef.current = null;
      setCharacter(null);
      return;
    }
    const ch = characterRowToCharacter(res.data[0]);
    characterRef.current = ch;
    setCharacter(ch);
  }, [serviceContext, userId]);

  const refreshCombat = useCallback(async () => {
    if (!serviceContext) return;
    const res = await getCombatState(serviceContext.client, serviceContext.campaignId);
    if (res.error) return;
    const row = res.data;
    const rawCombatants = row.combatants;
    const parsed = Array.isArray(rawCombatants) ? (rawCombatants as unknown as Combatant[]) : [];
    setCombatants(parsed);
    const turnIdx = row.current_turn_index ?? 0;
    const current = parsed[turnIdx] ?? null;
    setCurrentTurnId(current?.id ?? null);
    setCurrentAdvantage({
      playerAdvantage: row.player_advantage ?? 0,
      enemyAdvantage: row.enemy_advantage ?? 0,
    });
  }, [serviceContext]);

  const refreshJournal = useCallback(async () => {
    if (!serviceContext || !userId) return;
    const res = await getVisibleEntries(serviceContext.client, serviceContext.campaignId, userId);
    if (res.error) return;
    setJournalEntries(res.data.map(rowToJournalEntry));
  }, [serviceContext, userId]);

  const refreshFactions = useCallback(async () => {
    if (!serviceContext) return;
    const [facRes, terrRes] = await Promise.all([
      svcGetFactions(serviceContext.client, serviceContext.campaignId),
      svcGetTerritories(serviceContext.client, serviceContext.campaignId),
    ]);
    if (facRes.error || terrRes.error) return;
    setFactions(facRes.data.map(rowToFaction));
    const territoryMap: Record<string, LocationTerritory> = {};
    terrRes.data.forEach((row) => {
      if (!row.faction_id) return;
      territoryMap[row.location_id] = {
        controllingFactionId: row.faction_id,
        influenceWeight: row.control_level ?? 1,
      };
    });
    setLocationTerritories(territoryMap);
  }, [serviceContext]);

  const refreshQuests = useCallback(async () => {
    if (!serviceContext || !characterRef.current?.id) return;
    const res = await svcGetQuests(serviceContext.client, serviceContext.campaignId);
    if (res.error) return;
    const mine = res.data
      .map(rowToQuest)
      .filter((q) => q.characterId === characterRef.current!.id);
    setQuests(mine);
  }, [serviceContext]);

  const refreshShops = useCallback(async () => {
    if (!serviceContext || !characterRef.current?.id) return;
    const res = await svcGetShops(serviceContext.client, serviceContext.campaignId);
    if (res.error) return;
    const cid = characterRef.current!.id;
    const accessible: ShopState[] = [];
    res.data.forEach((row) => {
      const st = rowToShopState(row, cid);
      if (st) accessible.push(st);
    });
    setShops(accessible);
    setShopItems(accessible.map((s) => s.shopId));
  }, [serviceContext]);

  const refreshMaps = useCallback(async () => {
    if (!serviceContext || !userId) return;
    const [mapsRes, campaignRes, pinsRes, tokensRes, pinsUserRes] = await Promise.all([
      getMaps(serviceContext.client, serviceContext.campaignId),
      serviceContext.client
        .from('campaigns')
        .select('active_map_id')
        .eq('id', serviceContext.campaignId)
        .single(),
      serviceContext.client
        .from('map_pin_states')
        .select('*')
        .eq('campaign_id', serviceContext.campaignId),
      serviceContext.client
        .from('map_tokens')
        .select('*')
        .eq('campaign_id', serviceContext.campaignId),
      serviceContext.client
        .from('user_map_pins')
        .select('*')
        .eq('campaign_id', serviceContext.campaignId)
        .eq('user_id', userId),
    ]);

    if (mapsRes.error) return;

    const nextActive =
      (campaignRes.data?.active_map_id as string | null) ||
      mapsRes.data[0]?.id ||
      activeMapId;

    if (campaignRes.data?.active_map_id) {
      setActiveMapId(campaignRes.data.active_map_id);
    }

    const charId = characterRef.current?.id;
    const pinStatesForActive: Record<string, MapPinState> = {};
    if (!pinsRes.error && pinsRes.data && charId) {
      for (const row of pinsRes.data as { map_id: string; location_id: string; player_discovered: string[] }[]) {
        if (row.map_id !== nextActive) continue;
        if (row.player_discovered?.includes(charId)) {
          pinStatesForActive[row.location_id] = { playerDiscovered: [charId] };
        }
      }
    }
    setMapPinStates(pinStatesForActive);

    if (!tokensRes.error && tokensRes.data) {
      setTokens(
        (tokensRes.data as { id: string; character_id: string; map_id: string; x: number; y: number }[]).map(
          (t) => ({
            id: t.id,
            characterId: t.character_id,
            mapId: t.map_id,
            x: t.x,
            y: t.y,
          })
        )
      );
    }

    if (!pinsUserRes.error && pinsUserRes.data) {
      setUserPins(
        (pinsUserRes.data as {
          id: string;
          user_id: string;
          character_id: string | null;
          map_id: string;
          x: number;
          y: number;
          label: string | null;
          color: string | null;
        }[]).map((p) => ({
          id: p.id,
          playerId: p.user_id,
          characterId: p.character_id ?? '',
          mapId: p.map_id,
          x: p.x,
          y: p.y,
          label: p.label ?? '',
          color: p.color ?? undefined,
        }))
      );
    }
  }, [serviceContext, userId, activeMapId]);

  const refreshCalendar = useCallback(async () => {
    if (!serviceContext) return;
    const res = await getCalendarState(serviceContext.client, serviceContext.campaignId);
    if (res.error) return;
    const data = res.data;
    if (data && isCalendarState(data)) {
      const visible = (data.events || []).filter((e) => e.isVisibleToPlayers && !e.isHidden);
      setCalendarDate(data.currentDate);
      setCalendarEvents(visible);
      setCalendarWeather(data.currentWeather);
    }
  }, [serviceContext]);

  const refreshChat = useCallback(async () => {
    if (!serviceContext || !userId) return;
    const res = await getChatHistory(serviceContext.client, serviceContext.campaignId, userId);
    if (res.error) return;
    setChatMessages(res.data.map(rowToChatMessage));
  }, [serviceContext, userId]);

  const bootstrap = useCallback(async () => {
    if (!serviceContext || !userId) return;

    const memberRes = await serviceContext.client
      .from('campaign_members')
      .select('color')
      .eq('campaign_id', serviceContext.campaignId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!memberRes.error && memberRes.data?.color) {
      setPlayerColor(memberRes.data.color);
    }

    await refreshCharacter();

    const cid = characterRef.current?.id;

    await Promise.all([
      refreshCombat(),
      refreshJournal(),
      refreshFactions(),
      refreshCalendar(),
      refreshChat(),
      refreshMaps(),
    ]);

    if (cid) {
      await refreshQuests();
      await refreshShops();
    }
  }, [
    serviceContext,
    userId,
    refreshCharacter,
    refreshCombat,
    refreshJournal,
    refreshFactions,
    refreshCalendar,
    refreshChat,
    refreshMaps,
    refreshQuests,
    refreshShops,
  ]);

  useEffect(() => {
    if (!serviceContext || !userId) return;
    void bootstrap();
  }, [serviceContext, userId, bootstrap]);

  const realtimeCallbacks = useMemo(
    () => ({
      characters: refreshCharacter,
      quests: refreshQuests,
      journal: refreshJournal,
      factions: refreshFactions,
      maps: refreshMaps,
      shops: refreshShops,
      combat: refreshCombat,
      calendar: refreshCalendar,
      chat: refreshChat,
    }),
    [
      refreshCharacter,
      refreshQuests,
      refreshJournal,
      refreshFactions,
      refreshMaps,
      refreshShops,
      refreshCombat,
      refreshCalendar,
      refreshChat,
    ]
  );

  useRealtimeSync({ serviceContext, callbacks: realtimeCallbacks });

  const connect = useCallback(
    async (campaignId: string, username: string, password: string) => {
      setAuthError(null);
      setConnecting(true);
      selectCampaign(campaignId.trim());
      const { error } = await supabase.auth.signInWithPassword({
        email: username.trim(),
        password,
      });
      if (error) {
        setAuthError(error.message);
        clearCampaign();
        setConnecting(false);
        return;
      }
      setDisplayUsername(username.trim());
      setConnecting(false);
    },
    [supabase.auth, selectCampaign, clearCampaign]
  );

  const disconnect = useCallback(async () => {
    setConnecting(false);
    await signOut();
    setCharacter(null);
    setAuthError(null);
    setDisplayUsername(null);
    setShopItems([]);
    setShops([]);
    setCombatants([]);
    setJournalEntries([]);
    setQuests([]);
    setTokens([]);
    setUserPins([]);
    setChatMessages([]);
  }, [signOut]);

  const sendMessage = useCallback(
    async (message: ClientToServerMessage) => {
      if (!serviceContext || !userId) return;

      if (message.type === 'PLAYER_UPDATE_CHARACTER') {
        const { characterId, updates } = message.payload;
        const mine = characterRef.current;
        if (!mine || mine.id !== characterId) return;
        const patch = characterToUpdate(updates);
        const res = await svcUpdateCharacter(serviceContext.client, characterId, patch as never);
        if (!res.error) setCharacter(characterRowToCharacter(res.data));
        return;
      }

      if (message.type === 'TOKEN_MOVE') {
        const { tokenId, x, y } = message.payload;
        await svcMoveToken(serviceContext.client, tokenId, x, y);
        return;
      }

      if (message.type === 'MAP_ADD_PIN') {
        const { pin } = message.payload;
        await svcAddUserPin(
          serviceContext.client,
          serviceContext.campaignId,
          pin.mapId,
          userId,
          pin.x,
          pin.y,
          pin.label,
          pin.color ?? null
        );
        return;
      }

      if (message.type === 'MAP_REMOVE_PIN') {
        await svcRemoveUserPin(serviceContext.client, message.payload.pinId);
        return;
      }

      if (message.type === 'MAP_PING_REQUEST') {
        const { x, y } = message.payload;
        await sendPing(activeMapId, { x, y }, userId, playerColor);
        return;
      }

      if (message.type === 'CHAT_SEND') {
        const { content, senderName } = message.payload;
        const parsed = parseChatCommand(content);
        let messageType: 'text' | 'dice_roll' | 'system' | 'whisper' = 'text';
        let messageContent = content;
        let rollData: unknown;
        if (parsed.isRollCommand && parsed.diceRequest) {
          const rollResult = executeDiceRoll(parsed.diceRequest);
          messageType = 'dice_roll';
          messageContent = `Rolling ${rollResult.formula}`;
          rollData = rollResult as unknown;
        } else if (parsed.isRollCommand && !parsed.diceRequest) {
          setChatMessages((prev) => [
            ...prev,
            {
              id: `chat-error-${Date.now()}`,
              timestamp: Date.now(),
              senderId: 'system',
              senderName: 'System',
              type: 'error',
              content: parsed.errorMessage ?? 'Invalid dice command',
              isPrivate: Boolean(parsed.isPrivate),
            },
          ]);
          return;
        }
        if (parsed.isPrivate) messageType = 'whisper';
        await chatInsertRow(
          serviceContext.client,
          serviceContext.campaignId,
          userId,
          senderName,
          messageContent,
          messageType,
          (rollData ?? null) as never,
          parsed.isPrivate ? userId : null
        );
        await refreshChat();
        return;
      }

      if (message.type === 'QUEST_UPDATE') {
        const { quest } = message.payload;
        const existing = await svcGetQuests(serviceContext.client, serviceContext.campaignId);
        if (existing.error) return;
        const has = existing.data.some((r) => r.id === quest.id);
        if (has) {
          await svcUpdateQuest(serviceContext.client, quest.id, {
            title: quest.title,
            description: quest.description,
            character_id: quest.characterId || null,
            status: quest.status,
            objectives: objectivesToJson(quest.objectives),
          });
        } else {
          await svcCreateQuest(serviceContext.client, serviceContext.campaignId, {
            id: quest.id,
            title: quest.title,
            description: quest.description,
            character_id: quest.characterId || null,
            status: quest.status,
            objectives: objectivesToJson(quest.objectives),
          });
        }
        await refreshQuests();
        return;
      }

      if (message.type === 'QUEST_DELETE') {
        await svcDeleteQuest(serviceContext.client, message.payload.questId);
        await refreshQuests();
        return;
      }

      await relayPlayerMessage(message);
    },
    [
      serviceContext,
      userId,
      relayPlayerMessage,
      sendPing,
      activeMapId,
      playerColor,
      refreshChat,
      refreshQuests,
    ]
  );

  return {
    socket: null,
    connecting,
    isConnected,
    isAuthenticated,
    authError,
    username: displayUsername,
    userId,
    playerColor,
    character,
    shopItems,
    shops,
    combatants,
    currentTurnId,
    currentAdvantage,
    opposedTestRequest,
    setOpposedTestRequest,
    conditionTestRequest,
    setConditionTestRequest,
    journalEntries,
    mapPinStates,
    mapPing,
    factions,
    locationTerritories,
    quests,
    tokens,
    userPins,
    chatMessages,
    setChatMessages,
    activeMapId,
    isMapTransitioning,
    setIsMapTransitioning,
    calendarDate,
    calendarEvents,
    calendarWeather,
    realtimeCampaignId,
    /** Same campaign ephemeral channel as relays — do not call usePresence/useBroadcast again for this campaign */
    onlineUsers: campaignOnlineUsers,
    connect,
    disconnect,
    sendMessage,
  };
};
