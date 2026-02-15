import React, { useState, useEffect } from 'react';
import { Character, CharacterLore, Motivation, Relationship } from '@wfrp/shared';
import styles from './LoreEditor.module.css';
import { useTranslation } from 'react-i18next';

type TabKey = 'identity' | 'psychology' | 'relationships';

const RELATIONSHIP_TYPES: Relationship['type'][] = ['kin', 'friend', 'ally', 'love', 'rival', 'enemy', 'servant', 'master', 'other'];

/** Inverse mapping for reciprocal relationships */
const INVERSE_RELATIONSHIP: Record<Relationship['type'], Relationship['type']> = {
    kin: 'kin',
    friend: 'friend',
    ally: 'ally',
    love: 'love',
    rival: 'rival',
    enemy: 'enemy',
    servant: 'master',
    master: 'servant',
    other: 'other',
};

interface LoreEditorProps {
    character: Character;
    characters: Character[]; // All characters for relationship target dropdown
    motivations: Motivation[];
    onCharacterUpdate: (character: Character) => void;
    /** Called when we need to update another character (for reciprocal relationships) */
    onOtherCharacterUpdate: (character: Character) => void;
    onClose: () => void;
}

const defaultLore: CharacterLore = {
    gmNotes: '',
    background: [],
    playerNotes: '',
    appearance: '',
    voice: '',
    mannerisms: '',
    biography: '',
    ambitions: { short: '', long: '' },
    motivationKey: '',
    imageUrl: undefined,
    relationships: [],
};

export const LoreEditor: React.FC<LoreEditorProps> = ({
    character,
    characters,
    motivations,
    onCharacterUpdate,
    onOtherCharacterUpdate,
    onClose,
}) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<TabKey>('identity');
    const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

    const lore: CharacterLore = {
        ...defaultLore,
        ...character.lore,
    };

    // Load image on mount / when imageUrl changes
    useEffect(() => {
        const loadImage = async () => {
            if (lore.imageUrl) {
                try {
                    const dataUrl = await window.ipcRenderer.loadCharacterImage(lore.imageUrl);
                    if (dataUrl) setImageDataUrl(dataUrl);
                } catch {
                    setImageDataUrl(null);
                }
            } else {
                setImageDataUrl(null);
            }
        };
        loadImage();
    }, [lore.imageUrl]);

    // Helper to update lore fields
    const updateLore = (updates: Partial<CharacterLore>) => {
        onCharacterUpdate({
            ...character,
            lore: {
                ...lore,
                ...updates,
            },
        });
    };

    // === Image Handling ===

    const handleImageUpload = async () => {
        try {
            const result = await window.ipcRenderer.selectCharacterImage(character.id);
            if (result.success && result.path) {
                updateLore({ imageUrl: result.path });
                if (result.dataUrl) {
                    setImageDataUrl(result.dataUrl);
                }
            }
        } catch (err) {
            console.error('Error uploading image:', err);
        }
    };

    const handleRemoveImage = async () => {
        try {
            await window.ipcRenderer.deleteCharacterImage(character.id);
            updateLore({ imageUrl: undefined });
            setImageDataUrl(null);
        } catch (err) {
            console.error('Error removing image:', err);
        }
    };

    // === Relationship Management ===

    const [newRelTarget, setNewRelTarget] = useState('');
    const [newRelType, setNewRelType] = useState<Relationship['type']>('ally');
    const [newRelDesc, setNewRelDesc] = useState('');
    const [addReciprocal, setAddReciprocal] = useState(true);
    const [reciprocalDesc, setReciprocalDesc] = useState('');

    const relationships = lore.relationships || [];
    const otherCharacters = characters.filter(c => c.id !== character.id);

    const handleAddRelationship = () => {
        if (!newRelTarget) return;

        const newRel: Relationship = {
            id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            targetCharacterId: newRelTarget,
            type: newRelType,
            description: newRelDesc,
        };

        const updatedRelationships = [...relationships, newRel];
        updateLore({ relationships: updatedRelationships });

        // Handle reciprocal relationship
        if (addReciprocal) {
            const targetChar = characters.find(c => c.id === newRelTarget);
            if (targetChar) {
                const targetLore: CharacterLore = {
                    ...defaultLore,
                    ...targetChar.lore,
                };
                const inverseRel: Relationship = {
                    id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_inv`,
                    targetCharacterId: character.id,
                    type: INVERSE_RELATIONSHIP[newRelType],
                    description: reciprocalDesc || newRelDesc,
                };
                const targetRelationships = [...(targetLore.relationships || []), inverseRel];
                onOtherCharacterUpdate({
                    ...targetChar,
                    lore: {
                        ...targetLore,
                        relationships: targetRelationships,
                    },
                });
            }
        }

        // Reset form
        setNewRelTarget('');
        setNewRelType('ally');
        setNewRelDesc('');
        setReciprocalDesc('');
    };

    const handleDeleteRelationship = (relId: string) => {
        const updatedRelationships = relationships.filter(r => r.id !== relId);
        updateLore({ relationships: updatedRelationships });
    };

    // Find selected motivation
    const selectedMotivation = motivations.find(m => m.id === lore.motivationKey);


    const tabs: { key: TabKey; label: string; icon: string }[] = [
        { key: 'identity', label: t('lore.tabs.identity', 'Identity'), icon: '👤' },
        { key: 'psychology', label: t('lore.tabs.psychology', 'Psychology'), icon: '🧠' },
        { key: 'relationships', label: t('lore.tabs.relationships', 'Relationships'), icon: '🔗' },
    ];

    return (
        <>
            <div className={styles.overlay} onClick={onClose} />
            <div className={styles.loreEditor}>
                <div className={styles.header}>
                    <h2>🎭 {t('lore.editLore', 'Edit Lore')}: {character.name}</h2>
                    <button className={styles.closeButton} onClick={onClose}>
                        ✖ {t('common.close', 'Close')}
                    </button>
                </div>

                <div className={styles.body}>
                    {/* Left Column: Image + Quick Info */}
                    <div className={styles.leftColumn}>
                        <div className={styles.imageZone} onClick={handleImageUpload}>
                            {imageDataUrl ? (
                                <img src={imageDataUrl} alt={character.name} className={styles.imagePreview} />
                            ) : (
                                <div className={styles.imagePlaceholder}>
                                    <span>📷</span>
                                    <span>{t('lore.uploadImage', 'Upload Image')}</span>
                                </div>
                            )}
                        </div>
                        {lore.imageUrl && (
                            <div className={styles.imageActions}>
                                <button className={styles.smallButton} onClick={handleImageUpload}>
                                    📷 {t('lore.changeImage', 'Change')}
                                </button>
                                <button className={`${styles.smallButton} ${styles.dangerButton}`} onClick={handleRemoveImage}>
                                    🗑️ {t('lore.removeImage', 'Remove')}
                                </button>
                            </div>
                        )}

                        <div>
                            <div className={styles.fieldLabel}>{t('lore.voice', 'Voice')}</div>
                            <input
                                type="text"
                                className={styles.smallInput}
                                value={lore.voice || ''}
                                onChange={e => updateLore({ voice: e.target.value })}
                                placeholder={t('lore.voicePlaceholder', 'e.g. Gravelly, Soft...')}
                            />
                        </div>

                        <div>
                            <div className={styles.fieldLabel}>{t('lore.mannerisms', 'Mannerisms')}</div>
                            <input
                                type="text"
                                className={styles.smallInput}
                                value={lore.mannerisms || ''}
                                onChange={e => updateLore({ mannerisms: e.target.value })}
                                placeholder={t('lore.mannerismsPlaceholder', 'e.g. Fidgets, Spits...')}
                            />
                        </div>

                        <div>
                            <div className={styles.fieldLabel}>{t('lore.species', 'Species')}</div>
                            <div style={{ color: '#d4c9a8', fontSize: '13px' }}>{character.species}</div>
                        </div>

                        <div>
                            <div className={styles.fieldLabel}>{t('lore.tags', 'Tags')}</div>
                            <div style={{ color: '#8b734a', fontSize: '12px' }}>
                                {character.tags?.join(', ') || '—'}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Tabbed Content */}
                    <div className={styles.rightColumn}>
                        <div className={styles.tabs}>
                            {tabs.map(tab => (
                                <button
                                    key={tab.key}
                                    className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
                                    onClick={() => setActiveTab(tab.key)}
                                >
                                    {tab.icon} {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className={styles.tabContent}>
                            {activeTab === 'identity' && (
                                <IdentityTab
                                    lore={lore}
                                    onUpdateLore={updateLore}
                                />
                            )}
                            {activeTab === 'psychology' && (
                                <PsychologyTab
                                    lore={lore}
                                    motivations={motivations}
                                    selectedMotivation={selectedMotivation}
                                    onUpdateLore={updateLore}
                                />
                            )}
                            {activeTab === 'relationships' && (
                                <RelationshipsTab
                                    relationships={relationships}
                                    otherCharacters={otherCharacters}
                                    newRelTarget={newRelTarget}
                                    newRelType={newRelType}
                                    newRelDesc={newRelDesc}
                                    addReciprocal={addReciprocal}
                                    reciprocalDesc={reciprocalDesc}
                                    characterName={character.name}
                                    onSetNewRelTarget={setNewRelTarget}
                                    onSetNewRelType={setNewRelType}
                                    onSetNewRelDesc={setNewRelDesc}
                                    onSetAddReciprocal={setAddReciprocal}
                                    onSetReciprocalDesc={setReciprocalDesc}
                                    onAddRelationship={handleAddRelationship}
                                    onDeleteRelationship={handleDeleteRelationship}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

// === Sub-Tab Components ===

interface IdentityTabProps {
    lore: CharacterLore;
    onUpdateLore: (updates: Partial<CharacterLore>) => void;
}

const IdentityTab: React.FC<IdentityTabProps> = ({ lore, onUpdateLore }) => {
    const { t } = useTranslation();

    return (
        <>
            <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}>{t('lore.appearance', 'Appearance')}</div>
                <textarea
                    className={styles.appearanceArea}
                    value={lore.appearance || ''}
                    onChange={e => onUpdateLore({ appearance: e.target.value })}
                    placeholder={t('lore.appearancePlaceholder', 'Describe the character\'s physical appearance...')}
                />
            </div>

            <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}>{t('lore.biography', 'Biography')}</div>
                <textarea
                    className={styles.bioArea}
                    value={lore.biography || ''}
                    onChange={e => onUpdateLore({ biography: e.target.value })}
                    placeholder={t('lore.biographyPlaceholder', 'Write the character\'s backstory and history...')}
                />
            </div>

            <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}>{t('lore.gmNotes', 'GM Notes (Private)')}</div>
                <textarea
                    className={styles.bioArea}
                    value={lore.gmNotes || ''}
                    onChange={e => onUpdateLore({ gmNotes: e.target.value })}
                    placeholder={t('lore.gmNotesPlaceholder', 'Private notes only visible to the GM...')}
                    style={{ minHeight: '100px' }}
                />
            </div>
        </>
    );
};

interface PsychologyTabProps {
    lore: CharacterLore;
    motivations: Motivation[];
    selectedMotivation: Motivation | undefined;
    onUpdateLore: (updates: Partial<CharacterLore>) => void;
}

const PsychologyTab: React.FC<PsychologyTabProps> = ({ lore, motivations, selectedMotivation, onUpdateLore }) => {
    const { t } = useTranslation();

    return (
        <>
            <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}>{t('lore.motivation', 'Motivation')}</div>
                <select
                    className={styles.motivationSelect}
                    value={lore.motivationKey || ''}
                    onChange={e => onUpdateLore({ motivationKey: e.target.value || undefined })}
                >
                    <option value="">{t('lore.selectMotivation', '— Select Motivation —')}</option>
                    {motivations.sort((a, b) => a.name.localeCompare(b.name)).map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                </select>
                {selectedMotivation && (
                    <div className={styles.motivationDescription}>
                        "{selectedMotivation.description}"
                    </div>
                )}
            </div>

            <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}>{t('lore.ambitions', 'Ambitions')}</div>
                <div className={styles.ambitionRow}>
                    <div className={styles.ambitionField}>
                        <div className={styles.fieldLabel}>{t('lore.shortTermAmbition', 'Short-Term')}</div>
                        <input
                            type="text"
                            className={styles.smallInput}
                            value={lore.ambitions?.short || ''}
                            onChange={e => onUpdateLore({
                                ambitions: {
                                    short: e.target.value,
                                    long: lore.ambitions?.long || '',
                                }
                            })}
                            placeholder={t('lore.shortAmbitionPlaceholder', 'e.g. Pay off the racketeers')}
                        />
                    </div>
                    <div className={styles.ambitionField}>
                        <div className={styles.fieldLabel}>{t('lore.longTermAmbition', 'Long-Term')}</div>
                        <input
                            type="text"
                            className={styles.smallInput}
                            value={lore.ambitions?.long || ''}
                            onChange={e => onUpdateLore({
                                ambitions: {
                                    short: lore.ambitions?.short || '',
                                    long: e.target.value,
                                }
                            })}
                            placeholder={t('lore.longAmbitionPlaceholder', 'e.g. Buy a noble title')}
                        />
                    </div>
                </div>
            </div>
        </>
    );
};

interface RelationshipsTabProps {
    relationships: Relationship[];
    otherCharacters: Character[];
    newRelTarget: string;
    newRelType: Relationship['type'];
    newRelDesc: string;
    addReciprocal: boolean;
    reciprocalDesc: string;
    characterName: string;
    onSetNewRelTarget: (v: string) => void;
    onSetNewRelType: (v: Relationship['type']) => void;
    onSetNewRelDesc: (v: string) => void;
    onSetAddReciprocal: (v: boolean) => void;
    onSetReciprocalDesc: (v: string) => void;
    onAddRelationship: () => void;
    onDeleteRelationship: (relId: string) => void;
}

const RelationshipsTab: React.FC<RelationshipsTabProps> = ({
    relationships,
    otherCharacters,
    newRelTarget,
    newRelType,
    newRelDesc,
    addReciprocal,
    reciprocalDesc,
    characterName,
    onSetNewRelTarget,
    onSetNewRelType,
    onSetNewRelDesc,
    onSetAddReciprocal,
    onSetReciprocalDesc,
    onAddRelationship,
    onDeleteRelationship,
}) => {
    const { t } = useTranslation();

    const targetName = otherCharacters.find(c => c.id === newRelTarget)?.name;
    const inverseType = INVERSE_RELATIONSHIP[newRelType];

    return (
        <>
            {/* Existing Relationships */}
            <div className={styles.fieldLabel}>{t('lore.currentTies', 'Current Ties')}</div>
            {relationships.length === 0 ? (
                <div className={styles.noRelationships}>
                    {t('lore.noRelationships', 'No relationships defined yet.')}
                </div>
            ) : (
                <div className={styles.relationshipList}>
                    {relationships.map(rel => {
                        const target = otherCharacters.find(c => c.id === rel.targetCharacterId);
                        return (
                            <div key={rel.id} className={styles.relationshipCard}>
                                <span className={styles.relationshipTarget}>
                                    {target?.name || t('lore.unknownCharacter', 'Unknown')}
                                </span>
                                <span className={styles.relationshipType}>{rel.type}</span>
                                <span className={styles.relationshipDesc}>
                                    {rel.description || '—'}
                                </span>
                                <button
                                    className={styles.deleteRelButton}
                                    onClick={() => onDeleteRelationship(rel.id)}
                                    title={t('lore.removeRelationship', 'Remove')}
                                >
                                    ✖
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add Relationship Form */}
            <div className={styles.addRelationshipForm}>
                <div className={styles.fieldLabel}>{t('lore.addRelationship', '+ Add Relationship')}</div>
                <div className={styles.addRelRow}>
                    <div className={styles.addRelField}>
                        <div className={styles.fieldLabel}>{t('lore.target', 'Target')}</div>
                        <select
                            className={styles.selectInput}
                            value={newRelTarget}
                            onChange={e => onSetNewRelTarget(e.target.value)}
                        >
                            <option value="">{t('lore.selectCharacter', '— Select Character —')}</option>
                            {otherCharacters.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.addRelField}>
                        <div className={styles.fieldLabel}>{t('lore.type', 'Type')}</div>
                        <select
                            className={styles.selectInput}
                            value={newRelType}
                            onChange={e => onSetNewRelType(e.target.value as Relationship['type'])}
                        >
                            {RELATIONSHIP_TYPES.map(type => (
                                <option key={type} value={type}>
                                    {t(`lore.relType.${type}`, type.charAt(0).toUpperCase() + type.slice(1))}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className={styles.addRelRow}>
                    <div className={styles.addRelField} style={{ flex: 1 }}>
                        <div className={styles.fieldLabel}>{t('lore.description', 'Description')}</div>
                        <input
                            type="text"
                            className={styles.smallInput}
                            value={newRelDesc}
                            onChange={e => onSetNewRelDesc(e.target.value)}
                            placeholder={t('lore.relDescPlaceholder', 'e.g. Owes him 50 GC')}
                        />
                    </div>
                </div>

                <div className={styles.reciprocalRow}>
                    <input
                        type="checkbox"
                        id="addReciprocal"
                        checked={addReciprocal}
                        onChange={e => onSetAddReciprocal(e.target.checked)}
                    />
                    <label htmlFor="addReciprocal">
                        {t('lore.addInverse', 'Add inverse relationship')}
                        {newRelTarget && targetName && (
                            <span style={{ color: '#8b734a' }}>
                                {' '}({targetName} → {characterName} as {t(`lore.relType.${inverseType}`, inverseType)})
                            </span>
                        )}
                    </label>
                </div>

                {addReciprocal && (
                    <div style={{ marginBottom: '10px' }}>
                        <div className={styles.fieldLabel}>{t('lore.inverseDescription', 'Inverse Description (optional)')}</div>
                        <input
                            type="text"
                            className={styles.smallInput}
                            value={reciprocalDesc}
                            onChange={e => onSetReciprocalDesc(e.target.value)}
                            placeholder={t('lore.inverseDescPlaceholder', 'Leave blank to use the same description')}
                        />
                    </div>
                )}

                <div className={styles.addRelActions}>
                    <button
                        className={styles.actionButton}
                        onClick={onAddRelationship}
                        disabled={!newRelTarget}
                    >
                        ➕ {t('lore.addRelButton', 'Add Relationship')}
                    </button>
                </div>
            </div>
        </>
    );
};

export default LoreEditor;
