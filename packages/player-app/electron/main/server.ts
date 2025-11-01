import { BrowserWindow, ipcMain } from 'electron';
import { Server, Socket } from 'socket.io';
import { networkInterfaces } from 'os';

const PORT = 3003;
const connectedClients = new Map<string, Socket>();
let io: Server | null = null;

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

export function sendToPlayer(socketId: string, message: any) {
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

    socket.on('disconnect', () => {
      console.log(`[SERVER] Player disconnected: ${socket.id}`);
      connectedClients.delete(socket.id);
      updateStatus(); 
    });
  });

  ipcMain.handle('get-server-status', async () => {
    return {
      ip: localIp,
      port: PORT,
      clients: Array.from(connectedClients.keys())
    };
  });
}