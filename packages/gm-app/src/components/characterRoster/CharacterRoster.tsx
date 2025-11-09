import React from 'react';
import { Character, User } from '@wfrp/shared';
import styles from './CharacterRoster.module.css';

interface CharacterRosterProps {
    characters: Character[];
    users: User[];
    openSheetIds: string[];
    onToggleCharacterSheet: (characterId: string) => void;
    onAssignCharacter: (userId: string, characterId: string | null) => void;
    onCreateCharacter: () => void;
    onGenerateNpc: () => void;
    onDeleteCharacter: (characterId: string) => void;
    onAddCombatant: (character: Character) => void;
    onFightButtonClick: () => void;
}

const CharacterRoster: React.FC<CharacterRosterProps> = ({ 
    characters, 
    users,
    openSheetIds, 
    onToggleCharacterSheet, 
    onAssignCharacter, 
    onCreateCharacter, 
    onGenerateNpc, 
    onDeleteCharacter, 
    onAddCombatant, 
    onFightButtonClick 
}) => {
    const handleAssignChange = (character: Character, event: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedValue = event.target.value;
        if (selectedValue === '') {
            // Unassign character
            onAssignCharacter(character.userId!, null);
        } else {
            // Assign to selected user
            onAssignCharacter(selectedValue, character.id);
        }
    };

    const getAssignedUser = (character: Character): User | undefined => {
        return users.find(u => u.id === character.userId);
    };
    
    return (
        <div className={styles.rosterContainer}>
            <header className={styles.header}>
                <h2>Character Roster</h2>
                <div className={styles.actions}>
                    <button onClick={onCreateCharacter}>New</button>
                    <button onClick={onGenerateNpc}>Generate NPC</button>
                    <button onClick={onFightButtonClick}>Fight</button>
                </div>
            </header>
            <ul className={styles.characterList}>
                {characters.map(character => {
                    const isOpen = openSheetIds.includes(character.id);
                    const assignedUser = getAssignedUser(character);
                    
                    return (
                        <li key={character.id} className={styles.characterItem}>
                            <span className={styles.characterName}>
                                {character.name}
                                {assignedUser && (
                                    <span className={styles.userBadge}>
                                        👤 {assignedUser.username}
                                    </span>
                                )}
                            </span>
                            <div className={styles.itemActions}>
                                <button onClick={() => onAddCombatant(character)} className={styles.combatBtn}>
                                    ⚔️
                                </button>
                                <select 
                                    value={character.userId || ''} 
                                    onChange={(e) => handleAssignChange(character, e)}
                                    className={styles.assignSelect}
                                >
                                    <option value="">Unassigned</option>
                                    {users.map(user => (
                                        <option key={user.id} value={user.id}>
                                            {user.username}
                                        </option>
                                    ))}
                                </select>
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