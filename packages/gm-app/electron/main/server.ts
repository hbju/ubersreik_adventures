import { BrowserWindow, ipcMain } from 'electron';
import { Server, Socket } from 'socket.io';
import { networkInterfaces } from 'os';
import { ClientToServerMessage, ServerToClientMessage, JournalUpdateMessage, JournalEntry, MapStateUpdateMessage, MapPinState, User, Character, LoginSuccessMessage, LoginFailureMessage, Faction, FactionUpdateMessage, CharacterUpdateMessage, ShopInventoryState, ShopStateUpdateMessage, ShopItemRevealedMessage, ShopState, ShopInventoryItem, Quest, QuestSyncMessage } from '@wfrp/shared';
import { getCampaignData, saveCampaignData } from './dataManager';

const PORT = 3003;
const connectedClients = new Map<string, Socket>();
let io: Server | null = null;

// Track authenticated users and prevent duplicate logins
interface UserSession {
    userId: string;
    username: string;
    socketId: string;
}

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

            // Handle authentication
            if (message.type === 'LOGIN_REQUEST') {
                const { username, password } = message.payload;
                console.log(`[AUTH] Login attempt from ${socket.id}: ${username}`);

                // Validate credentials
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

                // Check if user is already logged in
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

                // Create session
                const session: UserSession = {
                    userId: user.id,
                    username: user.username,
                    socketId: socket.id,
                };
                activeSessions.set(user.id, session);
                socketToUserId.set(socket.id, user.id);

                // Get character if assigned
                const character = getUserCharacter(user.id);

                // Send success message
                const successMessage: LoginSuccessMessage = {
                    type: 'LOGIN_SUCCESS',
                    payload: {
                        character: character,
                        username: user.username
                    }
                };
                socket.emit('gm-message', successMessage);
                console.log(`[AUTH] Login successful: ${username} (character: ${character?.name || 'none'})`);

                sendInitialStateToPlayer(socket, user.id, character?.id);

                return;
            }

            // Handle logout
            if (message.type === 'LOGOUT') {
                const userId = socketToUserId.get(socket.id);
                if (userId) {
                    activeSessions.delete(userId);
                    socketToUserId.delete(socket.id);
                    console.log(`[AUTH] User logged out: ${userId}`);
                }
                return;
            }

            // For all other messages, verify the user is authenticated
            const userId = socketToUserId.get(socket.id);
            if (!userId) {
                console.log(`[SERVER] Unauthenticated message ignored from ${socket.id}`);
                return;
            }

            // Handle player character updates (Edit Mode)
            if (message.type === 'PLAYER_UPDATE_CHARACTER') {
                const { characterId, updates } = message.payload;
                const campaignData = getCampaignData();
                if (!campaignData) {
                    console.log(`[SERVER] No campaign data available`);
                    return;
                }

                // Find the character and validate ownership
                const characterIndex = campaignData.characters.findIndex(c => c.id === characterId);
                if (characterIndex === -1) {
                    console.log(`[SERVER] Character ${characterId} not found`);
                    return;
                }

                const character = campaignData.characters[characterIndex];
                
                // Validate that this player owns this character
                const userCharacter = getUserCharacter(userId);
                if (!userCharacter || userCharacter.id !== characterId) {
                    console.log(`[SERVER] Player ${userId} does not own character ${characterId}`);
                    return;
                }

                // Merge the updates into the character
                const updatedCharacter: Character = {
                    ...character,
                    ...updates,
                    // Ensure ID cannot be changed
                    id: character.id,
                    userId: character.userId,
                };

                // Update the campaign data
                campaignData.characters[characterIndex] = updatedCharacter;
                saveCampaignData(campaignData);

                // Broadcast the character update to all connected clients
                const updateMessage: CharacterUpdateMessage = {
                    type: 'CHARACTER_UPDATE',
                    payload: { character: updatedCharacter }
                };

                connectedClients.forEach((clientSocket) => {
                    clientSocket.emit('gm-message', updateMessage);
                });

                // Also notify the GM app
                mainWindow.webContents.send('data-updated', { characters: campaignData.characters });

                console.log(`[SERVER] Player ${userId} updated character ${characterId}`);
                return;
            }

            // Handle shop evaluate request - forward to GM
            if (message.type === 'SHOP_EVALUATE_REQUEST') {
                console.log(`[SERVER] Shop evaluate request from ${userId}:`, message.payload);
                mainWindow.webContents.send('player-message-received', message);
                return;
            }

            // Handle shop purchase request - forward to GM
            if (message.type === 'SHOP_PURCHASE_REQUEST') {
                console.log(`[SERVER] Shop purchase request from ${userId}:`, message.payload);
                mainWindow.webContents.send('player-message-received', message);
                return;
            }

            // Handle quest update from player
            if (message.type === 'QUEST_UPDATE') {
                const { quest } = message.payload;
                const campaignData = getCampaignData();
                if (!campaignData) {
                    console.log(`[SERVER] No campaign data available`);
                    return;
                }

                // Initialize quests array if not exists
                if (!campaignData.quests) {
                    campaignData.quests = [];
                }

                // Find existing quest or add new one
                const existingIndex = campaignData.quests.findIndex(q => q.id === quest.id);
                if (existingIndex >= 0) {
                    campaignData.quests[existingIndex] = quest;
                } else {
                    campaignData.quests.push(quest);
                }

                saveCampaignData(campaignData);

                // Broadcast quest sync to all connected players
                broadcastQuests(campaignData.quests);

                // Notify GM app
                mainWindow.webContents.send('data-updated', { quests: campaignData.quests });

                console.log(`[SERVER] Quest updated: ${quest.title} by user ${userId}`);
                return;
            }

            // Handle quest delete from player
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

                // Broadcast quest sync to all connected players
                broadcastQuests(campaignData.quests);

                // Notify GM app
                mainWindow.webContents.send('data-updated', { quests: campaignData.quests });

                console.log(`[SERVER] Quest deleted: ${questId} by user ${userId}`);
                return;
            }

            // Forward authenticated messages to GM
            mainWindow.webContents.send('player-message-received', message);
        });

        socket.on('disconnect', () => {
            console.log(`[SERVER] Player disconnected: ${socket.id}`);

            // Clean up session
            const userId = socketToUserId.get(socket.id);
            if (userId) {
                activeSessions.delete(userId);
                socketToUserId.delete(socket.id);
                console.log(`[AUTH] Session ended for user: ${userId}`);
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

    // Send quests - party-wide, so all authenticated players get all quests
    if (campaignData.quests && campaignData.quests.length > 0) {
        const questMessage: QuestSyncMessage = {
            type: 'QUEST_SYNC',
            payload: { quests: campaignData.quests },
        };
        socket.emit('gm-message', questMessage);
        console.log(`[SERVER] Sent ${campaignData.quests.length} quests to player ${socket.id}`);
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

        // Filter shops to only include those the player has access to
        const filteredShops: Record<string, ShopState> = {};

        for (const [shopId, shopState] of Object.entries(shopInventory.shops)) {
            if (shopState.playerAccess.includes(assignedCharacterId)) {
                // Filter inventory items to hide quality/flaw for unidentified items
                const filteredInventory: ShopInventoryItem[] = shopState.inventory.map(item => {
                    if (!item.isIdentified) {
                        // Hide modification details for unidentified items
                        return {
                            ...item,
                            modification: 'standard' as const,
                            quality: undefined,
                            flaw: undefined,
                            // Show base price instead of modified price
                            modifiedPrice: item.basePrice
                        };
                    }
                    return item;
                });

                filteredShops[shopId] = {
                    ...shopState,
                    inventory: filteredInventory,
                    playerAccess: [assignedCharacterId] // Only include this character's access
                };
            }
        }

        if (Object.keys(filteredShops).length > 0) {
            // Convert to array format expected by ShopStateUpdateMessage
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

        // Only broadcast to players with access to this shop
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

    console.log(`[SERVER] Broadcasting ${quests.length} quests to ${connectedClients.size} players`);

    const message: QuestSyncMessage = {
        type: 'QUEST_SYNC',
        payload: { quests },
    };

    connectedClients.forEach((socket) => {
        socket.emit('gm-message', message);
    });
}
