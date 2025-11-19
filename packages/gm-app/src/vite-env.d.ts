/// <reference types="vite/client" />

interface Window {
  // expose in the `electron/preload/index.ts`
  ipcRenderer: import('electron').IpcRenderer & 
    { getServerStatus: () => Promise<any>; 
      onServerStatusUpdate: (callback: (value: any) => void) => () => void; 
      sendToPlayer: (userId: string, message: any) => void; 
      sendToAllPlayers: (message: any) => void;
      onPlayerMessageReceived: (callback: (value: any) => void) => () => void; 
      assignCharacterToPlayer: (characterId: string, socketId: string) => void;
      getInitialData: () => Promise<any>;
      saveData: (data: any) => void;
      onDataUpdated: (callback: (value: any) => void) => () => void;
      backupCampaign: () => Promise<{ success: boolean; path?: string; error?: string }>;
    };
}
