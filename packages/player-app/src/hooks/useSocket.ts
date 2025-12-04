import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ServerToClientMessage, ClientToServerMessage, Character, Combatant, Advantages, JournalEntry, MapPinState, LoginRequestMessage, Faction } from '@wfrp/shared';

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

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [shopItems, setShopItems] = useState<string[]>([]);
  const [combatants, setCombatants] = useState<Combatant[]>([]);
  const [currentTurnId, setCurrentTurnId] = useState<string | null>(null);
  const [currentAdvantage, setCurrentAdvantage] = useState<Advantages>({ playerAdvantage: 0, enemyAdvantage: 0 });
  const [opposedTestRequest, setOpposedTestRequest] = useState<OpposedTestRequest | null>(null);
  const [conditionTestRequest, setConditionTestRequest] = useState<ConditionTestRequest | null>(null);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [mapPinStates, setMapPinStates] = useState<Record<string, MapPinState>>({});
  const [mapPing, setMapPing] = useState<{ x: number; y: number } | null>(null);
  const [factions, setFactions] = useState<Faction[]>([]);


  const connect = useCallback((ipAddress: string, username: string, password: string) => {
    if (socket?.connected) return;

    console.log(`[CLIENT] Attempting to connect to ws://${ipAddress}:3003`);
    setAuthError(null);
    const newSocket = io(`ws://${ipAddress}:3003`);

    newSocket.on('connect', () => {
      console.log(`[CLIENT] Connected successfully with ID: ${newSocket.id}`);
      setIsConnected(true);
      
      // Send login request immediately after connection
      const loginMessage: LoginRequestMessage = {
        type: 'LOGIN_REQUEST',
        payload: { username, password }
      };
      console.log('[CLIENT] Sending login request...');
      newSocket.emit('player-message', loginMessage);
    });

    newSocket.on('disconnect', () => {
      console.log('[CLIENT] Disconnected from server.');
      setIsConnected(false);
      setIsAuthenticated(false);
      setUsername(null);
      setCharacter(null);
    });

    newSocket.on('gm-message', (message: ServerToClientMessage) => {
      console.log('[CLIENT] Received message from GM:', message);
      
      // Handle authentication responses
      if (message.type === 'LOGIN_SUCCESS') {
        console.log('[CLIENT] Login successful!');
        setIsAuthenticated(true);
        setUsername(message.payload.username);
        setAuthError(null);
        
        // Auto-assign character if available
        if (message.payload.character) {
          console.log('[CLIENT] Character assigned:', message.payload.character.name);
          setCharacter(message.payload.character);
        } else {
          console.log('[CLIENT] No character assigned to this user');
        }
        return;
      }

      if (message.type === 'LOGIN_FAILURE') {
        console.log('[CLIENT] Login failed:', message.payload.reason);
        setIsAuthenticated(false);
        setAuthError(message.payload.reason);
        // Disconnect socket on failed login
        newSocket.disconnect();
        return;
      }

      // Handle character assignment (legacy support)
      if (message.type === 'ASSIGN_CHARACTER') {
        setCharacter(message.payload.character);
      }

      if (message.type === 'UPDATE_SHOP_INVENTORY') {
        console.log('[CLIENT] Shop inventory updated:', message.payload);
        const itemIds = Object.keys(message.payload.items);
        setShopItems(itemIds);
      }

      if (message.type === 'PURCHASE_RESPONSE') {
        console.log('[CLIENT] Purchase response:', message.payload);
        if (message.payload.success) {
          alert(`Purchase successful! You received ${message.payload.item.name}`);
        } else {
          alert(`Purchase denied${message.payload.reason ? ': ' + message.payload.reason : ''}`);
        }
      }

      if (message.type === 'UPDATE_INITIATIVE_TRACKER') {
        console.log('[CLIENT] Initiative tracker updated:', message.payload);
        setCombatants(message.payload.combatants);
        setCurrentTurnId(message.payload.currentTurnId);
        setCurrentAdvantage(message.payload.currentAdvantage);
      }

      if (message.type === 'REQUEST_OPPOSED_TEST') {
        console.log('[CLIENT] Opposed test request:', message.payload);
        setOpposedTestRequest({
          testId: message.payload.testId,
          role: message.payload.role,
          skillName: message.payload.skillName,
          targetNumber: message.payload.targetNumber,
          modifier: message.payload.modifier
        });
      }

      if (message.type === 'REQUEST_CONDITION_TEST') {
        console.log('[CLIENT] Condition test request:', message.payload);
        setConditionTestRequest({
          testId: message.payload.testId,
          conditionId: message.payload.conditionId,
          conditionName: message.payload.conditionName,
          testType: message.payload.testType,
          targetNumber: message.payload.targetNumber,
          modifier: message.payload.modifier,
          conditionCount: message.payload.conditionCount,
          description: message.payload.description
        });
      }

      if (message.type === 'JOURNAL_UPDATE') {
        console.log('[CLIENT] Journal update received:', message.payload);
        setJournalEntries(message.payload.entries);
      }

      if (message.type === 'MAP_STATE_UPDATE') {
        console.log('[CLIENT] Map state update received:', message.payload);
        setMapPinStates(message.payload.pinStates);
      }

      if (message.type === 'MAP_PING') {
        console.log('[CLIENT] Map ping received:', message.payload);
        setMapPing({ x: message.payload.x, y: message.payload.y });
        setTimeout(() => setMapPing(null), 100);
      }

      // Task 3.4: Handle career change response
      if (message.type === 'CAREER_CHANGE_RESPONSE') {
        console.log('[CLIENT] Career change response received:', message.payload);
        if (message.payload.success && message.payload.character) {
          setCharacter(message.payload.character);
          alert('Career change approved by GM! Your character has been updated.');
        } else {
          alert(`Career change request denied${message.payload.reason ? ': ' + message.payload.reason : '.'}`);
        }
      }

      // Handle faction updates
      if (message.type === 'FACTION_UPDATE') {
        console.log('[CLIENT] Faction update received:', message.payload);
        setFactions(message.payload.factions);
      }

      // Handle character updates (from Edit Mode or GM updates)
      if (message.type === 'CHARACTER_UPDATE') {
        console.log('[CLIENT] Character update received:', message.payload);
        // Only update if this is our character
        const updatedChar = message.payload.character;
        setCharacter(prevChar => {
          if (prevChar && prevChar.id === updatedChar.id) {
            return updatedChar;
          }
          return prevChar;
        });
      }
    });

    setSocket(newSocket);
  }, [socket]);

  const sendMessage = useCallback((message: ClientToServerMessage) => {
    if (socket) {
      console.log('[CLIENT] Sending message to GM:', message);
      socket.emit('player-message', message);
    }
  }, [socket]);

  const disconnect = useCallback(() => {
    socket?.disconnect();
  }, [socket]);

  useEffect(() => {
    return () => {
      socket?.disconnect();
    };
  }, [socket]);

  return { 
    isConnected, 
    isAuthenticated, 
    authError, 
    username,
    character, 
    shopItems, 
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
    connect, 
    disconnect, 
    sendMessage 
  };
};