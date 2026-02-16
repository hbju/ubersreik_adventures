import React, { useRef, useState } from 'react';
import { Faction, FactionCategory, getFactionCategoryIcon, Location } from '@wfrp/shared';
import styles from './FactionManager.module.css';
import { useTranslation } from 'react-i18next';

interface FactionManagerProps {
    factions: Faction[];
    locations: Location[];
    onUpdateFactions: (factions: Faction[]) => void;
    onClose: () => void;
}

const FACTION_CATEGORIES: FactionCategory[] = [
    'government',
    'noble_house',
    'guild',
    'criminal',
    'religious',
    'military',
    'cult',
    'other'
];

const DEFAULT_CATEGORY_COLORS: Record<FactionCategory, string> = {
    government: '#4169e1',
    noble_house: '#9b59b6',
    guild: '#d4af37',
    criminal: '#8b0000',
    religious: '#f5f5dc',
    military: '#2f4f4f',
    cult: '#4b0082',
    other: '#808080'
};

const DEFAULT_FACTION: Omit<Faction, 'id'> = {
    name: 'New Faction',
    description: '',
    category: 'other',
    icon: '',
    hq: '',
    head: '',
    defaultReputation: 0,
    color: DEFAULT_CATEGORY_COLORS['other']
};

export const FactionManager: React.FC<FactionManagerProps> = ({
    factions,
    locations,
    onUpdateFactions,
    onClose,
}) => {
    const { t } = useTranslation();
    const [selectedFaction, setSelectedFaction] = useState<Faction | null>(null);
    const [editingFaction, setEditingFaction] = useState<Faction | null>(null);
    const [filterCategory, setFilterCategory] = useState<FactionCategory | 'all'>('all');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleCreateFaction = () => {
        const newFaction: Faction = {
            id: `faction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...DEFAULT_FACTION
        };
        setSelectedFaction(newFaction);
        setEditingFaction(newFaction);
    };

    const handleSelectFaction = (faction: Faction) => {
        setSelectedFaction(faction);
        setEditingFaction({ ...faction });
    };

    const handleSaveFaction = () => {
        if (!editingFaction) return;

        const existingIndex = factions.findIndex((f) => f.id === editingFaction.id);
        let updatedFactions: Faction[];

        if (existingIndex >= 0) {
            updatedFactions = factions.map((f) =>
                f.id === editingFaction.id ? editingFaction : f
            );
        } else {
            updatedFactions = [...factions, editingFaction];
        }

        onUpdateFactions(updatedFactions);
        setSelectedFaction(editingFaction);
    };

    const handleDeleteFaction = () => {
        if (!editingFaction) return;

        if (window.confirm(t('factions.confirmDelete', { name: editingFaction.name }))) {
            const updatedFactions = factions.filter((f) => f.id !== editingFaction.id);
            onUpdateFactions(updatedFactions);
            setSelectedFaction(null);
            setEditingFaction(null);
        }
    };

    const handleFieldChange = (field: keyof Faction, value: string | number) => {
        if (!editingFaction) return;
        setEditingFaction({ ...editingFaction, [field]: value });
    };

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            alert('Image must be less than 10MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Data = e.target?.result as string;
            handleFieldChange('icon', base64Data);
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveImage = () => {
        handleFieldChange('icon', '');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const filteredFactions = filterCategory === 'all'
        ? factions
        : factions.filter(f => f.category === filterCategory);

    return (
        <>
            <div className={styles.overlay} onClick={onClose} />
            <div className={styles.factionManager}>
                <div className={styles.header}>
                    <h2>🏰 {t('factions.title')}</h2>
                    <button className={styles.closeButton} onClick={onClose}>
                        {t('common.close')}
                    </button>
                </div>

                <div className={styles.content}>
                    {/* Sidebar with faction list */}
                    <div className={styles.sidebar}>
                        <div className={styles.sidebarHeader}>
                            <button className={styles.createButton} onClick={handleCreateFaction}>
                                ➕ {t('factions.createNew')}
                            </button>
                            <select
                                className={styles.filterSelect}
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value as FactionCategory | 'all')}
                            >
                                <option value="all">{t('factions.allCategories')}</option>
                                {FACTION_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>
                                        {getFactionCategoryIcon(cat)} {t('factions.categories.' + cat)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.factionsList}>
                            {filteredFactions.map((faction) => (
                                <div
                                    key={faction.id}
                                    className={`${styles.factionItem} ${selectedFaction?.id === faction.id ? styles.selected : ''
                                        }`}
                                    onClick={() => handleSelectFaction(faction)}
                                >
                                    <div className={styles.factionIcon}>
                                        {faction.icon !== '' ? (
                                            <img
                                                src={faction.icon!}
                                                alt={faction.name}
                                                className={styles.factionIconImage}
                                            />
                                        ) : getFactionCategoryIcon(faction.category)}                                    </div>
                                    <div className={styles.factionInfo}>
                                        <div className={styles.factionName}>{faction.name}</div>
                                        <div className={styles.factionCategory}>
                                            {t('factions.categories.' + faction.category)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {filteredFactions.length === 0 && (
                                <div className={styles.emptyMessage}>
                                    {t('factions.noFactions')}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Editor panel */}
                    <div className={styles.editor}>
                        {editingFaction ? (
                            <>
                                <div className={styles.formGroup}>
                                    <label>{t('factions.name')}</label>
                                    <input
                                        type="text"
                                        value={editingFaction.name}
                                        onChange={(e) => handleFieldChange('name', e.target.value)}
                                        placeholder={t('factions.namePlaceholder')}
                                    />
                                </div>

                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label>{t('factions.category')}</label>
                                        <select
                                            value={editingFaction.category}
                                            onChange={(e) => handleFieldChange('category', e.target.value as FactionCategory)}
                                        >
                                            {FACTION_CATEGORIES.map(cat => (
                                                <option key={cat} value={cat}>
                                                    {getFactionCategoryIcon(cat)} {t('factions.categories.' + cat)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className={styles.formGroup}>
                                        <label>Image (Optional, max 2MB)</label>
                                        <div className={styles.imageUploadSection}>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                className={styles.fileInput}
                                            />
                                            {editingFaction.icon && (
                                                <div className={styles.imagePreview}>
                                                    <img
                                                        src={editingFaction.icon}
                                                        alt="Preview"
                                                        className={styles.previewImage}
                                                    />
                                                    <button
                                                        type="button"
                                                        className={styles.removeImageButton}
                                                        onClick={handleRemoveImage}
                                                    >
                                                        ✕ Remove Image
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.formGroup}>
                                    <label>{t('factions.description')}</label>
                                    <textarea
                                        value={editingFaction.description}
                                        onChange={(e) => handleFieldChange('description', e.target.value)}
                                        placeholder={t('factions.descriptionPlaceholder')}
                                    />
                                </div>

                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label>{t('factions.hq')}</label>
                                        <input
                                            type="text"
                                            value={editingFaction.hq}
                                            onChange={(e) => {
                                                const selectedLocation = locations.find(loc => loc.name === e.target.value);
                                                handleFieldChange('hq', selectedLocation ? selectedLocation.id : e.target.value);
                                            }}
                                            placeholder={t('factions.hqPlaceholder')}
                                            list="location-list"
                                        />
                                        <datalist id="location-list">
                                            {locations.map((loc) => (
                                                <option key={loc.id} value={loc.name} />
                                            ))}
                                        </datalist>
                                    </div>

                                    <div className={styles.formGroup}>
                                        <label>{t('factions.head')}</label>
                                        <input
                                            type="text"
                                            value={editingFaction.head}
                                            onChange={(e) => handleFieldChange('head', e.target.value)}
                                            placeholder={t('factions.headPlaceholder')}
                                        />
                                    </div>
                                </div>

                                <div className={styles.formGroup}>
                                    <label>🎨 Territory Color</label>
                                    <div className={styles.formRow}>
                                        <input
                                            type="color"
                                            value={editingFaction.color || DEFAULT_CATEGORY_COLORS[editingFaction.category] || '#808080'}
                                            onChange={(e) => handleFieldChange('color', e.target.value)}
                                            style={{ width: '48px', height: '32px', padding: '2px', cursor: 'pointer', border: '1px solid #5c4a2a', borderRadius: '4px', background: 'transparent' }}
                                        />
                                        <span style={{ marginLeft: '8px', color: '#b8a88a', fontSize: '0.85rem' }}>
                                            {editingFaction.color || DEFAULT_CATEGORY_COLORS[editingFaction.category] || '#808080'}
                                        </span>
                                    </div>
                                </div>

                                <div className={styles.formGroup}>
                                    <label>{t('factions.defaultReputation')}: {editingFaction.defaultReputation}</label>
                                    <input
                                        type="range"
                                        min="-100"
                                        max="100"
                                        value={editingFaction.defaultReputation}
                                        onChange={(e) => handleFieldChange('defaultReputation', parseInt(e.target.value))}
                                    />
                                    <div className={styles.reputationScale}>
                                        <span>-100 ({t('factions.hostile')})</span>
                                        <span>0 ({t('factions.neutral')})</span>
                                        <span>+100 ({t('factions.allied')})</span>
                                    </div>
                                </div>

                                <div className={styles.actions}>
                                    <button className={styles.saveButton} onClick={handleSaveFaction}>
                                        💾 {t('common.save')}
                                    </button>
                                    {factions.some((f) => f.id === editingFaction.id) && (
                                        <button className={styles.deleteButton} onClick={handleDeleteFaction}>
                                            🗑️ {t('common.delete')}
                                        </button>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className={styles.noSelection}>
                                {t('factions.selectOrCreate')}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default FactionManager;
