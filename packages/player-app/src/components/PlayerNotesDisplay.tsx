import React from 'react';
import { Character, KnowledgeEntry, CharacterLore } from '@wfrp/shared';
import styles from './PlayerNotesDisplay.module.css';

interface PlayerNotesDisplayProps {
    character: Character;
    currentUserId: string;
    onCharacterUpdate: (updates: Partial<Character>) => void;
}

const defaultLore: CharacterLore = {
    gmNotes: '',
    background: [],
    playerNotes: ''
};

export const PlayerNotesDisplay: React.FC<PlayerNotesDisplayProps> = ({
    character,
    currentUserId,
    onCharacterUpdate
}) => {
    const lore = character.lore || defaultLore;

    // Filter knowledge entries to only show those visible to this player
    const visibleEntries = lore.background.filter(entry =>
        entry.visibility.includes(currentUserId)
    );

    const handlePlayerNotesChange = (value: string) => {
        onCharacterUpdate({
            lore: {
                ...lore,
                playerNotes: value
            }
        });
    };

    // Group entries by topic for better organization
    const entriesByTopic = visibleEntries.reduce((acc, entry) => {
        if (!acc[entry.topic]) {
            acc[entry.topic] = [];
        }
        acc[entry.topic].push(entry);
        return acc;
    }, {} as Record<string, KnowledgeEntry[]>);

    const topicOrder = Object.keys(entriesByTopic).sort();

    return (
        <div className={styles.playerNotesDisplay}>
            {/* Player's Own Notes */}
            <div className={styles.section}>
                <h4 className={styles.sectionTitle}>
                    <span className={styles.noteIcon}>📝</span>
                    My Notes
                </h4>
                <p className={styles.sectionDescription}>
                    Write your own notes, theories, and reminders here. Only you and the GM can see this.
                </p>
                <textarea
                    className={styles.notesTextarea}
                    value={lore.playerNotes || ''}
                    onChange={(e) => handlePlayerNotesChange(e.target.value)}
                    placeholder="Write your personal notes, theories about the campaign, NPC observations, or anything else you want to remember..."
                    rows={6}
                />
            </div>

            {/* Discovered Knowledge */}
            <div className={styles.section}>
                <h4 className={styles.sectionTitle}>
                    <span className={styles.bookIcon}>📖</span>
                    Discovered Lore
                </h4>
                {visibleEntries.length === 0 ? (
                    <p className={styles.emptyMessage}>
                        You haven't discovered any special knowledge about this character yet.
                        Explore, investigate, and interact with NPCs to uncover secrets!
                    </p>
                ) : (
                    <div className={styles.knowledgeList}>
                        {topicOrder.map(topic => (
                            <div key={topic} className={styles.topicGroup}>
                                <h5 className={styles.topicTitle}>{topic}</h5>
                                <div className={styles.entriesContainer}>
                                    {entriesByTopic[topic].map(entry => (
                                        <div key={entry.id} className={styles.knowledgeEntry}>
                                            <p className={styles.entryContent}>{entry.content}</p>
                                            <span className={styles.discoveredDate}>
                                                Discovered: {new Date(entry.updatedAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlayerNotesDisplay;
