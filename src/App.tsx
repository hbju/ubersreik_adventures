import MapDisplay from './components/MapDisplay';
import CharacterSheet from './components/CharacterSheet';
import CombatResolver from './components/combatResolver/CombatResolver';
import CharacterRoster from './components/characterRoster/CharacterRoster';

import React, { useState } from 'react';
import { Character } from './type/wfrp.types';
import { generateRandomNpc, createBlankCharacter } from './utils/generator';

import gameData from './data/ubersreik.json'; 
import useLocalStorageState from './hooks/useLocalStorageState';

import './App.css';

function App() {

  const [characters, setCharacters] = useLocalStorageState<Character[]>('wfrp-gm-tools-characters', gameData.characters);

  const [openSheetIds, setOpenSheetIds] = useState<string[]>([]);

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
  
  return (
    <div className="App">
      <CharacterRoster 
        characters={characters} 
        openSheetIds={openSheetIds} 
        onToggleCharacterSheet={handleToggleCharacterSheet} 
        onCreateCharacter={handleCreateCharacter}
        onGenerateNpc={handleGenerateNPC}
        onDeleteCharacter={handleDeleteCharacter}
      />

      <MapDisplay gameData={gameData} />
      {/* <CombatResolver characters={characters} /> */}

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

export default App;