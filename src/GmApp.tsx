import MapDisplay from './components/MapDisplay';
import CharacterSheet from './components/CharacterSheet';
import CombatResolver from './components/combatResolver/CombatResolver';
import CharacterRoster from './components/characterRoster/CharacterRoster';
import AtmospherePanel from './components/atmospherePanel/AtmospherePanel';
import InitiativeTracker from './components/initiativeTracker/InitiativeTracker'

import { socket, 
    Character, 
    Combatant, 
    generateRandomNpc, 
    createBlankCharacter, 
    gameData,
    calculateCharacteristicBonus
 } from '@wfrp/shared';

import React, { useState, useEffect } from 'react';
import useLocalStorageState from './hooks/useLocalStorageState';

import './GmApp.css';
import ServerStatus from './components/server/ServerStatus';

function GmApp() {
    const calculateMaxWounds = (character: Character) => {
        return calculateCharacteristicBonus(character.characteristics.t) * 2
            + calculateCharacteristicBonus(character.characteristics.s)
            + calculateCharacteristicBonus(character.characteristics.ws)
    }

    const initChars = (gameData.characters as Character[]).map(c => ({ ...c, status: { ...c.status, wounds: { ...c.status.wounds, max: calculateMaxWounds(c) } } }))

    const [characters, setCharacters] = useLocalStorageState<Character[]>('wfrp-gm-tools-characters', gameData.characters);

    const [openSheetIds, setOpenSheetIds] = useState<string[]>([]);

    const [combatants, setCombatants] = useState<Combatant[]>([]);
    const [currentTurnId, setCurrentTurnId] = useState<string | null>(null);

    const handleCharacterUpdate = (updatedCharacter: Character) => {
        setCharacters(prevChars =>
            prevChars.map(char =>
                char.id === updatedCharacter.id ? updatedCharacter : char
            )
        );
    }

    const handleToggleCharacterSheet = (characterId: string) => {
        setOpenSheetIds(prevOpenIds =>
            prevOpenIds.includes(characterId) ? prevOpenIds.filter(id => id !== characterId) : [...prevOpenIds, characterId]
        );
    }

    const handleCreateCharacter = () => {
        const newChar = createBlankCharacter();
        setCharacters(prev => [...prev, newChar]);
    };

    const handleGenerateNPC = () => {
        const newNPC = generateRandomNpc();
        setCharacters(prev => [...prev, newNPC]);
    }

    const handleDeleteCharacter = (characterId: string) => {
        console.log("trying to delete " + characterId);
        const characterToDelete = characters.find(c => c.id === characterId);
        if (!characterToDelete) return;

        console.log("deleting " + characterId);
        if (window.confirm(`Are you sure you want to delete ${characterToDelete.name}? This cannot be undone.`)) {
            setCharacters(prev => prev.filter(char => char.id !== characterId));
            setOpenSheetIds(prev => prev.filter(id => id !== characterId));
        }
    };

    const handleAddCombatant = (character: Character) => {
        // Prevent adding the same character twice
        if (combatants.some(c => c.sourceId === character.id)) return;

        const newCombatant: Combatant = {
            id: crypto.randomUUID(),
            sourceId: character.id,
            name: character.name,
            initiative: null,
            currentWounds: character.status.wounds.current,
            maxWounds: calculateMaxWounds(character),
            baseInitiative: calculateCharacteristicBonus(character.characteristics.i),
            baseAg: calculateCharacteristicBonus(character.characteristics.ag),
            isPlayer: true,
        };
        setCombatants(prev => [...prev, newCombatant]);
    };

    const handleUpdateCombatant = (updatedCombatant: Combatant) => {
        setCombatants(prev => prev.map(c => c.id === updatedCombatant.id ? updatedCombatant : c));
    };

    const handleClearCombatants = () => {
        setCombatants([]);
        setCurrentTurnId(null);
    };

    useEffect(() => {
        window.ipcRenderer.on('server-ready', () => {
            console.log("Server is ready, connecting to socket ...")
            socket.connect();
        })
        return () => { socket.disconnect(); };
    }, []);

    return (
        <div className="App">
            <ServerStatus />

            <CharacterRoster
                characters={characters}
                openSheetIds={openSheetIds}
                onToggleCharacterSheet={handleToggleCharacterSheet}
                onCreateCharacter={handleCreateCharacter}
                onGenerateNpc={handleGenerateNPC}
                onDeleteCharacter={handleDeleteCharacter}
                onAddCombatant={handleAddCombatant}
            />

            <InitiativeTracker
                combatants={combatants}
                onSetCombatants={setCombatants} // For sorting
                onUpdateCombatant={handleUpdateCombatant}
                onClearCombatants={handleClearCombatants}
                currentTurnId={currentTurnId}
                onSetCurrentTurnId={setCurrentTurnId}
            />

            <MapDisplay gameData={gameData} />
            <CombatResolver characters={characters} />

            <AtmospherePanel />

            <div className="character-sheets-container">
                {openSheetIds.map(characterId => {
                    const character = characters.find(char => char.id === characterId);

                    if (!character) return null;

                    return (
                        <CharacterSheet
                            key={character.id}
                            character={character}
                            onCharacterUpdate={handleCharacterUpdate}
                        />
                    );
                })}
            </div>
        </div>
    );
}

export default GmApp;