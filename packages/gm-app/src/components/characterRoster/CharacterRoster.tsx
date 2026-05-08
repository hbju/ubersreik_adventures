import React, { useState, useMemo } from 'react';
import { Character, User, Location, Faction, useGameData } from '@wfrp/shared';
import { MapToken } from '@wfrp/shared/src/types/wfrp.types';
import styles from './CharacterRoster.module.css';
import RosterFilterBar, { CharacterTypeFilter, ViewMode } from './RosterFilterBar';
import { useCharacterContext } from '../../context/CharacterContext';

interface CharacterRosterProps {
    users: User[];
    openSheetIds: string[];
    onToggleCharacterSheet: (characterId: string) => void;
    onAssignCharacter: (userId: string, characterId: string | null) => void;
    onCreateCharacter: () => void;
    onGenerateNpc: () => void;
    onGenerateNpcDetailed?: () => void;
    onAddCombatant: (character: Character) => void;
    onFightButtonClick: () => void;
    tokens?: MapToken[];
    onPlaceToken?: (characterId: string) => void;
    onRemoveToken?: (tokenId: string) => void;
}

interface GroupedCharacters {
    [key: string]: Character[];
}

const CharacterRoster: React.FC<CharacterRosterProps> = ({
    users,
    openSheetIds,
    onToggleCharacterSheet,
    onAssignCharacter,
    onCreateCharacter,
    onGenerateNpc,
    onGenerateNpcDetailed,
    onAddCombatant,
    onFightButtonClick,
    tokens = [],
    onPlaceToken,
    onRemoveToken,
}) => {
    const { characters, deleteCharacter } = useCharacterContext();
    const { mapData: gameData } = useGameData();

    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<CharacterTypeFilter>('all');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const availableTags = useMemo(() => {
        const tagSet = new Set<string>();
        characters.forEach(char => {
            (char.tags || []).forEach(tag => tagSet.add(tag));
        });
        return Array.from(tagSet).sort();
    }, [characters]);

    const filteredCharacters = useMemo(() => {
        return characters.filter(char => {
            if (searchTerm && !char.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
            }

            if (typeFilter === 'pcs' && !char.userId) {
                return false;
            }
            if (typeFilter === 'npcs' && char.userId) {
                return false;
            }

            if (selectedTags.length > 0) {
                const charTags = char.tags || [];
                if (!selectedTags.some(tag => charTags.includes(tag))) {
                    return false;
                }
            }

            return true;
        });
    }, [characters, searchTerm, typeFilter, selectedTags]);

    const groupedCharacters = useMemo((): GroupedCharacters => {
        if (viewMode === 'list') {
            return { 'All Characters': filteredCharacters };
        }

        if (viewMode === 'location') {
            const groups: GroupedCharacters = { 'No Location': [] };
            const locations = gameData?.locations || [];

            locations.forEach((loc: Location) => {
                groups[loc.name] = [];
            });

            filteredCharacters.forEach(char => {
                if (char.locationId) {
                    const location = locations.find((loc: Location) => loc.id === char.locationId);
                    if (location) {
                        groups[location.name].push(char);
                    } else {
                        groups['No Location'].push(char);
                    }
                } else {
                    groups['No Location'].push(char);
                }
            });

            Object.keys(groups).forEach(key => {
                if (groups[key].length === 0 && key !== 'No Location') {
                    delete groups[key];
                }
            });
            if (groups['No Location'].length === 0) {
                delete groups['No Location'];
            }

            return groups;
        }
        
        return { 'All Characters': filteredCharacters };
    }, [filteredCharacters, viewMode, gameData]);

    const handleAssignChange = (character: Character, event: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedValue = event.target.value;
        if (selectedValue === '') {
            onAssignCharacter(character.userId!, null);
        } else {
            onAssignCharacter(selectedValue, character.id);
        }
    };

    const getAssignedUser = (character: Character): User | undefined => {
        return users.find(u => u.id === character.userId);
    };

    const toggleGroup = (groupName: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(groupName)) {
            newExpanded.delete(groupName);
        } else {
            newExpanded.add(groupName);
        }
        setExpandedGroups(newExpanded);
    };

    const renderCharacterItem = (character: Character) => {
        const isOpen = openSheetIds.includes(character.id);
        const assignedUser = getAssignedUser(character);
        const hasToken = tokens.some(t => t.characterId === character.id);
        const characterToken = tokens.find(t => t.characterId === character.id);

        return (
            <li key={character.id} className={styles.characterItem}>
                <span className={styles.characterName}>
                    {character.name}
                    {assignedUser && (
                        <span className={styles.userBadge}>
                            👤 {assignedUser.username}
                        </span>
                    )}
                    {hasToken && (
                        <span className={styles.tokenBadge} title="Token on map">
                            🎯
                        </span>
                    )}
                    {(character.tags && character.tags.length > 0) && (
                        <span className={styles.tagBadges}>
                            {character.tags.slice(0, 2).map(tag => (
                                <span key={tag} className={styles.tagBadge}>{tag}</span>
                            ))}
                            {character.tags.length > 2 && (
                                <span className={styles.tagBadge}>+{character.tags.length - 2}</span>
                            )}
                        </span>
                    )}
                </span>
                <div className={styles.itemActions}>
                    {(character.tags && character.tags.length > 0) && (
                        <span className={styles.tagBadges}>
                            {character.tags.slice(0, 2).map(tag => (
                                <span key={tag} className={styles.tagBadge}>{tag}</span>
                            ))}
                            {character.tags.length > 2 && (
                                <span className={styles.tagBadge}>+{character.tags.length - 2}</span>
                            )}
                        </span>
                    )}
                </div>
                <div className={styles.itemActions}>
                    {onPlaceToken && !hasToken && (
                        <button 
                            onClick={() => onPlaceToken(character.id)} 
                            className={styles.tokenBtn}
                            title="Place token on map"
                        >
                            🎯
                        </button>
                    )}
                    {onRemoveToken && hasToken && characterToken && (
                        <button 
                            onClick={() => onRemoveToken(characterToken.id)} 
                            className={styles.removeTokenBtn}
                            title="Remove token from map"
                        >
                            ❌
                        </button>
                    )}
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
                        onClick={() => deleteCharacter(character.id)}
                        className={styles.deleteBtn}>
                        Del
                    </button>
                </div>
            </li >
        );
    };

const renderGroupedView = () => {
    const groupNames = Object.keys(groupedCharacters);

    return groupNames.map(groupName => {
        const chars = groupedCharacters[groupName];
        const isExpanded = expandedGroups.has(groupName) || viewMode === 'list';

        if (viewMode === 'list') {
            return (
                <ul key="all" className={styles.characterList}>
                    {chars.map(renderCharacterItem)}
                </ul>
            );
        }

        return (
            <div key={groupName} className={styles.accordionGroup}>
                <button
                    className={styles.accordionHeader}
                    onClick={() => toggleGroup(groupName)}
                >
                    <span className={styles.accordionArrow}>{isExpanded ? '▼' : '▶'}</span>
                    <span className={styles.accordionTitle}>{groupName}</span>
                    <span className={styles.accordionCount}>({chars.length})</span>
                </button>
                {isExpanded && (
                    <ul className={styles.characterList}>
                        {chars.map(renderCharacterItem)}
                    </ul>
                )}
            </div>
        );
    });
};

return (
    <div className={styles.rosterContainer}>
        <header className={styles.header}>
            <h2>Character Roster</h2>
            <div className={styles.actions}>
                <button onClick={onCreateCharacter}>New</button>
                <button onClick={onGenerateNpc}>Quick NPC</button>
                {onGenerateNpcDetailed && (
                    <button onClick={onGenerateNpcDetailed}>Detailed NPC</button>
                )}
                <button onClick={onFightButtonClick}>Fight</button>
            </div>
        </header>

        <RosterFilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            selectedTags={selectedTags}
            onSelectedTagsChange={setSelectedTags}
            availableTags={availableTags}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
        />

        <div className={styles.rosterContent}>
            {filteredCharacters.length === 0 ? (
                <div className={styles.noResults}>No characters match the current filters</div>
            ) : (
                renderGroupedView()
            )}
        </div>
    </div>
);
};

export default CharacterRoster;