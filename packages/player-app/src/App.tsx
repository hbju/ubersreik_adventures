import React, { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import './App.css';

import { ConnectionScreen } from './components/ConnectionScreen';
import { CharacterSheet, Character, CharacterUpdateMessage } from '@wfrp/shared';
import { TestModal } from './components/TestModal';
import { TestResultMessage, calculateCharacteristicAdvanceCost, calculateSkillAdvanceCost, allSkillsAndCharacteristics } from '@wfrp/shared';


const PlayerApp: React.FC = () => {
  const { isConnected, character, connect, disconnect, sendMessage } = useSocket();
  const [isAdvancementMode, setIsAdvancementMode] = useState(false);
  const [draftCharacter, setDraftCharacter] = useState<Character | null>(null);
  const [testModalInfo, setTestModalInfo] = useState<{ name: string, value: number } | null>(null);


  const handleSkillClick = (skillName: string, skillValue: number) => {
    setTestModalInfo({ name: skillName, value: skillValue });
  };

  const handleRoll = (result: TestResultMessage['payload']) => {
    sendMessage({ type: 'TEST_RESULT', payload: result });
  };

  const handleEnterAdvancement = () => {
    if (!character) return;
    setDraftCharacter(JSON.parse(JSON.stringify(character)));
    setIsAdvancementMode(true);
  };

  const handleCancelAdvancement = () => {
    setDraftCharacter(null);
    setIsAdvancementMode(false);
  };

  const handleConfirmAdvancement = () => {
    if (!draftCharacter) return;
    const message: CharacterUpdateMessage = {
      type: 'CHARACTER_UPDATE',
      payload: { character: draftCharacter },
    };
    sendMessage(message);

    setIsAdvancementMode(false);
    setDraftCharacter(null);
  };

  const handleAdvanceCharacteristic = (charName: keyof Character['characteristics']) => {
    if (!draftCharacter) return;

    const advances = draftCharacter.characteristics[charName].advances;
    const cost = calculateCharacteristicAdvanceCost(advances, true);

    if (draftCharacter.xp.current >= cost) {
      const newDraft = { ...draftCharacter };
      newDraft.characteristics[charName].advances += 1;
      newDraft.xp.current -= cost;
      setDraftCharacter(newDraft);
    } else {
      alert("Not enough XP!");
    }
  };

  const handleAdvanceSkill = (skillId: string) => {
    if (!draftCharacter) return;

    let skill = draftCharacter.skills.find(s => s.id === skillId);

    if (!skill) {
      const baseSkills = allSkillsAndCharacteristics.filter(s => s.type === 'skill');
      const baseSkill = baseSkills.find(s => s.id === skillId);
      if (baseSkill) {
        skill = { ...baseSkill, advances: 0, talents: 0, modifier: 0 };
        draftCharacter.skills.push(skill);
      } else {
        alert("Skill not found!");
        return;
      }
    }

    const advances = skill.advances;
    const cost = calculateSkillAdvanceCost(advances, true);

    if (draftCharacter.xp.current >= cost) {
      const newDraft = { ...draftCharacter };
      const skillToUpdate = newDraft.skills.find(s => s.id === skillId);
      if (skillToUpdate) {
        skillToUpdate.advances += 1;
        newDraft.xp.current -= cost;
        setDraftCharacter(newDraft);
      }
    } else {
      alert("Not enough XP!");
    }
  };

  const activeCharacter = isAdvancementMode ? draftCharacter : character;

  if (!isConnected) {
    return <ConnectionScreen onConnect={connect} />;
  }

  return (
    <div className="player-app-container">
      {character && !isAdvancementMode && (
        <button onClick={handleEnterAdvancement} className='advanceControlButton'>Advance Character</button>
      )}
      {isAdvancementMode && draftCharacter && (
        <div className="advancement-controls">
          <h3>Advancement Mode</h3>
          <p>XP Available: {draftCharacter.xp.current}</p>
          {/* We'll calculate spent XP later */}
          <button onClick={handleConfirmAdvancement} className='advanceControlButton'>Confirm Changes</button>
          <button onClick={handleCancelAdvancement} className="advanceControlButton">Cancel</button>
        </div>
      )}
      {character ? (
        <CharacterSheet
          character={activeCharacter!}
          onCharacterUpdate={() => { }}
          onSkillClick={handleSkillClick}
          readonly={true}
          advancementMode={isAdvancementMode}
          onCharacteristicAdvance={handleAdvanceCharacteristic}
          onSkillAdvance={handleAdvanceSkill}
        />
      ) : (
        <div className="waiting-screen">
          <h1>Connected to the Game</h1>
          <p>Waiting for the GM to assign your character...</p>
          <button onClick={disconnect}>Disconnect</button>
        </div>
      )}
      {testModalInfo && character && (
        <TestModal
          characterName={character.name}
          testName={testModalInfo.name}
          baseTarget={testModalInfo.value}
          onClose={() => setTestModalInfo(null)}
          onRoll={handleRoll}
        />
      )}
    </div>
  );
};

export default PlayerApp;