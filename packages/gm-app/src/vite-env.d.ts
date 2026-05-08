/// <reference types="vite/client" />

interface IpcRendererApi {
    // Base IPC methods exposed from preload
    on(channel: string, listener: (...args: any[]) => void): void;
    off(channel: string, listener: (...args: any[]) => void): void;
    send(channel: string, ...args: any[]): void;
    invoke(channel: string, ...args: any[]): Promise<any>;

    // Campaign Data Persistence API
    getInitialData: () => Promise<any>;
    saveData: (data: any) => void;
    onDataUpdated: (callback: (value: any) => void) => () => void;

    // Backup API
    backupCampaign: () => Promise<{ success: boolean; path?: string; error?: string }>;
    
    // Audio Manager API
    getAudioServerPort: () => Promise<number>;
    getAudioLibrary: () => Promise<import('@wfrp/shared').AudioLibrary>;
    saveAudioLibrary: (data: import('@wfrp/shared').AudioLibrary) => void;
    scanAudioDirectory: (dirPath: string) => Promise<import('@wfrp/shared').AudioScanResult>;
    selectAudioDirectory: () => Promise<string | null>;
    updateTrackTags: (trackId: string, tags: string[]) => Promise<import('@wfrp/shared').AudioTrack | null>;
    bulkUpdateTrackTags: (trackIds: string[], tagsToAdd: string[], tagsToRemove?: string[]) => Promise<import('@wfrp/shared').AudioTrack[]>;
    createPlaylist: (name: string, trackIds?: string[], description?: string) => Promise<import('@wfrp/shared').Playlist>;
    updatePlaylist: (playlist: import('@wfrp/shared').Playlist) => Promise<import('@wfrp/shared').Playlist | null>;
    deletePlaylist: (playlistId: string) => Promise<boolean>;
    deleteTrack: (trackId: string) => Promise<boolean>;
    updateTrackDisplayName: (trackId: string, displayName: string) => Promise<import('@wfrp/shared').AudioTrack | null>;
    
    // Image Handler API
    selectCharacterImage: (characterId: string) => Promise<{ success: boolean; path?: string; dataUrl?: string; cancelled?: boolean; error?: string }>;
    loadCharacterImage: (imagePath: string) => Promise<string | null>;
    deleteCharacterImage: (characterId: string) => Promise<{ success: boolean; error?: string }>;
}

interface Window {
    // expose in the `electron/preload/index.ts`
    ipcRenderer: IpcRendererApi;
}
