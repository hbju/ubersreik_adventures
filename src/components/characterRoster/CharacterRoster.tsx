import React from 'react';
import { Character } from '../../type/wfrp.types';
import styles from './CharacterRoster.module.css';

interface CharacterRosterProps {
    characters: Character[];
    openSheetIds: string[];
    onToggleCharacterSheet: (characterId: string) => void;
    onCreateCharacter: () => void;
    onGenerateNpc: () => void;
    onDeleteCharacter: (characterId: string) => void;
    onAddCombatant: (character: Character) => void;
}

const CharacterRoster: React.FC<CharacterRosterProps> = ({ characters, openSheetIds, onToggleCharacterSheet, onCreateCharacter, onGenerateNpc, onDeleteCharacter, onAddCombatant }) => {
    return (
        <div className={styles.rosterContainer}>
            <header className={styles.header}>
                <h2>Character Roster</h2>
                <div className={styles.actions}>
                    <button onClick={onCreateCharacter}>New</button>
                    <button onClick={onGenerateNpc}>Generate NPC</button>
                </div>
            </header>
            <ul className={styles.characterList}>
                {characters.map(character => {
                    const isOpen = openSheetIds.includes(character.id);
                    return (
                        <li key={character.id} className={styles.characterItem}>
                            <span className={styles.characterName}>{character.name}</span>
                            <div className={styles.itemActions}>
                                <button onClick={() => onAddCombatant(character)} className={styles.combatBtn}>
                                    ⚔️
                                </button>
                                <button
                                    onClick={() => onToggleCharacterSheet(character.id)}
                                    className={isOpen ? styles.closeBtn : styles.openBtn}>
                                    {isOpen ? 'Close' : 'Open'}
                                </button>
                                <button
                                    onClick={() => onDeleteCharacter(character.id)}
                                    className={styles.deleteBtn}>
                                    Del
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default CharacterRoster;