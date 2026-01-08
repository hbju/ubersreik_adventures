/**
 * Audio system types for the Advanced Audio Manager & Sidebar Player
 */

/**
 * Represents a single audio track in the library
 */
export interface AudioTrack {
    /** Unique identifier for the track */
    id: string;
    /** Filename without path (e.g., "battle_theme_1.mp3") */
    filename: string;
    /** Full absolute path to the audio file */
    path: string;
    /** User-assigned tags for categorization (e.g., ["Combat", "Epic", "Fast"]) */
    tags: string[];
    /** Duration in seconds (populated after metadata scan) */
    duration?: number;
    /** Whether the file is missing from disk */
    isMissing?: boolean;
    /** Optional display name (defaults to filename if not set) */
    displayName?: string;
    /** Last modified timestamp */
    lastModified?: string;
}

/**
 * Represents a user-created playlist
 */
export interface Playlist {
    /** Unique identifier for the playlist */
    id: string;
    /** User-defined name for the playlist */
    name: string;
    /** Ordered array of track IDs in this playlist */
    trackIds: string[];
    /** Optional description */
    description?: string;
    /** When the playlist was created */
    createdAt?: string;
    /** When the playlist was last modified */
    updatedAt?: string;
}

/**
 * The complete audio library state
 */
export interface AudioLibrary {
    /** All tracks in the library */
    tracks: AudioTrack[];
    /** All user-created playlists */
    playlists: Playlist[];
    /** Root path of the music directory */
    rootPath: string;
    /** When the library was last scanned */
    lastScanned?: string;
    /** Version for migration purposes */
    version?: string;
}

/**
 * Current playback state
 */
export interface AudioPlaybackState {
    /** Currently playing track, or null if stopped */
    currentTrack: AudioTrack | null;
    /** Queue of upcoming tracks */
    queue: AudioTrack[];
    /** Whether audio is currently playing */
    isPlaying: boolean;
    /** Current volume (0-1) */
    volume: number;
    /** Current playback position in seconds */
    currentTime: number;
    /** Total duration of current track in seconds */
    duration: number;
    /** Whether shuffle mode is enabled */
    isShuffled: boolean;
    /** Whether repeat mode is enabled */
    isRepeating: boolean;
    /** The source of current playback (tag name or playlist id) */
    playbackSource?: {
        type: 'tag' | 'playlist' | 'single';
        id: string;
        name: string;
    };
}

/**
 * Audio scan result from the main process
 */
export interface AudioScanResult {
    /** Number of new tracks added */
    added: number;
    /** Number of tracks marked as missing */
    missing: number;
    /** Number of tracks that were already present */
    unchanged: number;
    /** Total tracks in library after scan */
    total: number;
    /** Any errors encountered during scan */
    errors?: string[];
}

/**
 * Messages for audio IPC communication
 */
export type AudioIPCMessage =
    | { type: 'SCAN_AUDIO_DIRECTORY'; payload: { path: string } }
    | { type: 'GET_AUDIO_LIBRARY'; payload: {} }
    | { type: 'SAVE_AUDIO_LIBRARY'; payload: AudioLibrary }
    | { type: 'UPDATE_TRACK_TAGS'; payload: { trackId: string; tags: string[] } }
    | { type: 'CREATE_PLAYLIST'; payload: Omit<Playlist, 'id'> }
    | { type: 'UPDATE_PLAYLIST'; payload: Playlist }
    | { type: 'DELETE_PLAYLIST'; payload: { playlistId: string } }
    | { type: 'SET_AUDIO_ROOT_PATH'; payload: { path: string } };

/**
 * Supported audio file extensions
 */
export const SUPPORTED_AUDIO_EXTENSIONS = ['.mp3', '.ogg', '.wav', '.m4a', '.flac', '.aac'] as const;
export type SupportedAudioExtension = typeof SUPPORTED_AUDIO_EXTENSIONS[number];
