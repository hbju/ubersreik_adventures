import { BrowserWindow, ipcMain } from 'electron';
import { Server, Socket } from 'socket.io';
import { networkInterfaces } from 'os';
import { ClientToServerMessage, ServerToClientMessage, JournalUpdateMessage, JournalEntry, MapStateUpdateMessage, MapPinState, User, Character, LoginSuccessMessage, LoginFailureMessage } from '@wfrp/shared';
import { getCampaignData } from './dataManager';

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
