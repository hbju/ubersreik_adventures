import React, { createContext, useContext, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { AudioTrack, AudioLibrary, Playlist, AudioPlaybackState, AudioScanResult } from '@wfrp/shared';

/**
 * Utility function to get audio file URL from path
 * Uses the custom audio:// protocol registered in Electron
 */
export function getAudioUrl(filePath: string): string {
    // Use the custom protocol for local files
    return `audio://${encodeURIComponent(filePath)}`;
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

interface AudioContextValue {
    // Library state
    library: AudioLibrary;
    isLoading: boolean;
    
    // Playback state
    playbackState: AudioPlaybackState;
    
    // Library management
    loadLibrary: () => Promise<void>;
    scanDirectory: (path?: string) => Promise<AudioScanResult | null>;
    selectDirectory: () => Promise<string | null>;
    updateTrackTags: (trackId: string, tags: string[]) => Promise<void>;
    bulkUpdateTrackTags: (trackIds: string[], tagsToAdd: string[], tagsToRemove?: string[]) => Promise<void>;
    deleteTrack: (trackId: string) => Promise<void>;
    
    // Playlist management
    createPlaylist: (name: string, trackIds?: string[], description?: string) => Promise<Playlist | null>;
    updatePlaylist: (playlist: Playlist) => Promise<void>;
    deletePlaylist: (playlistId: string) => Promise<void>;
    
    // Playback controls
    playTrack: (track: AudioTrack) => void;
    playTag: (tag: string) => void;
    playPlaylist: (playlistId: string) => void;
    pause: () => void;
    resume: () => void;
    stop: () => void;
    next: () => void;
    previous: () => void;
    seek: (time: number) => void;
    setVolume: (volume: number) => void;
    fadeOut: (duration?: number) => Promise<void>;
    fadeIn: (duration?: number) => Promise<void>;
    toggleShuffle: () => void;
    toggleRepeat: () => void;
    
    // Utility
    getTracksByTag: (tag: string) => AudioTrack[];
    getTracksByPlaylist: (playlistId: string) => AudioTrack[];
    getAllTags: () => string[];
}

const defaultPlaybackState: AudioPlaybackState = {
    currentTrack: null,
    queue: [],
    isPlaying: false,
    volume: 0.7,
    currentTime: 0,
    duration: 0,
    isShuffled: false,
    isRepeating: false,
};

const defaultLibrary: AudioLibrary = {
    tracks: [],
    playlists: [],
    rootPath: '',
};

const AudioContext = createContext<AudioContextValue | undefined>(undefined);

export const useAudio = (): AudioContextValue => {
    const context = useContext(AudioContext);
    if (!context) {
        throw new Error('useAudio must be used within an AudioProvider');
    }
    return context;
};

interface AudioProviderProps {
    children: React.ReactNode;
}

export const AudioProvider: React.FC<AudioProviderProps> = ({ children }) => {
    const [library, setLibrary] = useState<AudioLibrary>(defaultLibrary);
    const [isLoading, setIsLoading] = useState(false);
    const [playbackState, setPlaybackState] = useState<AudioPlaybackState>(defaultPlaybackState);
    
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
    
    // Initialize audio element
    useEffect(() => {
        audioRef.current = new Audio();
        audioRef.current.volume = playbackState.volume;
        
        const audio = audioRef.current;
        
        const handleTimeUpdate = () => {
            setPlaybackState(prev => ({
                ...prev,
                currentTime: audio.currentTime,
            }));
        };
        
        const handleLoadedMetadata = () => {
            setPlaybackState(prev => ({
                ...prev,
                duration: audio.duration,
            }));
        };
        
        const handleEnded = () => {
            // Play next track or stop
            if (playbackState.queue.length > 0) {
                const [nextTrack, ...remainingQueue] = playbackState.queue;
                playTrackInternal(nextTrack, remainingQueue);
            } else if (playbackState.isRepeating && playbackState.currentTrack) {
                // Repeat current track
                audio.currentTime = 0;
                audio.play();
            } else {
                setPlaybackState(prev => ({
                    ...prev,
                    isPlaying: false,
                    currentTrack: null,
                    currentTime: 0,
                    duration: 0,
                }));
            }
        };
        
        const handleError = (e: ErrorEvent) => {
            console.error('Audio playback error:', e);
            setPlaybackState(prev => ({
                ...prev,
                isPlaying: false,
            }));
        };
        
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError as any);
        
        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError as any);
            audio.pause();
            audio.src = '';
        };
    }, []);
    
    // Load library on mount
    useEffect(() => {
        loadLibrary();
    }, []);
    
    const loadLibrary = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await window.ipcRenderer.getAudioLibrary();
            setLibrary(data);
        } catch (error) {
            console.error('Error loading audio library:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);
    
    const scanDirectory = useCallback(async (path?: string): Promise<AudioScanResult | null> => {
        setIsLoading(true);
        try {
            let dirPath: string | null | undefined = path;
            if (!dirPath) {
                dirPath = await window.ipcRenderer.selectAudioDirectory();
                if (!dirPath) {
                    return null;
                }
            }
            
            const result = await window.ipcRenderer.scanAudioDirectory(dirPath);
            await loadLibrary(); // Reload library after scan
            return result;
        } catch (error) {
            console.error('Error scanning audio directory:', error);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [loadLibrary]);
    
    const selectDirectory = useCallback(async (): Promise<string | null> => {
        try {
            return await window.ipcRenderer.selectAudioDirectory();
        } catch (error) {
            console.error('Error selecting directory:', error);
            return null;
        }
    }, []);
    
    const updateTrackTags = useCallback(async (trackId: string, tags: string[]) => {
        try {
            await window.ipcRenderer.updateTrackTags(trackId, tags);
            setLibrary(prev => ({
                ...prev,
                tracks: prev.tracks.map(t => 
                    t.id === trackId ? { ...t, tags } : t
                ),
            }));
        } catch (error) {
            console.error('Error updating track tags:', error);
        }
    }, []);
    
    const bulkUpdateTrackTags = useCallback(async (trackIds: string[], tagsToAdd: string[], tagsToRemove: string[] = []) => {
        try {
            await window.ipcRenderer.bulkUpdateTrackTags(trackIds, tagsToAdd, tagsToRemove);
            setLibrary(prev => ({
                ...prev,
                tracks: prev.tracks.map(t => {
                    if (!trackIds.includes(t.id)) return t;
                    let newTags = t.tags.filter(tag => !tagsToRemove.includes(tag));
                    for (const tag of tagsToAdd) {
                        if (!newTags.includes(tag)) {
                            newTags.push(tag);
                        }
                    }
                    return { ...t, tags: newTags };
                }),
            }));
        } catch (error) {
            console.error('Error bulk updating track tags:', error);
        }
    }, []);
    
    const deleteTrack = useCallback(async (trackId: string) => {
        try {
            await window.ipcRenderer.deleteTrack(trackId);
            setLibrary(prev => ({
                ...prev,
                tracks: prev.tracks.filter(t => t.id !== trackId),
                playlists: prev.playlists.map(p => ({
                    ...p,
                    trackIds: p.trackIds.filter(id => id !== trackId),
                })),
            }));
        } catch (error) {
            console.error('Error deleting track:', error);
        }
    }, []);
    
    const createPlaylist = useCallback(async (name: string, trackIds: string[] = [], description?: string): Promise<Playlist | null> => {
        try {
            const playlist = await window.ipcRenderer.createPlaylist(name, trackIds, description);
            setLibrary(prev => ({
                ...prev,
                playlists: [...prev.playlists, playlist],
            }));
            return playlist;
        } catch (error) {
            console.error('Error creating playlist:', error);
            return null;
        }
    }, []);
    
    const updatePlaylist = useCallback(async (playlist: Playlist) => {
        try {
            await window.ipcRenderer.updatePlaylist(playlist);
            setLibrary(prev => ({
                ...prev,
                playlists: prev.playlists.map(p => 
                    p.id === playlist.id ? playlist : p
                ),
            }));
        } catch (error) {
            console.error('Error updating playlist:', error);
        }
    }, []);
    
    const deletePlaylist = useCallback(async (playlistId: string) => {
        try {
            await window.ipcRenderer.deletePlaylist(playlistId);
            setLibrary(prev => ({
                ...prev,
                playlists: prev.playlists.filter(p => p.id !== playlistId),
            }));
        } catch (error) {
            console.error('Error deleting playlist:', error);
        }
    }, []);
    
    // Internal function to play a track
    const playTrackInternal = useCallback((track: AudioTrack, queue: AudioTrack[] = [], source?: AudioPlaybackState['playbackSource']) => {
        if (!audioRef.current) return;
        
        const audio = audioRef.current;
        audio.src = getAudioUrl(track.path);
        audio.play().catch(console.error);
        
        setPlaybackState(prev => ({
            ...prev,
            currentTrack: track,
            queue,
            isPlaying: true,
            currentTime: 0,
            duration: 0,
            playbackSource: source,
        }));
    }, []);
    
    const playTrack = useCallback((track: AudioTrack) => {
        playTrackInternal(track, [], { type: 'single', id: track.id, name: track.displayName || track.filename });
    }, [playTrackInternal]);
    
    const playTag = useCallback((tag: string) => {
        const tracks = library.tracks.filter(t => t.tags.includes(tag) && !t.isMissing);
        if (tracks.length === 0) return;
        
        const shuffled = shuffleArray(tracks);
        const [first, ...rest] = shuffled;
        playTrackInternal(first, rest, { type: 'tag', id: tag, name: tag });
    }, [library.tracks, playTrackInternal]);
    
    const playPlaylist = useCallback((playlistId: string) => {
        const playlist = library.playlists.find(p => p.id === playlistId);
        if (!playlist) return;
        
        const trackMap = new Map(library.tracks.map(t => [t.id, t]));
        const tracks = playlist.trackIds
            .map(id => trackMap.get(id))
            .filter((t): t is AudioTrack => t !== undefined && !t.isMissing);
        
        if (tracks.length === 0) return;
        
        const [first, ...rest] = tracks;
        playTrackInternal(first, rest, { type: 'playlist', id: playlistId, name: playlist.name });
    }, [library.playlists, library.tracks, playTrackInternal]);
    
    const pause = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            setPlaybackState(prev => ({ ...prev, isPlaying: false }));
        }
    }, []);
    
    const resume = useCallback(() => {
        if (audioRef.current && playbackState.currentTrack) {
            audioRef.current.play().catch(console.error);
            setPlaybackState(prev => ({ ...prev, isPlaying: true }));
        }
    }, [playbackState.currentTrack]);
    
    const stop = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.src = '';
            setPlaybackState(prev => ({
                ...prev,
                currentTrack: null,
                queue: [],
                isPlaying: false,
                currentTime: 0,
                duration: 0,
                playbackSource: undefined,
            }));
        }
    }, []);
    
    const next = useCallback(() => {
        if (playbackState.queue.length > 0) {
            const [nextTrack, ...remainingQueue] = playbackState.queue;
            playTrackInternal(nextTrack, remainingQueue, playbackState.playbackSource);
        } else if (playbackState.isRepeating && playbackState.playbackSource) {
            // Restart the source (tag or playlist)
            if (playbackState.playbackSource.type === 'tag') {
                playTag(playbackState.playbackSource.id);
            } else if (playbackState.playbackSource.type === 'playlist') {
                playPlaylist(playbackState.playbackSource.id);
            }
        } else {
            stop();
        }
    }, [playbackState, playTrackInternal, playTag, playPlaylist, stop]);
    
    const previous = useCallback(() => {
        if (audioRef.current) {
            // If more than 3 seconds in, restart current track
            if (audioRef.current.currentTime > 3) {
                audioRef.current.currentTime = 0;
            } else {
                // Otherwise, no previous track history in this simple implementation
                audioRef.current.currentTime = 0;
            }
        }
    }, []);
    
    const seek = useCallback((time: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = time;
        }
    }, []);
    
    const setVolume = useCallback((volume: number) => {
        const clampedVolume = Math.max(0, Math.min(1, volume));
        if (audioRef.current) {
            audioRef.current.volume = clampedVolume;
        }
        setPlaybackState(prev => ({ ...prev, volume: clampedVolume }));
    }, []);
    
    const fadeOut = useCallback((duration: number = 2000): Promise<void> => {
        return new Promise((resolve) => {
            if (!audioRef.current) {
                resolve();
                return;
            }
            
            const audio = audioRef.current;
            const startVolume = audio.volume;
            const steps = 20;
            const stepDuration = duration / steps;
            const volumeStep = startVolume / steps;
            let currentStep = 0;
            
            if (fadeIntervalRef.current) {
                clearInterval(fadeIntervalRef.current);
            }
            
            fadeIntervalRef.current = setInterval(() => {
                currentStep++;
                const newVolume = Math.max(0, startVolume - (volumeStep * currentStep));
                audio.volume = newVolume;
                
                if (currentStep >= steps) {
                    clearInterval(fadeIntervalRef.current!);
                    fadeIntervalRef.current = null;
                    audio.pause();
                    audio.volume = startVolume; // Restore original volume
                    setPlaybackState(prev => ({ ...prev, isPlaying: false }));
                    resolve();
                }
            }, stepDuration);
        });
    }, []);
    
    const fadeIn = useCallback((duration: number = 2000): Promise<void> => {
        return new Promise((resolve) => {
            if (!audioRef.current || !playbackState.currentTrack) {
                resolve();
                return;
            }
            
            const audio = audioRef.current;
            const targetVolume = playbackState.volume;
            const steps = 20;
            const stepDuration = duration / steps;
            const volumeStep = targetVolume / steps;
            let currentStep = 0;
            
            audio.volume = 0;
            audio.play().catch(console.error);
            setPlaybackState(prev => ({ ...prev, isPlaying: true }));
            
            if (fadeIntervalRef.current) {
                clearInterval(fadeIntervalRef.current);
            }
            
            fadeIntervalRef.current = setInterval(() => {
                currentStep++;
                const newVolume = Math.min(targetVolume, volumeStep * currentStep);
                audio.volume = newVolume;
                
                if (currentStep >= steps) {
                    clearInterval(fadeIntervalRef.current!);
                    fadeIntervalRef.current = null;
                    resolve();
                }
            }, stepDuration);
        });
    }, [playbackState.currentTrack, playbackState.volume]);
    
    const toggleShuffle = useCallback(() => {
        setPlaybackState(prev => {
            const newIsShuffled = !prev.isShuffled;
            let newQueue = prev.queue;
            
            if (newIsShuffled) {
                newQueue = shuffleArray(prev.queue);
            }
            
            return { ...prev, isShuffled: newIsShuffled, queue: newQueue };
        });
    }, []);
    
    const toggleRepeat = useCallback(() => {
        setPlaybackState(prev => ({ ...prev, isRepeating: !prev.isRepeating }));
    }, []);
    
    const getTracksByTag = useCallback((tag: string): AudioTrack[] => {
        return library.tracks.filter(t => t.tags.includes(tag) && !t.isMissing);
    }, [library.tracks]);
    
    const getTracksByPlaylist = useCallback((playlistId: string): AudioTrack[] => {
        const playlist = library.playlists.find(p => p.id === playlistId);
        if (!playlist) return [];
        
        const trackMap = new Map(library.tracks.map(t => [t.id, t]));
        return playlist.trackIds
            .map(id => trackMap.get(id))
            .filter((t): t is AudioTrack => t !== undefined && !t.isMissing);
    }, [library.playlists, library.tracks]);
    
    const getAllTags = useCallback((): string[] => {
        const tagSet = new Set<string>();
        for (const track of library.tracks) {
            for (const tag of track.tags) {
                tagSet.add(tag);
            }
        }
        return Array.from(tagSet).sort();
    }, [library.tracks]);
    
    const value: AudioContextValue = useMemo(() => ({
        library,
        isLoading,
        playbackState,
        loadLibrary,
        scanDirectory,
        selectDirectory,
        updateTrackTags,
        bulkUpdateTrackTags,
        deleteTrack,
        createPlaylist,
        updatePlaylist,
        deletePlaylist,
        playTrack,
        playTag,
        playPlaylist,
        pause,
        resume,
        stop,
        next,
        previous,
        seek,
        setVolume,
        fadeOut,
        fadeIn,
        toggleShuffle,
        toggleRepeat,
        getTracksByTag,
        getTracksByPlaylist,
        getAllTags,
    }), [
        library,
        isLoading,
        playbackState,
        loadLibrary,
        scanDirectory,
        selectDirectory,
        updateTrackTags,
        bulkUpdateTrackTags,
        deleteTrack,
        createPlaylist,
        updatePlaylist,
        deletePlaylist,
        playTrack,
        playTag,
        playPlaylist,
        pause,
        resume,
        stop,
        next,
        previous,
        seek,
        setVolume,
        fadeOut,
        fadeIn,
        toggleShuffle,
        toggleRepeat,
        getTracksByTag,
        getTracksByPlaylist,
        getAllTags,
    ]);
    
    return (
        <AudioContext.Provider value={value}>
            {children}
        </AudioContext.Provider>
    );
};

export default AudioContext;
