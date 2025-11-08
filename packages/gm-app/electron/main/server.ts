import { BrowserWindow, ipcMain } from 'electron';
import { Server, Socket } from 'socket.io';
import { networkInterfaces } from 'os';
import { ClientToServerMessage, ServerToClientMessage, JournalUpdateMessage, JournalEntry, MapStateUpdateMessage, MapPinState } from '@wfrp/shared';

const PORT = 3003;
const connectedClients = new Map<string, Socket>();
let io: Server | null = null;
const charactersAssignments = new Map<string, string>();

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
      mainWindow.webContents.send('player-message-received', message);
    });

    socket.on('disconnect', () => {
      console.log(`[SERVER] Player disconnected: ${socket.id}`);
      connectedClients.delete(socket.id);
      for (const [key, charId] of charactersAssignments.entries()) {
        if (charId === socket.id) {
          charactersAssignments.delete(key);
          break;
        }
      }
      updateStatus(); 
    });
  });

  ipcMain.on('send-to-player', (_event, socketId: string, message: any) => {
    const targetSocketId = charactersAssignments.get(socketId) || socketId;
    console.log(`[IPC] Received request to send message to ${targetSocketId}`);
    sendToPlayer(targetSocketId, message);
  });

  ipcMain.on('send-to-all-players', (_event, message: ServerToClientMessage) => {
    console.log(`[IPC] Broadcasting message to all ${connectedClients.size} connected players`);
    connectedClients.forEach((socket) => {
      socket.emit('gm-message', message);
    });
  });

  ipcMain.on('assign-character-to-player', (_event, characterId: string, socketId: string) => {
    charactersAssignments.set(characterId, socketId);
    console.log(`[IPC] Assigned character ${characterId} to player ${socketId}`);
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
    let assignedCharacterId: string | undefined;
    for (const [charId, socketIdValue] of charactersAssignments.entries()) {
      if (socketIdValue === socketId) {
        assignedCharacterId = charId;
        break;
      }
    }

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
    // Find which character is assigned to this player
    let assignedCharacterId: string | undefined;
    for (const [charId, socketIdValue] of charactersAssignments.entries()) {
      if (socketIdValue === socketId) {
        assignedCharacterId = charId;
        break;
      }
    }

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
