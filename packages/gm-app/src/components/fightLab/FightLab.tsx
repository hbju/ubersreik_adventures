import React, { useEffect, useMemo, useState } from 'react';
import {
    PlayerCharacterSheet,
    useGameData,
    type Armor,
    type Character,
    type CharacterTemplate,
    type EncounterCombatantConfig,
    type EncounterInitialAdvantage,
    type HeuristicProfileId,
    type Item,
    type SideId,
    type Talent,
    type Weapon,
} from '@wfrp/shared';
import { useTranslation } from 'react-i18next';
import { ItemSelectorModal } from '../ItemSelectorModal';
import { TalentSelectorModal } from '../TalentSelectorModal';
import {
    addCharacterToScenario,
    cloneScenario,
    createEmptyScenario,
    deepClone,
    materializeTemplate,
    proficiencyWarnings,
    randomSeed,
    removeCombatant,
    updateCombatant,
    updateCombatantOffset,
    updateSidePosition,
    validationView,
} from '../../fight-lab/model';
import { loadFightLabStore, saveFightLabStore } from '../../fight-lab/persistence';
import {
    EMPTY_FIGHT_LAB_STORE,
    type FightLabScenario,
    type FightLabStore,
} from '../../fight-lab/types';
import styles from './FightLab.module.css';

type WorkspaceTab = 'configurator' | 'run' | 'dashboard' | 'replay' | 'compare';
type SourceTab = 'templates' | 'library' | 'campaign';
type AdvantageCategory = keyof EncounterInitialAdvantage;

interface FightLabProps {
    characters: Character[];
    templates: CharacterTemplate[];
    onClose: () => void;
}

interface EditorSelection {
    side: SideId;
    combatantId: string;
}

const PROFILE_IDS: HeuristicProfileId[] = ['berserker', 'duellist', 'skirmisher', 'marksman', 'brute'];
const ADVANTAGE_CATEGORIES: AdvantageCategory[] = ['surprise', 'terrain', 'threat', 'manoeuvrability'];

export const FightLab: React.FC<FightLabProps> = ({ characters, templates, onClose }) => {
    const { t } = useTranslation();
    const { skills, weapons, armor, items } = useGameData();
    const [store, setStore] = useState<FightLabStore>(EMPTY_FIGHT_LAB_STORE);
    const [scenario, setScenario] = useState<FightLabScenario>(() => createEmptyScenario());
    const [savedSnapshot, setSavedSnapshot] = useState('');
    const [tab, setTab] = useState<WorkspaceTab>('configurator');
    const [sourceSide, setSourceSide] = useState<SideId | null>(null);
    const [sourceTab, setSourceTab] = useState<SourceTab>('templates');
    const [sourceSearch, setSourceSearch] = useState('');
    const [editor, setEditor] = useState<EditorSelection | null>(null);
    const [showItemSelector, setShowItemSelector] = useState(false);
    const [showTalentSelector, setShowTalentSelector] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        loadFightLabStore().then(loadedStore => {
            setStore(loadedStore);
            const selected = loadedStore.scenarios.find(candidate => candidate.id === loadedStore.selectedScenarioId)
                ?? loadedStore.scenarios[0];
            if (selected) {
                const snapshot = deepClone(selected);
                setScenario(snapshot);
                setSavedSnapshot(JSON.stringify(snapshot));
            }
            setLoaded(true);
        });
    }, []);

    const validation = useMemo(() => validationView(scenario.config), [scenario.config]);
    const dirty = savedSnapshot !== JSON.stringify(scenario);
    const currentEditorMember = editor
        ? scenario.config.sides[editor.side].find(member => member.id === editor.combatantId)
        : undefined;
    const currentEditorCharacter = currentEditorMember && 'inventory' in currentEditorMember.character
        ? currentEditorMember.character
        : undefined;

    const commitStore = async (nextStore: FightLabStore) => {
        setStore(nextStore);
        await saveFightLabStore(nextStore);
    };

    const saveScenario = async () => {
        const saved = { ...deepClone(scenario), updatedAt: new Date().toISOString() };
        const exists = store.scenarios.some(candidate => candidate.id === saved.id);
        const scenarios = exists
            ? store.scenarios.map(candidate => candidate.id === saved.id ? saved : candidate)
            : [...store.scenarios, saved];
        const nextStore = { ...store, scenarios, selectedScenarioId: saved.id };
        setScenario(deepClone(saved));
        setSavedSnapshot(JSON.stringify(saved));
        await commitStore(nextStore);
    };

    const newScenario = () => {
        const next = createEmptyScenario();
        setScenario(next);
        setSavedSnapshot('');
        setTab('configurator');
    };

    const loadScenario = (selected: FightLabScenario) => {
        const snapshot = deepClone(selected);
        setScenario(snapshot);
        setSavedSnapshot(JSON.stringify(snapshot));
        setTab('configurator');
        void commitStore({ ...store, selectedScenarioId: selected.id });
    };

    const duplicateScenario = async (selected: FightLabScenario) => {
        const copy = cloneScenario(selected);
        const nextStore = {
            ...store,
            scenarios: [...store.scenarios, copy],
            selectedScenarioId: copy.id,
        };
        setScenario(deepClone(copy));
        setSavedSnapshot(JSON.stringify(copy));
        await commitStore(nextStore);
    };

    const deleteScenario = async (scenarioId: string) => {
        const scenarios = store.scenarios.filter(candidate => candidate.id !== scenarioId);
        const fallback = scenarios[0];
        const nextStore = {
            ...store,
            scenarios,
            selectedScenarioId: fallback?.id,
        };
        await commitStore(nextStore);
        if (scenario.id === scenarioId) {
            const next = fallback ? deepClone(fallback) : createEmptyScenario();
            setScenario(next);
            setSavedSnapshot(fallback ? JSON.stringify(fallback) : '');
        }
    };

    const addSourceCharacter = (character: Character) => {
        if (!sourceSide) return;
        setScenario(current => addCharacterToScenario(current, character, sourceSide));
        setSourceSide(null);
        setSourceSearch('');
    };

    const addSourceTemplate = (template: CharacterTemplate) => {
        const names = [...characters.map(character => character.name), ...allScenarioCharacters(scenario).map(character => character.name)];
        addSourceCharacter(materializeTemplate(template, skills, names));
    };

    const updateCharacter = (updates: Partial<Character>) => {
        if (!editor || !currentEditorCharacter) return;
        setScenario(current => updateCombatant(current, editor.side, editor.combatantId, {
            character: { ...currentEditorCharacter, ...deepClone(updates) },
        }));
    };

    const addItem = (item: Armor | Weapon | Item) => {
        if (!currentEditorCharacter) return;
        const category = 'damage' in item ? 'weapons' : 'ap' in item ? 'armor' : 'items';
        updateCharacter({
            inventory: {
                ...currentEditorCharacter.inventory,
                [category]: {
                    ...currentEditorCharacter.inventory[category],
                    [item.id]: (currentEditorCharacter.inventory[category][item.id] ?? 0) + 1,
                },
            },
        });
        setShowItemSelector(false);
    };

    const addTalent = (talent: Talent) => {
        if (!currentEditorCharacter) return;
        updateCharacter({
            talents: {
                ...currentEditorCharacter.talents,
                [talent.id]: (currentEditorCharacter.talents[talent.id] ?? 0) + 1,
            },
        });
        setShowTalentSelector(false);
    };

    const sourceCharacters = sourceTab === 'library'
        ? characters.filter(character => !character.userId)
        : characters;
    const filteredTemplates = templates.filter(template => matchesSearch(template.name, sourceSearch));
    const filteredCharacters = sourceCharacters.filter(character => matchesSearch(character.name, sourceSearch));

    return (
        <section className={styles.shell} aria-label={t('fightLab.title')}>
            <header className={styles.header}>
                <div className={styles.titleBlock}>
                    <span className={styles.labMark} aria-hidden="true">FL</span>
                    <div>
                        <h1>{t('fightLab.title')}</h1>
                        <input
                            className={styles.scenarioName}
                            value={scenario.name}
                            aria-label={t('fightLab.scenarioName')}
                            onChange={event => setScenario(current => ({ ...current, name: event.target.value }))}
                        />
                    </div>
                    {dirty && <span className={styles.dirty}>{t('fightLab.unsaved')}</span>}
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.primaryButton} onClick={() => void saveScenario()}>
                        {t('fightLab.save')}
                    </button>
                    <button className={styles.iconButton} onClick={onClose} title={t('common.close')} aria-label={t('common.close')}>
                        X
                    </button>
                </div>
            </header>

            <nav className={styles.tabs} aria-label={t('fightLab.workspace')}>
                {(['configurator', 'run', 'dashboard', 'replay', 'compare'] as WorkspaceTab[]).map(workspaceTab => (
                    <button
                        key={workspaceTab}
                        className={tab === workspaceTab ? styles.activeTab : ''}
                        onClick={() => setTab(workspaceTab)}
                    >
                        {t(`fightLab.tab.${workspaceTab}`)}
                    </button>
                ))}
            </nav>

            <div className={styles.body}>
                <aside className={styles.library}>
                    <div className={styles.libraryHeader}>
                        <h2>{t('fightLab.library')}</h2>
                        <button className={styles.iconButton} onClick={newScenario} title={t('fightLab.newScenario')}>+</button>
                    </div>
                    <div className={styles.scenarioList}>
                        {!loaded && <p className={styles.muted}>{t('fightLab.loading')}</p>}
                        {loaded && store.scenarios.length === 0 && <p className={styles.muted}>{t('fightLab.emptyLibrary')}</p>}
                        {store.scenarios.map(saved => (
                            <div
                                key={saved.id}
                                className={`${styles.scenarioRow} ${saved.id === scenario.id ? styles.selectedScenario : ''}`}
                            >
                                <button className={styles.scenarioLoad} onClick={() => loadScenario(saved)}>
                                    <strong>{saved.name}</strong>
                                    <span>{saved.config.sides.ally.length} v {saved.config.sides.adversary.length}</span>
                                </button>
                                <button className={styles.rowIcon} onClick={() => void duplicateScenario(saved)} title={t('fightLab.duplicate')}>D</button>
                                <button className={styles.rowIcon} onClick={() => void deleteScenario(saved.id)} title={t('fightLab.delete')}>X</button>
                            </div>
                        ))}
                    </div>
                </aside>

                <main className={styles.workspace}>
                    {tab === 'configurator' ? (
                        <Configurator
                            scenario={scenario}
                            validation={validation}
                            weapons={weapons}
                            onChange={setScenario}
                            onAdd={setSourceSide}
                            onEdit={(side, combatantId) => setEditor({ side, combatantId })}
                        />
                    ) : (
                        <div className={styles.placeholder}>
                            <span>{t(`fightLab.placeholder.${tab}`)}</span>
                        </div>
                    )}
                </main>
            </div>

            {sourceSide && (
                <div className={styles.modalBackdrop} onMouseDown={() => setSourceSide(null)}>
                    <div className={styles.sourceDialog} onMouseDown={event => event.stopPropagation()}>
                        <header className={styles.dialogHeader}>
                            <h2>{t('fightLab.source.title')}</h2>
                            <button className={styles.iconButton} onClick={() => setSourceSide(null)} aria-label={t('common.close')}>X</button>
                        </header>
                        <div className={styles.sourceTabs}>
                            {(['templates', 'library', 'campaign'] as SourceTab[]).map(candidate => (
                                <button
                                    key={candidate}
                                    className={sourceTab === candidate ? styles.activeSourceTab : ''}
                                    onClick={() => setSourceTab(candidate)}
                                >
                                    {t(`fightLab.source.${candidate}`)}
                                </button>
                            ))}
                        </div>
                        <input
                            className={styles.search}
                            value={sourceSearch}
                            onChange={event => setSourceSearch(event.target.value)}
                            placeholder={t('fightLab.source.search')}
                            autoFocus
                        />
                        <div className={styles.sourceList}>
                            {sourceTab === 'templates'
                                ? filteredTemplates.map(template => (
                                    <button key={template.id} className={styles.sourceRow} onClick={() => addSourceTemplate(template)}>
                                        <span><strong>{template.name}</strong><small>{template.category}</small></span>
                                        <span>+</span>
                                    </button>
                                ))
                                : filteredCharacters.map(character => (
                                    <button key={character.id} className={styles.sourceRow} onClick={() => addSourceCharacter(character)}>
                                        <span>
                                            <strong>{character.name}</strong>
                                            <small>{character.userId ? t('fightLab.source.partyMember') : character.species}</small>
                                        </span>
                                        <span>+</span>
                                    </button>
                                ))}
                        </div>
                    </div>
                </div>
            )}

            {currentEditorCharacter && editor && (
                <>
                    <div className={styles.sheetBackdrop} />
                    <PlayerCharacterSheet
                        character={currentEditorCharacter}
                        isEditMode={true}
                        onEditModeToggle={() => undefined}
                        onCharacterUpdate={updateCharacter}
                        isGM={true}
                        onRemoveTalent={talentId => {
                            const nextTalents = { ...currentEditorCharacter.talents };
                            delete nextTalents[talentId];
                            updateCharacter({ talents: nextTalents });
                        }}
                        onAddTalent={() => setShowTalentSelector(true)}
                        onRemoveItem={(itemId, type) => {
                            const category = type === 'weapon' ? 'weapons' : type === 'armor' ? 'armor' : 'items';
                            const next = { ...currentEditorCharacter.inventory[category] };
                            delete next[itemId];
                            updateCharacter({
                                inventory: { ...currentEditorCharacter.inventory, [category]: next },
                            });
                        }}
                        onAddItem={() => setShowItemSelector(true)}
                        onClose={() => setEditor(null)}
                        users={[]}
                    />
                </>
            )}
            {showItemSelector && currentEditorCharacter && (
                <ItemSelectorModal onClose={() => setShowItemSelector(false)} onSelect={addItem} />
            )}
            {showTalentSelector && currentEditorCharacter && (
                <TalentSelectorModal
                    onClose={() => setShowTalentSelector(false)}
                    onSelect={addTalent}
                    character={currentEditorCharacter}
                />
            )}
        </section>
    );
};

interface ConfiguratorProps {
    scenario: FightLabScenario;
    validation: ReturnType<typeof validationView>;
    weapons: Weapon[];
    onChange: React.Dispatch<React.SetStateAction<FightLabScenario>>;
    onAdd: (side: SideId) => void;
    onEdit: (side: SideId, combatantId: string) => void;
}

const Configurator: React.FC<ConfiguratorProps> = ({
    scenario,
    validation,
    weapons,
    onChange,
    onAdd,
    onEdit,
}) => {
    const { t } = useTranslation();

    const setScenario = (next: FightLabScenario) => onChange(next);
    const updateAdvantage = (category: AdvantageCategory, side: SideId | 'none', value: number) => {
        const initialAdvantage = { ...scenario.config.initialAdvantage };
        if (side === 'none' || value <= 0) delete initialAdvantage[category];
        else initialAdvantage[category] = { side, value };
        setScenario(touch({
            ...scenario,
            config: { ...scenario.config, initialAdvantage },
        }));
    };

    return (
        <div className={styles.configurator}>
            <section className={validation.valid ? styles.validBanner : styles.invalidBanner}>
                <strong>{validation.valid ? t('fightLab.validation.valid') : t('fightLab.validation.invalid')}</strong>
                {!validation.valid && (
                    <ul>
                        {validation.errors.map((error, index) => (
                            <li key={`${error.key}-${index}`}>
                                {t(error.key, { defaultValue: error.key })}{error.detail ? ` (${error.detail})` : ''}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <div className={styles.sidesGrid}>
                {(['ally', 'adversary'] as SideId[]).map(side => (
                    <section key={side} className={styles.sideColumn}>
                        <header className={styles.sideHeader}>
                            <div>
                                <h2>{t(`fightLab.side.${side}`)}</h2>
                                <span>{scenario.config.sides[side].length} {t('fightLab.combatants')}</span>
                            </div>
                            <label>
                                {t('fightLab.sidePosition')}
                                <input
                                    type="number"
                                    value={scenario.layout.sidePositions[side]}
                                    onChange={event => setScenario(updateSidePosition(scenario, side, Number(event.target.value)))}
                                />
                            </label>
                        </header>
                        <div className={styles.combatantList}>
                            {scenario.config.sides[side].map(member => (
                                <CombatantRow
                                    key={member.id}
                                    member={member}
                                    side={side}
                                    scenario={scenario}
                                    weapons={weapons}
                                    onChange={setScenario}
                                    onEdit={() => onEdit(side, member.id)}
                                />
                            ))}
                            <button className={styles.addCombatant} onClick={() => onAdd(side)}>
                                + {t('fightLab.addCombatant')}
                            </button>
                        </div>
                    </section>
                ))}
            </div>

            <div className={styles.settingsGrid}>
                <section className={styles.settingsSection}>
                    <h2>{t('fightLab.initialAdvantage')}</h2>
                    {ADVANTAGE_CATEGORIES.map(category => {
                        const modifier = scenario.config.initialAdvantage?.[category];
                        const selected = Array.isArray(modifier) ? modifier[0] : modifier;
                        return (
                            <div className={styles.settingRow} key={category}>
                                <span>{t(`fightLab.advantage.${category}`)}</span>
                                <select
                                    value={selected?.side ?? 'none'}
                                    onChange={event => updateAdvantage(category, event.target.value as SideId | 'none', selected?.value ?? 1)}
                                >
                                    <option value="none">{t('fightLab.none')}</option>
                                    <option value="ally">{t('fightLab.side.ally')}</option>
                                    <option value="adversary">{t('fightLab.side.adversary')}</option>
                                </select>
                                <input
                                    type="number"
                                    min={0}
                                    value={selected?.value ?? 0}
                                    onChange={event => updateAdvantage(category, selected?.side ?? 'none', Number(event.target.value))}
                                />
                            </div>
                        );
                    })}
                    <div className={styles.readOnlySetting}>
                        <span>{t('fightLab.advantage.outnumbering')}</span>
                        <strong>{scenario.config.sides.ally.length} : {scenario.config.sides.adversary.length}</strong>
                    </div>
                </section>

                <section className={styles.settingsSection}>
                    <h2>{t('fightLab.rules')}</h2>
                    <Toggle
                        label={t('fightLab.suddenDeath')}
                        checked={scenario.config.toggles?.suddenDeath ?? false}
                        onChange={checked => setScenario(touch({
                            ...scenario,
                            config: {
                                ...scenario.config,
                                toggles: { ...scenario.config.toggles, suddenDeath: checked },
                            },
                        }))}
                    />
                    <Toggle
                        label={t('fightLab.shootingIntoMelee')}
                        checked={scenario.config.toggles?.shootingIntoMelee ?? false}
                        onChange={checked => setScenario(touch({
                            ...scenario,
                            config: {
                                ...scenario.config,
                                toggles: { ...scenario.config.toggles, shootingIntoMelee: checked },
                            },
                        }))}
                    />
                    <label className={styles.settingRow}>
                        <span>{t('fightLab.maxRounds')}</span>
                        <input
                            type="number"
                            min={1}
                            value={scenario.config.toggles?.maxRounds ?? 50}
                            onChange={event => setScenario(touch({
                                ...scenario,
                                config: {
                                    ...scenario.config,
                                    toggles: { ...scenario.config.toggles, maxRounds: Number(event.target.value) },
                                },
                            }))}
                        />
                    </label>
                    <label className={styles.settingRow}>
                        <span>{t('fightLab.tacticalDominantSide')}</span>
                        <select
                            value={scenario.config.toggles?.tacticalDominantSide ?? 'none'}
                            onChange={event => {
                                const value = event.target.value as SideId | 'none';
                                setScenario(touch({
                                    ...scenario,
                                    config: {
                                        ...scenario.config,
                                        toggles: {
                                            ...scenario.config.toggles,
                                            tacticalDominantSide: value === 'none' ? undefined : value,
                                        },
                                    },
                                }));
                            }}
                        >
                            <option value="none">{t('fightLab.none')}</option>
                            <option value="ally">{t('fightLab.side.ally')}</option>
                            <option value="adversary">{t('fightLab.side.adversary')}</option>
                        </select>
                    </label>
                </section>

                <section className={styles.settingsSection}>
                    <h2>{t('fightLab.batch')}</h2>
                    <label className={styles.settingRow}>
                        <span>{t('fightLab.iterations')}</span>
                        <input
                            type="number"
                            min={1}
                            value={scenario.batch.iterations}
                            onChange={event => setScenario(touch({
                                ...scenario,
                                batch: { ...scenario.batch, iterations: Math.max(1, Number(event.target.value)) },
                            }))}
                        />
                    </label>
                    <label className={styles.seedRow}>
                        <span>{t('fightLab.masterSeed')}</span>
                        <input
                            value={scenario.batch.masterSeed}
                            disabled={scenario.batch.seedLocked}
                            onChange={event => setScenario(touch({
                                ...scenario,
                                batch: { ...scenario.batch, masterSeed: event.target.value },
                            }))}
                        />
                        <button
                            className={styles.iconButton}
                            title={t('fightLab.randomizeSeed')}
                            disabled={scenario.batch.seedLocked}
                            onClick={() => setScenario(touch({
                                ...scenario,
                                batch: { ...scenario.batch, masterSeed: randomSeed() },
                            }))}
                        >
                            R
                        </button>
                        <button
                            className={`${styles.iconButton} ${scenario.batch.seedLocked ? styles.locked : ''}`}
                            title={scenario.batch.seedLocked ? t('fightLab.unlockSeed') : t('fightLab.lockSeed')}
                            onClick={() => setScenario(touch({
                                ...scenario,
                                batch: { ...scenario.batch, seedLocked: !scenario.batch.seedLocked },
                            }))}
                        >
                            {scenario.batch.seedLocked ? 'L' : 'U'}
                        </button>
                    </label>
                </section>
            </div>
        </div>
    );
};

interface CombatantRowProps {
    member: EncounterCombatantConfig;
    side: SideId;
    scenario: FightLabScenario;
    weapons: Weapon[];
    onChange: (scenario: FightLabScenario) => void;
    onEdit: () => void;
}

const CombatantRow: React.FC<CombatantRowProps> = ({
    member,
    side,
    scenario,
    weapons,
    onChange,
    onEdit,
}) => {
    const { t } = useTranslation();
    const warnings = proficiencyWarnings(member, side, weapons);
    const name = member.character.name;
    const offset = scenario.layout.offsets[member.id] ?? 0;
    return (
        <article className={styles.combatant}>
            <header className={styles.combatantHeader}>
                <div>
                    <strong>{name}</strong>
                    <span>{member.id}</span>
                </div>
                <div className={styles.rowActions}>
                    <button className={styles.rowIcon} onClick={onEdit} title={t('fightLab.edit')}>E</button>
                    <button
                        className={styles.rowIcon}
                        onClick={() => onChange(removeCombatant(scenario, side, member.id))}
                        title={t('fightLab.remove')}
                    >
                        X
                    </button>
                </div>
            </header>
            <div className={styles.combatantControls}>
                <label>
                    {t('fightLab.profile')}
                    <select
                        value={typeof member.profile === 'string' ? member.profile : 'auto'}
                        onChange={event => onChange(updateCombatant(scenario, side, member.id, {
                            profile: event.target.value === 'auto' ? undefined : event.target.value as HeuristicProfileId,
                        }))}
                    >
                        <option value="auto">{t('fightLab.profileAuto')}</option>
                        {PROFILE_IDS.map(profile => <option key={profile} value={profile}>{t(`fightLab.profileName.${profile}`)}</option>)}
                    </select>
                </label>
                <label>
                    {t('fightLab.cover')}
                    <select
                        value={member.cover === true ? 'medium' : member.cover || 'none'}
                        onChange={event => onChange(updateCombatant(scenario, side, member.id, {
                            cover: event.target.value as EncounterCombatantConfig['cover'],
                        }))}
                    >
                        {(['none', 'soft', 'medium', 'hard'] as const).map(cover => (
                            <option key={cover} value={cover}>{t(`fightLab.coverName.${cover}`)}</option>
                        ))}
                    </select>
                </label>
                <label>
                    {t('fightLab.offset')}
                    <input
                        type="number"
                        value={offset}
                        onChange={event => onChange(updateCombatantOffset(scenario, side, member.id, Number(event.target.value)))}
                    />
                </label>
            </div>
            {warnings.length > 0 && (
                <div className={styles.warnings}>
                    {warnings.map(warning => (
                        <div key={warning.weaponId} className={warning.severity === 'error' ? styles.errorWarning : styles.warning}>
                            {t(warning.i18nKey, { weapon: warning.weaponName })}
                        </div>
                    ))}
                </div>
            )}
        </article>
    );
};

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({
    label,
    checked,
    onChange,
}) => (
    <label className={styles.toggleRow}>
        <span>{label}</span>
        <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
        <span className={styles.toggleTrack} aria-hidden="true"><span /></span>
    </label>
);

function allScenarioCharacters(scenario: FightLabScenario): Character[] {
    return [...scenario.config.sides.ally, ...scenario.config.sides.adversary]
        .map(member => member.character)
        .filter((character): character is Character => 'inventory' in character);
}

function matchesSearch(value: string, search: string): boolean {
    return !search.trim() || value.toLowerCase().includes(search.trim().toLowerCase());
}

function touch(scenario: FightLabScenario): FightLabScenario {
    return { ...scenario, cachedReport: undefined, updatedAt: new Date().toISOString() };
}

export default FightLab;
