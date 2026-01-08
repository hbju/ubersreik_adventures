import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
    on(...args: Parameters<typeof ipcRenderer.on>) {
        const [channel, listener] = args
        return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
    },
    off(...args: Parameters<typeof ipcRenderer.off>) {
        const [channel, ...omit] = args
        return ipcRenderer.off(channel, ...omit)
    },
    send(...args: Parameters<typeof ipcRenderer.send>) {
        const [channel, ...omit] = args
        return ipcRenderer.send(channel, ...omit)
    },
    invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
        const [channel, ...omit] = args
        return ipcRenderer.invoke(channel, ...omit)
    },

    getServerStatus() {
        return ipcRenderer.invoke('get-server-status')
    },
    onServerStatusUpdate(callback: (value: any) => void) {
        const listener = (_event: any, value: any) => callback(value);
        ipcRenderer.on('server-status-update', listener)
        return () => {
            ipcRenderer.removeListener('server-status-update', listener)
        }
    },
    sendToPlayer(userId: string, message: any) {
        return ipcRenderer.send('send-to-player', userId, message)
    },
    sendToAllPlayers(message: any) {
        return ipcRenderer.send('send-to-all-players', message)
    },
    assignCharacterToPlayer(characterId: string, userId: string) {
        return ipcRenderer.send('assign-character-to-player', characterId, userId)
    },
    onPlayerMessageReceived(callback: (value: any) => void) {
        const listener = (_event: any, value: any) => callback(value);
        ipcRenderer.on('player-message-received', listener)
        return () => {
            ipcRenderer.removeListener('player-message-received', listener)
        }
    },

    // ==================== Campaign Data Persistence API ====================

    /**
     * Get initial campaign data from the main process
     * @returns Promise resolving to the campaign data
     */
    getInitialData() {
        return ipcRenderer.invoke('get-initial-data')
    },

    /**
     * Save campaign data to the main process
     * @param data The campaign data to save
     */
    saveData(data: any) {
        return ipcRenderer.send('save-data', data)
    },

    /**
     * Listen for data updates from the main process
     * @param callback Function to call when data is updated
     * @returns Cleanup function to remove the listener
     */
    onDataUpdated(callback: (value: any) => void) {
        const listener = (_event: any, value: any) => callback(value);
        ipcRenderer.on('data-updated', listener)
        return () => {
            ipcRenderer.removeListener('data-updated', listener)
        }
    },

    onMapPingReceived(callback: (value: any) => void) {
        const listener = (_event: any, value: any) => callback(value);
        ipcRenderer.on('map-ping', listener)
        return () => {
            ipcRenderer.removeListener('map-ping', listener)
        }
    },

    // ==================== Chat API ====================
    
    /**
     * Send a chat message from the GM
     * @param message The chat message to send
     */
    sendChatMessage(message: any) {
        return ipcRenderer.send('send-chat-message', message)
    },

    /**
     * Listen for chat messages from players
     * @param callback Function to call when a chat message is received
     * @returns Cleanup function to remove the listener
     */
    onChatMessage(callback: (value: any) => void) {
        const listener = (_event: any, value: any) => callback(value);
        ipcRenderer.on('chat-message', listener)
        return () => {
            ipcRenderer.removeListener('chat-message', listener)
        }
    },

    /**
     * Get chat history
     * @returns Promise resolving to the chat history array
     */
    getChatHistory() {
        return ipcRenderer.invoke('get-chat-history')
    },

    /**
     * Trigger a manual backup of the campaign data
     * @returns Promise resolving to the result { success: boolean, path?: string, error?: string }
     */
    backupCampaign() {
        return ipcRenderer.invoke('backup-campaign')
    },

    // ==================== Audio Manager API ====================

    /**
     * Get the audio library data
     * @returns Promise resolving to the AudioLibrary
     */
    getAudioLibrary() {
        return ipcRenderer.invoke('get-audio-library')
    },

    /**
     * Save the audio library data
     * @param data The audio library data to save
     */
    saveAudioLibrary(data: any) {
        return ipcRenderer.send('save-audio-library', data)
    },

    /**
     * Scan a directory for audio files
     * @param dirPath The path to scan
     * @returns Promise resolving to the scan result
     */
    scanAudioDirectory(dirPath: string) {
        return ipcRenderer.invoke('scan-audio-directory', dirPath)
    },

    /**
     * Open dialog to select audio directory
     * @returns Promise resolving to the selected path or null
     */
    selectAudioDirectory() {
        return ipcRenderer.invoke('select-audio-directory')
    },

    /**
     * Update tags for a single track
     * @param trackId The track ID
     * @param tags The new tags array
     * @returns Promise resolving to the updated track
     */
    updateTrackTags(trackId: string, tags: string[]) {
        return ipcRenderer.invoke('update-track-tags', trackId, tags)
    },

    /**
     * Bulk update tags for multiple tracks
     * @param trackIds Array of track IDs to update
     * @param tagsToAdd Tags to add to all tracks
     * @param tagsToRemove Tags to remove from all tracks
     * @returns Promise resolving to the updated tracks
     */
    bulkUpdateTrackTags(trackIds: string[], tagsToAdd: string[], tagsToRemove: string[] = []) {
        return ipcRenderer.invoke('bulk-update-track-tags', trackIds, tagsToAdd, tagsToRemove)
    },

    /**
     * Create a new playlist
     * @param name Playlist name
     * @param trackIds Initial track IDs
     * @param description Optional description
     * @returns Promise resolving to the created playlist
     */
    createPlaylist(name: string, trackIds: string[] = [], description?: string) {
        return ipcRenderer.invoke('create-playlist', name, trackIds, description)
    },

    /**
     * Update an existing playlist
     * @param playlist The playlist to update
     * @returns Promise resolving to the updated playlist
     */
    updatePlaylist(playlist: any) {
        return ipcRenderer.invoke('update-playlist', playlist)
    },

    /**
     * Delete a playlist
     * @param playlistId The playlist ID to delete
     * @returns Promise resolving to boolean success
     */
    deletePlaylist(playlistId: string) {
        return ipcRenderer.invoke('delete-playlist', playlistId)
    },

    /**
     * Delete a track from the library
     * @param trackId The track ID to delete
     * @returns Promise resolving to boolean success
     */
    deleteTrack(trackId: string) {
        return ipcRenderer.invoke('delete-track', trackId)
    },

    /**
     * Update track display name
     * @param trackId The track ID
     * @param displayName The new display name
     * @returns Promise resolving to the updated track
     */
    updateTrackDisplayName(trackId: string, displayName: string) {
        return ipcRenderer.invoke('update-track-display-name', trackId, displayName)
    },


    // You can expose other APTs you need here.
    // ...
})

// --------- Preload scripts loading ---------
function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
    return new Promise(resolve => {
        if (condition.includes(document.readyState)) {
            resolve(true)
        } else {
            document.addEventListener('readystatechange', () => {
                if (condition.includes(document.readyState)) {
                    resolve(true)
                }
            })
        }
    })
}

const safeDOM = {
    append(parent: HTMLElement, child: HTMLElement) {
        if (!Array.from(parent.children).find(e => e === child)) {
            return parent.appendChild(child)
        }
    },
    remove(parent: HTMLElement, child: HTMLElement) {
        if (Array.from(parent.children).find(e => e === child)) {
            return parent.removeChild(child)
        }
    },
}

/**
 * https://tobiasahlin.com/spinkit
 * https://connoratherton.com/loaders
 * https://projects.lukehaas.me/css-loaders
 * https://matejkustec.github.io/SpinThatShit
 */
function useLoading() {
    const className = `loaders-css__square-spin`
    const styleContent = `
@keyframes square-spin {
  25% { transform: perspective(100px) rotateX(180deg) rotateY(0); }
  50% { transform: perspective(100px) rotateX(180deg) rotateY(180deg); }
  75% { transform: perspective(100px) rotateX(0) rotateY(180deg); }
  100% { transform: perspective(100px) rotateX(0) rotateY(0); }
}
.${className} > div {
  animation-fill-mode: both;
  width: 50px;
  height: 50px;
  background: #fff;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #282c34;
  z-index: 9;
}
    `
    const oStyle = document.createElement('style')
    const oDiv = document.createElement('div')

    oStyle.id = 'app-loading-style'
    oStyle.innerHTML = styleContent
    oDiv.className = 'app-loading-wrap'
    oDiv.innerHTML = `<div class="${className}"><div></div></div>`

    return {
        appendLoading() {
            safeDOM.append(document.head, oStyle)
            safeDOM.append(document.body, oDiv)
        },
        removeLoading() {
            safeDOM.remove(document.head, oStyle)
            safeDOM.remove(document.body, oDiv)
        },
    }
}

// ----------------------------------------------------------------------

const { appendLoading, removeLoading } = useLoading()
domReady().then(appendLoading)

window.onmessage = (ev) => {
    ev.data.payload === 'removeLoading' && removeLoading()
}

setTimeout(removeLoading, 4999)