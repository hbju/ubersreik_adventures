import MapDisplay from './components/MapDisplay';
import CharacterSheet from './components/CharacterSheet';
import CombatResolver from './components/combatResolver/CombatResolver';

import { useState } from 'react';
import { Character } from './type/wfrp.types';

import gameData from './data/ubersreik.json'; 

import { rolld100, getHitLocation } from './utils/mechanic'

import './App.css';

function App() {

  const [characters, setCharacters] = useState<Character[]>(gameData.characters);

  const handleCharacterUpdate = (updatedCharacter: Character) => {
    setCharacters(prevChars => 
      prevChars.map(char =>
        char.id === updatedCharacter.id ? updatedCharacter : char
      )
    );
  }
  
  return (
    <div className="App">
      <MapDisplay gameData={gameData} />

      <CombatResolver characters={characters} />

      <CharacterSheet 
        characters={characters} 
        onCharacterUpdate={handleCharacterUpdate} />
    </div>
  );
}

export default App;