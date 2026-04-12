/**
 * Live session Socket.io hook for the web player app.
 *
 * Connects to the GM's Socket.io server for real-time features:
 * combat, opposed tests, condition tests, chat, map pings, etc.
 *
 * Authentication uses a Supabase access token so the GM server
 * can verify the player's identity.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  ServerToClientMessage,
  ClientToServerMessage,
  Character,
  Combatant,
  Advantages,
  JournalEntry,
  MapPinState,
  Faction,
  ShopState,
  Quest,
  UserMapPin,
  ChatMessage,
  LocationTerritory,
  GameDate,
  TimelineEvent,
} from '@wfrp/shared';
import { MapToken } from '@wfrp/shared/src/types/wfrp.types';
import { supabase } from '@wfrp/shared';

export interface OpposedTestRequest {
  testId: string;
  role: 'attacker' | 'defender';
  skillName: string;
  targetNumber: number;
  modifier: number;
}

export interface ConditionTestRequest {
  testId: string;
  conditionId: string;
  conditionName: string;
  testType: string;
  targetNumber: number;
  modifier: number;
  conditionCount: number;
  description: string;
}

/** Callbacks invoked when the GM pushes data updates through Socket.io */
export interface LiveSessionCallbacks {
  onCharacterUpdate?: (character: Character) => void;
  onJournalUpdate?: (entries: JournalEntry[]) => void;
  onMapPinStatesUpdate?: (pinStates: Record<string, MapPinState>) => void;
  onFactionUpdate?: (factions: Faction[], locationTerritories?: Record<string, LocationTerritory>) => void;
  onShopStateUpdate?: (shops: ShopState[]) => void;
  onQuestSync?: (quests: Quest[]) => void;
  onTokensUpdate?: (tokens: MapToken[]) => void;
  onUserPinsUpdate?: (pins: UserMapPin[]) => void;
  onChatMessage?: (message: ChatMessage) => void;
  onChatHistory?: (messages: ChatMessage[]) => void;
  onCombatUpdate?: (combatants: Combatant[], currentTurnId: string | null, currentAdvantage: Advantages) => void;
  onCalendarSync?: (currentDate: GameDate, events: TimelineEvent[], currentWeather?: string) => void;
  onActiveMapUpdate?: (mapId: string) => void;
}

export function useLiveSession(callbacks: LiveSessionCallbacks) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [playerColor, setPlayerColor] = useState('#d4af37');
  const [opposedTestRequest, setOpposedTestRequest] = useState<OpposedTestRequest | null>(null);
  const [conditionTestRequest, setConditionTestRequest] = useState<ConditionTestRequest | null>(null);
  const [mapPing, setMapPing] = useState<{ x: number; y: number; color?: string } | null>(null);
  const [isMapTransitioning, setIsMapTransitioning] = useState(false);

  // Keep callbacks ref up to date without re-creating socket listeners
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const connect = useCallback(async (gmAddress: string) => {
    if (socket?.connected) return;
    setConnectionError(null);

    // Get Supabase access token to send along with login
    let accessToken: string | undefined;
    try {
      const sb = supabase.getSupabase();
      const { data: { session } } = await sb.auth.getSession();
      accessToken = session?.access_token;
    } catch {
      // Will fall back to unauthenticated connection
    }

    const newSocket = io(`http://${gmAddress}:3003`, {
      timeout: 10000,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      setIsConnected(true);

      // Send login with Supabase token (GM server validates it)
      newSocket.emit('player-message', {
        type: 'LOGIN_REQUEST',
        payload: {
          username: '', // GM resolves from token
          password: '',
          accessToken,
        },
      });
    });

    newSocket.on('connect_error', (error) => {
      setConnectionError(`Connection failed: ${error.message}`);
      setIsConnected(false);
      setIsAuthenticated(false);
      newSocket.disconnect();
    });

    newSocket.on('reconnect_failed', () => {
      setConnectionError('Unable to connect after multiple attempts.');
      setIsConnected(false);
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      setIsAuthenticated(false);
      if (reason === 'io server disconnect') {
        setConnectionError('Disconnected by server.');
      } else if (reason === 'transport close') {
        setConnectionError('Lost connection to server.');
      }
    });

    newSocket.on('gm-message', (message: ServerToClientMessage) => {
      const cb = cbRef.current;
      switch (message.type) {
        case 'LOGIN_SUCCESS':
          setIsAuthenticated(true);
          setPlayerColor(message.payload.playerColor);
          setConnectionError(null);
          if (message.payload.character) {
            cb.onCharacterUpdate?.(message.payload.character);
          }
          break;

        case 'LOGIN_FAILURE':
          setIsAuthenticated(false);
          setConnectionError(message.payload.reason);
          newSocket.disconnect();
          break;

        case 'ASSIGN_CHARACTER':
          cb.onCharacterUpdate?.(message.payload.character);
          break;

        case 'CHARACTER_UPDATE':
          cb.onCharacterUpdate?.(message.payload.character);
          break;

        case 'UPDATE_INITIATIVE_TRACKER':
          cb.onCombatUpdate?.(
            message.payload.combatants,
            message.payload.currentTurnId,
            message.payload.currentAdvantage,
          );
          break;

        case 'REQUEST_OPPOSED_TEST':
          setOpposedTestRequest({
            testId: message.payload.testId,
            role: message.payload.role,
            skillName: message.payload.skillName,
            targetNumber: message.payload.targetNumber,
            modifier: message.payload.modifier,
          });
          break;

        case 'REQUEST_CONDITION_TEST':
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
          break;

        case 'JOURNAL_UPDATE':
          cb.onJournalUpdate?.(message.payload.entries);
          break;

        case 'MAP_STATE_UPDATE':
          cb.onMapPinStatesUpdate?.(message.payload.pinStates);
          break;

        case 'MAP_PING':
          setMapPing({ x: message.payload.x, y: message.payload.y, color: message.payload.color });
          setTimeout(() => setMapPing(null), 100);
          break;

        case 'CAREER_CHANGE_RESPONSE':
          if (message.payload.success && message.payload.character) {
            cb.onCharacterUpdate?.(message.payload.character);
          }
          break;

        case 'FACTION_UPDATE':
          cb.onFactionUpdate?.(message.payload.factions, message.payload.locationTerritories);
          break;

        case 'SHOP_STATE_UPDATE':
          cb.onShopStateUpdate?.(message.payload.shops);
          break;

        case 'SHOP_ITEM_REVEALED':
          // Handled inline by the component via shops state
          break;

        case 'QUEST_SYNC':
          cb.onQuestSync?.(message.payload.quests);
          break;

        case 'CALENDAR_SYNC':
          cb.onCalendarSync?.(
            message.payload.currentDate,
            message.payload.events,
            message.payload.currentWeather,
          );
          break;

        case 'MAP_TOKENS_UPDATE':
          cb.onTokensUpdate?.(message.payload.tokens);
          break;

        case 'USER_PINS_UPDATE':
          cb.onUserPinsUpdate?.(message.payload.pins);
          break;

        case 'CHAT_MESSAGE':
          cb.onChatMessage?.(message.payload.message);
          break;

        case 'CHAT_HISTORY':
          cb.onChatHistory?.(message.payload.messages);
          break;

        case 'ACTIVE_MAP_UPDATE':
          setIsMapTransitioning(true);
          cb.onActiveMapUpdate?.(message.payload.activeMapId);
          break;

        case 'MAP_SWITCH':
          setIsMapTransitioning(true);
          cb.onActiveMapUpdate?.(message.payload.mapId);
          break;

        default:
          break;
      }
    });

    setSocket(newSocket);
  }, [socket]);

  const sendMessage = useCallback((message: ClientToServerMessage) => {
    if (socket) {
      socket.emit('player-message', message);
    }
  }, [socket]);

  const disconnect = useCallback(() => {
    socket?.disconnect();
    setSocket(null);
    setIsConnected(false);
    setIsAuthenticated(false);
  }, [socket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      socket?.disconnect();
    };
  }, [socket]);

  return {
    isConnected,
    isAuthenticated,
    connectionError,
    playerColor,
    opposedTestRequest,
    setOpposedTestRequest,
    conditionTestRequest,
    setConditionTestRequest,
    mapPing,
    isMapTransitioning,
    setIsMapTransitioning,
    connect,
    disconnect,
    sendMessage,
  };
}
