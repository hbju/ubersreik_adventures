import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ServerToClientMessage, ClientToServerMessage, Character, Combatant, Advantages, JournalEntry, MapPinState, LoginRequestMessage, Faction, ShopState, ShopInventoryItem, Quest, UserMapPin, ChatMessage } from '@wfrp/shared';
import { MapToken } from '@wfrp/shared/src/types/wfrp.types';

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
    const [userId, setUserId] = useState<string | null>(null);
    const [playerColor, setPlayerColor] = useState<string>('#d4af37');
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
    const [quests, setQuests] = useState<Quest[]>([]);
    const [tokens, setTokens] = useState<MapToken[]>([]);
    const [userPins, setUserPins] = useState<UserMapPin[]>([]);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [activeMapId, setActiveMapId] = useState<string>('ubersreik_city');
    const [isMapTransitioning, setIsMapTransitioning] = useState(false);


    const connect = useCallback((ipAddress: string, username: string, password: string) => {
        if (socket?.connected) return;

        console.log(`[CLIENT] Attempting to connect to http://${ipAddress}:3003`);
        setAuthError(null);
        const newSocket = io(`http://${ipAddress}:3003`, {
            timeout: 10000, // 10 second connection timeout
            reconnectionAttempts: 3, // Try to reconnect 3 times
            reconnectionDelay: 1000, // Wait 1 second between reconnection attempts
            transports: ['websocket', 'polling'], // Allow fallback to polling
        });

        newSocket.on('connect', () => {
            console.log(`[CLIENT] Connected successfully with ID: ${newSocket.id}`);
            setIsConnected(true);

            const loginMessage: LoginRequestMessage = {
                type: 'LOGIN_REQUEST',
                payload: { username, password }
            };
            console.log('[CLIENT] Sending login request...');
            newSocket.emit('player-message', loginMessage);
        });

        newSocket.on('connect_error', (error) => {
            console.log('[CLIENT] Connection error:', error.message);
            setAuthError(`Connection failed: ${error.message}. Check if the GM server is running and the IP is correct.`);
            setIsConnected(false);
            setIsAuthenticated(false);
            newSocket.disconnect();
        });

        newSocket.on('reconnect_failed', () => {
            console.log('[CLIENT] Failed to reconnect after multiple attempts');
            setAuthError('Unable to connect to server after multiple attempts. Please check your network connection.');
            setIsConnected(false);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('[CLIENT] Disconnected from server. Reason:', reason);
            setIsConnected(false);
            setIsAuthenticated(false);
            setUsername(null);
            setCharacter(null);

            if (reason === 'io server disconnect') {
                setAuthError('Disconnected by server.');
            } else if (reason === 'transport close') {
                setAuthError('Lost connection to server.');
            }
        });

        newSocket.on('gm-message', (message: ServerToClientMessage) => {
            console.log('[CLIENT] Received message from GM:', message);

            if (message.type === 'LOGIN_SUCCESS') {
                console.log('[CLIENT] Login successful!');
                setIsAuthenticated(true);
                setUsername(message.payload.username);
                setUserId(message.payload.character?.userId || null);
                setPlayerColor(message.payload.playerColor);
                setAuthError(null);

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
                newSocket.disconnect();
                return;
            }

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
                setMapPing({ x: message.payload.x, y: message.payload.y, color: message.payload.color });
                setTimeout(() => setMapPing(null), 100);
            }

            if (message.type === 'CAREER_CHANGE_RESPONSE') {
                console.log('[CLIENT] Career change response received:', message.payload);
                if (message.payload.success && message.payload.character) {
                    setCharacter(message.payload.character);
                    alert('Career change approved by GM! Your character has been updated.');
                } else {
                    alert(`Career change request denied${message.payload.reason ? ': ' + message.payload.reason : '.'}`);
                }
            }

            if (message.type === 'FACTION_UPDATE') {
                console.log('[CLIENT] Faction update received:', message.payload);
                setFactions(message.payload.factions);
            }

            if (message.type === 'SHOP_STATE_UPDATE') {
                console.log('[CLIENT] Shop state update received:', message.payload);
                setShops(message.payload.shops);
            }

            if (message.type === 'SHOP_ITEM_REVEALED') {
                console.log('[CLIENT] Shop item revealed:', message.payload);
                const { shopId, item } = message.payload;
                setShops(prevShops => {
                    return prevShops.map(shop => {
                        if (shop.shopId === shopId) {
                            const updatedInventory = shop.inventory.map(i => {
                                if (i.instanceId === item.instanceId) {
                                    return item;
                                }
                                return i;
                            });
                            return { ...shop, inventory: updatedInventory };
                        }
                        return shop;
                    });
                });
            }

            if (message.type === 'CHARACTER_UPDATE') {
                console.log('[CLIENT] Character update received:', message.payload);
                const updatedChar = message.payload.character;
                setCharacter(prevChar => {
                    if (prevChar && prevChar.id === updatedChar.id) {
                        return updatedChar;
                    }
                    return prevChar;
                });
            }

            if (message.type === 'QUEST_SYNC') {
                console.log('[CLIENT] Quest sync received:', message.payload);
                setQuests(message.payload.quests);
            }

            if (message.type === 'MAP_TOKENS_UPDATE') {
                console.log('[CLIENT] Map tokens update received:', message.payload);
                setTokens(message.payload.tokens);
            }

            if (message.type === 'USER_PINS_UPDATE') {
                console.log('[CLIENT] User pins update received:', message.payload);
                setUserPins(message.payload.pins);
            }

            if (message.type === 'CHAT_MESSAGE') {
                console.log('[CLIENT] Chat message received:', message.payload);
                setChatMessages(prev => [...prev, message.payload.message]);
            }

            if (message.type === 'CHAT_HISTORY') {
                console.log('[CLIENT] Chat history received:', message.payload);
                setChatMessages(message.payload.messages);
            }

            if (message.type === 'ACTIVE_MAP_UPDATE') {
                console.log('[CLIENT] Active map update received:', message.payload);
                setIsMapTransitioning(true);
                setActiveMapId(message.payload.activeMapId);
                // The transition state will be cleared by the component once the map image loads
            }

            if (message.type === 'MAP_SWITCH') {
                console.log('[CLIENT] Map switch received:', message.payload);
                setIsMapTransitioning(true);
                setActiveMapId(message.payload.mapId);
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
        quests,
        tokens,
        userPins,
        chatMessages,
        setChatMessages,
        activeMapId,
        isMapTransitioning,
        setIsMapTransitioning,
        connect,
        disconnect,
        sendMessage
    };
};