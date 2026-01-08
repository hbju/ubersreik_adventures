import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAudio } from '../../context/AudioContext';
import { AudioTrack } from '@wfrp/shared';
import AudioControls from './AudioControls';
import styles from './AudioSidebar.module.css';

interface AudioSidebarProps {
    onOpenLibraryManager?: () => void;
}

export const AudioSidebar: React.FC<AudioSidebarProps> = ({ onOpenLibraryManager }) => {
    const { t } = useTranslation();
    const {
        library,
        playbackState,
        getAllTags,
        getTracksByTag,
        playTag,
        playPlaylist,
        playTrack,
        scanDirectory,
    } = useAudio();

    const [searchTerm, setSearchTerm] = useState('');
    const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
    const [expandedPlaylists, setExpandedPlaylists] = useState<Set<string>>(new Set());

    const { currentTrack } = playbackState;

    // Get all unique tags with track counts
    const tagsWithCounts = useMemo(() => {
        const tags = getAllTags();
        return tags.map(tag => ({
            name: tag,
            tracks: getTracksByTag(tag),
        })).filter(t => t.tracks.length > 0);
    }, [getAllTags, getTracksByTag]);

    // Filter tags based on search
    const filteredTags = useMemo(() => {
        if (!searchTerm) return tagsWithCounts;
        const term = searchTerm.toLowerCase();
        return tagsWithCounts.filter(t => 
            t.name.toLowerCase().includes(term) ||
            t.tracks.some(track => 
                track.filename.toLowerCase().includes(term) ||
                track.displayName?.toLowerCase().includes(term)
            )
        );
    }, [tagsWithCounts, searchTerm]);

    // Filter playlists based on search
    const filteredPlaylists = useMemo(() => {
        if (!searchTerm) return library.playlists;
        const term = searchTerm.toLowerCase();
        return library.playlists.filter(p => p.name.toLowerCase().includes(term));
    }, [library.playlists, searchTerm]);

    const toggleTagExpanded = useCallback((tag: string) => {
        setExpandedTags(prev => {
            const newSet = new Set(prev);
            if (newSet.has(tag)) {
                newSet.delete(tag);
            } else {
                newSet.add(tag);
            }
            return newSet;
        });
    }, []);

    const togglePlaylistExpanded = useCallback((playlistId: string) => {
        setExpandedPlaylists(prev => {
            const newSet = new Set(prev);
            if (newSet.has(playlistId)) {
                newSet.delete(playlistId);
            } else {
                newSet.add(playlistId);
            }
            return newSet;
        });
    }, []);

    const handleSetupLibrary = useCallback(async () => {
        await scanDirectory();
    }, [scanDirectory]);

    const isTrackPlaying = (track: AudioTrack) => {
        return currentTrack?.id === track.id;
    };

    // Get tracks for a playlist
    const getPlaylistTracks = useCallback((playlistId: string): AudioTrack[] => {
        const playlist = library.playlists.find(p => p.id === playlistId);
        if (!playlist) return [];
        
        const trackMap = new Map(library.tracks.map(t => [t.id, t]));
        return playlist.trackIds
            .map(id => trackMap.get(id))
            .filter((t): t is AudioTrack => t !== undefined && !t.isMissing);
    }, [library.playlists, library.tracks]);

    const hasContent = library.tracks.length > 0;

    return (
        <div className={styles.audioSidebar}>
            <div className={styles.header}>
                <h2 className={styles.title}>
                    🎵 {t('audio.controller', 'Audio Controls')}
                </h2>
                <input
                    type="text"
                    className={styles.searchBox}
                    placeholder={t('audio.searchTracks', 'Search tracks...')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className={styles.content}>
                {!hasContent ? (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>🎶</div>
                        <p className={styles.emptyText}>
                            {t('audio.noLibrary', 'No music library configured.')}
                        </p>
                        <button
                            className={styles.setupButton}
                            onClick={handleSetupLibrary}
                        >
                            {t('audio.scanFolder', 'Scan Music Folder')}
                        </button>
                        {onOpenLibraryManager && (
                            <button
                                className={styles.setupButton}
                                onClick={onOpenLibraryManager}
                                style={{ marginTop: 8 }}
                            >
                                {t('audio.openLibraryManager', 'Open Library Manager')}
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Tags Section */}
                        <div className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionIcon}>🏷️</span>
                                {t('audio.tags', 'Tags')}
                            </div>
                            <div className={styles.tagList}>
                                {filteredTags.map(({ name, tracks }) => (
                                    <div key={name}>
                                        <div 
                                            className={`${styles.tagItem} ${expandedTags.has(name) ? styles.expanded : ''}`}
                                        >
                                            <button
                                                className={`${styles.expandButton} ${expandedTags.has(name) ? styles.expanded : ''}`}
                                                onClick={() => toggleTagExpanded(name)}
                                            >
                                                ▶
                                            </button>
                                            <span 
                                                className={styles.tagName}
                                                onClick={() => toggleTagExpanded(name)}
                                            >
                                                {name}
                                            </span>
                                            <span className={styles.trackCount}>
                                                {t('audio.trackCount', '{{count}} tracks', { count: tracks.length })}
                                            </span>
                                            <button
                                                className={styles.playButton}
                                                onClick={() => playTag(name)}
                                                title={t('audio.shufflePlay', 'Shuffle Play')}
                                            >
                                                ▶
                                            </button>
                                        </div>
                                        {expandedTags.has(name) && (
                                            <div className={styles.trackList}>
                                                {tracks.map(track => (
                                                    <div
                                                        key={track.id}
                                                        className={`${styles.trackItem} ${isTrackPlaying(track) ? styles.playing : ''}`}
                                                        onClick={() => playTrack(track)}
                                                    >
                                                        {isTrackPlaying(track) && (
                                                            <span className={styles.nowPlayingIndicator}>🎵 </span>
                                                        )}
                                                        <span className={styles.trackName}>
                                                            {track.displayName || track.filename}
                                                        </span>
                                                        <button
                                                            className={styles.trackPlayButton}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                playTrack(track);
                                                            }}
                                                        >
                                                            ▶
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {filteredTags.length === 0 && (
                                    <div className={styles.emptyState}>
                                        <p className={styles.emptyText}>
                                            {searchTerm 
                                                ? t('audio.noMatchingTags', 'No matching tags found')
                                                : t('audio.noTags', 'No tags yet. Add tags to your tracks in the Library Manager.')
                                            }
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Playlists Section */}
                        <div className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionIcon}>📋</span>
                                {t('audio.playlists', 'Playlists')}
                            </div>
                            <div className={styles.playlistList}>
                                {filteredPlaylists.map(playlist => {
                                    const tracks = getPlaylistTracks(playlist.id);
                                    return (
                                        <div key={playlist.id}>
                                            <div 
                                                className={`${styles.playlistItem} ${expandedPlaylists.has(playlist.id) ? styles.expanded : ''}`}
                                            >
                                                <button
                                                    className={`${styles.expandButton} ${expandedPlaylists.has(playlist.id) ? styles.expanded : ''}`}
                                                    onClick={() => togglePlaylistExpanded(playlist.id)}
                                                >
                                                    ▶
                                                </button>
                                                <span 
                                                    className={styles.playlistName}
                                                    onClick={() => togglePlaylistExpanded(playlist.id)}
                                                >
                                                    {playlist.name}
                                                </span>
                                                <span className={styles.trackCount}>
                                                    {t('audio.trackCount', '{{count}} tracks', { count: tracks.length })}
                                                </span>
                                                <button
                                                    className={styles.playButton}
                                                    onClick={() => playPlaylist(playlist.id)}
                                                    title={t('audio.playAll', 'Play All')}
                                                    disabled={tracks.length === 0}
                                                >
                                                    ▶
                                                </button>
                                            </div>
                                            {expandedPlaylists.has(playlist.id) && (
                                                <div className={styles.trackList}>
                                                    {tracks.map((track, index) => (
                                                        <div
                                                            key={track.id}
                                                            className={`${styles.trackItem} ${isTrackPlaying(track) ? styles.playing : ''}`}
                                                            onClick={() => playTrack(track)}
                                                        >
                                                            {isTrackPlaying(track) ? (
                                                                <span className={styles.nowPlayingIndicator}>🎵 </span>
                                                            ) : (
                                                                <span style={{ opacity: 0.5, marginRight: 4 }}>{index + 1}.</span>
                                                            )}
                                                            <span className={styles.trackName}>
                                                                {track.displayName || track.filename}
                                                            </span>
                                                            <button
                                                                className={styles.trackPlayButton}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    playTrack(track);
                                                                }}
                                                            >
                                                                ▶
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {tracks.length === 0 && (
                                                        <div className={styles.emptyState}>
                                                            <p className={styles.emptyText}>
                                                                {t('audio.emptyPlaylist', 'This playlist is empty')}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {filteredPlaylists.length === 0 && (
                                    <div className={styles.emptyState}>
                                        <p className={styles.emptyText}>
                                            {searchTerm 
                                                ? t('audio.noMatchingPlaylists', 'No matching playlists found')
                                                : t('audio.noPlaylists', 'No playlists yet. Create playlists in the Library Manager.')
                                            }
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Audio Controls - Sticky Footer */}
            <div className={styles.controlsContainer}>
                <AudioControls />
            </div>
        </div>
    );
};

export default AudioSidebar;
