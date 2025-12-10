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

    /**
     * Trigger a manual backup of the campaign data
     * @returns Promise resolving to the result { success: boolean, path?: string, error?: string }
     */
    backupCampaign() {
        return ipcRenderer.invoke('backup-campaign')
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