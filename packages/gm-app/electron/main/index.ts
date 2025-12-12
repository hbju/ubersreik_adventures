import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import path from 'node:path'
import os from 'node:os'
import { update } from './update'
import { startWebSocketServer, sendToPlayer, broadcastJournalEntries, broadcastMapPinStates, broadcastChatMessage, getChatHistory } from './server'
import { loadCampaignData, saveCampaignData, clearCampaignCache, backupCampaignData } from './dataManager'
import { CampaignState, ChatMessage } from '@wfrp/shared'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

async function createWindow() {
  win = new BrowserWindow({
    title: 'GM App',
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    fullscreenable: true,
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) { // #298
    win.loadURL(VITE_DEV_SERVER_URL)
    // Open devTool if the app is not packaged
  } else {
    win.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  // Auto update
  update(win)

  startWebSocketServer(win);
}

app.whenReady().then(() => {
  // Load campaign data on startup
  clearCampaignCache();
  loadCampaignData();
  createWindow();
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})


// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
});

// ==================== Campaign Data Persistence IPC Handlers ====================

/**
 * Handle request for initial campaign data
 * Returns the entire campaign data object loaded from disk
 */
ipcMain.handle('get-initial-data', async () => {
  try {
    const data = loadCampaignData();
    console.log('Sending initial data to renderer');
    return data;
  } catch (error) {
    console.error('Error loading initial data:', error);
    throw error;
  }
});

/**
 * Handle save data request from renderer
 * Saves the data to disk and broadcasts the update to all windows
 */
ipcMain.on('save-data', (event, data: CampaignState) => {
  try {
    saveCampaignData(data);
    console.log('Data saved successfully');
    
    // Broadcast journal entries to all connected players
    if (data.journal && data.journal.length > 0) {
      broadcastJournalEntries(data.journal);
    }
    
    // Broadcast map pin states to all connected players
    if (data.mapPinStates) {
      broadcastMapPinStates(data.mapPinStates);
    }
  } catch (error) {
    console.error('Error saving data:', error);
  }
});

/**
 * Handle backup request from renderer
 */
ipcMain.handle('backup-campaign', async () => {
  try {
    const backupPath = backupCampaignData();
    return { success: true, path: backupPath };
  } catch (error) {
    console.error('Error backing up campaign:', error);
    return { success: false, error: (error as Error).message };
  }
});

/**
 * Handle chat message from GM
 * Broadcasts the message to all connected players
 */
ipcMain.on('send-chat-message', (_event, message: ChatMessage) => {
  try {
    broadcastChatMessage(message);
    console.log('Chat message broadcast successfully');
  } catch (error) {
    console.error('Error broadcasting chat message:', error);
  }
});

/**
 * Handle get chat history request from renderer
 */
ipcMain.handle('get-chat-history', async () => {
  try {
    return getChatHistory();
  } catch (error) {
    console.error('Error getting chat history:', error);
    return [];
  }
});

