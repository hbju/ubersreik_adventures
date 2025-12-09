import React from 'react';
import { Character, EditableField } from '@wfrp/shared';
import './NotesTab.css';

interface NotesTabProps {
    character: Character;
    isEditMode: boolean;
    onCharacterUpdate: (updates: Partial<Character>) => void;
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
    onCharacterUpdate
}) => {
    const characterDetails = character.details || defaultDetails;

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
        </div>
    );
};

export default NotesTab;
