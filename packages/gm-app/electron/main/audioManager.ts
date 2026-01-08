import { app, dialog } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { 
    AudioLibrary, 
    AudioTrack, 
    Playlist, 
    AudioScanResult, 
    SUPPORTED_AUDIO_EXTENSIONS 
} from '@wfrp/shared';

/**
 * In-memory cache of the audio library data
 */
let audioLibrary: AudioLibrary | null = null;

/**
 * Get the path to the audio library data file
 */
function getAudioDataFilePath(): string {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'audio-data.json');
}

/**
 * Generate a unique ID for tracks and playlists
 */
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Check if a file has a supported audio extension
 */
function isSupportedAudioFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return SUPPORTED_AUDIO_EXTENSIONS.includes(ext as any);
}

/**
 * Load audio library data from disk into memory
 * If the file doesn't exist, initializes with default data
 */
export function loadAudioLibrary(): AudioLibrary {
    if (audioLibrary) {
        return audioLibrary;
    }

    const filePath = getAudioDataFilePath();

    try {
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            audioLibrary = JSON.parse(fileContent) as AudioLibrary;
            console.log('Audio library loaded from:', filePath);
        } else {
            // Initialize with default data if file doesn't exist
            audioLibrary = {
                tracks: [],
                playlists: [],
                rootPath: '',
                version: '1.0.0',
            };
            console.log('No existing audio library found. Initialized with defaults.');
        }
    } catch (error) {
        console.error('Error loading audio library:', error);
        audioLibrary = {
            tracks: [],
            playlists: [],
            rootPath: '',
            version: '1.0.0',
        };
    }

    return audioLibrary;
}

/**
 * Save audio library data to disk
 */
export function saveAudioLibrary(data: AudioLibrary): void {
    const filePath = getAudioDataFilePath();

    try {
        const dirPath = path.dirname(filePath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        audioLibrary = data;
        console.log('Audio library saved to:', filePath);
    } catch (error) {
        console.error('Error saving audio library:', error);
        throw error;
    }
}

/**
 * Clear the audio library cache
 */
export function clearAudioLibraryCache(): void {
    audioLibrary = null;
}

/**
 * Recursively scan a directory for audio files
 */
function scanDirectoryRecursively(dirPath: string, files: string[] = []): string[] {
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            
            if (entry.isDirectory()) {
                // Recursively scan subdirectories
                scanDirectoryRecursively(fullPath, files);
            } else if (entry.isFile() && isSupportedAudioFile(entry.name)) {
                files.push(fullPath);
            }
        }
    } catch (error) {
        console.error(`Error scanning directory ${dirPath}:`, error);
    }
    
    return files;
}

/**
 * Scan a directory for audio files and update the library
 */
export function scanAudioDirectory(rootPath: string): AudioScanResult {
    const library = loadAudioLibrary();
    const result: AudioScanResult = {
        added: 0,
        missing: 0,
        unchanged: 0,
        total: 0,
        errors: [],
    };

    if (!fs.existsSync(rootPath)) {
        result.errors = [`Directory does not exist: ${rootPath}`];
        return result;
    }

    // Get all audio files in the directory
    const foundFiles = scanDirectoryRecursively(rootPath);
    const foundPaths = new Set(foundFiles);
    const existingPaths = new Map(library.tracks.map(t => [t.path, t]));

    // Check for new files
    for (const filePath of foundFiles) {
        if (!existingPaths.has(filePath)) {
            // New file - add to library
            const filename = path.basename(filePath);
            const stats = fs.statSync(filePath);
            
            const newTrack: AudioTrack = {
                id: generateId(),
                filename,
                path: filePath,
                tags: [],
                isMissing: false,
                lastModified: stats.mtime.toISOString(),
            };
            
            library.tracks.push(newTrack);
            result.added++;
        } else {
            // Existing file - mark as not missing
            const existingTrack = existingPaths.get(filePath)!;
            if (existingTrack.isMissing) {
                existingTrack.isMissing = false;
            }
            result.unchanged++;
        }
    }

    // Check for missing files
    for (const track of library.tracks) {
        if (!foundPaths.has(track.path) && !track.isMissing) {
            track.isMissing = true;
            result.missing++;
        }
    }

    // Update library metadata
    library.rootPath = rootPath;
    library.lastScanned = new Date().toISOString();
    
    result.total = library.tracks.length;

    // Save the updated library
    saveAudioLibrary(library);

    return result;
}

/**
 * Update tags for a track
 */
export function updateTrackTags(trackId: string, tags: string[]): AudioTrack | null {
    const library = loadAudioLibrary();
    const track = library.tracks.find(t => t.id === trackId);
    
    if (!track) {
        return null;
    }
    
    track.tags = tags;
    saveAudioLibrary(library);
    
    return track;
}

/**
 * Bulk update tags for multiple tracks
 */
export function bulkUpdateTrackTags(trackIds: string[], tagsToAdd: string[], tagsToRemove: string[] = []): AudioTrack[] {
    const library = loadAudioLibrary();
    const updatedTracks: AudioTrack[] = [];
    
    for (const track of library.tracks) {
        if (trackIds.includes(track.id)) {
            // Remove specified tags
            track.tags = track.tags.filter(t => !tagsToRemove.includes(t));
            // Add new tags (avoiding duplicates)
            for (const tag of tagsToAdd) {
                if (!track.tags.includes(tag)) {
                    track.tags.push(tag);
                }
            }
            updatedTracks.push(track);
        }
    }
    
    if (updatedTracks.length > 0) {
        saveAudioLibrary(library);
    }
    
    return updatedTracks;
}

/**
 * Create a new playlist
 */
export function createPlaylist(name: string, trackIds: string[] = [], description?: string): Playlist {
    const library = loadAudioLibrary();
    
    const playlist: Playlist = {
        id: generateId(),
        name,
        trackIds,
        description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    
    library.playlists.push(playlist);
    saveAudioLibrary(library);
    
    return playlist;
}

/**
 * Update an existing playlist
 */
export function updatePlaylist(playlist: Playlist): Playlist | null {
    const library = loadAudioLibrary();
    const index = library.playlists.findIndex(p => p.id === playlist.id);
    
    if (index === -1) {
        return null;
    }
    
    playlist.updatedAt = new Date().toISOString();
    library.playlists[index] = playlist;
    saveAudioLibrary(library);
    
    return playlist;
}

/**
 * Delete a playlist
 */
export function deletePlaylist(playlistId: string): boolean {
    const library = loadAudioLibrary();
    const initialLength = library.playlists.length;
    library.playlists = library.playlists.filter(p => p.id !== playlistId);
    
    if (library.playlists.length < initialLength) {
        saveAudioLibrary(library);
        return true;
    }
    
    return false;
}

/**
 * Get all unique tags from the library
 */
export function getAllTags(): string[] {
    const library = loadAudioLibrary();
    const tagSet = new Set<string>();
    
    for (const track of library.tracks) {
        for (const tag of track.tags) {
            tagSet.add(tag);
        }
    }
    
    return Array.from(tagSet).sort();
}

/**
 * Get tracks by tag
 */
export function getTracksByTag(tag: string): AudioTrack[] {
    const library = loadAudioLibrary();
    return library.tracks.filter(t => t.tags.includes(tag) && !t.isMissing);
}

/**
 * Get tracks by playlist
 */
export function getTracksByPlaylist(playlistId: string): AudioTrack[] {
    const library = loadAudioLibrary();
    const playlist = library.playlists.find(p => p.id === playlistId);
    
    if (!playlist) {
        return [];
    }
    
    const trackMap = new Map(library.tracks.map(t => [t.id, t]));
    return playlist.trackIds
        .map(id => trackMap.get(id))
        .filter((t): t is AudioTrack => t !== undefined && !t.isMissing);
}

/**
 * Open a dialog to select the audio directory
 */
export async function selectAudioDirectory(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Music Folder',
    });
    
    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }
    
    return result.filePaths[0];
}

/**
 * Set the root path for the audio library
 */
export function setAudioRootPath(rootPath: string): void {
    const library = loadAudioLibrary();
    library.rootPath = rootPath;
    saveAudioLibrary(library);
}

/**
 * Delete a track from the library (does not delete the file)
 */
export function deleteTrack(trackId: string): boolean {
    const library = loadAudioLibrary();
    const initialLength = library.tracks.length;
    library.tracks = library.tracks.filter(t => t.id !== trackId);
    
    // Also remove from any playlists
    for (const playlist of library.playlists) {
        playlist.trackIds = playlist.trackIds.filter(id => id !== trackId);
    }
    
    if (library.tracks.length < initialLength) {
        saveAudioLibrary(library);
        return true;
    }
    
    return false;
}

/**
 * Update track display name
 */
export function updateTrackDisplayName(trackId: string, displayName: string): AudioTrack | null {
    const library = loadAudioLibrary();
    const track = library.tracks.find(t => t.id === trackId);
    
    if (!track) {
        return null;
    }
    
    track.displayName = displayName;
    saveAudioLibrary(library);
    
    return track;
}
