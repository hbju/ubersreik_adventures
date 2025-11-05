import React from 'react';
import { Character } from '@wfrp/shared';

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
      style={{ width: '60%', padding: '5px', backgroundColor: 'var(--color-vellum)', color: 'var(--color-ink)', border: '2px solid var(--color-leather-light)', textAlign: 'end', alignSelf: 'end', fontSize: '1rem' }}
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
