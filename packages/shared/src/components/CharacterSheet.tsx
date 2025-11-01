import React from 'react';
import { Character, Characteristic, Skill, SkillCharDefinition } from '../types/wfrp.types';
import { calculateCharacteristicBonus } from '../utils/skills';
import allSkillsAndCharacteristics from '../data/skillsAndCharacteristics.json';
import './CharacterSheet.css';

interface CharacterSheetProps {
    character: Character;
    onCharacterUpdate: (character: Character) => void;
    onSkillClick?: (skillName: string, skillValue: number) => void;
    onXpAward?: (amount: number) => void;
    readonly?: boolean;
    advancementMode?: boolean;
    onCharacteristicAdvance?: (charKey: keyof Character['characteristics']) => void;
    onSkillAdvance?: (skillId: string) => void;
}

const CharacterSheet: React.FC<CharacterSheetProps> = ({ character, onCharacterUpdate, onSkillClick, onXpAward, readonly, advancementMode, onCharacteristicAdvance, onSkillAdvance }) => {
    if (!character) {
        return <div className="sheetContainer">No Character Loaded</div>;
    }

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

    const baseSkills: Skill[] = (allSkillsAndCharacteristics as SkillCharDefinition[]).filter(skill => skill.type === 'skill').map(skill => ({
        id: skill.id,
        name: skill.name,
        characteristic: skill.characteristic,
        advances: 0,
        talents: 0,
        modifier: 0
    }));

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
            </div>

            <main className="mainGrid">
                <div className="characteristicsPanel">
                    <h3>Characteristics</h3>
                    <div className={advancementMode ? "characteristicsGridAdvancement" : "characteristicsGrid"}>
                        <span></span><span>Initial</span><span>Adv</span>{advancementMode && <span>Adv</span>}<span>Mod</span><span>Total</span>
                        {Object.entries(character.characteristics).map(([key, char]) => {
                            const charKey = key as keyof Character['characteristics'];
                            const total = char.initial + char.advances + char.talents + char.modifier;
                            return (
                                <React.Fragment key={key}>
                                    <label>{key.toUpperCase()}</label>
                                    <span>{char.initial}</span>
                                    { readonly ? (<span>{char.advances}</span>) : 
                                    (<input
                                        type="number"
                                        value={char.advances}
                                        onChange={e => handleCharacteristicChange(charKey, 'advances', parseInt(e.target.value, 10) || 0)}
                                        className="numericInput"
                                    />) }
                                    {advancementMode && <button onClick={() => onCharacteristicAdvance?.(charKey)} className="advanceButton">+</button>}
                                    { readonly ? (<span>{char.modifier}</span>) : (
                                    <input
                                        type="number"
                                        value={char.modifier}
                                        onChange={e => handleCharacteristicChange(charKey, 'modifier', parseInt(e.target.value, 10) || 0)}
                                        className="numericInput"
                                    />) }
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
                        { readonly ? (<span>{character.status.wounds.current}</span>) : (
                        <input
                            type="number"
                            value={character.status.wounds.current}
                            onChange={e => handleStatusChange('wounds', parseInt(e.target.value, 10) || 0)}
                            className="numericInput"
                        /> ) }
                        <span>/ {character.status.wounds.max}</span>
                        <label>Corruption</label>
                        { readonly ? (<span>{character.status.corruption.current}</span>) : (
                        <input
                            type="number"
                            value={character.status.corruption.current}
                            onChange={e => handleStatusChange('corruption', parseInt(e.target.value, 10) || 0)}
                            className="numericInput"
                        /> ) }
                        <span>/ {character.status.corruption.max}</span>
                        <label>Fate</label>
                        { readonly ? (<span>{character.status.fate.current}</span>) : (
                        <input
                            type="number"
                            value={character.status.fate.current}
                            onChange={e => handleStatusChange('fate', parseInt(e.target.value, 10) || 0)}
                            className="numericInput"
                        /> ) }
                        <span>/ {character.status.fate.max}</span>
                        <label>Fortune</label>
                        { readonly ? (<span>{character.status.fortune.current}</span>) : (
                        <input
                            type="number"
                            value={character.status.fortune.current}
                            onChange={e => handleStatusChange('fortune', parseInt(e.target.value, 10) || 0)}
                            className="numericInput"
                        /> ) }
                        <span>/ {character.status.fortune.max}</span>
                        <label>Resilience</label>
                        { readonly ? (<span>{character.status.resilience.current}</span>) : (
                        <input
                            type="number"
                            value={character.status.resilience.current}
                            onChange={e => handleStatusChange('resilience', parseInt(e.target.value, 10) || 0)}
                            className="numericInput"
                        /> ) }
                        <span>/ {character.status.resilience.max}</span>
                        <label>Resolve</label>
                        { readonly ? (<span>{character.status.resolve.current}</span>) : (
                        <input
                            type="number"
                            value={character.status.resolve.current}
                            onChange={e => handleStatusChange('resolve', parseInt(e.target.value, 10) || 0)}
                            className="numericInput"
                        /> ) }
                        <span>/ {character.status.resolve.max}</span>
                    </div>
                </div>

                <div className="skillsPanel">
                    <h3>Skills</h3>
                    <div className={advancementMode ? "skillsGridAdvancement" : "skillsGrid"}>
                        <span></span><span>Base</span><span>Char</span><span>Adv</span>{advancementMode && <span></span>}<span>Mod</span><span>Total</span><span></span>
                        {baseSkills.map(skill => {
                            const charSkill = character.skills.find(s => s.id === skill.id);
                            let charKey = charSkill ? charSkill.characteristic as keyof Character['characteristics'] : skill.characteristic as keyof Character['characteristics'];
                            const characteristicValue = character.characteristics[charKey];
                            const baseValue = characteristicValue.initial + characteristicValue.advances + characteristicValue.talents + characteristicValue.modifier;
                            const skillAdvances = charSkill ? charSkill.advances : skill.advances;
                            const skillTalents = charSkill ? charSkill.talents : skill.talents;
                            const skillModifier = charSkill ? charSkill.modifier : skill.modifier;

                            const total = baseValue + skillAdvances + skillTalents + skillModifier;
                            return (
                                <React.Fragment key={skill.id}>
                                        <label>{skill.name}</label>
                                        <span className="charValue">{skill.characteristic.toUpperCase()}</span>
                                        <span>{baseValue}</span>
                                        { readonly ? (<span>{skillAdvances}</span>) : ( 
                                        <input
                                            type="number"
                                            value={skillAdvances}
                                            onChange={e => handleSkillChange(skill.id, {
                                                ...skill,
                                                advances: Math.max(parseInt(e.target.value, 10) || 0, 0)
                                            })}
                                            className="numericInput"
                                        /> ) }
                                        {advancementMode && <button onClick={() => onSkillAdvance?.(skill.id)} className='advanceButton'>+</button>}
                                        { readonly ? (<span>{skillModifier}</span>) : (
                                        <input
                                            type="number"
                                            value={skillModifier}
                                            onChange={e => handleSkillChange(skill.id, {
                                                ...skill,
                                                modifier: Math.max(parseInt(e.target.value, 10) || 0, 0)
                                            })}
                                            className="numericInput"
                                        /> ) }
                                        <span>{total}</span>
                                        <button className="rollButton" onClick={() => onSkillClick && onSkillClick(skill.name, total)}>Roll</button>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CharacterSheet;