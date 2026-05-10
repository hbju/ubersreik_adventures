import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CalendarState, GameDate, TimelineEvent } from '../../data/calendar';
import type { ChatMessage } from '../../types/chat.types';
import type { Json } from '../../types/database.types';
import type { ClientToServerMessage, ServerToClientMessage } from '../../types/messaging.types';
import type {
  Character,
  Faction,
  JournalEntry,
  LocationTerritory,
  Quest,
  QuestStatus,
  ShopInventoryItem,
  ShopState,
  UserMapPin,
} from '../../types/wfrp.types';
import type { MapToken } from '../../types/wfrp.types';
import type { ServiceContext } from '../../services/serviceContext';
import type {
  BroadcastEnvelope,
  ConditionTestRequestPayload,
  GmRelayPayload,
  OpposedTestRequestPayload,
  PingPayload,
} from '../../lib/broadcast';
import type { FactionRow } from '../../services/factionService';
import type { JournalEntryRow } from '../../services/journalService';
import type { QuestRow } from '../../services/questService';
import type { ShopRow } from '../../services/shopService';
import { characterRowToCharacter, characterToUpdate } from '../../utils/characterConverter';
import { executeDiceRoll, parseChatCommand } from '../../utils/diceParser';
import { getCalendarState } from '../../services/calendarService';
import { updateCharacter as svcUpdateCharacter } from '../../services/characterService';
import { sendMessage as chatInsertRow } from '../../services/chatService';
import { getFactions as svcGetFactions, getTerritories as svcGetTerritories } from '../../services/factionService';
import { getVisibleEntries } from '../../services/journalService';
import { addUserPin as svcAddUserPin, moveToken as svcMoveToken, removeUserPin as svcRemoveUserPin } from '../../services/mapInteractionService';
import {
  createQuest as svcCreateQuest,
  deleteQuest as svcDeleteQuest,
  getQuests as svcGetQuests,
  updateQuest as svcUpdateQuest,
} from '../../services/questService';
import { getShops as svcGetShops } from '../../services/shopService';
import type { CampaignPresenceTrackPayload } from '../../lib/broadcast';
import { useRealtimeSync } from '../useRealtimeSync';
import { usePlayerBroadcast } from './usePlayerBroadcast';
import { usePlayerCharacter } from './usePlayerCharacter';
import { usePlayerChat } from './usePlayerChat';
import { usePlayerCombat } from './usePlayerCombat';
import { usePlayerMap } from './usePlayerMap';

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

export interface UsePlayerDataOptions {
  /** Null when not in a campaign session */
  serviceContext: ServiceContext | null;
  /** Display name fallback for Presence when character is missing */
  username?: string | null;
}

/**
 * Supabase-backed player session: composes character, map, combat, chat, broadcast, and campaign sync.
 * Return shape mirrors {@link useSocket} from the Electron player app for easier UI migration.
 */
export function usePlayerData(options: UsePlayerDataOptions) {
  const { serviceContext, username: displayUsername } = options;

  const [connecting] = useState(false);
  const [authError] = useState<string | null>(null);
  const [playerColor, setPlayerColor] = useState('#d4af37');
  const [shopItems, setShopItems] = useState<string[]>([]);
  const [shops, setShops] = useState<ShopState[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [mapPing, setMapPing] = useState<{ x: number; y: number; color?: string } | null>(null);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [locationTerritories, setLocationTerritories] = useState<Record<string, LocationTerritory>>({});
  const [quests, setQuests] = useState<Quest[]>([]);
  const [calendarDate, setCalendarDate] = useState<GameDate | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<TimelineEvent[]>([]);
  const [calendarWeather, setCalendarWeather] = useState<string | undefined>(undefined);

  const characterApi = usePlayerCharacter(serviceContext);
  const mapApi = usePlayerMap(serviceContext, characterApi.character?.id ?? null);
  const combatApi = usePlayerCombat(serviceContext);
  const chatApi = usePlayerChat(serviceContext);

  const characterRef = useRef(characterApi.character);
  useEffect(() => {
    characterRef.current = characterApi.character;
  }, [characterApi.character]);

  const refreshJournal = useCallback(async () => {
    if (!serviceContext) return;
    const res = await getVisibleEntries(serviceContext.client, serviceContext.campaignId, serviceContext.userId);
    if (res.error) return;
    setJournalEntries(res.data.map(rowToJournalEntry));
  }, [serviceContext]);

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

  const dispatchGmMessage = useCallback(
    (message: ServerToClientMessage) => {
    if (message.type === 'ASSIGN_CHARACTER') {
      characterApi.setCharacter(message.payload.character);
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
      combatApi.refreshCombat();
      return;
    }
    if (message.type === 'REQUEST_OPPOSED_TEST') {
      combatApi.setOpposedTestRequest({
        testId: message.payload.testId,
        role: message.payload.role,
        skillName: message.payload.skillName,
        targetNumber: message.payload.targetNumber,
        modifier: message.payload.modifier,
      });
      return;
    }
    if (message.type === 'REQUEST_CONDITION_TEST') {
      combatApi.setConditionTestRequest({
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
      void mapApi.refreshMaps();
      return;
    }
    if (message.type === 'MAP_PING') {
      setMapPing({ x: message.payload.x, y: message.payload.y, color: message.payload.color });
      setTimeout(() => setMapPing(null), 100);
      return;
    }
    if (message.type === 'CAREER_CHANGE_RESPONSE') {
      if (message.payload.success && message.payload.character) {
        characterApi.setCharacter(message.payload.character);
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
      characterApi.setCharacter((prevChar: Character | null) => {
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
      void mapApi.refreshMaps();
      return;
    }
    if (message.type === 'USER_PINS_UPDATE') {
      void mapApi.refreshMaps();
      return;
    }
    if (message.type === 'CHAT_MESSAGE') {
      chatApi.setChatMessages((prev) => [...prev, message.payload.message]);
      return;
    }
    if (message.type === 'CHAT_HISTORY') {
      chatApi.setChatMessages(message.payload.messages);
      return;
    }
    if (message.type === 'ACTIVE_MAP_UPDATE') {
      mapApi.setIsMapTransitioning(true);
      mapApi.setActiveMapId(message.payload.activeMapId);
      void mapApi.refreshMaps();
      return;
    }
    if (message.type === 'MAP_SWITCH') {
      mapApi.setIsMapTransitioning(true);
      mapApi.setActiveMapId(message.payload.mapId);
      void mapApi.refreshMaps();
    }
  },
    [characterApi, combatApi, mapApi, chatApi]
  );

  const broadcastHandlers = useMemo(
    () => ({
      onGmRelay: (envelope: BroadcastEnvelope<GmRelayPayload>) => {
        dispatchGmMessage(envelope.payload.message);
      },
      onPing: (envelope: BroadcastEnvelope<PingPayload>) => {
        const p = envelope.payload;
        if (p.mapId !== mapApi.activeMapId) return;
        setMapPing({ x: p.position.x, y: p.position.y, color: p.color });
        setTimeout(() => setMapPing(null), 100);
      },
      onOpposedTestRequest: (envelope: BroadcastEnvelope<OpposedTestRequestPayload>) => {
        const { targetUserId, message } = envelope.payload;
        if (!serviceContext || targetUserId !== serviceContext.userId) return;
        combatApi.setOpposedTestRequest({
          testId: message.testId,
          role: message.role,
          skillName: message.skillName,
          targetNumber: message.targetNumber,
          modifier: message.modifier,
        });
      },
      onConditionTestRequest: (envelope: BroadcastEnvelope<ConditionTestRequestPayload>) => {
        const { targetUserId, message } = envelope.payload;
        if (!serviceContext || targetUserId !== serviceContext.userId) return;
        combatApi.setConditionTestRequest({
          testId: message.testId,
          conditionId: message.conditionId,
          conditionName: message.conditionName,
          testType: message.testType,
          targetNumber: message.targetNumber,
          modifier: message.modifier,
          conditionCount: message.conditionCount,
          description: message.description,
        });
      },
    }),
    [dispatchGmMessage, mapApi.activeMapId, serviceContext, combatApi]
  );

  const presenceProfile = useMemo((): CampaignPresenceTrackPayload | null => {
    if (!serviceContext) return null;
    return {
      userId: serviceContext.userId,
      displayName: characterApi.character?.name ?? displayUsername ?? 'Player',
      characterId: characterApi.character?.id ?? null,
      role: 'player',
      online_at: new Date().toISOString(),
    };
  }, [serviceContext, characterApi.character?.id, characterApi.character?.name, displayUsername]);

  const broadcastApi = usePlayerBroadcast({
    serviceContext,
    presenceProfile,
    handlers: broadcastHandlers,
  });

  const realtimeCallbacks = useMemo(
    () => ({
      quests: refreshQuests,
      journal: refreshJournal,
      factions: refreshFactions,
      shops: refreshShops,
      combat: combatApi.refreshCombat,
      calendar: refreshCalendar,
    }),
    [
      refreshQuests,
      refreshJournal,
      refreshFactions,
      refreshShops,
      combatApi.refreshCombat,
      refreshCalendar,
    ]
  );

  useRealtimeSync({ serviceContext, callbacks: realtimeCallbacks });

  const bootstrap = useCallback(async () => {
    if (!serviceContext) return;

    const memberRes = await serviceContext.client
      .from('campaign_members')
      .select('color')
      .eq('campaign_id', serviceContext.campaignId)
      .eq('user_id', serviceContext.userId)
      .maybeSingle();
    if (!memberRes.error && memberRes.data?.color) {
      setPlayerColor(memberRes.data.color);
    }

    await characterApi.refreshCharacter();

    await Promise.all([
      combatApi.refreshCombat(),
      refreshJournal(),
      refreshFactions(),
      refreshCalendar(),
      chatApi.refreshChat(),
      mapApi.refreshMaps(),
    ]);

    if (characterRef.current?.id) {
      await refreshQuests();
      await refreshShops();
    }
  }, [
    serviceContext,
    characterApi,
    combatApi,
    refreshJournal,
    refreshFactions,
    refreshCalendar,
    chatApi,
    mapApi,
    refreshQuests,
    refreshShops,
  ]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const sendMessage = useCallback(
    async (message: ClientToServerMessage) => {
      if (!serviceContext) return;

      if (message.type === 'PLAYER_UPDATE_CHARACTER') {
        const { characterId, updates } = message.payload;
        const mine = characterRef.current;
        if (!mine || mine.id !== characterId) return;
        const patch = characterToUpdate(updates);
        const res = await svcUpdateCharacter(serviceContext.client, characterId, patch as never);
        if (!res.error && res.data) characterApi.setCharacter(characterRowToCharacter(res.data));
        return;
      }

      if (message.type === 'TOKEN_MOVE') {
        const { tokenId, x, y } = message.payload;
        await svcMoveToken(serviceContext.client, tokenId, x, y);
        await mapApi.refreshMaps();
        return;
      }

      if (message.type === 'MAP_ADD_PIN') {
        const { pin } = message.payload;
        await svcAddUserPin(
          serviceContext.client,
          serviceContext.campaignId,
          pin.mapId,
          serviceContext.userId,
          pin.x,
          pin.y,
          pin.label,
          pin.color ?? null
        );
        await mapApi.refreshMaps();
        return;
      }

      if (message.type === 'MAP_REMOVE_PIN') {
        await svcRemoveUserPin(serviceContext.client, message.payload.pinId);
        await mapApi.refreshMaps();
        return;
      }

      if (message.type === 'MAP_PING_REQUEST') {
        const { x, y } = message.payload;
        await broadcastApi.sendPing(mapApi.activeMapId, { x, y }, serviceContext.userId, playerColor);
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
          chatApi.setChatMessages((prev) => [
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
          serviceContext.userId,
          senderName,
          messageContent,
          messageType,
          (rollData ?? null) as never,
          parsed.isPrivate ? serviceContext.userId : null
        );
        await chatApi.refreshChat();
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

      await broadcastApi.relayPlayerMessage(message);
    },
    [
      serviceContext,
      characterApi,
      mapApi,
      broadcastApi,
      playerColor,
      chatApi,
      refreshQuests,
    ]
  );

  const connect = useCallback(async (_campaignId: string, _username: string, _password: string) => {
    /* Web apps authenticate via Supabase separately; kept for API parity with useSocket */
  }, []);

  const disconnect = useCallback(async () => {
    /* Caller clears serviceContext / signs out */
  }, []);

  const isConnected = Boolean(serviceContext);
  const isAuthenticated = isConnected;

  return {
    socket: null,
    connecting,
    isConnected,
    isAuthenticated,
    authError,
    username: displayUsername ?? null,
    userId: serviceContext?.userId ?? null,
    playerColor,
    character: characterApi.character,
    shopItems,
    shops,
    combatants: combatApi.combatants,
    currentTurnId: combatApi.currentTurnId,
    currentAdvantage: combatApi.currentAdvantage,
    opposedTestRequest: combatApi.opposedTestRequest,
    setOpposedTestRequest: combatApi.setOpposedTestRequest,
    conditionTestRequest: combatApi.conditionTestRequest,
    setConditionTestRequest: combatApi.setConditionTestRequest,
    journalEntries,
    mapPinStates: mapApi.mapPinStates,
    mapPing,
    factions,
    locationTerritories,
    quests,
    tokens: mapApi.tokens as MapToken[],
    userPins: mapApi.userPins as UserMapPin[],
    chatMessages: chatApi.chatMessages,
    setChatMessages: chatApi.setChatMessages,
    activeMapId: mapApi.activeMapId,
    isMapTransitioning: mapApi.isMapTransitioning,
    setIsMapTransitioning: mapApi.setIsMapTransitioning,
    calendarDate,
    calendarEvents,
    calendarWeather,
    realtimeCampaignId: serviceContext?.campaignId ?? null,
    onlineUsers: broadcastApi.onlineUsers,
    connect,
    disconnect,
    sendMessage,
    /** Granular hooks / actions for targeted UI */
    refreshCharacter: characterApi.refreshCharacter,
    updateCharacter: characterApi.updateCharacter,
    refreshMaps: mapApi.refreshMaps,
    moveMyToken: mapApi.moveMyToken,
    addPin: mapApi.addPin,
    removePin: mapApi.removePin,
    refreshCombat: combatApi.refreshCombat,
    relayPlayerMessage: broadcastApi.relayPlayerMessage,
    sendPing: broadcastApi.sendPing,
    sendTestResult: broadcastApi.sendTestResult,
    sendRollWithIntent: broadcastApi.sendRollWithIntent,
    ephemeralConnectionState: broadcastApi.connectionState,
  };
}
