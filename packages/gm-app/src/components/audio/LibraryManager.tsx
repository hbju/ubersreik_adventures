import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAudio } from '../../context/AudioContext';
import { AudioTrack, Playlist } from '@wfrp/shared';
import styles from './LibraryManager.module.css';

interface LibraryManagerProps {
    onClose: () => void;
}

export const LibraryManager: React.FC<LibraryManagerProps> = ({ onClose }) => {
    const { t } = useTranslation();
    const {
        library,
        isLoading,
        scanDirectory,
        getAllTags,
        updateTrackTags,
        bulkUpdateTrackTags,
        deleteTrack,
        createPlaylist,
        updatePlaylist,
        deletePlaylist,
        playTrack,
    } = useAudio();

    // State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
    const [playlistId, setPlaylistId] = useState<string | null>(null);
    const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
    const [showTagModal, setShowTagModal] = useState(false);
    const [showPlaylistModal, setShowPlaylistModal] = useState<'create' | 'edit' | null>(null);
    const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
    const [tagInput, setTagInput] = useState('');
    const [newTags, setNewTags] = useState<string[]>([]);
    const [playlistName, setPlaylistName] = useState('');

    // Computed values
    const allTags = useMemo(() => getAllTags(), [getAllTags]);

    const tagCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const track of library.tracks) {
            for (const tag of track.tags) {
                counts[tag] = (counts[tag] || 0) + 1;
            }
        }
        return counts;
    }, [library.tracks]);

    // Filter tracks
    const filteredTracks = useMemo(() => {
        let tracks = library.tracks;

        // Filter by selected playlist
        if (selectedPlaylistId) {
            const playlist = library.playlists.find(p => p.id === selectedPlaylistId);
            if (playlist) {
                const playlistTrackIds = new Set(playlist.trackIds);
                tracks = tracks.filter(t => playlistTrackIds.has(t.id));
            }
        }

        // Filter by selected tags
        if (selectedTags.length > 0) {
            tracks = tracks.filter(t =>
                selectedTags.some(tag => t.tags.includes(tag))
            );
        }

        // Filter by search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            tracks = tracks.filter(t =>
                t.filename.toLowerCase().includes(term) ||
                t.displayName?.toLowerCase().includes(term) ||
                t.path.toLowerCase().includes(term) ||
                t.tags.some(tag => tag.toLowerCase().includes(term))
            );
        }
        tracks = tracks.sort((a, b) => {
            const nameA = a.displayName || a.filename;
            const nameB = b.displayName || b.filename;
            return nameA.localeCompare(nameB);
        }
        );

        return tracks;
    }, [library.tracks, library.playlists, selectedPlaylistId, selectedTags, searchTerm]);

    // Handlers
    const handleRescan = useCallback(async () => {
        if (library.rootPath) {
            await scanDirectory(library.rootPath);
        } else {
            await scanDirectory();
        }
    }, [library.rootPath, scanDirectory]);

    const handleSelectAll = useCallback(() => {
        if (selectedTrackIds.size === filteredTracks.length) {
            setSelectedTrackIds(new Set());
        } else {
            setSelectedTrackIds(new Set(filteredTracks.map(t => t.id)));
        }
    }, [filteredTracks, selectedTrackIds.size]);

    const handleToggleTrackSelection = useCallback((trackId: string) => {
        setSelectedTrackIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(trackId)) {
                newSet.delete(trackId);
            } else {
                newSet.add(trackId);
            }
            return newSet;
        });
    }, []);

    const handleToggleTagFilter = useCallback((tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag)
                ? prev.filter(t => t !== tag)
                : [...prev, tag]
        );
    }, []);

    const handleAddTag = useCallback(() => {
        if (tagInput.trim() && !newTags.includes(tagInput.trim())) {
            setNewTags(prev => [...prev, tagInput.trim()]);
            setTagInput('');
        }
    }, [tagInput, newTags]);

    const handleRemoveNewTag = useCallback((tag: string) => {
        setNewTags(prev => prev.filter(t => t !== tag));
    }, []);

    const handleApplyTags = useCallback(async () => {
        if (selectedTrackIds.size === 0 || newTags.length === 0) return;
        let tagsToRemove: string[] = [];
        if (selectedTrackIds.size === 1) {
            const trackId = Array.from(selectedTrackIds)[0];
            const track = library.tracks.find(t => t.id === trackId);
            if (track) {
                tagsToRemove = track.tags.filter(tag => !newTags.includes(tag));
            }
        }
        await bulkUpdateTrackTags(Array.from(selectedTrackIds), newTags, tagsToRemove);
        setShowTagModal(false);
        setNewTags([]);
        setSelectedTrackIds(new Set());
    }, [selectedTrackIds, newTags, bulkUpdateTrackTags]);

    const handleCreatePlaylist = useCallback(async () => {
        if (!playlistName.trim()) return;
        await createPlaylist(playlistName.trim(), Array.from(selectedTrackIds));
        setShowPlaylistModal(null);
        setPlaylistName('');
        setSelectedTrackIds(new Set());
    }, [playlistName, selectedTrackIds, createPlaylist]);

    const handleUpdatePlaylist = useCallback(async () => {
        if (!editingPlaylist || !playlistName.trim()) return;
        await updatePlaylist({ ...editingPlaylist, name: playlistName.trim() });
        setShowPlaylistModal(null);
        setEditingPlaylist(null);
        setPlaylistName('');
    }, [editingPlaylist, playlistName, updatePlaylist]);

    const handleDeletePlaylist = useCallback(async (playlistId: string) => {
        if (window.confirm(t('audio.confirmDeletePlaylist', 'Are you sure you want to delete this playlist?'))) {
            await deletePlaylist(playlistId);
            if (selectedPlaylistId === playlistId) {
                setSelectedPlaylistId(null);
            }
        }
    }, [deletePlaylist, selectedPlaylistId, t]);

    const handleAddToPlaylist = useCallback(async (playlistId: string) => {
        const playlist = library.playlists.find(p => p.id === playlistId);
        if (!playlist) return;

        const newTrackIds = Array.from(selectedTrackIds).filter(
            id => !playlist.trackIds.includes(id)
        );

        await updatePlaylist({
            ...playlist,
            trackIds: [...playlist.trackIds, ...newTrackIds],
        });

        setSelectedTrackIds(new Set());
    }, [library.playlists, selectedTrackIds, updatePlaylist]);

    const handleRemoveFromPlaylist = useCallback(async (trackId: string) => {
        if (!selectedPlaylistId) return;
        const playlist = library.playlists.find(p => p.id === selectedPlaylistId);
        if (!playlist) return;

        await updatePlaylist({
            ...playlist,
            trackIds: playlist.trackIds.filter(id => id !== trackId),
        });
    }, [selectedPlaylistId, library.playlists, updatePlaylist]);

    const handleDeleteTrack = useCallback(async (trackId: string) => {
        if (window.confirm(t('audio.confirmDeleteTrack', 'Remove this track from the library? (The file will not be deleted)'))) {
            await deleteTrack(trackId);
        }
    }, [deleteTrack, t]);

    const openEditPlaylist = useCallback((playlist: Playlist) => {
        setEditingPlaylist(playlist);
        setPlaylistName(playlist.name);
        setShowPlaylistModal('edit');
    }, []);

    return (
        <div className={styles.libraryManager}>
            <div className={styles.modal}>
                {/* Header */}
                <div className={styles.header}>
                    <h2 className={styles.title}>
                        🎵 {t('audio.libraryManager', 'Music Library')}
                    </h2>
                    <div className={styles.headerActions}>
                        <button
                            className={styles.actionButton}
                            onClick={handleRescan}
                            disabled={isLoading}
                        >
                            🔄
                        </button>
                        <button
                            className={`${styles.actionButton} ${styles.primary}`}
                            onClick={() => scanDirectory()}
                            disabled={isLoading}
                        >
                            📁
                        </button>
                        <button
                            className={styles.closeButton}
                            onClick={onClose}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className={styles.content}>
                    {/* Sidebar */}
                    <div className={styles.sidebar}>
                        {/* Tag Filters */}
                        <div className={styles.sidebarSection}>
                            <div className={styles.sidebarHeader}>
                                {t('audio.filterByTag', 'Filter by Tag')}
                            </div>
                            <div className={styles.filterGroup}>
                                {allTags.map(tag => (
                                    <div
                                        key={tag}
                                        className={`${styles.filterItem} ${selectedTags.includes(tag) ? styles.selected : ''}`}
                                        onClick={() => handleToggleTagFilter(tag)}
                                    >
                                        <input
                                            type="checkbox"
                                            className={styles.filterCheckbox}
                                            checked={selectedTags.includes(tag)}
                                            onChange={() => { }}
                                        />
                                        <span className={styles.filterLabel}>{tag}</span>
                                        <span className={styles.filterCount}>
                                            {tagCounts[tag] || 0}
                                        </span>
                                    </div>
                                ))}
                                {allTags.length === 0 && (
                                    <div style={{ color: '#666', fontSize: 12, padding: 8 }}>
                                        {t('audio.noTagsYet', 'No tags yet')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className={styles.mainContent}>
                        {/* Toolbar */}
                        <div className={styles.toolbar}>
                            <input
                                type="text"
                                className={styles.searchInput}
                                placeholder={t('audio.searchTracks', 'Search tracks...')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <div className={styles.bulkActions}>
                                <button
                                    className={styles.bulkButton}
                                    disabled={selectedTrackIds.size === 0}
                                    onClick={() => {
                                        setNewTags([]);
                                        if (selectedTrackIds.size === 1) {
                                            const trackId = Array.from(selectedTrackIds)[0];
                                            const track = library.tracks.find(t => t.id === trackId);
                                            if (track) {
                                                setNewTags(track.tags);
                                            }
                                        }
                                        setTagInput('');
                                        setShowTagModal(true);
                                    }}
                                >
                                    🏷️ {t('audio.addTags', 'Add Tags')}
                                </button>
                                <select
                                    className={styles.playlistSelect}
                                    value={playlistId || ''}
                                    onChange={(e) => setPlaylistId(e.target.value || null)}
                                >
                                    <option value="">{t('audio.selectPlaylist', 'Select Playlist')}</option>
                                    {library.playlists.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                                <button
                                    className={styles.bulkButton}
                                    disabled={selectedTrackIds.size === 0 || playlistId === null}
                                    onClick={() => {
                                        if (playlistId) handleAddToPlaylist(playlistId);
                                    }}
                                >
                                    ➕ {t('audio.addToPlaylist', 'Add to Playlist')}
                                </button>
                            </div>
                        </div>

                        {/* Track Table */}
                        <div className={styles.tableContainer}>
                            {library.tracks.length === 0 ? (
                                <div className={styles.emptyState}>
                                    <div className={styles.emptyIcon}>🎶</div>
                                    <div className={styles.emptyTitle}>
                                        {t('audio.noTracksTitle', 'No Music Files Found')}
                                    </div>
                                    <div className={styles.emptyText}>
                                        {t('audio.noTracksText', 'Click "Select Folder" to scan a directory for music files.')}
                                    </div>
                                    <button
                                        className={`${styles.actionButton} ${styles.primary}`}
                                        onClick={() => scanDirectory()}
                                    >
                                        📁 {t('audio.selectFolder', 'Select Folder')}
                                    </button>
                                </div>
                            ) : (
                                <table className={styles.trackTable}>
                                    <thead>
                                        <tr>
                                            <th className={styles.checkboxCell}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTrackIds.size === filteredTracks.length && filteredTracks.length > 0}
                                                    onChange={handleSelectAll}
                                                />
                                            </th>
                                            <th>{t('audio.name', 'Name')}</th>
                                            <th>{t('audio.tags', 'Tags')}</th>
                                            <th>{t('audio.path', 'Path')}</th>
                                            <th className={styles.actionsCell}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTracks.map(track => (
                                            <tr
                                                key={track.id}
                                                className={`
                                                    ${selectedTrackIds.has(track.id) ? styles.selected : ''}
                                                    ${track.isMissing ? styles.missing : ''}
                                                `}
                                            >
                                                <td className={styles.checkboxCell}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedTrackIds.has(track.id)}
                                                        onChange={() => handleToggleTrackSelection(track.id)}
                                                    />
                                                </td>
                                                <td className={styles.nameCell}>
                                                    {track.displayName || track.filename}
                                                    {track.isMissing && (
                                                        <span className={`${styles.statusBadge} ${styles.missing}`}>
                                                            {t('audio.missing', 'Missing')}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className={styles.tagsCell}>
                                                    {track.tags.map(tag => (
                                                        <span key={tag} className={styles.tag}>
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </td>
                                                <td className={styles.pathCell} title={track.path}>
                                                    {track.path}
                                                </td>
                                                <td className={styles.actionsCell}>
                                                    <div className={styles.rowActions}>
                                                        <button
                                                            className={styles.rowActionBtn}
                                                            onClick={() => playTrack(track)}
                                                            disabled={track.isMissing}
                                                            title={t('audio.play', 'Play')}
                                                        >
                                                            ▶
                                                        </button>
                                                        {selectedPlaylistId && (
                                                            <button
                                                                className={styles.rowActionBtn}
                                                                onClick={() => handleRemoveFromPlaylist(track.id)}
                                                                title={t('audio.removeFromPlaylist', 'Remove from playlist')}
                                                            >
                                                                ➖
                                                            </button>
                                                        )}
                                                        <button
                                                            className={styles.rowActionBtn}
                                                            onClick={() => handleDeleteTrack(track.id)}
                                                            title={t('audio.remove', 'Remove')}
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>



                        {/* Footer */}
                        <div className={styles.footer}>
                            <div className={styles.stats}>
                                {t('audio.libraryStats', '{{total}} tracks | {{selected}} selected', {
                                    total: library.tracks.length,
                                    selected: selectedTrackIds.size,
                                })}
                                {library.rootPath && (
                                    <span style={{ marginLeft: 16, color: '#666' }}>
                                        📁 {library.rootPath}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className={styles.sidebar}>

                        {/* Playlists */}
                        <div className={styles.playlistSection}>
                            <div className={styles.sidebarSection}>
                                <div className={styles.sidebarHeader}>
                                    {t('audio.playlists', 'Playlists')}
                                </div>
                            </div>
                            <div
                                className={`${styles.playlistItem} ${!selectedPlaylistId ? styles.selected : ''}`}
                                onClick={() => setSelectedPlaylistId(null)}
                            >
                                <span className={styles.playlistIcon}>📚</span>
                                <span className={styles.playlistName}>
                                    {t('audio.allTracks', 'All Tracks')}
                                </span>
                            </div>
                            {library.playlists.map(playlist => (
                                <div
                                    key={playlist.id}
                                    className={`${styles.playlistItem} ${selectedPlaylistId === playlist.id ? styles.selected : ''}`}
                                    onClick={() => setSelectedPlaylistId(playlist.id)}
                                >
                                    <span className={styles.playlistIcon}>📋</span>
                                    <span className={styles.playlistName}>{playlist.name}</span>
                                    <div className={styles.playlistActions}>
                                        <button
                                            className={styles.playlistActionBtn}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openEditPlaylist(playlist);
                                            }}
                                            title={t('audio.editPlaylist', 'Edit')}
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className={styles.playlistActionBtn}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeletePlaylist(playlist.id);
                                            }}
                                            title={t('audio.deletePlaylist', 'Delete')}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <button
                                className={styles.newPlaylistBtn}
                                onClick={() => {
                                    setPlaylistName('');
                                    setShowPlaylistModal('create');
                                }}
                            >
                                + {t('audio.newPlaylist', 'New Playlist')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Loading Overlay */}
                {isLoading && (
                    <div className={styles.loadingOverlay}>
                        <div className={styles.spinner}></div>
                        <div className={styles.loadingText}>
                            {t('audio.scanning', 'Scanning...')}
                        </div>
                    </div>
                )}
            </div>

            {/* Add Tags Modal */}
            {showTagModal && (
                <div className={styles.tagModal} onClick={() => setShowTagModal(false)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <h3 className={styles.modalTitle}>
                            {t('audio.addTagsTo', 'Add Tags to {{count}} Tracks', { count: selectedTrackIds.size })}
                        </h3>
                        <div className={styles.modalBody}>
                            <div className={styles.inputGroup}>
                                <label className={styles.inputLabel}>
                                    {t('audio.enterTag', 'Enter tag name')}
                                </label>
                                <input
                                    type="text"
                                    className={styles.textInput}
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddTag();
                                        }
                                    }}
                                    placeholder={t('audio.tagPlaceholder', 'e.g., Combat, Tavern, Epic...')}
                                />
                            </div>
                            <div className={styles.tagInputContainer}>
                                {newTags.map(tag => (
                                    <div key={tag} className={styles.tagChip}>
                                        {tag}
                                        <button onClick={() => handleRemoveNewTag(tag)}>×</button>
                                    </div>
                                ))}
                            </div>
                            {allTags.length > 0 && (
                                <div className={styles.tagSuggestions}>
                                    {allTags.filter(t => !newTags.includes(t)).map(tag => (
                                        <button
                                            key={tag}
                                            className={styles.tagSuggestion}
                                            onClick={() => setNewTags(prev => [...prev, tag])}
                                        >
                                            + {tag}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className={styles.modalActions}>
                            <button
                                className={`${styles.modalButton} ${styles.cancel}`}
                                onClick={() => setShowTagModal(false)}
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                className={`${styles.modalButton} ${styles.confirm}`}
                                onClick={handleApplyTags}
                                disabled={newTags.length === 0}
                            >
                                {t('audio.applyTags', 'Apply Tags')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Playlist Modal */}
            {showPlaylistModal && (
                <div className={styles.playlistModal} onClick={() => setShowPlaylistModal(null)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <h3 className={styles.modalTitle}>
                            {showPlaylistModal === 'create'
                                ? t('audio.createPlaylist', 'Create Playlist')
                                : t('audio.editPlaylist', 'Edit Playlist')
                            }
                        </h3>
                        <div className={styles.modalBody}>
                            <div className={styles.inputGroup}>
                                <label className={styles.inputLabel}>
                                    {t('audio.playlistName', 'Playlist Name')}
                                </label>
                                <input
                                    type="text"
                                    className={styles.textInput}
                                    value={playlistName}
                                    onChange={(e) => setPlaylistName(e.target.value)}
                                    placeholder={t('audio.playlistNamePlaceholder', 'e.g., Boss Fight, Session Intro...')}
                                    autoFocus
                                />
                            </div>
                            {showPlaylistModal === 'create' && selectedTrackIds.size > 0 && (
                                <div style={{ fontSize: 12, color: '#888' }}>
                                    {t('audio.willAddTracks', '{{count}} tracks will be added to this playlist', {
                                        count: selectedTrackIds.size,
                                    })}
                                </div>
                            )}
                        </div>
                        <div className={styles.modalActions}>
                            <button
                                className={`${styles.modalButton} ${styles.cancel}`}
                                onClick={() => {
                                    setShowPlaylistModal(null);
                                    setEditingPlaylist(null);
                                }}
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                className={`${styles.modalButton} ${styles.confirm}`}
                                onClick={showPlaylistModal === 'create' ? handleCreatePlaylist : handleUpdatePlaylist}
                                disabled={!playlistName.trim()}
                            >
                                {showPlaylistModal === 'create'
                                    ? t('audio.create', 'Create')
                                    : t('audio.save', 'Save')
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LibraryManager;
