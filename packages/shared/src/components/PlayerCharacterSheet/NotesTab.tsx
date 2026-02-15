import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Character, EditableField, User, CharacterLore, KnowledgeEntry, useDebouncedCallback, useGameData } from '@wfrp/shared';
import './NotesTab.css';

interface NotesTabProps {
    character: Character;
    isEditMode: boolean;
    onCharacterUpdate: (updates: Partial<Character>) => void;
    // Optional secrets system props
    isGM?: boolean;
    users?: User[]; // For GM to select who to share with
    currentUserId?: string; // For player to see only their visible entries
    renderSecretsManager?: (props: {
        character: Character;
        users: User[];
        onCharacterUpdate: (updates: Partial<Character>) => void;
    }) => React.ReactNode; // Custom renderer for GM secrets manager
}

// Default details object for backwards compatibility
const defaultDetails = {
    age: '',
    height: '',
    hair: '',
    eyes: '',
    partyName: '',
    shortTermAmbition: '',
    longTermAmbition: '',
    partyShortTermAmbition: '',
    partyLongTermAmbition: ''
};

export const NotesTab: React.FC<NotesTabProps> = ({
    character,
    isEditMode,
    onCharacterUpdate,
    isGM = false,
    users = [],
    currentUserId,
    renderSecretsManager
}) => {
    const characterDetails = character.details || defaultDetails;
    const lore = character.lore || { gmNotes: '', background: [], playerNotes: '' };
    const motivations = useGameData().motivations;

    const handleDetailsUpdate = (field: keyof Character['details'], value: string) => {
        onCharacterUpdate({
            details: {
                ...characterDetails,
                [field]: value
            }
        });
    };

    return (
        <div className="notes-tab">
            {/* Personal Ambitions */}
            <div className="notes-panel ambitions-panel">
                <h3 className="panel-title">Personal Ambitions</h3>
                <div className="ambition-section">
                    <div className="ambition-item">
                        <label className="ambition-label">Short Term Ambition:</label>
                        <EditableField
                            value={characterDetails.shortTermAmbition || ''}
                            onChange={(val) => handleDetailsUpdate('shortTermAmbition', val as string)}
                            isEditing={isEditMode}
                            placeholder="What do you want to achieve soon?"
                            multiline={true}
                            rows={2}
                            className="ambition-value"
                        />
                    </div>
                    <div className="ambition-item">
                        <label className="ambition-label">Long Term Ambition:</label>
                        <EditableField
                            value={characterDetails.longTermAmbition || ''}
                            onChange={(val) => handleDetailsUpdate('longTermAmbition', val as string)}
                            isEditing={isEditMode}
                            placeholder="What is your ultimate goal?"
                            multiline={true}
                            rows={2}
                            className="ambition-value"
                        />
                    </div>
                </div>
            </div>

                        {/* Personal Motivations */}
            <div className="notes-panel motivations-panel">
                <div className="panel-title">Motivation</div>
                <select
                    className="motivation-select"
                    value={lore.motivationKey || ''}
                    onChange={e => onCharacterUpdate({ lore: { ...lore, motivationKey: e.target.value || undefined } })}
                >
                    <option value="">— Select Motivation —</option>
                    {motivations.sort((a, b) => a.name.localeCompare(b.name)).map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                </select>
                {lore.motivationKey && (
                    <div className="motivation-description">
                        "{motivations.find(m => m.id === lore.motivationKey)?.description}"
                    </div>
                )}
            </div>

            {/* Party Information */}
            <div className="notes-panel party-panel">
                <h3 className="panel-title">Party</h3>
                <div className="party-section">
                    <div className="party-item">
                        <label className="party-label">Party Name:</label>
                        <EditableField
                            value={characterDetails.partyName || ''}
                            onChange={(val) => handleDetailsUpdate('partyName', val as string)}
                            isEditing={isEditMode}
                            placeholder="Enter party name..."
                            className="party-value"
                        />
                    </div>
                    <div className="ambition-item">
                        <label className="ambition-label">Party Short Term Ambition:</label>
                        <EditableField
                            value={characterDetails.partyShortTermAmbition || ''}
                            onChange={(val) => handleDetailsUpdate('partyShortTermAmbition', val as string)}
                            isEditing={isEditMode}
                            placeholder="Party's short-term goal..."
                            multiline={true}
                            rows={2}
                            className="ambition-value"
                        />
                    </div>
                    <div className="ambition-item">
                        <label className="ambition-label">Party Long Term Ambition:</label>
                        <EditableField
                            value={characterDetails.partyLongTermAmbition || ''}
                            onChange={(val) => handleDetailsUpdate('partyLongTermAmbition', val as string)}
                            isEditing={isEditMode}
                            placeholder="Party's ultimate goal..."
                            multiline={true}
                            rows={2}
                            className="ambition-value"
                        />
                    </div>
                </div>
            </div>

            {/* Personal Details */}
            <div className="notes-panel details-panel">
                <h3 className="panel-title">Personal Details</h3>
                <div className="details-grid">
                    <div className="detail-row">
                        <label className="detail-label">Age:</label>
                        <EditableField
                            value={characterDetails.age || ''}
                            onChange={(val) => handleDetailsUpdate('age', val as string)}
                            isEditing={isEditMode}
                            placeholder="—"
                            className="detail-value"
                        />
                    </div>
                    <div className="detail-row">
                        <label className="detail-label">Height:</label>
                        <EditableField
                            value={characterDetails.height || ''}
                            onChange={(val) => handleDetailsUpdate('height', val as string)}
                            isEditing={isEditMode}
                            placeholder="—"
                            className="detail-value"
                        />
                    </div>
                    <div className="detail-row">
                        <label className="detail-label">Hair:</label>
                        <EditableField
                            value={characterDetails.hair || ''}
                            onChange={(val) => handleDetailsUpdate('hair', val as string)}
                            isEditing={isEditMode}
                            placeholder="—"
                            className="detail-value"
                        />
                    </div>
                    <div className="detail-row">
                        <label className="detail-label">Eyes:</label>
                        <EditableField
                            value={characterDetails.eyes || ''}
                            onChange={(val) => handleDetailsUpdate('eyes', val as string)}
                            isEditing={isEditMode}
                            placeholder="—"
                            className="detail-value"
                        />
                    </div>
                </div>
            </div>

            {/* Career History */}
            <div className="notes-panel history-panel">
                <h3 className="panel-title">Career History</h3>
                <div className="history-list">
                    {(!character.careerHistory || character.careerHistory.length === 0) ? (
                        <p className="empty-message">No career history recorded yet.</p>
                    ) : (
                        <table className="history-table">
                            <thead>
                                <tr>
                                    <th>Career</th>
                                    <th>Level</th>
                                    <th>Advancement</th>
                                    <th>XP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {character.careerHistory.slice(-10).reverse().map((entry, index) => (
                                    <tr key={index}>
                                        <td>{entry.careerName}</td>
                                        <td>{entry.levelName}</td>
                                        <td>{entry.advancementName}</td>
                                        <td>{entry.xpSpent}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* GM Secrets Manager - rendered via prop for app-specific component */}
            {isGM && renderSecretsManager && (
                <div className="notes-panel secrets-panel">
                    <h3 className="panel-title">🔒 Knowledge & Secrets</h3>
                    {renderSecretsManager({ character, users, onCharacterUpdate })}
                </div>
            )}

            {/* Player Notes - show their own notes and discovered knowledge */}
            {!isGM && currentUserId && (
                <PlayerLoreSection
                    character={character}
                    currentUserId={currentUserId}
                    onCharacterUpdate={onCharacterUpdate}
                />
            )}
        </div>
    );
};

/**
 * Player's view of lore - their own notes and discovered knowledge entries
 */
const PlayerLoreSection: React.FC<{
    character: Character;
    currentUserId: string;
    onCharacterUpdate: (updates: Partial<Character>) => void;
}> = ({ character, currentUserId, onCharacterUpdate }) => {
    const lore = character.lore || { gmNotes: '', background: [], playerNotes: '' };

    const [localNotes, setLocalNotes] = useState(lore.playerNotes || '');
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const debouncedSave = useDebouncedCallback((notes: string) => {
        onCharacterUpdate({
            lore: {
                ...lore,
                playerNotes: notes
            }
        });
    }, 300);

    // Filter knowledge entries to only show those visible to this player
    const visibleEntries = lore.background.filter(entry =>
        entry.visibility.includes(currentUserId)
    );

    // Group entries by topic
    const entriesByTopic = visibleEntries.reduce((acc, entry) => {
        if (!acc[entry.topic]) {
            acc[entry.topic] = [];
        }
        acc[entry.topic].push(entry);
        return acc;
    }, {} as Record<string, KnowledgeEntry[]>);

    const handlePlayerNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newNotes = e.target.value;
        setLocalNotes(newNotes);
        debouncedSave(newNotes);
    };

    return (
        <>
            {/* Player's Personal Notes */}
            <div className="notes-panel player-notes-panel">
                <h3 className="panel-title">📝 My Notes</h3>
                <p className="notes-description">
                    Write your own notes, theories, and reminders. Only you and the GM can see this.
                </p>
                <textarea
                    className="player-notes-textarea"
                    value={localNotes}
                    onChange={handlePlayerNotesChange}
                    placeholder="Write personal notes, theories, NPC observations..."
                    rows={6}
                />
            </div>

            {/* Discovered Knowledge */}
            {visibleEntries.length > 0 && (
                <div className="notes-panel discovered-lore-panel">
                    <h3 className="panel-title">📖 Discovered Lore</h3>
                    <div className="knowledge-list">
                        {Object.keys(entriesByTopic).sort().map(topic => (
                            <div key={topic} className="topic-group">
                                <h4 className="topic-title">{topic}</h4>
                                {entriesByTopic[topic].map(entry => (
                                    <div key={entry.id} className="knowledge-entry">
                                        <p className="knowledge-content">{entry.content}</p>
                                        <span className="discovered-date">
                                            Discovered: {new Date(entry.updatedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
};

export default NotesTab;
