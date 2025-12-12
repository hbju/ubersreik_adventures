import { BrowserWindow, ipcMain } from 'electron';
import { Server, Socket } from 'socket.io';
import { networkInterfaces } from 'os';
import { ClientToServerMessage, ServerToClientMessage, JournalUpdateMessage, JournalEntry, MapStateUpdateMessage, MapPinState, User, Character, LoginSuccessMessage, LoginFailureMessage, Faction, FactionUpdateMessage, CharacterUpdateMessage, ShopInventoryState, ShopStateUpdateMessage, ShopItemRevealedMessage, ShopState, ShopInventoryItem, Quest, QuestSyncMessage, UserMapPin, MapTokensUpdateMessage, UserPinsUpdateMessage, MapPingMessage, ChatMessage, ChatMessageBroadcast, ChatHistoryMessage, parseChatCommand, executeDiceRoll } from '@wfrp/shared';
import { MapToken } from '@wfrp/shared/src/types/wfrp.types';
import { getCampaignData, saveCampaignData } from './dataManager';

const PORT = 3003;
const connectedClients = new Map<string, Socket>();
let io: Server | null = null;

const MAX_CHAT_HISTORY = 100;
const chatHistory: ChatMessage[] = [];

interface UserSession {
    userId: string;
    username: string;
    socketId: string;
}

const PLAYER_COLORS = [
    '#4a9c4a', // Green
    '#4a7ba7', // Blue
    '#9c4a9c', // Purple
    '#c4884a', // Orange
    '#c44a4a', // Red
    '#4ac4c4', // Teal
    '#c4c44a', // Yellow
    '#7a4ac4', // Violet
];

const activeSessions = new Map<string, UserSession>(); // userId -> UserSession
const socketToUserId = new Map<string, string>(); // socketId -> userId

function getLocalIpAddress(): string {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]!) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return '127.0.0.1';
}

export const localIp = getLocalIpAddress();

/**
 * Hash password - same algorithm as in GM App
 */
function hashPassword(password: string): string {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
}

/**
 * Authenticate user with username and password
 * Returns the user if credentials are valid, null otherwise
 */
function authenticateUser(username: string, password: string): User | null {
    const campaignData = getCampaignData();
    if (!campaignData || !campaignData.users) {
        return null;
    }

    const user = campaignData.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
        console.log(`[AUTH] User not found: ${username}`);
        return null;
    }

    const passwordHash = hashPassword(password);
    if (user.passwordHash !== passwordHash) {
        console.log(`[AUTH] Invalid password for user: ${username}`);
        return null;
    }

    return user;
}

/**
 * Get character assigned to a user
 */
function getUserCharacter(userId: string): Character | null {
    const campaignData = getCampaignData();
    if (!campaignData) return null;

    const user = campaignData.users.find(u => u.id === userId);
    if (!user || !user.characterId) return null;

    const character = campaignData.characters.find(c => c.id === user.characterId);
    return character || null;
}

/**
 * Get or assign a color for a user
 */
function getPlayerColor(userId: string): string {
    const campaignData = getCampaignData();
    if (!campaignData) return PLAYER_COLORS[0];

    if (!campaignData.playerColors) {
        campaignData.playerColors = {};
    }

    if (campaignData.playerColors[userId]) {
        return campaignData.playerColors[userId];
    }

    const usedColors = Object.values(campaignData.playerColors);
    const availableColor = PLAYER_COLORS.find(c => !usedColors.includes(c)) || PLAYER_COLORS[0];
    
    campaignData.playerColors[userId] = availableColor;
    saveCampaignData(campaignData);
    
    return availableColor;
}

export function sendToPlayer(socketId: string, message: ServerToClientMessage) {
    const clientSocket = connectedClients.get(socketId);
    if (clientSocket) {
        clientSocket.emit('gm-message', message);
    }
}

export function startWebSocketServer(mainWindow: BrowserWindow) {
    io = new Server(PORT, {
        cors: { origin: '*' } // Allow connections from any origin, useful for development
    });

    console.log(`[SERVER] WebSocket server listening on ${localIp}:${PORT}`);

    const updateStatus = () => {
        mainWindow.webContents.send('server-status-update', {
            ip: localIp,
            port: PORT,
            clients: Array.from(connectedClients.keys())
        });
    };

    io.on('connection', (socket: Socket) => {
        console.log(`[SERVER] Player connected: ${socket.id}`);
        connectedClients.set(socket.id, socket);
        updateStatus();

        socket.on('player-message', (message: ClientToServerMessage) => {
            console.log(`[SERVER] Received message from ${socket.id}:`, message);

            if (message.type === 'LOGIN_REQUEST') {
                const { username, password } = message.payload;
                console.log(`[AUTH] Login attempt from ${socket.id}: ${username}`);

                const user = authenticateUser(username, password);
                if (!user) {
                    const failureMessage: LoginFailureMessage = {
                        type: 'LOGIN_FAILURE',
                        payload: { reason: 'Invalid username or password' }
                    };
                    socket.emit('gm-message', failureMessage);
                    console.log(`[AUTH] Login failed for ${username}`);
                    return;
                }

                const existingSession = activeSessions.get(user.id);
                if (existingSession) {
                    const failureMessage: LoginFailureMessage = {
                        type: 'LOGIN_FAILURE',
                        payload: { reason: 'User is already logged in from another session' }
                    };
                    socket.emit('gm-message', failureMessage);
                    console.log(`[AUTH] Login rejected - user already logged in: ${username}`);
                    return;
                }

                const session: UserSession = {
                    userId: user.id,
                    username: user.username,
                    socketId: socket.id,
                };
                activeSessions.set(user.id, session);
                socketToUserId.set(socket.id, user.id);

                const character = getUserCharacter(user.id);
                const playerColor = getPlayerColor(user.id);

                const successMessage: LoginSuccessMessage = {
                    type: 'LOGIN_SUCCESS',
                    payload: {
                        character: character,
                        username: user.username,
                        playerColor: playerColor
                    }
                };
                socket.emit('gm-message', successMessage);
                console.log(`[AUTH] Login successful: ${username} (character: ${character?.name || 'none'}, color: ${playerColor})`);

                sendInitialStateToPlayer(socket, user.id, character?.id);

                const displayName = character?.name || user.username;
                const systemMessage: ChatMessage = {
                    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    timestamp: Date.now(),
                    senderId: 'system',
                    senderName: 'System',
                    type: 'system',
                    content: `${displayName} connected.`
                };
                
                chatHistory.push(systemMessage);
                if (chatHistory.length > MAX_CHAT_HISTORY) {
                    chatHistory.shift();
                }
                
                const broadcastMsg: ChatMessageBroadcast = {
                    type: 'CHAT_MESSAGE',
                    payload: { message: systemMessage }
                };
                connectedClients.forEach((clientSocket) => {
                    clientSocket.emit('gm-message', broadcastMsg);
                });
                
                mainWindow.webContents.send('chat-message', systemMessage);

                return;
            }

            if (message.type === 'LOGOUT') {
                const userId = socketToUserId.get(socket.id);
                if (userId) {
                    activeSessions.delete(userId);
                    socketToUserId.delete(socket.id);
                    console.log(`[AUTH] User logged out: ${userId}`);
                }
                return;
            }

            const userId = socketToUserId.get(socket.id);
            if (!userId) {
                console.log(`[SERVER] Unauthenticated message ignored from ${socket.id}`);
                return;
            }

            if (message.type === 'PLAYER_UPDATE_CHARACTER') {
                const { characterId, updates } = message.payload;
                const campaignData = getCampaignData();
                if (!campaignData) {
                    console.log(`[SERVER] No campaign data available`);
                    return;
                }

                const characterIndex = campaignData.characters.findIndex(c => c.id === characterId);
                if (characterIndex === -1) {
                    console.log(`[SERVER] Character ${characterId} not found`);
                    return;
                }

                const character = campaignData.characters[characterIndex];
                
                const userCharacter = getUserCharacter(userId);
                if (!userCharacter || userCharacter.id !== characterId) {
                    console.log(`[SERVER] Player ${userId} does not own character ${characterId}`);
                    return;
                }

                const updatedCharacter: Character = {
                    ...character,
                    ...updates,
                    id: character.id,
                    userId: character.userId,
                };

                campaignData.characters[characterIndex] = updatedCharacter;
                saveCampaignData(campaignData);

                const updateMessage: CharacterUpdateMessage = {
                    type: 'CHARACTER_UPDATE',
                    payload: { character: updatedCharacter }
                };

                connectedClients.forEach((clientSocket) => {
                    clientSocket.emit('gm-message', updateMessage);
                });

                mainWindow.webContents.send('data-updated', { characters: campaignData.characters });

                console.log(`[SERVER] Player ${userId} updated character ${characterId}`);
                return;
            }

            if (message.type === 'SHOP_EVALUATE_REQUEST') {
                console.log(`[SERVER] Shop evaluate request from ${userId}:`, message.payload);
                mainWindow.webContents.send('player-message-received', message);
                return;
            }

            if (message.type === 'SHOP_PURCHASE_REQUEST') {
                console.log(`[SERVER] Shop purchase request from ${userId}:`, message.payload);
                mainWindow.webContents.send('player-message-received', message);
                return;
            }

            if (message.type === 'QUEST_UPDATE') {
                const { quest } = message.payload;
                const campaignData = getCampaignData();
                if (!campaignData) {
                    console.log(`[SERVER] No campaign data available`);
                    return;
                }

                if (!campaignData.quests) {
                    campaignData.quests = [];
                }

                const existingIndex = campaignData.quests.findIndex(q => q.id === quest.id);
                if (existingIndex >= 0) {
                    campaignData.quests[existingIndex] = quest;
                } else {
                    campaignData.quests.push(quest);
                }

                saveCampaignData(campaignData);

                broadcastQuests(campaignData.quests);

                mainWindow.webContents.send('data-updated', { quests: campaignData.quests });

                console.log(`[SERVER] Quest updated: ${quest.title} by user ${userId} for character ${quest.characterId}`);
                return;
            }

            if (message.type === 'QUEST_DELETE') {
                const { questId } = message.payload;
                const campaignData = getCampaignData();
                if (!campaignData) {
                    console.log(`[SERVER] No campaign data available`);
                    return;
                }

                if (!campaignData.quests) {
                    return;
                }

                campaignData.quests = campaignData.quests.filter(q => q.id !== questId);
                saveCampaignData(campaignData);

                broadcastQuests(campaignData.quests);

                mainWindow.webContents.send('data-updated', { quests: campaignData.quests });

                console.log(`[SERVER] Quest deleted: ${questId} by user ${userId}`);
                return;
            }

            // Handle token move from player
            if (message.type === 'TOKEN_MOVE') {
                const { tokenId, x, y } = message.payload;
                const campaignData = getCampaignData();
                if (!campaignData) {
                    console.log(`[SERVER] No campaign data available`);
                    return;
                }

                // Initialize tokens array if not exists
                if (!campaignData.tokens) {
                    campaignData.tokens = [];
                }

                // Find and update the token
                const tokenIndex = campaignData.tokens.findIndex(t => t.id === tokenId);
                if (tokenIndex >= 0) {
                    const token = campaignData.tokens[tokenIndex];
                    
                    // Validate permission: player can only move their own token
                    const userCharacter = getUserCharacter(userId);
                    if (!userCharacter || token.characterId !== userCharacter.id) {
                        console.log(`[SERVER] Player ${userId} not authorized to move token ${tokenId}`);
                        return;
                    }
                    
                    campaignData.tokens[tokenIndex] = { ...token, x, y };
                    saveCampaignData(campaignData);
                    
                    // Broadcast token update to all players
                    broadcastTokens(campaignData.tokens);
                    
                    // Notify GM app
                    mainWindow.webContents.send('data-updated', { tokens: campaignData.tokens });
                    
                    console.log(`[SERVER] Token ${tokenId} moved to (${x}, ${y}) by user ${userId}`);
                }
                return;
            }

            // Handle add pin from player
            if (message.type === 'MAP_ADD_PIN') {
                const { pin } = message.payload;
                const campaignData = getCampaignData();
                if (!campaignData) {
                    console.log(`[SERVER] No campaign data available`);
                    return;
                }

                // Initialize userPins array if not exists
                if (!campaignData.userPins) {
                    campaignData.userPins = [];
                }

                // Validate the pin belongs to this user
                if (pin.playerId !== userId) {
                    console.log(`[SERVER] Invalid pin owner for user ${userId}`);
                    return;
                }

                campaignData.userPins.push(pin);
                saveCampaignData(campaignData);

                // Send updated pins to this player only (pins are private)
                const playerPins = campaignData.userPins.filter(p => p.playerId === userId);
                const pinsMessage: UserPinsUpdateMessage = {
                    type: 'USER_PINS_UPDATE',
                    payload: { pins: playerPins }
                };
                socket.emit('gm-message', pinsMessage);

                console.log(`[SERVER] Pin added by user ${userId}: ${pin.label}`);
                return;
            }

            // Handle remove pin from player
            if (message.type === 'MAP_REMOVE_PIN') {
                const { pinId } = message.payload;
                const campaignData = getCampaignData();
                if (!campaignData || !campaignData.userPins) {
                    console.log(`[SERVER] No campaign data or pins available`);
                    return;
                }

                const pinIndex = campaignData.userPins.findIndex(p => p.id === pinId);
                if (pinIndex >= 0) {
                    const pin = campaignData.userPins[pinIndex];
                    if (pin.playerId !== userId) {
                        console.log(`[SERVER] User ${userId} not authorized to delete pin ${pinId}`);
                        return;
                    }

                    campaignData.userPins.splice(pinIndex, 1);
                    saveCampaignData(campaignData);

                    const playerPins = campaignData.userPins.filter(p => p.playerId === userId);
                    const pinsMessage: UserPinsUpdateMessage = {
                        type: 'USER_PINS_UPDATE',
                        payload: { pins: playerPins }
                    };
                    socket.emit('gm-message', pinsMessage);

                    console.log(`[SERVER] Pin ${pinId} deleted by user ${userId}`);
                }
                return;
            }

            if (message.type === 'MAP_PING_REQUEST') {
                const { x, y } = message.payload;
                const playerColor = getPlayerColor(userId);

                const pingMessage: MapPingMessage = {
                    type: 'MAP_PING',
                    payload: { x, y, color: playerColor, userId }
                };

                const filteredClients = Array.from(connectedClients.values()).filter(s => {
                    const sid = socketToUserId.get(s.id);
                    return sid !== userId;
                });

                filteredClients.forEach((clientSocket) => {
                    clientSocket.emit('gm-message', pingMessage);
                });

                mainWindow.webContents.send('map-ping', { x, y, color: playerColor, userId });

                console.log(`[SERVER] Ping at (${x}, ${y}) from user ${userId}`);
                return;
            }

            if (message.type === 'CHAT_SEND') {
                const { content, senderName } = message.payload;
                const playerColor = getPlayerColor(userId);

                const parsed = parseChatCommand(content);
                
                let chatMessage: ChatMessage;

                if (parsed.isRollCommand) {
                    if (parsed.diceRequest) {
                        const rollResult = executeDiceRoll(parsed.diceRequest);
                        chatMessage = {
                            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            timestamp: Date.now(),
                            senderId: userId,
                            senderName,
                            senderColor: playerColor,
                            type: 'roll',
                            content: `Rolling ${rollResult.formula}`,
                            data: rollResult
                        };
                    } else {
                        const errorMessage: ChatMessage = {
                            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            timestamp: Date.now(),
                            senderId: 'system',
                            senderName: 'System',
                            type: 'error',
                            content: parsed.errorMessage || 'Invalid dice syntax'
                        };
                        const errorBroadcast: ChatMessageBroadcast = {
                            type: 'CHAT_MESSAGE',
                            payload: { message: errorMessage }
                        };
                        socket.emit('gm-message', errorBroadcast);
                        return;
                    }
                } else {
                    chatMessage = {
                        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        timestamp: Date.now(),
                        senderId: userId,
                        senderName,
                        senderColor: playerColor,
                        type: 'chat',
                        content
                    };
                }

                chatHistory.push(chatMessage);
                if (chatHistory.length > MAX_CHAT_HISTORY) {
                    chatHistory.shift();
                }

                const broadcastMessage: ChatMessageBroadcast = {
                    type: 'CHAT_MESSAGE',
                    payload: { message: chatMessage }
                };
                connectedClients.forEach((clientSocket) => {
                    clientSocket.emit('gm-message', broadcastMessage);
                });

                mainWindow.webContents.send('chat-message', chatMessage);

                console.log(`[CHAT] Message from ${senderName}: ${content}`);
                return;
            }

            mainWindow.webContents.send('player-message-received', message);
        });

        socket.on('disconnect', () => {
            console.log(`[SERVER] Player disconnected: ${socket.id}`);

            const userId = socketToUserId.get(socket.id);
            if (userId) {
                const session = activeSessions.get(userId);
                const character = getUserCharacter(userId);
                const displayName = character?.name || session?.username || 'A player';
                
                activeSessions.delete(userId);
                socketToUserId.delete(socket.id);
                console.log(`[AUTH] Session ended for user: ${userId}`);

                const systemMessage: ChatMessage = {
                    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    timestamp: Date.now(),
                    senderId: 'system',
                    senderName: 'System',
                    type: 'system',
                    content: `${displayName} disconnected.`
                };
                
                chatHistory.push(systemMessage);
                if (chatHistory.length > MAX_CHAT_HISTORY) {
                    chatHistory.shift();
                }
                
                const broadcastMsg: ChatMessageBroadcast = {
                    type: 'CHAT_MESSAGE',
                    payload: { message: systemMessage }
                };
                connectedClients.forEach((clientSocket, clientSocketId) => {
                    if (clientSocketId !== socket.id) {
                        clientSocket.emit('gm-message', broadcastMsg);
                    }
                });
                
                mainWindow.webContents.send('chat-message', systemMessage);
            }

            connectedClients.delete(socket.id);
            updateStatus();
        });
    });

    ipcMain.on('send-to-player', (_event, userId: string, message: any) => {
        // Find the user session with this character
        let targetSocketId: string | undefined;
        let username: string | undefined;

        for (const session of activeSessions.values()) {
            if (session.userId === userId) {
                targetSocketId = session.socketId;
                username = session.username;
                break;
            }
        }

        if (targetSocketId) {
            console.log(`[IPC] Sending message to user ${username} at socket ${targetSocketId}`);
            sendToPlayer(targetSocketId, message);
        } else {
            console.log(`[IPC] No active session found for user ${userId}`);
        }
    });

    ipcMain.on('send-to-all-players', (_event, message: ServerToClientMessage) => {
        console.log(`[IPC] Broadcasting message to all ${connectedClients.size} connected players`);
        connectedClients.forEach((socket) => {
            socket.emit('gm-message', message);
        });
    });

    ipcMain.handle('get-server-status', async () => {
        console.log("updating server status")
        return {
            ip: localIp,
            port: PORT,
            clients: Array.from(connectedClients.keys())
        };
    });
}

function sendInitialStateToPlayer(socket: Socket, userId: string, characterId: string | undefined) {
    const campaignData = getCampaignData();
    if (!campaignData) {
        console.log(`[SERVER] No campaign data available for initial state`);
        return;
    }

    if (campaignData.journal && campaignData.journal.length > 0) {
        const filteredEntries = campaignData.journal.filter((entry) => {
            if (entry.sharedWith.includes('all')) {
                return true;
            }
            if (characterId && entry.sharedWith.includes(characterId)) {
                return true;
            }
            return false;
        });

        const journalMessage: JournalUpdateMessage = {
            type: 'JOURNAL_UPDATE',
            payload: { entries: filteredEntries },
        };
        socket.emit('gm-message', journalMessage);
        console.log(`[SERVER] Sent ${filteredEntries.length} journal entries to player ${socket.id}`);
    }

    if (campaignData.mapPinStates && characterId) {
        const filteredMapPinStates: Record<string, MapPinState> = {};

        for (const [locationId, pinState] of Object.entries(campaignData.mapPinStates)) {
            if (pinState.playerDiscovered.includes(characterId)) {
                filteredMapPinStates[locationId] = {
                    playerDiscovered: [characterId]
                };
            }
        }

        const mapMessage: MapStateUpdateMessage = {
            type: 'MAP_STATE_UPDATE',
            payload: { pinStates: filteredMapPinStates },
        };
        socket.emit('gm-message', mapMessage);
        console.log(`[SERVER] Sent ${Object.keys(filteredMapPinStates).length} discovered pins to player ${socket.id}`);
    } else if (campaignData.mapPinStates) {
        const mapMessage: MapStateUpdateMessage = {
            type: 'MAP_STATE_UPDATE',
            payload: { pinStates: {} },
        };
        socket.emit('gm-message', mapMessage);
        console.log(`[SERVER] Sent empty map state to unassigned player ${socket.id}`);
    }

    if (campaignData.factions && campaignData.factions.length > 0) {
        const factionMessage: FactionUpdateMessage = {
            type: 'FACTION_UPDATE',
            payload: { factions: campaignData.factions },
        };
        socket.emit('gm-message', factionMessage);
        console.log(`[SERVER] Sent ${campaignData.factions.length} factions to player ${socket.id}`);
    }

    // Send shop inventory filtered for player access
    if (campaignData.shopInventory && characterId) {
        const shopInventory = campaignData.shopInventory;
        const accessibleShops: ShopState[] = [];

        if (shopInventory.shops) {
            for (const [shopId, shopState] of Object.entries(shopInventory.shops)) {
                if (shopState.playerAccess.includes(characterId)) {
                    // Filter inventory items to hide quality/flaw for unidentified items
                    const filteredInventory: ShopInventoryItem[] = shopState.inventory.map(item => {
                        if (!item.isIdentified) {
                            return {
                                ...item,
                                modification: 'standard' as const,
                                quality: undefined,
                                flaw: undefined,
                                modifiedPrice: item.basePrice
                            };
                        }
                        return item;
                    });

                    accessibleShops.push({
                        ...shopState,
                        inventory: filteredInventory,
                        playerAccess: [characterId]
                    });
                }
            }
        }

        if (accessibleShops.length > 0) {
            const shopMessage: ShopStateUpdateMessage = {
                type: 'SHOP_STATE_UPDATE',
                payload: { shops: accessibleShops }
            };
            socket.emit('gm-message', shopMessage);
            console.log(`[SERVER] Sent ${accessibleShops.length} shops to player ${socket.id}`);
        }
    }

    if (campaignData.quests && campaignData.quests.length > 0) {
        const questMessage: QuestSyncMessage = {
            type: 'QUEST_SYNC',
            payload: { quests: campaignData.quests.filter(q => q.characterId === characterId)},
        };
        socket.emit('gm-message', questMessage);
        console.log(`[SERVER] Sent ${campaignData.quests.length} quests to player ${socket.id}`);
    }

    if (campaignData.tokens && campaignData.tokens.length > 0) {
        const tokensMessage: MapTokensUpdateMessage = {
            type: 'MAP_TOKENS_UPDATE',
            payload: { tokens: campaignData.tokens },
        };
        socket.emit('gm-message', tokensMessage);
        console.log(`[SERVER] Sent ${campaignData.tokens.length} tokens to player ${socket.id}`);
    }

    // Send user's personal pins (only their own)
    if (campaignData.userPins && campaignData.userPins.length > 0) {
        const playerPins = campaignData.userPins.filter(pin => pin.playerId === userId);
        if (playerPins.length > 0) {
            const pinsMessage: UserPinsUpdateMessage = {
                type: 'USER_PINS_UPDATE',
                payload: { pins: playerPins },
            };
            socket.emit('gm-message', pinsMessage);
            console.log(`[SERVER] Sent ${playerPins.length} personal pins to player ${socket.id}`);
        }
    }

    // Send chat history
    if (chatHistory.length > 0) {
        const historyMessage: ChatHistoryMessage = {
            type: 'CHAT_HISTORY',
            payload: { messages: [...chatHistory] },
        };
        socket.emit('gm-message', historyMessage);
        console.log(`[SERVER] Sent ${chatHistory.length} chat messages to player ${socket.id}`);
    }
}

/**
 * Broadcast map pin states to all connected players
 * Each player receives only pins discovered for their character
 * @param mapPinStates The complete map pin states record
 */
export function broadcastMapPinStates(mapPinStates: Record<string, MapPinState>) {
    if (!io || connectedClients.size === 0) {
        console.log('[SERVER] No clients connected, skipping map broadcast');
        return;
    }

    console.log(`[SERVER] Broadcasting map state to ${connectedClients.size} players`);

    connectedClients.forEach((socket, socketId) => {
        // Get user session for this socket
        const userId = socketToUserId.get(socketId);
        const assignedCharacterId = userId ? getUserCharacter(userId)?.id : undefined;

        if (!assignedCharacterId) {
            const message: MapStateUpdateMessage = {
                type: 'MAP_STATE_UPDATE',
                payload: { pinStates: {} },
            };
            socket.emit('gm-message', message);
            console.log(`[SERVER] Sent empty map state to unassigned player ${socketId}`);
            return;
        }

        const filteredMapPinStates: Record<string, MapPinState> = {};

        for (const [locationId, pinState] of Object.entries(mapPinStates)) {
            if (pinState.playerDiscovered.includes(assignedCharacterId)) {
                filteredMapPinStates[locationId] = {
                    playerDiscovered: [assignedCharacterId] // Only include this character's discovery
                };
            }
        }

        const message: MapStateUpdateMessage = {
            type: 'MAP_STATE_UPDATE',
            payload: { pinStates: filteredMapPinStates },
        };

        socket.emit('gm-message', message);
        console.log(`[SERVER] Sent ${Object.keys(filteredMapPinStates).length} discovered pins to player ${socketId} (character ${assignedCharacterId})`);
    });
}

/**
 * Broadcast journal entries to all connected players
 * Each player receives only entries they are allowed to see
 * @param journal The complete journal array
 */
export function broadcastJournalEntries(journal: JournalEntry[]) {
    if (!io || connectedClients.size === 0) {
        console.log('[SERVER] No clients connected, skipping journal broadcast');
        return;
    }

    console.log(`[SERVER] Broadcasting journal to ${connectedClients.size} players`);

    // Iterate through each connected player
    connectedClients.forEach((socket, socketId) => {
        // Get user session for this socket
        const userId = socketToUserId.get(socketId);
        const assignedCharacterId = userId ? getUserCharacter(userId)?.id : undefined;

        // Filter journal entries for this player
        const filteredEntries = journal.filter((entry) => {
            // Include entries shared with all
            if (entry.sharedWith.includes('all')) {
                return true;
            }
            // Include entries shared with this specific character
            if (assignedCharacterId && entry.sharedWith.includes(assignedCharacterId)) {
                return true;
            }
            return false;
        });

        // Send the filtered journal to this player
        const message: JournalUpdateMessage = {
            type: 'JOURNAL_UPDATE',
            payload: { entries: filteredEntries },
        };

        socket.emit('gm-message', message);
        console.log(`[SERVER] Sent ${filteredEntries.length} journal entries to player ${socketId}`);
    });
}

/**
 * Broadcast factions to all connected players
 * All players receive the full faction list (filtering is done client-side based on knowledge level)
 * @param factions The complete factions array
 */
export function broadcastFactions(factions: Faction[]) {
    if (!io || connectedClients.size === 0) {
        console.log('[SERVER] No clients connected, skipping faction broadcast');
        return;
    }

    console.log(`[SERVER] Broadcasting ${factions.length} factions to ${connectedClients.size} players`);

    const message: FactionUpdateMessage = {
        type: 'FACTION_UPDATE',
        payload: { factions },
    };

    connectedClients.forEach((socket) => {
        socket.emit('gm-message', message);
    });
}

/**
 * Broadcast shop inventory to all connected players
 * Each player receives only shops they have access to
 * Items are filtered to hide quality/flaw info for unidentified items
 * @param shopInventory The complete shop inventory state
 */
export function broadcastShopInventory(shopInventory: ShopInventoryState) {
    if (!io || connectedClients.size === 0) {
        console.log('[SERVER] No clients connected, skipping shop broadcast');
        return;
    }

    console.log(`[SERVER] Broadcasting shop inventory to ${connectedClients.size} players`);

    connectedClients.forEach((socket, socketId) => {
        const userId = socketToUserId.get(socketId);
        const assignedCharacterId = userId ? getUserCharacter(userId)?.id : undefined;

        if (!assignedCharacterId || !shopInventory.shops) {
            console.log(`[SERVER] Skipping shop broadcast for unassigned player ${socketId}`);
            return;
        }

        const filteredShops: Record<string, ShopState> = {};

        for (const [shopId, shopState] of Object.entries(shopInventory.shops)) {
            if (shopState.playerAccess.includes(assignedCharacterId)) {
                const filteredInventory: ShopInventoryItem[] = shopState.inventory.map(item => {
                    if (!item.isIdentified) {
                        return {
                            ...item,
                            modification: 'standard' as const,
                            quality: undefined,
                            flaw: undefined,
                            modifiedPrice: item.basePrice
                        };
                    }
                    return item;
                });

                filteredShops[shopId] = {
                    ...shopState,
                    inventory: filteredInventory,
                    playerAccess: [assignedCharacterId]
                };
            }
        }

        if (Object.keys(filteredShops).length > 0) {
            const shopsArray: ShopState[] = Object.values(filteredShops);
            
            const message: ShopStateUpdateMessage = {
                type: 'SHOP_STATE_UPDATE',
                payload: {
                    shops: shopsArray
                }
            };

            socket.emit('gm-message', message);
            console.log(`[SERVER] Sent ${shopsArray.length} shops to player ${socketId}`);
        }
    });
}

/**
 * Broadcast a single item reveal to players who have access to that shop
 * @param shopId The shop containing the item
 * @param itemInstanceId The specific item that was revealed
 * @param shopInventory The complete shop inventory to get the revealed item details
 */
export function broadcastShopItemReveal(shopId: string, itemInstanceId: string, shopInventory: ShopInventoryState) {
    if (!io || connectedClients.size === 0) {
        console.log('[SERVER] No clients connected, skipping item reveal broadcast');
        return;
    }

    const shopState = shopInventory.shops?.[shopId];
    if (!shopState) {
        console.log(`[SERVER] Shop ${shopId} not found for item reveal`);
        return;
    }

    const revealedItem = shopState.inventory.find(item => item.instanceId === itemInstanceId);
    if (!revealedItem) {
        console.log(`[SERVER] Item ${itemInstanceId} not found in shop ${shopId}`);
        return;
    }

    console.log(`[SERVER] Broadcasting item reveal for ${itemInstanceId} in shop ${shopId}`);

    connectedClients.forEach((socket, socketId) => {
        const userId = socketToUserId.get(socketId);
        const assignedCharacterId = userId ? getUserCharacter(userId)?.id : undefined;

        if (!assignedCharacterId) return;

        if (shopState.playerAccess.includes(assignedCharacterId)) {
            const message: ShopItemRevealedMessage = {
                type: 'SHOP_ITEM_REVEALED',
                payload: {
                    shopId,
                    item: revealedItem
                }
            };

            socket.emit('gm-message', message);
            console.log(`[SERVER] Sent item reveal to player ${socketId}`);
        }
    });
}

/**
 * Broadcast quests to all connected players
 * Quests are party-wide, so all authenticated players see all quests
 * @param quests The complete quests array
 */
export function broadcastQuests(quests: Quest[]) {
    if (!io || connectedClients.size === 0) {
        console.log('[SERVER] No clients connected, skipping quest broadcast');
        return;
    }

    connectedClients.forEach((socket, socketId) => {
        const userId = socketToUserId.get(socketId);
        const assignedCharacterId = userId ? getUserCharacter(userId)?.id : undefined;

        if (!assignedCharacterId) {
            return;
        }
        const characterQuests = quests.filter(q => q.characterId === assignedCharacterId);
        const message: QuestSyncMessage = {
            type: 'QUEST_SYNC',
            payload: { quests: characterQuests },
        };
        socket.emit('gm-message', message);
        console.log(`[SERVER] Sent ${characterQuests.length} quests to player ${socketId} (character ${assignedCharacterId})`);
    });
}

/**
 * Broadcast map tokens to all connected players
 * All players see all tokens
 * @param tokens The complete tokens array
 */
export function broadcastTokens(tokens: MapToken[]) {
    if (!io || connectedClients.size === 0) {
        console.log('[SERVER] No clients connected, skipping token broadcast');
        return;
    }

    console.log(`[SERVER] Broadcasting ${tokens.length} tokens to ${connectedClients.size} players`);

    const message: MapTokensUpdateMessage = {
        type: 'MAP_TOKENS_UPDATE',
        payload: { tokens },
    };

    connectedClients.forEach((socket) => {
        socket.emit('gm-message', message);
    });
}

/**
 * Broadcast a ping to all connected players
 * @param x Map X coordinate
 * @param y Map Y coordinate
 * @param color Color of the ping
 * @param userId User who sent the ping
 */
export function broadcastPing(x: number, y: number, color: string, userId: string) {
    if (!io || connectedClients.size === 0) {
        console.log('[SERVER] No clients connected, skipping ping broadcast');
        return;
    }

    console.log(`[SERVER] Broadcasting ping at (${x}, ${y}) to ${connectedClients.size} players`);

    const message: MapPingMessage = {
        type: 'MAP_PING',
        payload: { x, y, color, userId },
    };

    connectedClients.forEach((socket) => {
        socket.emit('gm-message', message);
    });
}

/**
 * Broadcast a chat message to all connected players
 * Called from GM app via IPC
 * @param chatMessage The chat message to broadcast
 */
export function broadcastChatMessage(chatMessage: ChatMessage) {
    chatHistory.push(chatMessage);
    if (chatHistory.length > MAX_CHAT_HISTORY) {
        chatHistory.shift();
    }

    if (!io || connectedClients.size === 0) {
        console.log('[SERVER] No clients connected, skipping chat broadcast');
        return;
    }

    console.log(`[SERVER] Broadcasting chat from ${chatMessage.senderName} to ${connectedClients.size} players`);

    const message: ChatMessageBroadcast = {
        type: 'CHAT_MESSAGE',
        payload: { message: chatMessage },
    };

    connectedClients.forEach((socket) => {
        socket.emit('gm-message', message);
    });
}

/**
 * Get current chat history
 * @returns Array of chat messages
 */
export function getChatHistory(): ChatMessage[] {
    return [...chatHistory];
}
