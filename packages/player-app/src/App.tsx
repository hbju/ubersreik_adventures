import React, { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import './App.css';

import { ConnectionScreen } from './components/ConnectionScreen';
import { CharacterSheet, Character, CharacterUpdateMessage, RequestPurchaseMessage, OpposedTestResultMessage, MapDisplay, gameData } from '@wfrp/shared';
import { TestModal } from './components/TestModal';
import { TestResultMessage, calculateCharacteristicAdvanceCost, calculateSkillAdvanceCost, allSkillsAndCharacteristics } from '@wfrp/shared';
import { TalentModal } from './components/TalentModal';
import { ShopModal } from './components/ShopModal';
import { OpposedTestModal } from './components/OpposedTestModal';
import InitiativeTracker from './components/initiativeTracker/InitiativeTracker';
import { JournalView } from './components/JournalView';


const PlayerApp: React.FC = () => {
  const { isConnected, character, shopItems, combatants, currentTurnId, currentAdvantage, opposedTestRequest, setOpposedTestRequest, journalEntries, mapPinStates, connect, disconnect, sendMessage } = useSocket();
  const [isAdvancementMode, setIsAdvancementMode] = useState(false);
  const [draftCharacter, setDraftCharacter] = useState<Character | null>(null);
  const [testModalInfo, setTestModalInfo] = useState<{ name: string, value: number } | null>(null);
  const [isTalentModalOpen, setIsTalentModalOpen] = useState(false);
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'character' | 'journal' | 'map'>('character');

  const handleSkillClick = (skillName: string, skillValue: number) => {
    setTestModalInfo({ name: skillName, value: skillValue });
  };

  const handleCharacteristicClick = (charName: string, charValue: number) => {
    setTestModalInfo({ name: charName, value: charValue });
  }

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

  const handleBuyTalent = (talentId: string, cost: number) => {
    if (!draftCharacter) return;

    if (draftCharacter.xp.current >= cost) {
      const newDraft = { ...draftCharacter };
      newDraft.xp.current -= cost;
      newDraft.talents[talentId] = (newDraft.talents[talentId] || 0) + 1;
      setDraftCharacter(newDraft);
    } else {
      alert("Not enough XP!");
    }
  };

  const handleRequestPurchase = (item: any) => {
    if (!character) return;
    
    const message: RequestPurchaseMessage = {
      type: 'REQUEST_PURCHASE',
      payload: { 
        item,
        characterId: character.id 
      }
    };
    sendMessage(message);
    setIsShopModalOpen(false);
    alert(`Purchase request sent to GM for ${item.name}`);
  };

  const handleOpposedTestRoll = (rollResult: number, successLevel: number, fortuneSpent: number, corruptionGained: number) => {
    if (!character || !opposedTestRequest) return;

    // Update character's fortune and corruption
    const updatedCharacter: Character = {
      ...character,
      status: {
        ...character.status,
        fortune: {
          ...character.status.fortune,
          current: character.status.fortune.current - fortuneSpent
        },
        corruption: {
          ...character.status.corruption,
          current: Math.min(character.status.corruption.current + corruptionGained, character.status.corruption.max)
        }
      }
    };

    // Send CHARACTER_UPDATE to sync the changes
    const updateMessage: CharacterUpdateMessage = {
      type: 'CHARACTER_UPDATE',
      payload: { character: updatedCharacter }
    };
    sendMessage(updateMessage);

    // Send the opposed test result
    const message: OpposedTestResultMessage = {
      type: 'OPPOSED_TEST_RESULT',
      payload: {
        testId: opposedTestRequest.testId,
        characterId: character.id,
        role: opposedTestRequest.role,
        rollResult,
        successLevel
      }
    };
    sendMessage(message);
    setOpposedTestRequest(null);
  };

  const activeCharacter = isAdvancementMode ? draftCharacter : character;

  if (!isConnected) {
    return <ConnectionScreen onConnect={connect} />;
  }

  return (
    <div className="player-app-container">
      {/* Navigation tabs */}
      {character && (
        <div style={{
          position: 'fixed',
          top: '10px',
          left: '10px',
          display: 'flex',
          gap: '10px',
          zIndex: 1100
        }}>
          <button
            onClick={() => setCurrentView('character')}
            style={{
              padding: '10px 20px',
              background: currentView === 'character' ? '#2d5016' : '#2c1810',
              color: '#d4af37',
              border: currentView === 'character' ? '2px solid #3d6f1f' : '2px solid #8b6914',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            ⚔️ Character
          </button>
          <button
            onClick={() => setCurrentView('journal')}
            style={{
              padding: '10px 20px',
              background: currentView === 'journal' ? '#2d5016' : '#2c1810',
              color: '#d4af37',
              border: currentView === 'journal' ? '2px solid #3d6f1f' : '2px solid #8b6914',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
              position: 'relative'
            }}
          >
            📜 Journal
            {journalEntries.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                background: '#8b0000',
                color: '#fff',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px'
              }}>
                {journalEntries.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setCurrentView('map')}
            style={{
              padding: '10px 20px',
              background: currentView === 'map' ? '#2d5016' : '#2c1810',
              color: '#d4af37',
              border: currentView === 'map' ? '2px solid #3d6f1f' : '2px solid #8b6914',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            🗺️ Map
          </button>
        </div>
      )}

      {currentView === 'character' && (
        <>
      {character && !isAdvancementMode && (
        <button onClick={handleEnterAdvancement} className='advanceControlButton'>Advance Character</button>
      )}
      {isAdvancementMode && draftCharacter && (
        <div className="advancement-controls">
          <h3>Advancement Mode</h3>
          <p>XP Available: {draftCharacter.xp.current}</p>
          {/* We'll calculate spent XP later */}
          <button onClick={() => setIsTalentModalOpen(true)} className='advanceControlButton'>Buy Talents</button>
          <button onClick={handleConfirmAdvancement} className='advanceControlButton'>Confirm Changes</button>
          <button onClick={handleCancelAdvancement} className="advanceControlButton">Cancel</button>
        </div>
      )}
      {isTalentModalOpen && draftCharacter && (
        <TalentModal
          character={draftCharacter}
          onClose={() => setIsTalentModalOpen(false)}
          onBuyTalent={handleBuyTalent}
        />
      )}
      {isShopModalOpen && character && (
        <ShopModal
          shopItems={shopItems}
          playerCurrency={character.currency}
          onClose={() => setIsShopModalOpen(false)}
          onRequestPurchase={handleRequestPurchase}
        />
      )}

      {opposedTestRequest && character && (
        <OpposedTestModal
          testId={opposedTestRequest.testId}
          role={opposedTestRequest.role}
          skillName={opposedTestRequest.skillName}
          targetNumber={opposedTestRequest.targetNumber}
          modifier={opposedTestRequest.modifier}
          fortunePoints={character.status.fortune.current}
          corruptionCurrent={character.status.corruption.current}
          corruptionMax={character.status.corruption.max}
          onRollComplete={handleOpposedTestRoll}
          onClose={() => setOpposedTestRequest(null)}
        />
      )}
      
      <InitiativeTracker 
        combatants={combatants}
        currentTurnId={currentTurnId}
        advantages={currentAdvantage}
      />
      
      {character ? (
        <CharacterSheet
          character={activeCharacter!}
          onCharacterUpdate={() => { }}
          onSkillClick={handleSkillClick}
          onCharacteristicClick={handleCharacteristicClick}
          readonly={true}
          advancementMode={isAdvancementMode}
          onCharacteristicAdvance={handleAdvanceCharacteristic}
          onSkillAdvance={handleAdvanceSkill}
          onPurchaseClick={() => setIsShopModalOpen(true)}
          showPurchaseButton={!isAdvancementMode}
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
        </>
      )}

      {/* Journal View */}
      {currentView === 'journal' && (
        <JournalView journal={journalEntries} />
      )}

      {/* Map View */}
      {currentView === 'map' && character && (
        <MapDisplay
          gameData={gameData}
          mapPinStates={mapPinStates}
          characters={[character]}
          isGM={false}
        />
      )}
    </div>
  );
};

export default PlayerApp;