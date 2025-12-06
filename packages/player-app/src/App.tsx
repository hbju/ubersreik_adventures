import React, { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import './App.css';

import { ConnectionScreen } from './components/ConnectionScreen';
import { CharacterSheet, Character, CharacterCreationWizard, CharacterUpdateMessage, RequestPurchaseMessage, OpposedTestResultMessage, ConditionTestResultMessage, MapView, DiscoveredLocationsList, recalculateCharacterTalentBonuses, getAvailableAdvancements, hasCompletedCurrentLevel, CareerHistoryEntry, Location, useGameData, CharacterCreateMessage, PlayerUpdateCharacterMessage } from '@wfrp/shared';
import { TalentSelectionModal } from '@wfrp/shared';
import {
    TestResultMessage,
    calculateCharacteristicAdvanceCost,
    calculateSkillAdvanceCost
} from '@wfrp/shared';
import { TalentModal } from './components/TalentModal';
import { ShopModal } from './components/ShopModal';
import { OpposedTestModal } from './components/OpposedTestModal';
import { ConditionTestModal } from './components/ConditionTestModal';
import InitiativeTracker from './components/initiativeTracker/InitiativeTracker';
import { JournalView } from './components/JournalView';
import { CareerChangeModal } from './components/CareerChangeModal';
import { ReputationDisplay } from './components/ReputationDisplay';
import PlayerCharacterSheet from './components/PlayerCharacterSheet';


const PlayerApp: React.FC = () => {
    const { skills, talents, careers, items, weapons, armor, conditions, gameData } = useGameData();

    const { isConnected, isAuthenticated, authError, username, character, shopItems, combatants, currentTurnId, currentAdvantage, opposedTestRequest, setOpposedTestRequest, conditionTestRequest, setConditionTestRequest, journalEntries, mapPinStates, mapPing, factions, connect, disconnect, sendMessage } = useSocket();
    const [isAdvancementMode, setIsAdvancementMode] = useState(false);
    const [draftCharacter, setDraftCharacter] = useState<Character | null>(null);
    const [testModalInfo, setTestModalInfo] = useState<{ id: string, name: string, value: number } | null>(null);
    const [createCharacterWizardOpen, setCreateCharacterWizardOpen] = useState(false);
    const [isTalentModalOpen, setIsTalentModalOpen] = useState(false);
    const [isShopModalOpen, setIsShopModalOpen] = useState(false);
    const [currentView, setCurrentView] = useState<'character' | 'journal' | 'map' | 'reputation'>('character');
    const [isCareerChangeModalOpen, setIsCareerChangeModalOpen] = useState(false);
    const [canChangeCareer, setCanChangeCareer] = useState(false);
    const [mapViewState, setMapViewState] = useState({ scale: 0.3, offsetX: 126, offsetY: -26 });
    const [isEditMode, setIsEditMode] = useState(false);
    const [useNewSheet, setUseNewSheet] = useState(true); // Toggle between old and new sheet

    const handleSkillClick = (skillId: string, skillName: string, skillValue: number) => {
        setTestModalInfo({ id: skillId, name: skillName, value: skillValue });
    };

    const handleCharacteristicClick = (charId: string, charName: string, charValue: number) => {
        setTestModalInfo({ id: charId, name: charName, value: charValue });
    }

    // Check if the current level is completed (Task 3.2)
    useEffect(() => {
        if (character && character.currentCareerId && character.currentCareerLevelId) {
            const completed = hasCompletedCurrentLevel(character, careers);
            setCanChangeCareer(completed);
        } else {
            setCanChangeCareer(false);
        }
    }, [character]);

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

    const handleCreateCharacterComplete = (newCharacter: Character) => {
        console.log('Creating character:', username, newCharacter);
        const message: CharacterCreateMessage = {
            type: 'CHARACTER_CREATE',
            payload: { character: newCharacter, userId: username || '' },
        };
        sendMessage(message);
        setCreateCharacterWizardOpen(false);
    };

    const handleAdvanceCharacteristic = (charName: keyof Character['characteristics']) => {
        if (!draftCharacter) return;

        const advances = draftCharacter.characteristics[charName].advances;
        const cost = calculateCharacteristicAdvanceCost(advances, true);

        const currentCareer = careers.find(c => c.id === draftCharacter.currentCareerId);
        const currentLevel = currentCareer?.career_level.find(lvl => lvl.id === draftCharacter.currentCareerLevelId);

        if (draftCharacter.xp.current >= cost) {

            const careerHistoryEntry: CareerHistoryEntry = {
                careerId: draftCharacter.currentCareerId,
                careerLevelId: draftCharacter.currentCareerLevelId,
                careerName: currentCareer ? currentCareer.name : 'Unknown',
                levelName: currentLevel ? currentLevel.name : 'Unknown',
                level: currentLevel ? currentLevel.lvl : 0,
                xpSpent: cost,
                advancementType: 'characteristic' as const,
                advancementId: charName,
                advancementName: charName.toUpperCase(),
                timestamp: Date.now().toString(),
            }

            const newCareerHistory = draftCharacter.careerHistory ? [...draftCharacter.careerHistory, careerHistoryEntry] : [careerHistoryEntry];
            const newDraft = { ...draftCharacter, careerHistory: newCareerHistory };

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
            const baseSkills = skills.filter(s => s.type === 'skill');
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

            const currentCareer = careers.find(c => c.id === draftCharacter.currentCareerId);
            const currentLevel = currentCareer?.career_level.find(lvl => lvl.id === draftCharacter.currentCareerLevelId);
            const careerHistoryEntry: CareerHistoryEntry = {
                careerId: draftCharacter.currentCareerId,
                careerLevelId: draftCharacter.currentCareerLevelId,
                careerName: currentCareer ? currentCareer.name : 'Unknown',
                levelName: currentLevel ? currentLevel.name : 'Unknown',
                level: currentLevel ? currentLevel.lvl : 0,
                xpSpent: cost,
                advancementType: 'skill' as const,
                advancementId: skillId,
                advancementName: skill.name,
                timestamp: Date.now().toString(),
            }


            const newCareerHistory = draftCharacter.careerHistory ? [...draftCharacter.careerHistory, careerHistoryEntry] : [careerHistoryEntry];
            const newDraft = { ...draftCharacter, careerHistory: newCareerHistory };

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

            const currentCareer = careers.find(c => c.id === draftCharacter.currentCareerId);
            const currentLevel = currentCareer?.career_level.find(lvl => lvl.id === draftCharacter.currentCareerLevelId);

            const careerHistoryEntry: CareerHistoryEntry = {
                careerId: draftCharacter.currentCareerId,
                careerLevelId: draftCharacter.currentCareerLevelId,
                careerName: currentCareer ? currentCareer.name : 'Unknown',
                levelName: currentLevel ? currentLevel.name : 'Unknown',
                level: currentLevel ? currentLevel.lvl : 0,
                xpSpent: cost,
                advancementType: 'talent' as const,
                advancementId: talentId,
                advancementName: talents.find(t => t.id === talentId) ? talents.find(t => t.id === talentId)!.name : 'Unknown',
                timestamp: Date.now().toString(),
            }

            const newCareerHistory = draftCharacter.careerHistory ? [...draftCharacter.careerHistory, careerHistoryEntry] : [careerHistoryEntry];
            const newDraft = { ...draftCharacter, careerHistory: newCareerHistory };
            newDraft.xp.current -= cost;
            newDraft.talents[talentId] = (newDraft.talents[talentId] || 0) + 1;
            setDraftCharacter(recalculateCharacterTalentBonuses(newDraft, talents));
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

    const handleOpposedTestRoll = (
        rollResult: number, 
        successLevel: number, 
        fortuneSpent: number, 
        corruptionGained: number
    ) => {
        if (!character || !opposedTestRequest) return;

        // Send the opposed test result
        const message: OpposedTestResultMessage = {
            type: 'OPPOSED_TEST_RESULT',
            payload: {
                testId: opposedTestRequest.testId,
                characterId: character.id,
                role: opposedTestRequest.role,
                rollResult,
                successLevel,
                fortuneSpent,
                corruptionGained
            }
        };
        sendMessage(message);
        setOpposedTestRequest(null);
    };

    // To reimplement later, conditions rolls
    const handleConditionTestRoll = (testId: string, roll: number, sl: number, targetNumber: number) => {
        if (!character || !conditionTestRequest) return;

        const message: ConditionTestResultMessage = {
            type: 'CONDITION_TEST_RESULT',
            payload: {
                testId,
                conditionId: conditionTestRequest.conditionId,
                rollResult: roll,
                successLevel: sl,
                characterId: character.id,
                targetNumber
            }
        };
        sendMessage(message);
        setConditionTestRequest(null);
    };

    const handleCareerChangeRequest = (careerId: string, careerLevelId: string, careerName: string, levelName: string, xpCost: number) => {
        if (!character) return;

        const message = {
            type: 'CAREER_CHANGE_REQUEST' as const,
            payload: {
                characterId: character.id,
                characterName: character.name,
                newCareerId: careerId,
                newCareerLevelId: careerLevelId,
                newCareerName: careerName,
                newCareerLevelName: levelName,
                xpCost: xpCost
            }
        };

        sendMessage(message);
        setIsCareerChangeModalOpen(false);
        alert('Career change request sent to GM. Awaiting approval...');
    };

    // Edit Mode: Handle character updates from the new PlayerCharacterSheet
    const handleEditModeCharacterUpdate = (updates: Partial<Character>) => {
        if (!character) return;
        
        const message: PlayerUpdateCharacterMessage = {
            type: 'PLAYER_UPDATE_CHARACTER',
            payload: {
                characterId: character.id,
                updates
            }
        };
        sendMessage(message);
    };

    const handleLocationSelect = (location: Location) => {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const effectiveViewportWidth = viewportWidth;

        const targetX = effectiveViewportWidth / 2 - location.coords.x * mapViewState.scale;
        const targetY = viewportHeight / 2 - location.coords.y * mapViewState.scale;

        setMapViewState({
            scale: mapViewState.scale,
            offsetX: targetX,
            offsetY: targetY,
        });
    };

    const activeCharacter = isAdvancementMode ? draftCharacter : character;

    // Show connection screen if not authenticated
    if (!isAuthenticated) {
        return (
            <ConnectionScreen
                onConnect={connect}
                error={authError || undefined}
                isConnecting={isConnected && !isAuthenticated}
            />
        );
    }

    return (
        <div className="player-app-container">
            {/* Navigation tabs */}
            {character && (
                <div style={{
                    position: 'fixed',
                    top: '10px',
                    left: '10px',
                    display: 'grid',
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
                    <button
                        onClick={() => setCurrentView('reputation')}
                        style={{
                            padding: '10px 20px',
                            background: currentView === 'reputation' ? '#2d5016' : '#2c1810',
                            color: '#d4af37',
                            border: currentView === 'reputation' ? '2px solid #3d6f1f' : '2px solid #8b6914',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '14px'
                        }}
                    >
                        ⚖️ Reputation
                    </button>
                </div>
            )}

            <InitiativeTracker
                combatants={combatants}
                currentTurnId={currentTurnId}
                advantages={currentAdvantage}
                currentCharacterId={character?.id}
            />

            {currentView === 'character' && (
                <>
                    {character && !isAdvancementMode && (
                        <button onClick={handleEnterAdvancement} className='advanceControlButton'>Advance Character</button>
                    )}
                    {canChangeCareer && (
                        <button
                            onClick={() => setIsCareerChangeModalOpen(true)} className='advanceControlButton' style={{ background: '#2d5016', borderColor: '#3d6f1f' }}>
                            Change Career
                        </button>
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
                    {isCareerChangeModalOpen && character && (
                        <CareerChangeModal
                            character={character}
                            onRequestChange={handleCareerChangeRequest}
                            onClose={() => setIsCareerChangeModalOpen(false)}
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

                    {character ? (
                        useNewSheet ? (
                            <PlayerCharacterSheet
                                character={activeCharacter!}
                                isEditMode={isEditMode}
                                onEditModeToggle={() => setIsEditMode(!isEditMode)}
                                onCharacterUpdate={handleEditModeCharacterUpdate}
                                onSkillClick={handleSkillClick}
                                onCharacteristicClick={handleCharacteristicClick}
                                advancementMode={isAdvancementMode}
                                onCharacteristicAdvance={handleAdvanceCharacteristic}
                                onSkillAdvance={handleAdvanceSkill}
                                onPurchaseClick={() => setIsShopModalOpen(true)}
                                showPurchaseButton={!isAdvancementMode}
                            />
                        ) : (
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
                        )
                    ) : (
                        <div className="waiting-screen">
                            <h1>Connected to the Game</h1>
                            <p>Waiting for the GM to assign your character...</p>
                            <button onClick={() => setCreateCharacterWizardOpen(true)}>Create Character</button>
                            <button onClick={disconnect}>Disconnect</button>
                        </div>
                    )}
                    {testModalInfo && character && (
                        <TalentSelectionModal
                            character={character}
                            testName={testModalInfo.name}
                            testId={testModalInfo.id}
                            baseTarget={testModalInfo.value}
                            fortunePoints={character.status.fortune.current}
                            corruptionCurrent={character.status.corruption.current}
                            corruptionMax={character.status.corruption.max}
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
                <div style={{
                    display: 'flex',
                    width: '100vw',
                    height: '100vh',
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    zIndex: 1000
                }}>
                    <div style={{ flex: 1 }}>
                        <MapView
                            gameData={gameData}
                            mapPinStates={mapPinStates}
                            characters={[character]}
                            isGM={false}
                            viewState={mapViewState}
                            onViewStateChange={setMapViewState}
                            incomingPing={mapPing}
                        />
                    </div>
                    <div style={{ width: '25vw', height: '100vh', overflowY: 'auto', backgroundColor: '#1c1c1c', borderLeft: '2px solid #444', position: 'absolute', right: 0, top: 0 }}>
                        <DiscoveredLocationsList
                            locations={gameData.locations}
                            mapPinStates={mapPinStates}
                            onLocationSelect={handleLocationSelect}
                        />
                    </div>
                </div>
            )}

            {/* Reputation View */}
            {currentView === 'reputation' && character && (
                <ReputationDisplay character={character} factions={factions} />
            )}

            {createCharacterWizardOpen && (
                <CharacterCreationWizard
                    onClose={() => setCreateCharacterWizardOpen(false)}
                    onComplete={handleCreateCharacterComplete}
                />
            )}
        </div>
    );
};

export default PlayerApp;