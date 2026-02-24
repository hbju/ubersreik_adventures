import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Character, Characteristic, Skill, SkillCharDefinition, Currency, Advantages, Talent, Career, Location } from '../types/wfrp.types';
import { calculateCharacteristicBonus, calculateCharacteristicValue, getGroupedSkill, isSkillGrouped } from '../utils/skills';
import { getAvailableAdvancements } from '..';
import { useGameData } from '../hooks/useGameData';
import InventoryView from './InventoryView';
import './CharacterSheet.css';
import { getTalentCharacteristicBonus } from '../utils/talents';
import { CodexPopupTrigger } from './codex/CodexPopup';

interface CharacterSheetProps {
    character: Character;
    onCharacterUpdate: (character: Character) => void;
    onSkillClick?: (skillId: string, skillName: string, skillValue: number) => void;
    onCharacteristicClick?: (charId: string, charName: string, charValue: number) => void;
    onXpAward?: (amount: number) => void;
    onCareerManagementModalOpen?: (character: Character) => void;
    onCurrencyAward?: (newCurrency: Currency) => void;
    readonly?: boolean;
    advancementMode?: boolean;
    onCharacteristicAdvance?: (charKey: keyof Character['characteristics']) => void;
    onSkillAdvance?: (skillId: string) => void;
    onPurchaseClick?: () => void;
    showPurchaseButton?: boolean;
    advantages?: Advantages;
    onRemoveTalent?: (talentId: string) => void;
    onAddTalent?: () => void;
    onCorruptionTest?: () => void;
    onRemoveItem?: (itemId: string, type: 'weapon' | 'armor' | 'item') => void;
    onAddItem?: () => void;
    onClose?: () => void;
}

const CharacterSheetRow: React.FC<{
    charKey: keyof Character['characteristics'];
    char: Characteristic;
    character: Character;
    readonly?: boolean;
    advancementMode?: boolean;
    onCharacteristicClick?: (charId: string, charName: string, charValue: number) => void;
    onCharacteristicAdvance?: (charKey: keyof Character['characteristics']) => void;
    onCharacteristicChange: (charKey: keyof Characteristic, newValue: number) => void;
}> = ({
    charKey,
    char,
    character,
    readonly,
    advancementMode,
    onCharacteristicClick,
    onCharacteristicAdvance,
    onCharacteristicChange
}) => {
        const { t } = useTranslation();
        const { talents } = useGameData();

        const charNames: { [key: string]: string } = {
            "ws": t('stats.WS'),
            "bs": t('stats.BS'),
            "s": t('stats.S'),
            "t": t('stats.T'),
            "i": t('stats.I'),
            "ag": t('stats.Ag'),
            "int": t('stats.Int'),
            "dex": t('stats.Dex'),
            "wp": t('stats.WP'),
            "fel": t('stats.Fel')
        };
        const charTalents = getTalentCharacteristicBonus(character, talents, charKey);
        const total = char.initial + char.advances + charTalents + char.modifier;
        const isUnlocked = !character.unlockedCharacteristicIds || character.unlockedCharacteristicIds.map(id => id.toLowerCase()).includes(charKey);
        return (
            <React.Fragment>
                <button className={!isUnlocked ? "rollButton" : "rollButtonUnlocked"} onClick={() => onCharacteristicClick && onCharacteristicClick(charKey, charNames[charKey], total)}>{charKey.toUpperCase()}</button>
                {readonly ? (<span>{char.initial}</span>) :
                    (<input
                        type="number"
                        value={char.initial}
                        onChange={e => onCharacteristicChange('initial', parseInt(e.target.value, 10) || 0)}
                        className="numericInput"
                    />)}
                {readonly ? (<span>{char.advances}</span>) :
                    (<input
                        type="number"
                        value={char.advances}
                        onChange={e => onCharacteristicChange('advances', parseInt(e.target.value, 10) || 0)}
                        className="numericInput"
                    />)}
                {advancementMode && isUnlocked && <button onClick={() => onCharacteristicAdvance?.(charKey)} className="advanceButton">+</button>}
                {advancementMode && !isUnlocked && <span></span>}
                {readonly ? (<span>{char.modifier}</span>) : (
                    <input
                        type="number"
                        value={char.modifier}
                        onChange={e => onCharacteristicChange('modifier', parseInt(e.target.value, 10) || 0)}
                        className="numericInput"
                    />)}
                <span>{charTalents}</span>
                <span className="totalValue">{total}</span>
            </React.Fragment>
        );
    };

const CharacterSheet: React.FC<CharacterSheetProps> = ({
    character,
    onCharacterUpdate,
    onSkillClick,
    onCharacteristicClick,
    onXpAward,
    onCareerManagementModalOpen,
    onCurrencyAward,
    readonly,
    advancementMode,
    onCharacteristicAdvance,
    onSkillAdvance,
    onPurchaseClick,
    showPurchaseButton = false,
    advantages,
    onRemoveTalent,
    onAddTalent,
    onCorruptionTest,
    onRemoveItem,
    onAddItem,
    onClose
}) => {
    const { t } = useTranslation();
    const { skills: allSkills, talents, careers: careersData, conditions: conditionsData, mapData: gameData } = useGameData();
    const [activeTab, setActiveTab] = useState<'stats' | 'talents' | 'inventory'>('stats');

    if (!character) {
        return <div className="sheetContainer">No Character Loaded</div>;
    }

    const career = careersData.find((c: any) => c.id === character.currentCareerId);
    const careerLevel = career?.career_level.find((lvl: any) => lvl.id === character.currentCareerLevelId);

    const getConditionName = (conditionId: string): string => {
        const condition = conditionsData.find((c: any) => c.id === conditionId);
        return condition ? condition.name : conditionId;
    };

    const getConditionDescription = (conditionId: string): string => {
        const condition = conditionsData.find((c: any) => c.id === conditionId);
        return condition ? condition.description : '';
    };

    // Group conditions by ID and count them
    const getConditionCounts = (conditions: string[]): Map<string, number> => {
        const counts = new Map<string, number>();
        conditions.forEach(condId => {
            counts.set(condId, (counts.get(condId) || 0) + 1);
        });
        return counts;
    };

    const handleCareerChange = (newCareerId: string, newCareerLevelId?: string) => {
        const newCareer = careersData.find((c: any) => c.id === newCareerId);
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
                        const grouped = getGroupedSkill(skillId, allSkills);
                        if (!grouped) return { id: "", name: "Unknown Skill", characteristic: "ws", advances: 0, talents: 0, modifier: 0 };
                        return grouped;
                    }
                    const skillDef = allSkills.find((s: any) => s.id === skillId && s.type === 'skill');
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

    const handleCharacteristicChange = (
        charKey: keyof Character['characteristics'],
        field: keyof Characteristic,
        value: number) => {
        const updatedCharacter: Character = JSON.parse(JSON.stringify(character));
        updatedCharacter.characteristics[charKey][field] = Math.max(value, 0);
        onCharacterUpdate(updatedCharacter);
    }

    const handleStatusChange = (
        statusKey: keyof Character['status'],
        value: number) => {
        const updatedCharacter: Character = JSON.parse(JSON.stringify(character));
        updatedCharacter.status[statusKey].current = Math.max(value, 0);
        onCharacterUpdate(updatedCharacter);
    }

    const charSkills = character.skills
    const remainingBasicSkills: Skill[] = allSkills.filter(skill => charSkills.filter(s => s.id === skill.id).length == 0 && skill.type === 'skill' && skill.classification === 'basic').map(skill => ({
        id: skill.id,
        name: skill.name,
        characteristic: skill.characteristic,
        advances: 0,
        talents: 0,
        modifier: 0
    }));
    const baseSkills: Skill[] = [...charSkills, ...remainingBasicSkills].filter(skill => skill.id !== "ranged").sort((a, b) => a.name.localeCompare(b.name));

    const handleSkillChange = (
        skillId: string,
        newSkill: Skill) => {
        const updatedCharacter: Character = JSON.parse(JSON.stringify(character));
        const skillIndex = updatedCharacter.skills.findIndex(s => s.id === skillId);

        if (skillIndex !== -1) {
            updatedCharacter.skills[skillIndex] = newSkill;
            onCharacterUpdate(updatedCharacter);
        }
        else {
            updatedCharacter.skills.push(newSkill);
            onCharacterUpdate(updatedCharacter);
        }
    }

    const handleNameChange = (newName: string) => {
        const updatedCharacter = { ...character, name: newName };
        onCharacterUpdate(updatedCharacter);
    }

    return (
        <div className="sheetContainer">
            <header className="header">
                <input
                    type="text"
                    value={character.name}
                    onChange={e => handleNameChange(e.target.value)}
                    className="charNameInput"
                />
                {onClose && (
                    <button onClick={onClose} className="closeButton">✖</button>
                )}
            </header>

            <div className="xpPanel">
                <span>XP: {character.xp.current} / {character.xp.spent}</span>
                {
                    readonly ? (
                        <span>Career {career?.name} - {careerLevel?.name}</span>
                    ) : (
                        <div className="career"><span>Career : </span>
                            <select value={character.currentCareerId} onChange={e => handleCareerChange(e.target.value)}>
                                {(careersData as Career[]).map(c => {
                                    return (<option key={c.id} value={c.id}>{c.name}</option>);
                                }).sort((a, b) => a.props.children.localeCompare(b.props.children))}
                            </select>
                            -
                            <select value={character.currentCareerLevelId} onChange={e => handleCareerChange(character.currentCareerId, e.target.value)}>
                                {(careersData as Career[]).filter(c => c.id === character.currentCareerId).flatMap(c => c.career_level).map(level => {
                                    return (<option key={level.id} value={level.id}>{level.name}</option>);
                                })}
                            </select>
                        </div>
                    )
                }
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {!readonly && onXpAward && (
                        <div className="xpButtons">
                            <input
                                type="number"
                                min={0}
                                defaultValue={10}
                                id="xpAwardInput"
                            />
                            <button onClick={() => {
                                const input = document.getElementById('xpAwardInput') as HTMLInputElement;
                                const amount = parseInt(input.value, 10) || 0;
                                onXpAward(amount);
                            }}>Award XP</button>
                        </div>
                    )}
                    {!readonly && onCareerManagementModalOpen && (
                        <button onClick={() => onCareerManagementModalOpen(character)}>Manage Career</button>
                    )}
                </div>
            </div>
            {!readonly && onCurrencyAward && (
                <div className="currencyPanel">
                    <span>Currency: {character.currency.gc} GC - {character.currency.ss} SS - {character.currency.bp} BP</span>
                    <div className="currencyButtons">
                        GC
                        <input
                            type="number"
                            defaultValue={0}
                            id="gcAwardInput"
                        />
                        SS
                        <input
                            type="number"
                            defaultValue={0}
                            id="ssAwardInput"
                        />
                        BP
                        <input
                            type="number"
                            defaultValue={0}
                            id="bpAwardInput"
                        />
                        <button onClick={() => {
                            const inputGc = document.getElementById('gcAwardInput') as HTMLInputElement;
                            const amountGc = parseInt(inputGc.value, 10) || 0;

                            const inputSs = document.getElementById('ssAwardInput') as HTMLInputElement;
                            const amountSs = parseInt(inputSs.value, 10) || 0;

                            const inputBp = document.getElementById('bpAwardInput') as HTMLInputElement;
                            const amountBp = parseInt(inputBp.value, 10) || 0;

                            onCurrencyAward({
                                gc: amountGc,
                                ss: amountSs,
                                bp: amountBp
                            });
                        }}>Award Currency</button>
                    </div>
                </div>
            )}

            {/* Tag and Location Management (GM only, when not readonly) */}
            {!readonly && (
                <div className="tagLocationPanel">
                    <div className="tagSection">
                        <label className="panelLabel">Tags:</label>
                        <div className="tagsContainer">
                            {(character.tags || []).map((tag, index) => (
                                <span key={index} className="tagChip">
                                    {tag}
                                    <button
                                        className="tagRemoveBtn"
                                        onClick={() => {
                                            const newTags = (character.tags || []).filter((_, i) => i !== index);
                                            onCharacterUpdate({ ...character, tags: newTags });
                                        }}
                                    >×</button>
                                </span>
                            ))}
                            <input
                                type="text"
                                placeholder="Add tag..."
                                className="tagInput"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const input = e.target as HTMLInputElement;
                                        const newTag = input.value.trim();
                                        if (newTag && !(character.tags || []).includes(newTag)) {
                                            onCharacterUpdate({
                                                ...character,
                                                tags: [...(character.tags || []), newTag]
                                            });
                                            input.value = '';
                                        }
                                    }
                                }}
                            />
                        </div>
                    </div>
                    <div className="locationSection">
                        <label className="panelLabel">Location:</label>
                        <select
                            value={character.locationId || ''}
                            onChange={(e) => {
                                onCharacterUpdate({
                                    ...character,
                                    locationId: e.target.value || null
                                });
                            }}
                            className="locationSelect"
                        >
                            <option value="">No Location</option>
                            {(gameData?.locations || []).map((loc: Location) => (
                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            <div className="tabsContainer">
                <button
                    className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
                    onClick={() => setActiveTab('stats')}
                >
                    {t('sheet.characteristics')} & {t('sheet.skills')}
                </button>
                <button
                    className={`tab ${activeTab === 'talents' ? 'active' : ''}`}
                    onClick={() => setActiveTab('talents')}
                >
                    {t('sheet.talents')}
                </button>
                <button
                    className={`tab ${activeTab === 'inventory' ? 'active' : ''}`}
                    onClick={() => setActiveTab('inventory')}
                >
                    {t('sheet.inventory')}
                </button>
            </div>

            {activeTab === 'stats' && (
                <main className="mainGrid">
                    <div className="characteristicsPanel">
                        <h3>{t('sheet.characteristics')}</h3>
                        <div className={advancementMode ? "characteristicsGridAdvancement" : "characteristicsGrid"}>
                            <span></span><span>Initial</span><span>Adv</span>{advancementMode && <span></span>}<span>Mod</span><span>{t('sheet.talents')}</span><span>Total</span>
                            {Object.entries(character.characteristics).map(([key, char]) => {
                                const charKey = key as keyof Character['characteristics'];
                                return (<CharacterSheetRow
                                    key={key}
                                    charKey={charKey}
                                    char={char}
                                    character={character}
                                    readonly={readonly}
                                    advancementMode={advancementMode}
                                    onCharacteristicClick={onCharacteristicClick}
                                    onCharacteristicAdvance={onCharacteristicAdvance}
                                    onCharacteristicChange={(field, newValue) => handleCharacteristicChange(charKey, field, newValue)}
                                />)
                            })}
                        </div>
                    </div>

                    <div className="statusPanel">
                        <h3>{t('sheet.status')}</h3>
                        <div className="statusGrid">
                            <label>{t('sheet.wounds')}</label>
                            {readonly ? (<span>{character.status.wounds.current}</span>) : (
                                <input
                                    type="number"
                                    value={character.status.wounds.current}
                                    onChange={e => handleStatusChange('wounds', parseInt(e.target.value, 10) || 0)}
                                    className="numericInput"
                                />)}
                            <span>/ {character.status.wounds.max}</span>

                            {onCorruptionTest ? (
                                <button
                                    onClick={() => onCorruptionTest()}
                                    title="Test Corruption"
                                    className="rollButton"
                                >
                                    {t('sheet.corruption')}
                                </button>
                            ) : <label>{t('sheet.corruption')}</label>}
                            {readonly ? (<span>{character.status.corruption.current}</span>) : (
                                <input
                                    type="number"
                                    value={character.status.corruption.current}
                                    onChange={e => handleStatusChange('corruption', parseInt(e.target.value, 10) || 0)}
                                    className="numericInput"
                                />)}
                            <span>/ {character.status.corruption.max}</span>
                            <label>{t('sheet.fate')}</label>
                            {readonly ? (<span>{character.status.fate.current}</span>) : (
                                <input
                                    type="number"
                                    value={character.status.fate.current}
                                    onChange={e => handleStatusChange('fate', parseInt(e.target.value, 10) || 0)}
                                    className="numericInput"
                                />)}
                            <span>/ {character.status.fate.max}</span>
                            <label>{t('sheet.fortune')}</label>
                            {readonly ? (<span>{character.status.fortune.current}</span>) : (
                                <input
                                    type="number"
                                    value={character.status.fortune.current}
                                    onChange={e => handleStatusChange('fortune', parseInt(e.target.value, 10) || 0)}
                                    className="numericInput"
                                />)}
                            <span>/ {character.status.fortune.max}</span>
                            <label>{t('sheet.resilience')}</label>
                            {readonly ? (<span>{character.status.resilience.current}</span>) : (
                                <input
                                    type="number"
                                    value={character.status.resilience.current}
                                    onChange={e => handleStatusChange('resilience', parseInt(e.target.value, 10) || 0)}
                                    className="numericInput"
                                />)}
                            <span>/ {character.status.resilience.max}</span>
                            <label>{t('sheet.resolve')}</label>
                            {readonly ? (<span>{character.status.resolve.current}</span>) : (
                                <input
                                    type="number"
                                    value={character.status.resolve.current}
                                    onChange={e => handleStatusChange('resolve', parseInt(e.target.value, 10) || 0)}
                                    className="numericInput"
                                />)}
                            <span>/ {character.status.resolve.max}</span>
                        </div>
                        {character.conditions.length > 0 && (
                            <div className="conditionsPanel">
                                <h3>Active Conditions</h3>
                                <div className="conditionsList">
                                    {character.conditions.map((cond) => {
                                        return (
                                            <div
                                                key={cond.id}
                                                className="conditionItem"
                                                title={getConditionDescription(cond.id)}
                                            >
                                                <CodexPopupTrigger lookupId={`condition:${cond.id}`}>
                                                    <span className="conditionName">{getConditionName(cond.id)}</span>
                                                </CodexPopupTrigger>
                                                {cond.stack > 1 && <span className="conditionCount">×{cond.stack}</span>}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {(advantages) && (
                        <div className="advantagePanel">
                            <h3>Advantage: <span className="advantageValue">{advantages.playerAdvantage}</span></h3>
                        </div>
                    )}

                    <div className="skillsPanel">
                        <h3>{t('sheet.skills')}</h3>
                        <div className={advancementMode ? "skillsGridAdvancement" : "skillsGrid"}>
                            <span></span><span>Base</span><span>Char</span><span>Adv</span>{advancementMode && <span></span>}<span>Mod</span><span>Total</span><span></span>
                            {baseSkills.map(skill => {
                                let charKey = skill.characteristic.toLowerCase() as keyof Character['characteristics'];
                                const characteristicValue = character.characteristics[charKey];
                                const baseValue = calculateCharacteristicValue(characteristicValue);
                                const skillAdvances = skill.advances;
                                const skillTalents = skill.talents;
                                const skillModifier = skill.modifier;

                                const total = baseValue + skillAdvances + skillTalents + skillModifier;
                                const isUnlocked = !character.unlockedSkillIds || character.unlockedSkillIds.includes(skill.id);
                                return (
                                    <React.Fragment key={skill.id}>
                                        {
                                            isUnlocked ? (
                                                <span className="skillUnlockedName">{skill.name}</span>
                                            ) : (
                                                <label>{skill.name}</label>
                                            )
                                        }
                                        <span className="charValue">{skill.characteristic.toUpperCase()}</span>
                                        <span>{baseValue}</span>
                                        {readonly ? (<span>{skillAdvances}</span>) : (
                                            <input
                                                type="number"
                                                value={skillAdvances}
                                                onChange={e => handleSkillChange(skill.id, {
                                                    ...skill,
                                                    advances: Math.max(parseInt(e.target.value, 10) || 0, 0)
                                                })}
                                                className="numericInput"
                                            />)}
                                        {advancementMode && isUnlocked && <button onClick={() => onSkillAdvance?.(skill.id)} className='advanceButton'>+</button>}
                                        {advancementMode && !isUnlocked && <span></span>}
                                        {readonly ? (<span>{skillModifier}</span>) : (
                                            <input
                                                type="number"
                                                value={skillModifier}
                                                onChange={e => handleSkillChange(skill.id, {
                                                    ...skill,
                                                    modifier: Math.max(parseInt(e.target.value, 10) || 0, 0)
                                                })}
                                                className="numericInput"
                                            />)}
                                        <span>{total}</span>
                                        <button className="rollButton" onClick={() => onSkillClick && onSkillClick(skill.id, skill.name, total)}>Roll</button>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                </main>
            )}

            {activeTab === 'talents' && (
                <main className="mainGrid">
                    <div className="talentsPanel">
                        <div className="talentsHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3>{t('sheet.talents')}</h3>
                            {!readonly && onAddTalent && (
                                <button onClick={onAddTalent} className="addTalentButton">
                                    + {t('common.add')} {t('sheet.talents')}
                                </button>
                            )}
                        </div>
                        <div className="talentsList">
                            {Object.keys(character.talents).length === 0 ? (
                                <p className="noTalents">No talents acquired yet.</p>
                            ) : (
                                Object.entries(character.talents).map(([talentId, rank]) => {
                                    const talentDef = talents.find(t => t.id === talentId);
                                    if (!talentDef) return null;

                                    return (
                                        <div key={talentId} className="talentCard">
                                            <div className="talentHeader">
                                                <CodexPopupTrigger lookupId={`talent:${talentId}`}>
                                                    <span className="talentName">{talentDef.name}</span>
                                                </CodexPopupTrigger>
                                                <div>
                                                    <span className="talentRank">Rank {rank}</span>
                                                    {!readonly && onRemoveTalent && (
                                                        <button className="removeTalentButton" onClick={() => onRemoveTalent(talentId)}>X</button>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="talentDescription">{talentDef.description}</p>
                                            {talentDef.effects && talentDef.effects.length > 0 && talentDef.effects.some(effect => effect.type === 'SL_BONUS_ON_SUCCESS') && (
                                                <div className="talentTests">
                                                    <strong>Tests:</strong> {talentDef.tests.join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </main>
            )}

            {activeTab === 'inventory' && (
                <InventoryView
                    character={character}
                    onPurchaseClick={onPurchaseClick}
                    showPurchaseButton={showPurchaseButton}
                    onRemoveItem={onRemoveItem}
                    onAddItem={onAddItem}
                />
            )}
        </div>
    );
};

export default CharacterSheet;