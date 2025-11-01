/// <reference types="vite/client" />

interface Window {
  // expose in the `electron/preload/index.ts`
  ipcRenderer: import('electron').IpcRenderer & 
    { getServerStatus: () => Promise<any>; 
      onServerStatusUpdate: (callback: (value: any) => void) => () => void; 
      sendToPlayer: (socketId: string, message: any) => void; 
      onPlayerMessageReceived: (callback: (value: any) => void) => () => void; 
      assignCharacterToPlayer: (characterId: string, socketId: string) => void; 
    };
}
