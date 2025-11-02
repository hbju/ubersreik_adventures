import { BrowserWindow, ipcMain } from 'electron';
import { Server, Socket } from 'socket.io';
import { networkInterfaces } from 'os';
import { ClientToServerMessage, ServerToClientMessage } from '@wfrp/shared';

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