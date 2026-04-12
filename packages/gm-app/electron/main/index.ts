import { app, BrowserWindow, shell, ipcMain, protocol, dialog } from 'electron'
import * as fs from 'fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import path from 'node:path'
import os from 'node:os'
import { update } from './update'
import { startWebSocketServer, sendToPlayer, broadcastJournalEntries, broadcastMapPinStates, broadcastChatMessage, getChatHistory } from './server'
import {
  loadCampaignData, saveCampaignData, clearCampaignCache, backupCampaignData,
  saveCharacter, deleteCharacter as deleteCharacterFromDb, saveJournal, saveQuests,
  saveFactions, saveMapPinStates, saveTokens, saveCalendarState, saveActiveMapId,
  saveShopInventory, saveCustomShopDefinitions, importCampaignFromJson, exportCampaignToJson,
} from './dataManager'
import {
  initializeSupabase, signIn, signUp, signOut, getCurrentUser,
  setCurrentCampaignId,
} from './supabaseManager'
import { startAudioServer, getAudioServerPort, stopAudioServer } from './audioServer'
import { selectAndCopyCharacterImage, readCharacterImageAsDataUrl, deleteCharacterImage } from './imageHandler'
import {
  loadAudioLibrary,
  saveAudioLibrary,
  scanAudioDirectory,
  updateTrackTags,
  bulkUpdateTrackTags,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  selectAudioDirectory,
  deleteTrack,
  updateTrackDisplayName
} from './audioManager'
import { CampaignState, ChatMessage, AudioLibrary, Playlist, supabase } from '@wfrp/shared'

const { campaignQueries } = supabase;

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

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'audio',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
    },
  },
]);

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
  const stopUpdate = update(win)

  startWebSocketServer(win);

  // Clean up listeners when the window is closed
  win.on('closed', () => {
    stopUpdate();
    stopAudioServer();
    win = null
  })
}

app.whenReady().then(async () => {
  await startAudioServer();

  // Initialize Supabase client (auth happens later via IPC from renderer)
  try {
    initializeSupabase();
  } catch (error) {
    console.warn('[STARTUP] Supabase initialization failed:', error);
  }

  createWindow();
})

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.webm': 'audio/webm',
  };
  return mimeTypes[ext] || 'audio/mpeg';
}

app.on('window-all-closed', () => {
  stopAudioServer();
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

// ==================== Supabase Auth IPC Handlers ====================

ipcMain.handle('auth:sign-in', async (_event, email: string, password: string) => {
  try {
    const result = await signIn(email, password);
    return { success: true, user: result.user };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('auth:sign-up', async (_event, email: string, password: string) => {
  try {
    const result = await signUp(email, password);
    return { success: true, user: result.user };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('auth:sign-out', async () => {
  try {
    await signOut();
    clearCampaignCache();
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('auth:get-user', async () => {
  try {
    const user = await getCurrentUser();
    return user;
  } catch (error) {
    return null;
  }
});

// ==================== Campaign Management IPC Handlers ====================

ipcMain.handle('campaign:list', async () => {
  try {
    var result = await campaignQueries.listMyCampaigns();
    return { success: true, campaigns: result.map(c => ({ id: c.campaigns.id, name: c.campaigns.name, description: c.campaigns.description, created_at: c.campaigns.created_at, updated_at: c.campaigns.updated_at })) };
  } catch (error) {
    console.error('Error listing campaigns:', error);
    return { success: false, error: (error as Error).message, campaigns: [] };
  }
});

ipcMain.handle('campaign:create', async (_event, name: string, description?: string) => {
  try {
    const campaign = await campaignQueries.createCampaign(name, description);
    return campaign;
  } catch (error) {
    console.error('Error creating campaign:', error);
    throw error;
  }
});

ipcMain.handle('campaign:load', async (_event, campaignId: string) => {
  try {
    setCurrentCampaignId(campaignId);
    clearCampaignCache();
    const data = await loadCampaignData();
    console.log('Campaign loaded from Supabase:', campaignId);
    return { success: true, data };
  } catch (error) {
    console.error('Error loading campaign:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('campaign:delete', async (_event, campaignId: string) => {
  try {
    await campaignQueries.deleteCampaign(campaignId);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('campaign:import-json', async (_event, jsonPath: string, name: string) => {
  try {
    const newCampaignId = await importCampaignFromJson(jsonPath, name);
    return { success: true, campaignId: newCampaignId };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('campaign:export-json', async () => {
  try {
    const backupPath = exportCampaignToJson();
    return { success: true, path: backupPath };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('campaign:select-import-file', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select Campaign JSON File',
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return { success: false, path: null };
  return { success: true, path: result.filePaths[0] };
});

ipcMain.handle('campaign:invite-player', async (_event, campaignId: string, email: string) => {
  try {
    // Look up user by email — this would require admin API or a users table
    // For now, we use the user_id directly if known
    // TODO: Implement user lookup via email when Supabase project is set up
    return { success: false, error: 'User lookup by email not yet implemented. Use Supabase dashboard to invite.' };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// ==================== Granular Save IPC Handlers ====================

ipcMain.handle('save:character', async (_event, character: any) => {
  try {
    await saveCharacter(character);
    return { success: true };
  } catch (error) {
    console.error('Error saving character:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('save:delete-character', async (_event, characterId: string) => {
  try {
    await deleteCharacterFromDb(characterId);
    return { success: true };
  } catch (error) {
    console.error('Error deleting character:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('save:journal', async (_event, entries: any[]) => {
  try {
    await saveJournal(entries);
    return { success: true };
  } catch (error) {
    console.error('Error saving journal:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('save:quests', async (_event, quests: any[]) => {
  try {
    await saveQuests(quests);
    return { success: true };
  } catch (error) {
    console.error('Error saving quests:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('save:factions', async (_event, factions: any[], territories?: any) => {
  try {
    await saveFactions(factions, territories);
    return { success: true };
  } catch (error) {
    console.error('Error saving factions:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('save:map-pin-states', async (_event, pinStates: any) => {
  try {
    await saveMapPinStates(pinStates);
    return { success: true };
  } catch (error) {
    console.error('Error saving map pin states:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('save:tokens', async (_event, tokens: any[]) => {
  try {
    await saveTokens(tokens);
    return { success: true };
  } catch (error) {
    console.error('Error saving tokens:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('save:calendar', async (_event, calendar: any) => {
  try {
    await saveCalendarState(calendar);
    return { success: true };
  } catch (error) {
    console.error('Error saving calendar:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('save:active-map-id', async (_event, mapId: string) => {
  try {
    await saveActiveMapId(mapId);
    return { success: true };
  } catch (error) {
    console.error('Error saving active map ID:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('save:shop-inventory', async (_event, shopInventory: any) => {
  try {
    await saveShopInventory(shopInventory);
    return { success: true };
  } catch (error) {
    console.error('Error saving shop inventory:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('save:custom-shop-definitions', async (_event, defs: any[]) => {
  try {
    await saveCustomShopDefinitions(defs);
    return { success: true };
  } catch (error) {
    console.error('Error saving custom shop definitions:', error);
    return { success: false, error: (error as Error).message };
  }
});

// ==================== Campaign Data Persistence IPC Handlers ====================

/**
 * Handle request for initial campaign data
 * Returns campaign data loaded from Supabase (must be authenticated and have a campaign loaded)
 * @deprecated Legacy handler — kept for backward compatibility when Supabase is not configured.
 *             New code should use granular IPC handlers and load data via CampaignSelector.
 */
ipcMain.handle('get-initial-data', async () => {
  try {
    const data = await loadCampaignData();
    console.log('Sending initial data to renderer');
    return data;
  } catch (error) {
    console.error('Error loading initial data:', error);
    throw error;
  }
});

/**
 * Handle save data request from renderer (legacy full-state save)
 * Saves the data to Supabase and broadcasts the update to all players
 * @deprecated No longer called from the renderer — all saves are granular now.
 *             Kept because server.ts still uses saveCampaignData() internally.
 */
ipcMain.on('save-data', async (event, data: CampaignState) => {
  try {
    await saveCampaignData(data);
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
 * Handle backup request from renderer (exports to JSON)
 */
ipcMain.handle('backup-campaign', async () => {
  try {
    const backupPath = exportCampaignToJson();
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

// ==================== Audio Manager IPC Handlers ====================

/**
 * Return the audio server port
 * */
ipcMain.handle('get-audio-server-port', () => {
  return getAudioServerPort();
});

/**
 * Get the audio library data
 */
ipcMain.handle('get-audio-library', async () => {
  try {
    return loadAudioLibrary();
  } catch (error) {
    console.error('Error loading audio library:', error);
    throw error;
  }
});

/**
 * Save the audio library data
 */
ipcMain.on('save-audio-library', (_event, data: AudioLibrary) => {
  try {
    saveAudioLibrary(data);
    console.log('Audio library saved successfully');
  } catch (error) {
    console.error('Error saving audio library:', error);
  }
});

/**
 * Scan a directory for audio files
 */
ipcMain.handle('scan-audio-directory', async (_event, dirPath: string) => {
  try {
    const result = scanAudioDirectory(dirPath);
    return result;
  } catch (error) {
    console.error('Error scanning audio directory:', error);
    throw error;
  }
});

/**
 * Open dialog to select audio directory
 */
ipcMain.handle('select-audio-directory', async () => {
  try {
    return await selectAudioDirectory();
  } catch (error) {
    console.error('Error selecting audio directory:', error);
    throw error;
  }
});

/**
 * Update tags for a single track
 */
ipcMain.handle('update-track-tags', async (_event, trackId: string, tags: string[]) => {
  try {
    return updateTrackTags(trackId, tags);
  } catch (error) {
    console.error('Error updating track tags:', error);
    throw error;
  }
});

/**
 * Bulk update tags for multiple tracks
 */
ipcMain.handle('bulk-update-track-tags', async (_event, trackIds: string[], tagsToAdd: string[], tagsToRemove: string[]) => {
  try {
    return bulkUpdateTrackTags(trackIds, tagsToAdd, tagsToRemove);
  } catch (error) {
    console.error('Error bulk updating track tags:', error);
    throw error;
  }
});

/**
 * Create a new playlist
 */
ipcMain.handle('create-playlist', async (_event, name: string, trackIds: string[], description?: string) => {
  try {
    return createPlaylist(name, trackIds, description);
  } catch (error) {
    console.error('Error creating playlist:', error);
    throw error;
  }
});

/**
 * Update an existing playlist
 */
ipcMain.handle('update-playlist', async (_event, playlist: Playlist) => {
  try {
    return updatePlaylist(playlist);
  } catch (error) {
    console.error('Error updating playlist:', error);
    throw error;
  }
});

/**
 * Delete a playlist
 */
ipcMain.handle('delete-playlist', async (_event, playlistId: string) => {
  try {
    return deletePlaylist(playlistId);
  } catch (error) {
    console.error('Error deleting playlist:', error);
    throw error;
  }
});

/**
 * Delete a track from the library
 */
ipcMain.handle('delete-track', async (_event, trackId: string) => {
  try {
    return deleteTrack(trackId);
  } catch (error) {
    console.error('Error deleting track:', error);
    throw error;
  }
});

/**
 * Update track display name
 */
ipcMain.handle('update-track-display-name', async (_event, trackId: string, displayName: string) => {
  try {
    return updateTrackDisplayName(trackId, displayName);
  } catch (error) {
    console.error('Error updating track display name:', error);
    throw error;
  }
});

// ==================== Image Handler IPC Handlers ====================

/**
 * Open file dialog to select and copy a character image
 */
ipcMain.handle('select-character-image', async (_event, characterId: string) => {
  try {
    const imagePath = await selectAndCopyCharacterImage(characterId);
    if (imagePath) {
      const dataUrl = await readCharacterImageAsDataUrl(imagePath);
      return { success: true, path: imagePath, dataUrl };
    }
    return { success: false, cancelled: true };
  } catch (error) {
    console.error('Error selecting character image:', error);
    return { success: false, error: (error as Error).message };
  }
});

/**
 * Load a character image as a data URL
 */
ipcMain.handle('load-character-image', async (_event, imagePath: string) => {
  try {
    const dataUrl = await readCharacterImageAsDataUrl(imagePath);
    return dataUrl;
  } catch (error) {
    console.error('Error loading character image:', error);
    return null;
  }
});

/**
 * Delete a character's image
 */
ipcMain.handle('delete-character-image', async (_event, characterId: string) => {
  try {
    await deleteCharacterImage(characterId);
    return { success: true };
  } catch (error) {
    console.error('Error deleting character image:', error);
    return { success: false, error: (error as Error).message };
  }
});
