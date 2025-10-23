import React from 'react';
import { Character, Characteristic, Skill } from '../type/wfrp.types';
import styles from './CharacterSheet.module.css';

interface CharacterSheetProps {
    characters: Character[];
    onCharacterUpdate: (character: Character) => void;
}

const CharacterSheet: React.FC<CharacterSheetProps> = ({ characters, onCharacterUpdate }) => {
    const character = characters[0];
    const characterCharacteristicsBonus = (char: Characteristic) => {
        return Math.floor((char.initial + char.advances + char.talents + char.modifier) / 10);
    }

    if (!character) {
        return <div className={styles.sheetContainer}>No Characters Loaded</div>;
    }

    const handleCharacteristicChange = (
        charKey: keyof Character['characteristics'],
        field: keyof Characteristic,
        value: number) => {
        const updatedCharacter: Character = JSON.parse(JSON.stringify(character));
        updatedCharacter.characteristics[charKey][field] = Math.max(value, 0);
        onCharacterUpdate(updatedCharacter);
    }

    const woundsMax = characterCharacteristicsBonus(character.characteristics.t) * 2
     + characterCharacteristicsBonus(character.characteristics.s)
     + characterCharacteristicsBonus(character.characteristics.ws);

    const corruptionMax = characterCharacteristicsBonus(character.characteristics.wp) +
        characterCharacteristicsBonus(character.characteristics.t);

    const handleStatusChange = (
        statusKey: keyof Character['status'],
        value: number) => {
        const updatedCharacter: Character = JSON.parse(JSON.stringify(character));
        updatedCharacter.status[statusKey].current = Math.max(value, 0);
        onCharacterUpdate(updatedCharacter);
    }

    const baseSkills: Skill[] = [
        { id: 'art', name: 'Art', characteristic: 'dex', advances: 0, talents: 0, modifier: 0 },
        { id: 'athletics', name: 'Athletics', characteristic: 'ag', advances: 0, talents: 0, modifier: 0 },
        { id: 'bribery', name: 'Bribery', characteristic: 'fel', advances: 0, talents: 0, modifier: 0 },
        { id: 'charm', name: 'Charm', characteristic: 'fel', advances: 0, talents: 0, modifier: 0 },
        { id: 'charm-animal', name: 'Charm Animal', characteristic: 'wp', advances: 0, talents: 0, modifier: 0 },
        { id: 'climb', name: 'Climb', characteristic: 's', advances: 0, talents: 0, modifier: 0 },
        { id: 'consume-alcohol', name: 'Consume Alcohol', characteristic: 't', advances: 0, talents: 0, modifier: 0 },
        { id: 'cool', name: 'Cool', characteristic: 'wp', advances: 0, talents: 0, modifier: 0 },
        { id: 'dodge', name: 'Dodge', characteristic: 'ag', advances: 0, talents: 0, modifier: 0 },
        { id: 'drive', name: 'Drive', characteristic: 'dex', advances: 0, talents: 0, modifier: 0 },
        { id: 'endurance', name: 'Endurance', characteristic: 't', advances: 0, talents: 0, modifier: 0 },
        { id: 'entertain', name: 'Entertain', characteristic: 'fel', advances: 0, talents: 0, modifier: 0 },
        { id: 'gamble', name: 'Gamble', characteristic: 'int', advances: 0, talents: 0, modifier: 0 },
        { id: 'gossip', name: 'Gossip', characteristic: 'fel', advances: 0, talents: 0, modifier: 0 },
        { id: 'haggle', name: 'Haggle', characteristic: 'fel', advances: 0, talents: 0, modifier: 0 },
        { id: 'intimidate', name: 'Intimidate', characteristic: 's', advances: 0, talents: 0, modifier: 0 },
        { id: 'intuition', name: 'Intuition', characteristic: 'i', advances: 0, talents: 0, modifier: 0 },
        { id: 'leadership', name: 'Leadership', characteristic: 'fel', advances: 0, talents: 0, modifier: 0 },
        { id: 'melee-basic', name: 'Melee (Basic)', characteristic: 'ws', advances: 0, talents: 0, modifier: 0 },
        { id: 'navigation', name: 'Navigation', characteristic: 'i', advances: 0, talents: 0, modifier: 0 },
        { id: 'outdoor-survival', name: 'Outdoor Survival', characteristic: 'int', advances: 0, talents: 0, modifier: 0 },
        { id: 'perception', name: 'Perception', characteristic: 'i', advances: 0, talents: 0, modifier: 0 },
        { id: 'ride', name: 'Ride', characteristic: 'ag', advances: 0, talents: 0, modifier: 0 },
        { id: 'stealth', name: 'Stealth', characteristic: 'ag', advances: 0, talents: 0, modifier: 0 },
    ];

    const handleSkillChange = (
        skillId: string,
        newSkill: Skill)  => {
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
        <div className={styles.sheetContainer}>
            <header className={styles.header}>
                <input
                    type="text"
                    value={character.name}
                    onChange={e => handleNameChange(e.target.value)}
                    className={styles.charNameInput}
                />
            </header>

            <main className={styles.mainGrid}>
                <div className={styles.characteristicsPanel}>
                    <h3>Characteristics</h3>
                    <div className={styles.characteristicsGrid}>
                        <span></span><span>Initial</span><span>Adv</span><span>Tlts</span><span>Mod</span><span>Total</span>
                        {Object.entries(character.characteristics).map(([key, char]) => {
                            const charKey = key as keyof Character['characteristics'];
                            const total = char.initial + char.advances + char.talents + char.modifier;
                            return (
                                <React.Fragment key={key}>
                                    <label>{key.toUpperCase()}</label>
                                    <span>{char.initial}</span>
                                    <input
                                        type="number"
                                        value={char.advances}
                                        onChange={e => handleCharacteristicChange(charKey, 'advances', parseInt(e.target.value, 10) || 0)}
                                        className={styles.numericInput}
                                    />
                                    <input
                                        type="number"
                                        value={char.talents}
                                        onChange={e => handleCharacteristicChange(charKey, 'talents', parseInt(e.target.value, 10) || 0)}
                                        className={styles.numericInput}
                                    />
                                    <input
                                        type="number"
                                        value={char.modifier}
                                        onChange={e => handleCharacteristicChange(charKey, 'modifier', parseInt(e.target.value, 10) || 0)}
                                        className={styles.numericInput}
                                    />
                                    <span className={styles.totalValue}>{total}</span>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                <div className={styles.statusPanel}>
                    <h3>Status</h3>
                    <div className={styles.statusGrid}>
                        <label>Wounds</label>
                        <input
                            type="number"
                            value={character.status.wounds.current}
                            onChange={e => handleStatusChange('wounds', parseInt(e.target.value, 10) || 0)}
                            className={styles.numericInput}
                        />
                        <span>/ {woundsMax}</span>
                        <label>Corruption</label>
                        <input
                            type="number"
                            value={character.status.corruption.current}
                            onChange={e => handleStatusChange('corruption', parseInt(e.target.value, 10) || 0)}
                            className={styles.numericInput}
                        />
                        <span>/ {corruptionMax}</span>
                        <label>Fate</label>
                        <input
                            type="number"
                            value={character.status.fate.current}
                            onChange={e => handleStatusChange('fate', parseInt(e.target.value, 10) || 0)}
                            className={styles.numericInput}
                        />
                        <span>/ {character.status.fate.max}</span>
                        <label>Fortune</label>
                        <input
                            type="number" 
                            value={character.status.fortune.current}
                            onChange={e => handleStatusChange('fortune', parseInt(e.target.value, 10) || 0)}
                            className={styles.numericInput}
                        />
                        <span>/ {character.status.fortune.max}</span>
                        <label>Resilience</label>
                        <input
                            type="number"
                            value={character.status.resilience.current}
                            onChange={e => handleStatusChange('resilience', parseInt(e.target.value, 10) || 0)}
                            className={styles.numericInput}
                        />
                        <span>/ {character.status.resilience.max}</span>
                        <label>Resolve</label>
                        <input
                            type="number"
                            value={character.status.resolve.current}
                            onChange={e => handleStatusChange('resolve', parseInt(e.target.value, 10) || 0)}
                            className={styles.numericInput}
                        />
                        <span>/ {character.status.resolve.max}</span>
                    </div>
                </div>

                <div className={styles.skillsPanel}>
                    <h3>Skills</h3>
                    <div className={styles.skillsGrid}>
                        <span></span><span>Base</span><span>Char</span><span>Adv</span><span>Tlts</span><span>Mod</span><span>Total</span>
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
                                    <span className={styles.charValue}>{skill.characteristic.toUpperCase()}</span>
                                    <span>{baseValue}</span>
                                    <input 
                                        type="number"
                                        value={skillAdvances}
                                        onChange={e => handleSkillChange(skill.id, {
                                            ...skill,
                                            advances: Math.max(parseInt(e.target.value, 10) || 0, 0)
                                        })}
                                        className={styles.numericInput}
                                    />
                                    <input
                                        type="number"
                                        value={skillTalents}
                                        onChange={e => handleSkillChange(skill.id, {
                                            ...skill,
                                            talents: Math.max(parseInt(e.target.value, 10) || 0, 0)
                                        })}
                                        className={styles.numericInput}
                                    />
                                    <input
                                        type="number"
                                        value={skillModifier}
                                        onChange={e => handleSkillChange(skill.id, {
                                            ...skill,
                                            modifier: Math.max(parseInt(e.target.value, 10) || 0, 0)
                                        })}
                                        className={styles.numericInput}
                                    />
                                    <span>{total}</span>
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