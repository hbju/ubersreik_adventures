import React from 'react';
import { Character } from '../../type/wfrp.types';

interface CharacterSelectorProps {
  characters: Character[];
  selectedCharacterId: string;
  onCharacterSelect: (id: string) => void;
}

const CharacterSelector: React.FC<CharacterSelectorProps> = ({
  characters,
  selectedCharacterId,
  onCharacterSelect,
}) => {
  return (
    <select 
      value={selectedCharacterId} 
      onChange={(e) => onCharacterSelect(e.target.value)}
      style={{ width: '100%', padding: '5px', backgroundColor: '#333', color: 'white', border: '1px solid #555' }}
    >
      <option value="manual">-- Manual Entry --</option>
      {characters.map(char => (
        <option key={char.id} value={char.id}>
          {char.name}
        </option>
      ))}
    </select>
  );
};

export default CharacterSelector;
