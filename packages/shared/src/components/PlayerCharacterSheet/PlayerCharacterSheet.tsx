import React, { useState } from 'react';
import {
    Character,
    Characteristic,
    Skill,
    Career,
    Location,
    Currency,
    User,
    Weapon,
    useGameData,
    EditableField,
    calculateCharacteristicValue,
    getAvailableAdvancements,
    isSkillGrouped,
    getGroupedSkill
} from '@wfrp/shared';
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
    // Combat roll handlers for the Roll Queue system
    onWeaponRoll?: (weapon: Weapon, skillId: string, skillName: string, skillValue: number, weaponDamage: number) => void;
    onDefendRoll?: (skillId: string, skillName: string, skillValue: number) => void;
    advancementMode?: boolean;
    onCharacteristicAdvance?: (charKey: keyof Character['characteristics']) => void;
    onSkillAdvance?: (skillId: string) => void;
    onPurchaseClick?: () => void;
    showPurchaseButton?: boolean;
    isGM?: boolean; // GM-only features (tags, location)
    onClose?: () => void; // Close button callback
    // GM-specific callbacks
    onXpAward?: (amount: number) => void;
    onCareerManagementModalOpen?: (character: Character) => void;
    onCurrencyAward?: (newCurrency: Currency) => void;
    onRemoveTalent?: (talentId: string) => void;
    onAddTalent?: () => void;
    onCorruptionTest?: () => void;
    onRemoveItem?: (itemId: string, type: 'weapon' | 'armor' | 'item') => void;
    onAddItem?: () => void;
    onMinionViewClick?: () => void; // Toggle back to minion view (for generated minions)
    // Secrets system props
    users?: User[]; // List of users (for GM to share secrets)
    currentUserId?: string; // Current player's user ID (for player view)
    renderSecretsManager?: (props: {
        character: Character;
        users: User[];
        onCharacterUpdate: (updates: Partial<Character>) => void;
    }) => React.ReactNode; // Custom secrets manager renderer (GM only)
}

const PlayerCharacterSheet: React.FC<PlayerCharacterSheetProps> = ({
    character,
    isEditMode,
    onEditModeToggle,
    onCharacterUpdate,
    onSkillClick,
    onCharacteristicClick,
    onWeaponRoll,
    onDefendRoll,
    advancementMode = false,
    onCharacteristicAdvance,
    onSkillAdvance,
    onPurchaseClick,
    showPurchaseButton = false,
    isGM = false,
    onClose,
    // GM-specific callbacks
    onXpAward,
    onCareerManagementModalOpen,
    onCurrencyAward,
    onRemoveTalent,
    onAddTalent,
    onCorruptionTest,
    onRemoveItem,
    onAddItem,
    onMinionViewClick,
    // Secrets system props
    users = [],
    currentUserId,
    renderSecretsManager,
}) => {
    const { skills, careers, talents, mapData: gameData } = useGameData();
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

    const handleCareerChange = (newCareerId: string, newCareerLevelId?: string) => {
        const newCareer = careers.find((c: any) => c.id === newCareerId);
        if (!newCareer) return;

        const newCareerLevel = newCareerLevelId ? newCareer.career_level.find((lvl: any) => lvl.id === newCareerLevelId) : newCareer.career_level.find((lvl: any) => lvl.lvl === 1);
        if (!newCareerLevel) return;

        const availableAdvancements = getAvailableAdvancements(newCareer, newCareerLevel.lvl);

        const updatedCharacter: Character = {
            ...character,
            currentCareerId: newCareerId,
            currentCareerLevelId: newCareerLevel.id,
            unlockedCharacteristicIds: availableAdvancements.characteristics,
            unlockedSkillIds: availableAdvancements.skills,
            unlockedTalentIds: availableAdvancements.talents,
            skills: [
                ...character.skills,
                ...newCareerLevel.skills_ids.filter(skillId => !character.skills.some(s => s.id === skillId)).map((skillId: string) => {
                    if (isSkillGrouped(skillId)) {
                        const grouped = getGroupedSkill(skillId, skills);
                        if (!grouped) return { id: "", name: "Unknown Skill", characteristic: "ws", advances: 0, talents: 0, modifier: 0 };
                        return grouped;
                    }
                    const skillDef = skills.find((s: any) => s.id === skillId && s.type === 'skill');
                    if (!skillDef) return { id: "", name: "Unknown Skill", characteristic: "ws", advances: 0, talents: 0, modifier: 0 };
                    return {
                        id: skillDef.id,
                        name: skillDef.name,
                        characteristic: skillDef.characteristic,
                        advances: 0,
                        talents: 0,
                        modifier: 0
                    };
                }).filter((s: Skill) => s.id !== "") // Filter out unknown skills
            ]
        };
        onCharacterUpdate(updatedCharacter);
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
                    {!isEditMode ? (
                        <div>
                            <div className="header-field">
                                <span className="header-label">Career:</span>
                                <span className="header-value">{career?.name || '—'}</span>
                            </div>
                            <div className="header-field">
                                <span className="header-label">Level:</span>
                                <span className="header-value">{careerLevel?.name || '—'}</span>
                            </div>
                        </div>
                    ) : (
                        <div><span className="header-label">Career : </span>
                            <select value={character.currentCareerId} onChange={e => handleCareerChange(e.target.value)}>
                                {careers.map(c => {
                                    return (<option key={c.id} value={c.id}>{c.name}</option>);
                                }).sort((a, b) => a.props.children.localeCompare(b.props.children))}
                            </select>
                            <span className="header-label"> Level : </span>
                            <select value={character.currentCareerLevelId} onChange={e => handleCareerChange(character.currentCareerId, e.target.value)}>
                                {careers.filter(c => c.id === character.currentCareerId).flatMap(c => c.career_level).map(level => {
                                    return (<option key={level.id} value={level.id}>{level.name}</option>);
                                })}
                            </select>
                        </div>
                    )}
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
                    {/* GM Action Buttons */}
                    {isGM && (
                        <div className="gm-header-actions">
                            {onXpAward && (
                                <div>
                                    <input
                                        type="number"
                                        className="xp-award-input"
                                        placeholder="XP Amount"
                                        min={0}
                                    />
                                    <button
                                        className="gm-header-btn"
                                        onClick={() => {
                                            const input = document.querySelector('.xp-award-input') as HTMLInputElement;
                                            const amount = input.value;
                                            if (amount) onXpAward(parseInt(amount) || 0);
                                        }}
                                        title="Award XP"
                                    >
                                        +XP
                                    </button>
                                </div>
                            )}
                            {onCareerManagementModalOpen && (
                                <button
                                    className="gm-header-btn"
                                    onClick={() => onCareerManagementModalOpen(character)}
                                    title="Manage Career"
                                >
                                    Career
                                </button>
                            )}
                            {onCorruptionTest && (
                                <button
                                    className="gm-header-btn corruption-btn"
                                    onClick={onCorruptionTest}
                                    title="Corruption Test"
                                >
                                    Corruption
                                </button>
                            )}
                        </div>
                    )}
                    {onMinionViewClick && (
                        <button 
                            className="minion-view-button" 
                            onClick={onMinionViewClick}
                            title="Switch to Minion View"
                        >
                            📋
                        </button>
                    )}
                    {onClose && (
                        <button className="close-button" onClick={onClose}>✖</button>
                    )}
                </div>
            </header>

            {/* GM-Only Panel: Tags and Location */}
            {isGM && (
                <div className="gm-panel">
                    <div className="gm-panel-section tags-section">
                        <span className="gm-panel-label">Tags:</span>
                        <div className="tags-container">
                            {(character.tags || []).map((tag, index) => (
                                <span key={index} className="tag-chip">
                                    {tag}
                                    <button
                                        className="tag-remove-btn"
                                        onClick={() => {
                                            const newTags = (character.tags || []).filter((_, i) => i !== index);
                                            onCharacterUpdate({ tags: newTags });
                                        }}
                                    >×</button>
                                </span>
                            ))}
                            <input
                                type="text"
                                placeholder="Add tag..."
                                className="tag-input"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const input = e.target as HTMLInputElement;
                                        const newTag = input.value.trim();
                                        if (newTag && !(character.tags || []).includes(newTag)) {
                                            onCharacterUpdate({
                                                tags: [...(character.tags || []), newTag]
                                            });
                                            input.value = '';
                                        }
                                    }
                                }}
                            />
                        </div>
                    </div>
                    <div className="gm-panel-section location-section">
                        <span className="gm-panel-label">Location:</span>
                        <select
                            value={character.locationId || ''}
                            onChange={(e) => {
                                onCharacterUpdate({
                                    locationId: e.target.value || null
                                });
                            }}
                            className="location-select"
                        >
                            <option value="">No Location</option>
                            {(gameData?.locations || []).map((loc: Location) => (
                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

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
                                <div className="panel-header">
                                    <h3 className="panel-title">Talents</h3>
                                    {isGM && onAddTalent && (
                                        <button className="gm-action-btn add-btn" onClick={onAddTalent} title="Add Talent">+</button>
                                    )}
                                </div>
                                <div className="talents-list">
                                    {Object.entries(character.talents).length === 0 ? (
                                        <p className="empty-message">No talents acquired yet.</p>
                                    ) : (
                                        Object.entries(character.talents).map(([talentId, rank]) => {
                                            const talentDef = talents.find(t => t.id === talentId);
                                            if (!talentDef) return null;
                                            return (
                                                <div key={talentId} className="talent-item">
                                                    <div className="talent-header">
                                                        <span className="talent-name">{talentDef.name}</span>
                                                        <span className="talent-rank">({rank})</span>
                                                        {isGM && onRemoveTalent && (
                                                            <button
                                                                className="gm-action-btn remove-btn"
                                                                onClick={() => onRemoveTalent(talentId)}
                                                                title="Remove Talent"
                                                            >×</button>
                                                        )}
                                                    </div>
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
                        onWeaponRoll={onWeaponRoll}
                        onDefendRoll={onDefendRoll}
                    />
                )}

                {activeTab === 'inventory' && (
                    <InventoryTab
                        character={character}
                        isEditMode={isEditMode}
                        onCharacterUpdate={onCharacterUpdate}
                        onPurchaseClick={onPurchaseClick}
                        showPurchaseButton={showPurchaseButton}
                        isGM={isGM}
                        onAddItem={onAddItem}
                        onRemoveItem={onRemoveItem}
                    />
                )}

                {activeTab === 'notes' && (
                    <NotesTab
                        character={character}
                        isEditMode={isEditMode}
                        onCharacterUpdate={onCharacterUpdate}
                        isGM={isGM}
                        users={users}
                        currentUserId={currentUserId}
                        renderSecretsManager={renderSecretsManager}
                    />
                )}
            </div>
        </div>
    );
};

export default PlayerCharacterSheet;
