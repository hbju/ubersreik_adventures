import React, { useState, useMemo } from 'react';
import {
    CharacterTemplate,
    CharacterTemplateCategory,
    CharacteristicVariance,
    TemplateSkill,
    useGameData,
    generateCharacterFromTemplate,
    Character
} from '@wfrp/shared';
import styles from './TemplateManager.module.css';

interface TemplateManagerProps {
    onClose: () => void;
    templates: CharacterTemplate[];
    onTemplatesChange: (templates: CharacterTemplate[]) => void;
    onGenerateCharacter: (character: Character) => void;
    existingCharacterNames: string[];
}

const CATEGORIES: CharacterTemplateCategory[] = ['Human', 'Dwarf', 'Elf', 'Halfling', 'Creature', 'Undead', 'Chaos', 'Other'];

const DEFAULT_CHARACTERISTICS: CharacterTemplate['characteristics'] = {
    ws: { base: 30, variance: 5 },
    bs: { base: 30, variance: 5 },
    s: { base: 30, variance: 5 },
    t: { base: 30, variance: 5 },
    i: { base: 30, variance: 5 },
    ag: { base: 30, variance: 5 },
    dex: { base: 30, variance: 5 },
    int: { base: 30, variance: 5 },
    wp: { base: 30, variance: 5 },
    fel: { base: 30, variance: 5 },
};

const createEmptyTemplate = (): CharacterTemplate => ({
    id: crypto.randomUUID(),
    name: 'New Template',
    category: 'Human',
    species: 'Human',
    movement: 4,
    characteristics: { ...DEFAULT_CHARACTERISTICS },
    skills: [],
    talents: [],
    trappings: {
        weapons: [],
        armor: [],
        items: []
    },
    isMinion: true,
    tags: []
});

export const TemplateManager: React.FC<TemplateManagerProps> = ({
    onClose,
    templates,
    onTemplatesChange,
    onGenerateCharacter,
    existingCharacterNames
}) => {
    const { skills: skillsData, talents: talentsData, weapons, armor, items } = useGameData();

    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<CharacterTemplate | null>(null);
    const [categoryFilter, setCategoryFilter] = useState<CharacterTemplateCategory | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [generateCount, setGenerateCount] = useState(1);
    const [useNumberedNames, setUseNumberedNames] = useState(false);

    // Filter templates
    const filteredTemplates = useMemo(() => {
        return templates.filter(t => {
            if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
            if (searchTerm && !t.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            return true;
        });
    }, [templates, categoryFilter, searchTerm]);

    // Get selected template
    const selectedTemplate = useMemo(() => {
        return templates.find(t => t.id === selectedTemplateId) || null;
    }, [templates, selectedTemplateId]);

    // Create new template
    const handleCreateTemplate = () => {
        const newTemplate = createEmptyTemplate();
        onTemplatesChange([...templates, newTemplate]);
        setSelectedTemplateId(newTemplate.id);
        setEditingTemplate(newTemplate);
    };

    // Delete template
    const handleDeleteTemplate = (templateId: string) => {
        if (window.confirm('Are you sure you want to delete this template?')) {
            onTemplatesChange(templates.filter(t => t.id !== templateId));
            if (selectedTemplateId === templateId) {
                setSelectedTemplateId(null);
                setEditingTemplate(null);
            }
        }
    };

    // Duplicate template
    const handleDuplicateTemplate = (template: CharacterTemplate) => {
        const newTemplate: CharacterTemplate = {
            ...template,
            id: crypto.randomUUID(),
            name: `${template.name} (Copy)`
        };
        onTemplatesChange([...templates, newTemplate]);
        setSelectedTemplateId(newTemplate.id);
        setEditingTemplate(newTemplate);
    };

    // Edit template
    const handleEditTemplate = (template: CharacterTemplate) => {
        setEditingTemplate({ ...template });
    };

    // Save template
    const handleSaveTemplate = () => {
        if (!editingTemplate) return;
        onTemplatesChange(templates.map(t => t.id === editingTemplate.id ? editingTemplate : t));
        setEditingTemplate(null);
    };

    // Cancel edit
    const handleCancelEdit = () => {
        setEditingTemplate(null);
    };

    // Generate NPCs from template
    const handleGenerateNPCs = () => {
        if (!selectedTemplate) return;

        const currentNames = [...existingCharacterNames];
        for (let i = 0; i < generateCount; i++) {
            const newCharacter = generateCharacterFromTemplate(
                selectedTemplate,
                skillsData,
                currentNames,
                useNumberedNames
            );
            currentNames.push(newCharacter.name);
            onGenerateCharacter(newCharacter);
        }
    };

    // Update characteristic in editing template
    const handleCharacteristicChange = (
        charKey: keyof CharacterTemplate['characteristics'],
        field: 'base' | 'variance',
        value: number
    ) => {
        if (!editingTemplate) return;
        setEditingTemplate({
            ...editingTemplate,
            characteristics: {
                ...editingTemplate.characteristics,
                [charKey]: {
                    ...editingTemplate.characteristics[charKey],
                    [field]: value
                }
            }
        });
    };

    // Add skill to template
    const handleAddSkill = (skillId: string) => {
        if (!editingTemplate) return;
        if (editingTemplate.skills.some(s => s.id === skillId)) return;
        setEditingTemplate({
            ...editingTemplate,
            skills: [...editingTemplate.skills, { id: skillId, advances: 10 }]
        });
    };

    // Remove skill from template
    const handleRemoveSkill = (skillId: string) => {
        if (!editingTemplate) return;
        setEditingTemplate({
            ...editingTemplate,
            skills: editingTemplate.skills.filter(s => s.id !== skillId)
        });
    };

    // Update skill advances
    const handleSkillAdvancesChange = (skillId: string, advances: number, variance?: number) => {
        if (!editingTemplate) return;
        setEditingTemplate({
            ...editingTemplate,
            skills: editingTemplate.skills.map(s =>
                s.id === skillId ? { ...s, advances, advancesVariance: variance } : s
            )
        });
    };

    // Toggle talent
    const handleToggleTalent = (talentId: string) => {
        if (!editingTemplate) return;
        const hasTalent = editingTemplate.talents.includes(talentId);
        setEditingTemplate({
            ...editingTemplate,
            talents: hasTalent
                ? editingTemplate.talents.filter(t => t !== talentId)
                : [...editingTemplate.talents, talentId]
        });
    };

    // Toggle weapon
    const handleToggleWeapon = (weaponId: string) => {
        if (!editingTemplate) return;
        const hasWeapon = editingTemplate.trappings.weapons.includes(weaponId);
        setEditingTemplate({
            ...editingTemplate,
            trappings: {
                ...editingTemplate.trappings,
                weapons: hasWeapon
                    ? editingTemplate.trappings.weapons.filter(w => w !== weaponId)
                    : [...editingTemplate.trappings.weapons, weaponId]
            }
        });
    };

    // Toggle armor
    const handleToggleArmor = (armorId: string) => {
        if (!editingTemplate) return;
        const hasArmor = editingTemplate.trappings.armor.includes(armorId);
        setEditingTemplate({
            ...editingTemplate,
            trappings: {
                ...editingTemplate.trappings,
                armor: hasArmor
                    ? editingTemplate.trappings.armor.filter(a => a !== armorId)
                    : [...editingTemplate.trappings.armor, armorId]
            }
        });
    };

    // Toggle item
    const handleToggleItem = (itemId: string) => {
        if (!editingTemplate) return;
        const hasItem = editingTemplate.trappings.items.includes(itemId);
        setEditingTemplate({
            ...editingTemplate,
            trappings: {
                ...editingTemplate.trappings,
                items: hasItem
                    ? editingTemplate.trappings.items.filter(i => i !== itemId)
                    : [...editingTemplate.trappings.items, itemId]
            }
        });
    };

    // Get skill name by id
    const getSkillName = (skillId: string): string => {
        const skill = skillsData.find(s => s.id === skillId);
        return skill?.name || skillId;
    };

    // Get talent name by id
    const getTalentName = (talentId: string): string => {
        const talent = talentsData.find(t => t.id === talentId);
        return talent?.name || talentId;
    };

    return (
        <div className={styles.modalBackdrop} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>NPC Template Manager</h2>
                    <button className={styles.closeButton} onClick={onClose}>&times;</button>
                </div>

                <div className={styles.mainLayout}>
                    {/* Templates List Panel */}
                    <div className={styles.templatesPanel}>
                        <div className={styles.templateControls}>
                            <input
                                type="text"
                                placeholder="Search templates..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className={styles.searchInput}
                            />
                            <select
                                value={categoryFilter}
                                onChange={e => setCategoryFilter(e.target.value as CharacterTemplateCategory | 'all')}
                                className={styles.categorySelect}
                            >
                                <option value="all">All Categories</option>
                                {CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                            <button className={styles.createButton} onClick={handleCreateTemplate}>
                                + New Template
                            </button>
                        </div>

                        <div className={styles.templatesList}>
                            {filteredTemplates.length === 0 ? (
                                <p className={styles.noTemplates}>No templates found. Create one to get started!</p>
                            ) : (
                                filteredTemplates.map(template => (
                                    <div
                                        key={template.id}
                                        className={`${styles.templateCard} ${selectedTemplateId === template.id ? styles.selected : ''}`}
                                        onClick={() => setSelectedTemplateId(template.id)}
                                    >
                                        <div className={styles.templateInfo}>
                                            <span className={styles.templateName}>{template.name}</span>
                                            <span className={styles.templateCategory}>{template.category}</span>
                                            {template.isMinion && <span className={styles.minionBadge}>Minion</span>}
                                        </div>
                                        <div className={styles.templateActions}>
                                            <button
                                                className={styles.iconButton}
                                                onClick={(e) => { e.stopPropagation(); handleEditTemplate(template); }}
                                                title="Edit"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className={styles.iconButton}
                                                onClick={(e) => { e.stopPropagation(); handleDuplicateTemplate(template); }}
                                                title="Duplicate"
                                            >
                                                📋
                                            </button>
                                            <button
                                                className={styles.iconButton}
                                                onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template.id); }}
                                                title="Delete"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Template Details / Editor Panel */}
                    <div className={styles.detailsPanel}>
                        {editingTemplate ? (
                            <TemplateEditor
                                template={editingTemplate}
                                setTemplate={setEditingTemplate}
                                onSave={handleSaveTemplate}
                                onCancel={handleCancelEdit}
                                skillsData={skillsData}
                                talentsData={talentsData}
                                weapons={weapons}
                                armor={armor}
                                items={items}
                                getSkillName={getSkillName}
                                getTalentName={getTalentName}
                                onCharacteristicChange={handleCharacteristicChange}
                                onAddSkill={handleAddSkill}
                                onRemoveSkill={handleRemoveSkill}
                                onSkillAdvancesChange={handleSkillAdvancesChange}
                                onToggleTalent={handleToggleTalent}
                                onToggleWeapon={handleToggleWeapon}
                                onToggleArmor={handleToggleArmor}
                                onToggleItem={handleToggleItem}
                            />
                        ) : selectedTemplate ? (
                            <TemplatePreview
                                template={selectedTemplate}
                                generateCount={generateCount}
                                setGenerateCount={setGenerateCount}
                                useNumberedNames={useNumberedNames}
                                setUseNumberedNames={setUseNumberedNames}
                                onGenerate={handleGenerateNPCs}
                                onEdit={() => handleEditTemplate(selectedTemplate)}
                                getSkillName={getSkillName}
                                getTalentName={getTalentName}
                                weapons={weapons}
                                armor={armor}
                                items={items}
                            />
                        ) : (
                            <div className={styles.noSelection}>
                                <p>Select a template to view details or generate NPCs</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Template Preview Component
interface TemplatePreviewProps {
    template: CharacterTemplate;
    generateCount: number;
    setGenerateCount: (count: number) => void;
    useNumberedNames: boolean;
    setUseNumberedNames: (use: boolean) => void;
    onGenerate: () => void;
    onEdit: () => void;
    getSkillName: (id: string) => string;
    getTalentName: (id: string) => string;
    weapons: { id: string; name: string }[];
    armor: { id: string; name: string }[];
    items: { id: string; name: string }[];
}

const TemplatePreview: React.FC<TemplatePreviewProps> = ({
    template,
    generateCount,
    setGenerateCount,
    useNumberedNames,
    setUseNumberedNames,
    onGenerate,
    onEdit,
    getSkillName,
    getTalentName,
    weapons,
    armor,
    items
}) => {
    const getItemName = (id: string, list: { id: string; name: string }[]) => {
        return list.find(i => i.id === id)?.name || id;
    };

    return (
        <div className={styles.templatePreview}>
            <div className={styles.previewHeader}>
                <h3>{template.name}</h3>
                <button className={styles.editButton} onClick={onEdit}>Edit Template</button>
            </div>

            <div className={styles.previewMeta}>
                <span><strong>Category:</strong> {template.category}</span>
                <span><strong>Species:</strong> {template.species}</span>
                <span><strong>Movement:</strong> {template.movement}</span>
                {template.isMinion && <span className={styles.minionBadge}>Minion View</span>}
            </div>

            {template.description && (
                <p className={styles.previewDescription}>{template.description}</p>
            )}

            <div className={styles.previewSection}>
                <h4>Characteristics</h4>
                <div className={styles.characteristicsGrid}>
                    {(Object.entries(template.characteristics) as [keyof CharacterTemplate['characteristics'], CharacteristicVariance][]).map(([key, val]) => (
                        <div key={key} className={styles.charPreview}>
                            <span className={styles.charLabel}>{key.toUpperCase()}</span>
                            <span className={styles.charValue}>{val.base} ± {val.variance}</span>
                        </div>
                    ))}
                </div>
            </div>

            {template.skills.length > 0 && (
                <div className={styles.previewSection}>
                    <h4>Skills</h4>
                    <div className={styles.skillsList}>
                        {template.skills.map(skill => (
                            <span key={skill.id} className={styles.skillTag}>
                                {getSkillName(skill.id)}: +{skill.advances}
                                {skill.advancesVariance && ` ±${skill.advancesVariance}`}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {template.talents.length > 0 && (
                <div className={styles.previewSection}>
                    <h4>Talents</h4>
                    <div className={styles.talentsList}>
                        {template.talents.map(talentId => (
                            <span key={talentId} className={styles.talentTag}>
                                {getTalentName(talentId)}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {(template.trappings.weapons.length > 0 || template.trappings.armor.length > 0 || template.trappings.items.length > 0) && (
                <div className={styles.previewSection}>
                    <h4>Trappings</h4>
                    <div className={styles.trappingsList}>
                        {template.trappings.weapons.map(id => (
                            <span key={id} className={styles.weaponTag}>⚔️ {getItemName(id, weapons)}</span>
                        ))}
                        {template.trappings.armor.map(id => (
                            <span key={id} className={styles.armorTag}>🛡️ {getItemName(id, armor)}</span>
                        ))}
                        {template.trappings.items.map(id => (
                            <span key={id} className={styles.itemTag}>📦 {getItemName(id, items)}</span>
                        ))}
                    </div>
                </div>
            )}

            <div className={styles.generateSection}>
                <h4>Generate NPCs</h4>
                <div className={styles.generateControls}>
                    <label className={styles.countLabel}>
                        Count:
                        <input
                            type="number"
                            min={1}
                            max={10}
                            value={generateCount}
                            onChange={e => setGenerateCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                            className={styles.countInput}
                        />
                    </label>
                    <label className={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            checked={useNumberedNames}
                            onChange={e => setUseNumberedNames(e.target.checked)}
                        />
                        Use numbered names (e.g., "Watchman #1")
                    </label>
                    <button className={styles.generateButton} onClick={onGenerate}>
                        Generate {generateCount} NPC{generateCount > 1 ? 's' : ''}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Template Editor Component
interface TemplateEditorProps {
    template: CharacterTemplate;
    setTemplate: (template: CharacterTemplate) => void;
    onSave: () => void;
    onCancel: () => void;
    skillsData: { id: string; name: string; characteristic: string; type: string }[];
    talentsData: { id: string; name: string }[];
    weapons: { id: string; name: string }[];
    armor: { id: string; name: string }[];
    items: { id: string; name: string }[];
    getSkillName: (id: string) => string;
    getTalentName: (id: string) => string;
    onCharacteristicChange: (key: keyof CharacterTemplate['characteristics'], field: 'base' | 'variance', value: number) => void;
    onAddSkill: (skillId: string) => void;
    onRemoveSkill: (skillId: string) => void;
    onSkillAdvancesChange: (skillId: string, advances: number, variance?: number) => void;
    onToggleTalent: (talentId: string) => void;
    onToggleWeapon: (weaponId: string) => void;
    onToggleArmor: (armorId: string) => void;
    onToggleItem: (itemId: string) => void;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({
    template,
    setTemplate,
    onSave,
    onCancel,
    skillsData,
    talentsData,
    weapons,
    armor,
    items,
    getSkillName,
    getTalentName,
    onCharacteristicChange,
    onAddSkill,
    onRemoveSkill,
    onSkillAdvancesChange,
    onToggleTalent,
    onToggleWeapon,
    onToggleArmor,
    onToggleItem
}) => {
    const [activeTab, setActiveTab] = useState<'basic' | 'skills' | 'talents' | 'trappings'>('basic');
    const [skillSearch, setSkillSearch] = useState('');
    const [talentSearch, setTalentSearch] = useState('');
    const [weaponSearch, setWeaponSearch] = useState('');
    const [armorSearch, setArmorSearch] = useState('');
    const [itemSearch, setItemSearch] = useState('');

    // Filter skills
    const filteredSkills = useMemo(() => {
        const search = skillSearch.toLowerCase();
        return skillsData.filter(s => s.type === 'skill' && s.name.toLowerCase().includes(search));
    }, [skillsData, skillSearch]);

    // Filter talents
    const filteredTalents = useMemo(() => {
        const search = talentSearch.toLowerCase();
        return talentsData.filter(t => t.name.toLowerCase().includes(search));
    }, [talentsData, talentSearch]);

    // Filter weapons
    const filteredWeapons = useMemo(() => {
        const search = weaponSearch.toLowerCase();
        return weapons.filter(w => w.name.toLowerCase().includes(search));
    }, [weapons, weaponSearch]);

    // Filter armor
    const filteredArmor = useMemo(() => {
        const search = armorSearch.toLowerCase();
        return armor.filter(a => a.name.toLowerCase().includes(search));
    }, [armor, armorSearch]);

    // Filter items
    const filteredItems = useMemo(() => {
        const search = itemSearch.toLowerCase();
        return items.filter(i => i.name.toLowerCase().includes(search));
    }, [items, itemSearch]);

    return (
        <div className={styles.templateEditor}>
            <div className={styles.editorHeader}>
                <h3>Edit Template</h3>
                <div className={styles.editorActions}>
                    <button className={styles.cancelButton} onClick={onCancel}>Cancel</button>
                    <button className={styles.saveButton} onClick={onSave}>Save Template</button>
                </div>
            </div>

            <div className={styles.editorTabs}>
                <button
                    className={`${styles.tab} ${activeTab === 'basic' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('basic')}
                >
                    Basic Info
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'skills' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('skills')}
                >
                    Skills ({template.skills.length})
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'talents' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('talents')}
                >
                    Talents ({template.talents.length})
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'trappings' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('trappings')}
                >
                    Trappings
                </button>
            </div>

            <div className={styles.editorContent}>
                {activeTab === 'basic' && (
                    <div className={styles.basicInfoTab}>
                        <div className={styles.formGroup}>
                            <label>Name</label>
                            <input
                                type="text"
                                value={template.name}
                                onChange={e => setTemplate({ ...template, name: e.target.value })}
                                className={styles.textInput}
                            />
                        </div>

                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label>Category</label>
                                <select
                                    value={template.category}
                                    onChange={e => setTemplate({ ...template, category: e.target.value as CharacterTemplateCategory })}
                                    className={styles.selectInput}
                                >
                                    {CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Species</label>
                                <input
                                    type="text"
                                    value={template.species}
                                    onChange={e => setTemplate({ ...template, species: e.target.value })}
                                    className={styles.textInput}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Movement</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={template.movement}
                                    onChange={e => setTemplate({ ...template, movement: parseInt(e.target.value) || 4 })}
                                    className={styles.numberInput}
                                />
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Description</label>
                            <textarea
                                value={template.description || ''}
                                onChange={e => setTemplate({ ...template, description: e.target.value })}
                                className={styles.textareaInput}
                                rows={3}
                            />
                        </div>

                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label>Base Wounds (optional)</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={template.baseWounds || ''}
                                    onChange={e => setTemplate({ ...template, baseWounds: e.target.value ? parseInt(e.target.value) : undefined })}
                                    placeholder="Auto-calculated"
                                    className={styles.numberInput}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Wounds Variance</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={template.woundsVariance || 0}
                                    onChange={e => setTemplate({ ...template, woundsVariance: parseInt(e.target.value) || 0 })}
                                    className={styles.numberInput}
                                />
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={template.isMinion}
                                    onChange={e => setTemplate({ ...template, isMinion: e.target.checked })}
                                />
                                Use Minion View (compact combat sheet)
                            </label>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Tags (comma-separated)</label>
                            <input
                                type="text"
                                value={(template.tags || []).join(', ')}
                                onChange={e => setTemplate({
                                    ...template,
                                    tags: e.target.value.split(',').map(t => t.trim()).filter(t => t)
                                })}
                                placeholder="e.g., City Watch, Guard, Human"
                                className={styles.textInput}
                            />
                        </div>

                        <div className={styles.characteristicsSection}>
                            <h4>Characteristics</h4>
                            <div className={styles.characteristicsEditor}>
                                {(Object.keys(template.characteristics) as (keyof CharacterTemplate['characteristics'])[]).map(charKey => (
                                    <div key={charKey} className={styles.charEditor}>
                                        <span className={styles.charLabel}>{charKey.toUpperCase()}</span>
                                        <div className={styles.charInputs}>
                                            <label>
                                                Base:
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={100}
                                                    value={template.characteristics[charKey].base}
                                                    onChange={e => onCharacteristicChange(charKey, 'base', parseInt(e.target.value) || 0)}
                                                    className={styles.charInput}
                                                />
                                            </label>
                                            <label>
                                                ±
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={20}
                                                    value={template.characteristics[charKey].variance}
                                                    onChange={e => onCharacteristicChange(charKey, 'variance', parseInt(e.target.value) || 0)}
                                                    className={styles.charInput}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'skills' && (
                    <div className={styles.skillsTab}>
                        <div className={styles.selectedItems}>
                            <h4>Selected Skills</h4>
                            {template.skills.length === 0 ? (
                                <p className={styles.noItems}>No skills added yet</p>
                            ) : (
                                <div className={styles.selectedList}>
                                    {template.skills.map(skill => (
                                        <div key={skill.id} className={styles.selectedSkill}>
                                            <span className={styles.skillName}>{getSkillName(skill.id)}</span>
                                            <div className={styles.skillAdvances}>
                                                <label>
                                                    Advances:
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={100}
                                                        value={skill.advances}
                                                        onChange={e => onSkillAdvancesChange(skill.id, parseInt(e.target.value) || 0, skill.advancesVariance)}
                                                        className={styles.advancesInput}
                                                    />
                                                </label>
                                                <label>
                                                    ±
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={20}
                                                        value={skill.advancesVariance || 0}
                                                        onChange={e => onSkillAdvancesChange(skill.id, skill.advances, parseInt(e.target.value) || undefined)}
                                                        className={styles.varianceInput}
                                                    />
                                                </label>
                                            </div>
                                            <button
                                                className={styles.removeButton}
                                                onClick={() => onRemoveSkill(skill.id)}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className={styles.availableItems}>
                            <h4>Available Skills</h4>
                            <input
                                type="text"
                                placeholder="Search skills..."
                                value={skillSearch}
                                onChange={e => setSkillSearch(e.target.value)}
                                className={styles.itemSearch}
                            />
                            <div className={styles.itemsGrid}>
                                {filteredSkills.map(skill => {
                                    const isSelected = template.skills.some(s => s.id === skill.id);
                                    return (
                                        <button
                                            key={skill.id}
                                            className={`${styles.itemButton} ${isSelected ? styles.itemSelected : ''}`}
                                            onClick={() => isSelected ? onRemoveSkill(skill.id) : onAddSkill(skill.id)}
                                        >
                                            {skill.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'talents' && (
                    <div className={styles.talentsTab}>
                        <div className={styles.selectedItems}>
                            <h4>Selected Talents</h4>
                            {template.talents.length === 0 ? (
                                <p className={styles.noItems}>No talents added yet</p>
                            ) : (
                                <div className={styles.selectedTags}>
                                    {template.talents.map(talentId => (
                                        <span key={talentId} className={styles.selectedTag}>
                                            {getTalentName(talentId)}
                                            <button onClick={() => onToggleTalent(talentId)}>✕</button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className={styles.availableItems}>
                            <h4>Available Talents</h4>
                            <input
                                type="text"
                                placeholder="Search talents..."
                                value={talentSearch}
                                onChange={e => setTalentSearch(e.target.value)}
                                className={styles.itemSearch}
                            />
                            <div className={styles.itemsGrid}>
                                {filteredTalents.map(talent => {
                                    const isSelected = template.talents.includes(talent.id);
                                    return (
                                        <button
                                            key={talent.id}
                                            className={`${styles.itemButton} ${isSelected ? styles.itemSelected : ''}`}
                                            onClick={() => onToggleTalent(talent.id)}
                                        >
                                            {talent.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'trappings' && (
                    <div className={styles.trappingsTab}>
                        <div className={styles.trappingsSection}>
                            <h4>Weapons</h4>
                            <input
                                type="text"
                                placeholder="Search weapons..."
                                value={weaponSearch}
                                onChange={e => setWeaponSearch(e.target.value)}
                                className={styles.itemSearch}
                            />
                            <div className={styles.selectedTags}>
                                {template.trappings.weapons.map(id => (
                                    <span key={id} className={styles.weaponTag}>
                                        {weapons.find(w => w.id === id)?.name || id}
                                        <button onClick={() => onToggleWeapon(id)}>✕</button>
                                    </span>
                                ))}
                            </div>
                            <div className={styles.itemsGrid}>
                                {filteredWeapons.map(weapon => {
                                    const isSelected = template.trappings.weapons.includes(weapon.id);
                                    return (
                                        <button
                                            key={weapon.id}
                                            className={`${styles.itemButton} ${isSelected ? styles.itemSelected : ''}`}
                                            onClick={() => onToggleWeapon(weapon.id)}
                                        >
                                            {weapon.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className={styles.trappingsSection}>
                            <h4>Armor</h4>
                            <input
                                type="text"
                                placeholder="Search armor..."
                                value={armorSearch}
                                onChange={e => setArmorSearch(e.target.value)}
                                className={styles.itemSearch}
                            />
                            <div className={styles.selectedTags}>
                                {template.trappings.armor.map(id => (
                                    <span key={id} className={styles.armorTag}>
                                        {armor.find(a => a.id === id)?.name || id}
                                        <button onClick={() => onToggleArmor(id)}>✕</button>
                                    </span>
                                ))}
                            </div>
                            <div className={styles.itemsGrid}>
                                {filteredArmor.map(a => {
                                    const isSelected = template.trappings.armor.includes(a.id);
                                    return (
                                        <button
                                            key={a.id}
                                            className={`${styles.itemButton} ${isSelected ? styles.itemSelected : ''}`}
                                            onClick={() => onToggleArmor(a.id)}
                                        >
                                            {a.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className={styles.trappingsSection}>
                            <h4>Items</h4>
                            <input
                                type="text"
                                placeholder="Search items..."
                                value={itemSearch}
                                onChange={e => setItemSearch(e.target.value)}
                                className={styles.itemSearch}
                            />
                            <div className={styles.selectedTags}>
                                {template.trappings.items.map(id => (
                                    <span key={id} className={styles.itemTag}>
                                        {items.find(i => i.id === id)?.name || id}
                                        <button onClick={() => onToggleItem(id)}>✕</button>
                                    </span>
                                ))}
                            </div>
                            <div className={styles.itemsGrid}>
                                {filteredItems.map(item => {
                                    const isSelected = template.trappings.items.includes(item.id);
                                    return (
                                        <button
                                            key={item.id}
                                            className={`${styles.itemButton} ${isSelected ? styles.itemSelected : ''}`}
                                            onClick={() => onToggleItem(item.id)}
                                        >
                                            {item.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TemplateManager;
