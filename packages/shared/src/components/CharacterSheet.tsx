import React, { useState } from 'react';
import { Character, Characteristic, Skill, SkillCharDefinition, Currency, Advantages, Talent, Career } from '../types/wfrp.types';
import { calculateCharacteristicBonus, getGroupedSkill, isSkillGrouped } from '../utils/skills';
import allSkillsAndCharacteristics from '../data/skillsAndCharacteristics.json';
import { getAvailableAdvancements, talentsData } from '..';
import { conditionsData } from '..';
import { careersData } from '..';
import InventoryView from './InventoryView';
import './CharacterSheet.css';
import { getTalentCharacteristicBonus } from '../utils/talents';

const talents = talentsData as Talent[];

interface CharacterSheetProps {
    character: Character;
    onCharacterUpdate: (character: Character) => void;
    onSkillClick?: (skillName: string, skillValue: number) => void;
    onCharacteristicClick?: (charName: string, charValue: number) => void;
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
}

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
    onRemoveTalent
}) => {
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
            unlockedSkillIds : availableAdvancements.skills,
            unlockedTalentIds: availableAdvancements.talents,
            skills: [
                ...character.skills,
                ...newCareerLevel.skills_ids.filter(skillId => !character.skills.some(s => s.id === skillId)).map((skillId: string) => { 
                    if (isSkillGrouped(skillId)) {
                        const grouped = getGroupedSkill(skillId);
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
                }).filter((s: Skill) => s.id !== "" ) // Filter out unknown skills
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

    const allSkills = allSkillsAndCharacteristics as SkillCharDefinition[]
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

            <div className="tabsContainer">
                <button
                    className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
                    onClick={() => setActiveTab('stats')}
                >
                    Stats & Skills
                </button>
                <button
                    className={`tab ${activeTab === 'talents' ? 'active' : ''}`}
                    onClick={() => setActiveTab('talents')}
                >
                    Talents
                </button>
                <button
                    className={`tab ${activeTab === 'inventory' ? 'active' : ''}`}
                    onClick={() => setActiveTab('inventory')}
                >
                    Inventory
                </button>
            </div>

            {activeTab === 'stats' && (
                <main className="mainGrid">
                    <div className="characteristicsPanel">
                        <h3>Characteristics</h3>
                        <div className={advancementMode ? "characteristicsGridAdvancement" : "characteristicsGrid"}>
                            <span></span><span>Initial</span><span>Adv</span>{advancementMode && <span></span>}<span>Mod</span><span>Talents</span><span>Total</span>
                            {Object.entries(character.characteristics).map(([key, char]) => {
                                const charKey = key as keyof Character['characteristics'];
                                const charNames: { [key: string]: string } = { "ws": "Weapon Skill", "bs": "Ballistic Skill", "s": "Strength", "t": "Toughness", "i": "Initiative", "ag": "Agility", "int": "Intelligence", "dex": "Dexterity", "wp": "Willpower", "fel": "Fellowship" };
                                const charTalents = getTalentCharacteristicBonus(character, charKey);
                                const total = char.initial + char.advances + charTalents + char.modifier;
                                const isUnlocked = !character.unlockedCharacteristicIds || character.unlockedCharacteristicIds.map(id => id.toLowerCase()).includes(charKey);
                                return (
                                    <React.Fragment key={key}>
                                        <button className={!isUnlocked ? "rollButton" : "rollButtonUnlocked"} onClick={() => onCharacteristicClick && onCharacteristicClick(charNames[key], total)}>{key.toUpperCase()}</button>
                                        <span>{char.initial}</span>
                                        {readonly ? (<span>{char.advances}</span>) :
                                            (<input
                                                type="number"
                                                value={char.advances}
                                                onChange={e => handleCharacteristicChange(charKey, 'advances', parseInt(e.target.value, 10) || 0)}
                                                className="numericInput"
                                            />)}
                                        {advancementMode && <button onClick={() => onCharacteristicAdvance?.(charKey)} className="advanceButton">+</button>}
                                        {readonly ? (<span>{char.modifier}</span>) : (
                                            <input
                                                type="number"
                                                value={char.modifier}
                                                onChange={e => handleCharacteristicChange(charKey, 'modifier', parseInt(e.target.value, 10) || 0)}
                                                className="numericInput"
                                            />)}
                                        <span>{charTalents}</span>
                                        <span className="totalValue">{total}</span>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>

                    <div className="statusPanel">
                        <h3>Status</h3>
                        <div className="statusGrid">
                            <label>Wounds</label>
                            {readonly ? (<span>{character.status.wounds.current}</span>) : (
                                <input
                                    type="number"
                                    value={character.status.wounds.current}
                                    onChange={e => handleStatusChange('wounds', parseInt(e.target.value, 10) || 0)}
                                    className="numericInput"
                                />)}
                            <span>/ {character.status.wounds.max}</span>
                            <label>Corruption</label>
                            {readonly ? (<span>{character.status.corruption.current}</span>) : (
                                <input
                                    type="number"
                                    value={character.status.corruption.current}
                                    onChange={e => handleStatusChange('corruption', parseInt(e.target.value, 10) || 0)}
                                    className="numericInput"
                                />)}
                            <span>/ {character.status.corruption.max}</span>
                            <label>Fate</label>
                            {readonly ? (<span>{character.status.fate.current}</span>) : (
                                <input
                                    type="number"
                                    value={character.status.fate.current}
                                    onChange={e => handleStatusChange('fate', parseInt(e.target.value, 10) || 0)}
                                    className="numericInput"
                                />)}
                            <span>/ {character.status.fate.max}</span>
                            <label>Fortune</label>
                            {readonly ? (<span>{character.status.fortune.current}</span>) : (
                                <input
                                    type="number"
                                    value={character.status.fortune.current}
                                    onChange={e => handleStatusChange('fortune', parseInt(e.target.value, 10) || 0)}
                                    className="numericInput"
                                />)}
                            <span>/ {character.status.fortune.max}</span>
                            <label>Resilience</label>
                            {readonly ? (<span>{character.status.resilience.current}</span>) : (
                                <input
                                    type="number"
                                    value={character.status.resilience.current}
                                    onChange={e => handleStatusChange('resilience', parseInt(e.target.value, 10) || 0)}
                                    className="numericInput"
                                />)}
                            <span>/ {character.status.resilience.max}</span>
                            <label>Resolve</label>
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
                                        console.log(cond);
                                        return (
                                            <div
                                                key={cond.id}
                                                className="conditionItem"
                                                title={getConditionDescription(cond.id)}
                                            >
                                                <span className="conditionName">{getConditionName(cond.id)}</span>
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
                        <h3>Skills</h3>
                        <div className={advancementMode ? "skillsGridAdvancement" : "skillsGrid"}>
                            <span></span><span>Base</span><span>Char</span><span>Adv</span>{advancementMode && <span></span>}<span>Mod</span><span>Total</span><span></span>
                            {baseSkills.map(skill => {
                                let charKey = skill.characteristic as keyof Character['characteristics'];
                                const characteristicValue = character.characteristics[charKey];
                                const baseValue = characteristicValue.initial + characteristicValue.advances + characteristicValue.talents + characteristicValue.modifier;
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
                                        {advancementMode && <button onClick={() => onSkillAdvance?.(skill.id)} className='advanceButton'>+</button>}
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
                                        <button className="rollButton" onClick={() => onSkillClick && onSkillClick(skill.name, total)}>Roll</button>
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
                        <h3>Talents</h3>
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
                                                <span className="talentName">{talentDef.name}</span>
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
                                                    <strong>Tests:</strong> {talentDef.effects.filter(effect => effect.type === 'SL_BONUS_ON_SUCCESS').map(effect => effect.appliesTo).join(', ')}
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
                />
            )}
        </div>
    );
};

export default CharacterSheet;