import React, { useState } from 'react';
import { Character, KnowledgeEntry, CharacterLore, User } from '@wfrp/shared';
import styles from './SecretsManager.module.css';

interface SecretsManagerProps {
    character: Character;
    users: User[];
    onCharacterUpdate: (updates: Partial<Character>) => void;
}

const defaultLore: CharacterLore = {
    gmNotes: '',
    background: [],
    playerNotes: ''
};

const TOPIC_PRESETS = [
    'Origin',
    'Secret Agenda',
    'Weakness',
    'Hidden Ally',
    'Dark Secret',
    'True Identity',
    'Motivation',
    'Fear',
    'Goal',
    'Connection',
    'Custom'
];

export const SecretsManager: React.FC<SecretsManagerProps> = ({
    character,
    users,
    onCharacterUpdate
}) => {
    const lore = character.lore || defaultLore;
    const [newEntryTopic, setNewEntryTopic] = useState('');
    const [newEntryContent, setNewEntryContent] = useState('');
    const [customTopic, setCustomTopic] = useState('');
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');

    // Get users who have assigned characters (potential players to share with)
    const playersWithCharacters = users.filter(u => u.characterId !== null);

    const handleGmNotesChange = (value: string) => {
        onCharacterUpdate({
            lore: {
                ...lore,
                gmNotes: value
            }
        });
    };

    const handleAddEntry = () => {
        const topic = newEntryTopic === 'Custom' ? customTopic : newEntryTopic;
        if (!topic.trim() || !newEntryContent.trim()) return;

        const newEntry: KnowledgeEntry = {
            id: `knowledge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            topic: topic.trim(),
            content: newEntryContent.trim(),
            visibility: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        onCharacterUpdate({
            lore: {
                ...lore,
                background: [...lore.background, newEntry]
            }
        });

        setNewEntryTopic('');
        setNewEntryContent('');
        setCustomTopic('');
    };

    const handleDeleteEntry = (entryId: string) => {
        onCharacterUpdate({
            lore: {
                ...lore,
                background: lore.background.filter(e => e.id !== entryId)
            }
        });
    };

    const handleToggleVisibility = (entryId: string, userId: string) => {
        const entry = lore.background.find(e => e.id === entryId);
        if (!entry) return;

        const isVisible = entry.visibility.includes(userId);
        const newVisibility = isVisible
            ? entry.visibility.filter(id => id !== userId)
            : [...entry.visibility, userId];

        const updatedBackground = lore.background.map(e =>
            e.id === entryId
                ? { ...e, visibility: newVisibility, updatedAt: new Date().toISOString() }
                : e
        );

        onCharacterUpdate({
            lore: {
                ...lore,
                background: updatedBackground
            }
        });
    };

    const handleShareWithAll = (entryId: string) => {
        const allPlayerIds = playersWithCharacters.map(u => u.id);
        const updatedBackground = lore.background.map(e =>
            e.id === entryId
                ? { ...e, visibility: allPlayerIds, updatedAt: new Date().toISOString() }
                : e
        );

        onCharacterUpdate({
            lore: {
                ...lore,
                background: updatedBackground
            }
        });
    };

    const handleMakePrivate = (entryId: string) => {
        const updatedBackground = lore.background.map(e =>
            e.id === entryId
                ? { ...e, visibility: [], updatedAt: new Date().toISOString() }
                : e
        );

        onCharacterUpdate({
            lore: {
                ...lore,
                background: updatedBackground
            }
        });
    };

    const startEditing = (entry: KnowledgeEntry) => {
        setEditingEntryId(entry.id);
        setEditContent(entry.content);
    };

    const saveEdit = (entryId: string) => {
        const updatedBackground = lore.background.map(e =>
            e.id === entryId
                ? { ...e, content: editContent, updatedAt: new Date().toISOString() }
                : e
        );

        onCharacterUpdate({
            lore: {
                ...lore,
                background: updatedBackground
            }
        });

        setEditingEntryId(null);
        setEditContent('');
    };

    const cancelEdit = () => {
        setEditingEntryId(null);
        setEditContent('');
    };

    const getVisibilityLabel = (entry: KnowledgeEntry): string => {
        if (entry.visibility.length === 0) return 'GM Only';
        if (entry.visibility.length === playersWithCharacters.length && playersWithCharacters.length > 0) {
            return 'All Players';
        }
        const visibleUsers = playersWithCharacters.filter(u => entry.visibility.includes(u.id));
        return visibleUsers.map(u => u.username).join(', ');
    };

    return (
        <div className={styles.secretsManager}>
            {/* GM Private Notes */}
            <div className={styles.section}>
                <h4 className={styles.sectionTitle}>
                    <span className={styles.lockIcon}>🔒</span>
                    GM Notes (Private)
                </h4>
                <textarea
                    className={styles.gmNotesTextarea}
                    value={lore.gmNotes}
                    onChange={(e) => handleGmNotesChange(e.target.value)}
                    placeholder="Private notes about this character that only you can see..."
                    rows={4}
                />
            </div>

            {/* Knowledge Entries */}
            <div className={styles.section}>
                <h4 className={styles.sectionTitle}>
                    <span className={styles.bookIcon}>📖</span>
                    Knowledge & Secrets
                </h4>

                {/* Add New Entry Form */}
                <div className={styles.addEntryForm}>
                    <div className={styles.formRow}>
                        <select
                            className={styles.topicSelect}
                            value={newEntryTopic}
                            onChange={(e) => setNewEntryTopic(e.target.value)}
                        >
                            <option value="">Select topic...</option>
                            {TOPIC_PRESETS.map(topic => (
                                <option key={topic} value={topic}>{topic}</option>
                            ))}
                        </select>
                        {newEntryTopic === 'Custom' && (
                            <input
                                type="text"
                                className={styles.customTopicInput}
                                value={customTopic}
                                onChange={(e) => setCustomTopic(e.target.value)}
                                placeholder="Enter custom topic..."
                            />
                        )}
                    </div>
                    <textarea
                        className={styles.entryContentInput}
                        value={newEntryContent}
                        onChange={(e) => setNewEntryContent(e.target.value)}
                        placeholder="Enter the secret or knowledge content..."
                        rows={3}
                    />
                    <button
                        className={styles.addButton}
                        onClick={handleAddEntry}
                        disabled={!newEntryTopic || !newEntryContent.trim() || (newEntryTopic === 'Custom' && !customTopic.trim())}
                    >
                        + Add Entry
                    </button>
                </div>

                {/* Entries List */}
                <div className={styles.entriesList}>
                    {lore.background.length === 0 ? (
                        <p className={styles.emptyMessage}>No knowledge entries yet. Add secrets, background info, or discoverable lore above.</p>
                    ) : (
                        lore.background.map(entry => (
                            <div key={entry.id} className={styles.entryCard}>
                                <div className={styles.entryHeader}>
                                    <span className={styles.entryTopic}>{entry.topic}</span>
                                    <span className={`${styles.visibilityBadge} ${entry.visibility.length === 0 ? styles.private : styles.shared}`}>
                                        {getVisibilityLabel(entry)}
                                    </span>
                                </div>

                                {editingEntryId === entry.id ? (
                                    <div className={styles.editMode}>
                                        <textarea
                                            className={styles.editTextarea}
                                            value={editContent}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            rows={3}
                                        />
                                        <div className={styles.editActions}>
                                            <button className={styles.saveBtn} onClick={() => saveEdit(entry.id)}>Save</button>
                                            <button className={styles.cancelBtn} onClick={cancelEdit}>Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className={styles.entryContent}>{entry.content}</p>
                                )}

                                {/* Visibility Controls */}
                                <div className={styles.visibilityControls}>
                                    <span className={styles.shareLabel}>Share with:</span>
                                    <div className={styles.playerCheckboxes}>
                                        {playersWithCharacters.length === 0 ? (
                                            <span className={styles.noPlayers}>No players connected</span>
                                        ) : (
                                            playersWithCharacters.map(user => (
                                                <label key={user.id} className={styles.playerCheckbox}>
                                                    <input
                                                        type="checkbox"
                                                        checked={entry.visibility.includes(user.id)}
                                                        onChange={() => handleToggleVisibility(entry.id, user.id)}
                                                    />
                                                    {user.username}
                                                </label>
                                            ))
                                        )}
                                    </div>
                                    <div className={styles.quickActions}>
                                        <button
                                            className={styles.quickBtn}
                                            onClick={() => handleShareWithAll(entry.id)}
                                            disabled={playersWithCharacters.length === 0}
                                            title="Share with all players"
                                        >
                                            👥 All
                                        </button>
                                        <button
                                            className={styles.quickBtn}
                                            onClick={() => handleMakePrivate(entry.id)}
                                            title="Make private (GM only)"
                                        >
                                            🔒 Private
                                        </button>
                                    </div>
                                </div>

                                {/* Entry Actions */}
                                <div className={styles.entryActions}>
                                    <button
                                        className={styles.editBtn}
                                        onClick={() => startEditing(entry)}
                                        disabled={editingEntryId === entry.id}
                                    >
                                        ✏️ Edit
                                    </button>
                                    <button
                                        className={styles.deleteBtn}
                                        onClick={() => handleDeleteEntry(entry.id)}
                                    >
                                        🗑️ Delete
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Player's Own Notes (if this is a player character) */}
            {character.userId && (
                <div className={styles.section}>
                    <h4 className={styles.sectionTitle}>
                        <span className={styles.noteIcon}>📝</span>
                        Player's Notes
                    </h4>
                    <div className={styles.playerNotesDisplay}>
                        {lore.playerNotes ? (
                            <p className={styles.playerNotesContent}>{lore.playerNotes}</p>
                        ) : (
                            <p className={styles.emptyMessage}>The player hasn't written any personal notes yet.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SecretsManager;
