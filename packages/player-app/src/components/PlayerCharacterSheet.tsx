import React, { useState } from 'react';
import {
    Character,
    Characteristic,
    Skill,
    Career,
    useGameData,
    EditableField,
    calculateCharacteristicValue
} from '@wfrp/shared';
import { getTalentCharacteristicBonus } from '@wfrp/shared';
import './PlayerCharacterSheet.css';
import { CharacteristicsTable } from './CharacteristicsTable';
import { SkillsPanel } from './SkillsPanel';
import { CombatTab } from './CombatTab';
import { InventoryTab } from './InventoryTab';
import { NotesTab } from './NotesTab';

export type TabType = 'main' | 'combat' | 'inventory' | 'notes';

interface PlayerCharacterSheetProps {
    character: Character;
    isEditMode: boolean;
    onEditModeToggle: () => void;
    onCharacterUpdate: (updates: Partial<Character>) => void;
    onSkillClick?: (skillId: string, skillName: string, skillValue: number) => void;
    onCharacteristicClick?: (charId: string, charName: string, charValue: number) => void;
    advancementMode?: boolean;
    onCharacteristicAdvance?: (charKey: keyof Character['characteristics']) => void;
    onSkillAdvance?: (skillId: string) => void;
    onPurchaseClick?: () => void;
    showPurchaseButton?: boolean;
}

const PlayerCharacterSheet: React.FC<PlayerCharacterSheetProps> = ({
    character,
    isEditMode,
    onEditModeToggle,
    onCharacterUpdate,
    onSkillClick,
    onCharacteristicClick,
    advancementMode = false,
    onCharacteristicAdvance,
    onSkillAdvance,
    onPurchaseClick,
    showPurchaseButton = false,
}) => {
    const { careers, talents } = useGameData();
    const [activeTab, setActiveTab] = useState<TabType>('main');

    const career = careers.find((c: Career) => c.id === character.currentCareerId);
    const careerLevel = career?.career_level.find(lvl => lvl.id === character.currentCareerLevelId);

    // Get species from character or derive from data
    const species = character.species || 'Human';
    const characterClass = character.class || career?.class || '';

    // Calculate movement based on species (default rules)
    const movement = character.movement || (species === 'Dwarf' || species === 'Halfling' ? 3 : 4);

    // Get status string (e.g., "Silver 3")
    const statusStr = careerLevel?.status || '';

    const handleFieldUpdate = (field: string, value: string | number) => {
        onCharacterUpdate({ [field]: value });
    };

    // Default details object for backwards compatibility with existing characters
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

    const characterDetails = character.details || defaultDetails;

    const handleDetailsUpdate = (field: keyof Character['details'], value: string) => {
        onCharacterUpdate({
            details: {
                ...characterDetails,
                [field]: value
            }
        });
    };

    const handleStatusUpdate = (statusKey: keyof Character['status'], value: number) => {
        onCharacterUpdate({
            status: {
                ...character.status,
                [statusKey]: {
                    ...character.status[statusKey],
                    current: Math.max(0, value)
                }
            }
        });
    };

    const handleCurrencyUpdate = (field: keyof Character['currency'], value: number) => {
        onCharacterUpdate({
            currency: {
                ...character.currency,
                [field]: Math.max(0, value)
            }
        });
    };

    return (
        <div className="player-sheet-container">
            {/* Fixed Header */}
            <header className="sheet-header">
                <div className="header-row header-row-main">
                    <div className="header-field">
                        <span className="header-label">Name:</span>
                        <EditableField
                            value={character.name}
                            onChange={(val) => handleFieldUpdate('name', val as string)}
                            isEditing={isEditMode}
                            className="header-value name-value"
                        />
                    </div>
                    <div className="header-field">
                        <span className="header-label">Species:</span>
                        <EditableField
                            value={species}
                            onChange={(val) => handleFieldUpdate('species', val as string)}
                            isEditing={isEditMode}
                            className="header-value"
                        />
                    </div>
                    <div className="header-field">
                        <span className="header-label">Class:</span>
                        <EditableField
                            value={characterClass}
                            onChange={(val) => handleFieldUpdate('class', val as string)}
                            isEditing={isEditMode}
                            className="header-value"
                        />
                    </div>
                </div>
                <div className="header-row">
                    <div className="header-field">
                        <span className="header-label">Career:</span>
                        <span className="header-value">{career?.name || '—'}</span>
                    </div>
                    <div className="header-field">
                        <span className="header-label">Level:</span>
                        <span className="header-value">{careerLevel?.name || '—'}</span>
                    </div>
                    <div className="header-field">
                        <span className="header-label">Status:</span>
                        <span className="header-value">{statusStr || '—'}</span>
                    </div>
                    <div className="header-field">
                        <span className="header-label">XP:</span>
                        <span className="header-value">{character.xp.current} / {character.xp.current + character.xp.spent}</span>
                    </div>
                    <div className="edit-toggle">
                        <label className="toggle-label">
                            Edit Mode
                            <input
                                type="checkbox"
                                checked={isEditMode}
                                onChange={onEditModeToggle}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </header>

            {/* Tab Navigation */}
            <nav className="sheet-tabs">
                <button
                    className={`tab-button ${activeTab === 'main' ? 'active' : ''}`}
                    onClick={() => setActiveTab('main')}
                >
                    Main
                </button>
                <button
                    className={`tab-button ${activeTab === 'combat' ? 'active' : ''}`}
                    onClick={() => setActiveTab('combat')}
                >
                    Combat
                </button>
                <button
                    className={`tab-button ${activeTab === 'inventory' ? 'active' : ''}`}
                    onClick={() => setActiveTab('inventory')}
                >
                    Inventory
                </button>
                <button
                    className={`tab-button ${activeTab === 'notes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('notes')}
                >
                    Notes
                </button>
            </nav>

            {/* Tab Content */}
            <div className="sheet-content">
                {activeTab === 'main' && (
                    <div className="main-tab">
                        <div className="main-tab-left">
                            <CharacteristicsTable
                                character={character}
                                isEditMode={isEditMode}
                                advancementMode={advancementMode}
                                onCharacterUpdate={onCharacterUpdate}
                                onCharacteristicClick={onCharacteristicClick}
                                onCharacteristicAdvance={onCharacteristicAdvance}
                            />

                            {/* Fate/Fortune/Resilience/Resolve Panel */}
                            <div className="status-box">
                                <div className="status-row">
                                    <div className="status-group">
                                        <span className="status-label">Resilience</span>
                                        <div className="status-values">
                                            <EditableField
                                                value={character.status.resilience.current}
                                                onChange={(val) => handleStatusUpdate('resilience', val as number)}
                                                isEditing={isEditMode}
                                                type="number"
                                                min={0}
                                            />
                                        </div>
                                    </div>
                                    <div className="status-group">
                                        <span className="status-label">Fate</span>
                                        <div className="status-values">
                                            <EditableField
                                                value={character.status.fate.current}
                                                onChange={(val) => handleStatusUpdate('fate', val as number)}
                                                isEditing={isEditMode}
                                                type="number"
                                                min={0}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="status-row">
                                    <div className="status-group">
                                        <span className="status-label">Resolve</span>
                                        <div className="status-values">
                                            <EditableField
                                                value={character.status.resolve.current}
                                                onChange={(val) => handleStatusUpdate('resolve', val as number)}
                                                isEditing={isEditMode}
                                                type="number"
                                                min={0}
                                            />
                                            <span>/</span>
                                            <span>{character.status.resilience.current}</span>
                                        </div>
                                    </div>
                                    <div className="status-group">
                                        <span className="status-label">Fortune</span>
                                        <div className="status-values">
                                            <EditableField
                                                value={character.status.fortune.current}
                                                onChange={(val) => handleStatusUpdate('fortune', val as number)}
                                                isEditing={isEditMode}
                                                type="number"
                                                min={0}
                                            />
                                            <span>/</span>
                                            <span>{character.status.fate.current}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="status-row movement-row">
                                    <span className="status-label">Movement</span>
                                    <EditableField
                                        value={movement}
                                        onChange={(val) => handleFieldUpdate('movement', val as number)}
                                        isEditing={isEditMode}
                                        type="number"
                                        min={1}
                                    />
                                </div>
                            </div>

                            <SkillsPanel
                                character={character}
                                isEditMode={isEditMode}
                                advancementMode={advancementMode}
                                onCharacterUpdate={onCharacterUpdate}
                                onSkillClick={onSkillClick}
                                onSkillAdvance={onSkillAdvance}
                            />
                        </div>

                        <div className="main-tab-right">
                            {/* Talents */}
                            <div className="panel talents-panel">
                                <h3 className="panel-title">Talents</h3>
                                <div className="talents-list">
                                    {Object.entries(character.talents).length === 0 ? (
                                        <p className="empty-message">No talents acquired yet.</p>
                                    ) : (
                                        Object.entries(character.talents).map(([talentId, rank]) => {
                                            const talentDef = talents.find(t => t.id === talentId);
                                            if (!talentDef) return null;
                                            return (
                                                <div key={talentId} className="talent-item">
                                                    <span className="talent-name">{talentDef.name}</span>
                                                    <span className="talent-rank">({rank})</span>
                                                    <p className="talent-description">{talentDef.description}</p>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Ambitions */}
                            <div className="panel ambitions-panel">
                                <h3 className="panel-title">Ambitions</h3>
                                <div className="ambition-item">
                                    <span className="ambition-label">Short Term:</span>
                                    <EditableField
                                        value={characterDetails.shortTermAmbition || ''}
                                        onChange={(val) => handleDetailsUpdate('shortTermAmbition', val as string)}
                                        isEditing={isEditMode}
                                        placeholder="Enter short-term ambition..."
                                    />
                                </div>
                                <div className="ambition-item">
                                    <span className="ambition-label">Long Term:</span>
                                    <EditableField
                                        value={characterDetails.longTermAmbition || ''}
                                        onChange={(val) => handleDetailsUpdate('longTermAmbition', val as string)}
                                        isEditing={isEditMode}
                                        placeholder="Enter long-term ambition..."
                                    />
                                </div>
                            </div>

                            {/* Personal Details */}
                            <div className="panel details-panel">
                                <h3 className="panel-title">Personal Details</h3>
                                <div className="details-grid">
                                    <div className="detail-item">
                                        <span className="detail-label">Age:</span>
                                        <EditableField
                                            value={characterDetails.age || ''}
                                            onChange={(val) => handleDetailsUpdate('age', val as string)}
                                            isEditing={isEditMode}
                                            placeholder="—"
                                        />
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Height:</span>
                                        <EditableField
                                            value={characterDetails.height || ''}
                                            onChange={(val) => handleDetailsUpdate('height', val as string)}
                                            isEditing={isEditMode}
                                            placeholder="—"
                                        />
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Hair:</span>
                                        <EditableField
                                            value={characterDetails.hair || ''}
                                            onChange={(val) => handleDetailsUpdate('hair', val as string)}
                                            isEditing={isEditMode}
                                            placeholder="—"
                                        />
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Eyes:</span>
                                        <EditableField
                                            value={characterDetails.eyes || ''}
                                            onChange={(val) => handleDetailsUpdate('eyes', val as string)}
                                            isEditing={isEditMode}
                                            placeholder="—"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'combat' && (
                    <CombatTab
                        character={character}
                        isEditMode={isEditMode}
                        onCharacterUpdate={onCharacterUpdate}
                    />
                )}

                {activeTab === 'inventory' && (
                    <InventoryTab
                        character={character}
                        isEditMode={isEditMode}
                        onCharacterUpdate={onCharacterUpdate}
                        onPurchaseClick={onPurchaseClick}
                        showPurchaseButton={showPurchaseButton}
                    />
                )}

                {activeTab === 'notes' && (
                    <NotesTab
                        character={character}
                        isEditMode={isEditMode}
                        onCharacterUpdate={onCharacterUpdate}
                    />
                )}
            </div>
        </div>
    );
};

export default PlayerCharacterSheet;
