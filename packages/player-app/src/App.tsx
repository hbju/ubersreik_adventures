import React, { useState, useEffect, useCallback } from 'react';
import { useSocket } from './hooks/useSocket';
import './App.css';

import Update from './components/update';
import { ConnectionScreen } from './components/ConnectionScreen';
import {
    CharacterSheet,
    Character,
    CharacterCreationWizard,
    CharacterUpdateMessage,
    RequestPurchaseMessage,
    OpposedTestResultMessage,
    ConditionTestResultMessage,
    MapView,
    DiscoveredLocationsList,
    recalculateCharacterTalentBonuses,
    getAvailableAdvancements,
    hasCompletedCurrentLevel,
    CareerHistoryEntry,
    Location,
    useGameData,
    CharacterCreateMessage,
    PlayerUpdateCharacterMessage,
    ShopEvaluateRequestMessage,
    ShopPurchaseRequestMessage,
    TalentSelectionModal,
    PlayerCharacterSheet,
    TestResultMessage,
    calculateCharacteristicAdvanceCost,
    calculateSkillAdvanceCost,
    TokenMoveMessage,
    MapAddPinMessage,
    MapRemovePinMessage,
    MapPingRequestMessage,
    UserMapPin,
    ChatBox,
    ChatMessage,
    ChatSendMessage,
    Weapon,
    RollWithIntentMessage,
    DateWeatherWidget,
    NotebookView,
    NotebookUpdateMessage,
    Notebook,
} from '@wfrp/shared';

import { TalentModal } from './components/TalentModal';
import { ShopModal } from './components/ShopModal';
import { OpposedTestModal } from './components/OpposedTestModal';
import InitiativeTracker from './components/initiativeTracker/InitiativeTracker';
import { JournalView } from './components/JournalView';
import { CareerChangeModal } from './components/CareerChangeModal';
import { ReputationDisplay } from './components/ReputationDisplay';
import { QuestJournal } from './components/journal/QuestJournal';
import { MapTransitionOverlay } from './components/MapTransitionOverlay';
import { ActionBar } from './components/actionbar';
import { Quest, QuestUpdateMessage, QuestDeleteMessage, CodexProvider, CommandPalette, CodexViewer, CodexPopupModal, useCodex, useKeyboardShortcuts, ShortcutsHelpOverlay, ShortcutsSettings } from '@wfrp/shared';
import type { CodexDataSources, ShortcutAction } from '@wfrp/shared';
import { PlayerTimeline } from './components/timeline/PlayerTimeline';
import { PlayerFightScreen } from './components/fight/PlayerFightScreen';

/** Small wrapper so we can call useCodex inside CodexProvider */
const CodexNavButton: React.FC = () => {
    const { openViewer } = useCodex();
    return (
        <button
            onClick={() => openViewer('md:general/welcome')}
            style={{
                padding: '10px 20px',
                background: '#2c1810',
                color: '#d4af37',
                border: '2px solid #8b6914',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.75rem',
                minWidth: '10%'
            }}
        >
            📚 Codex
        </button>
    );
};


const PlayerApp: React.FC = () => {
    const { skills, talents, careers, items, weapons, armor, conditions, qualities, shops: shopDefinitions, mapData, maps, mapsList } = useGameData();

    // Codex data sources
    const codexDataSources: CodexDataSources = React.useMemo(() => ({
        talents, skills, careers, conditions, qualities: qualities ?? [],
    }), [talents, skills, careers, conditions, qualities]);

    const { isConnected, isAuthenticated, authError, username, userId, playerColor, character, shopItems, shops, combatants, currentTurnId, currentAdvantage, opposedTestRequest, setOpposedTestRequest, conditionTestRequest, setConditionTestRequest, journalEntries, mapPinStates, mapPing, factions, locationTerritories, quests, tokens, userPins, chatMessages, setChatMessages, activeMapId, isMapTransitioning, setIsMapTransitioning, calendarDate, calendarEvents, calendarWeather, notebook, fightState, pendingDecision, connect, disconnect, sendMessage, submitDecision } = useSocket();

    const currentMapData = React.useMemo(() => {
        return maps[activeMapId] || mapData;
    }, [maps, activeMapId, mapData]);

    const [isAdvancementMode, setIsAdvancementMode] = useState(false);
    const [draftCharacter, setDraftCharacter] = useState<Character | null>(null);
    const [testModalInfo, setTestModalInfo] = useState<{ id: string, name: string, value: number } | null>(null);
    const [weaponRollInfo, setWeaponRollInfo] = useState<{
        weapon: Weapon;
        skillId: string;
        skillName: string;
        skillValue: number;
        weaponDamage: number;
    } | null>(null);
    const [defenseRollInfo, setDefenseRollInfo] = useState<{
        skillId: string;
        skillName: string;
        skillValue: number;
    } | null>(null);
    const [createCharacterWizardOpen, setCreateCharacterWizardOpen] = useState(false);
    const [isTalentModalOpen, setIsTalentModalOpen] = useState(false);
    const [isShopModalOpen, setIsShopModalOpen] = useState(false);
    const [currentView, setCurrentView] = useState<'character' | 'journal' | 'quests' | 'map' | 'reputation' | 'calendar' | 'notebook' | 'fight'>('character');
    const [isCareerChangeModalOpen, setIsCareerChangeModalOpen] = useState(false);
    const [canChangeCareer, setCanChangeCareer] = useState(false);
    const [mapViewState, setMapViewState] = useState({ scale: 0.3, offsetX: 126, offsetY: -26 });
    const [locationTags, setLocationTags] = useState<string[]>([]);
    const [isEditMode, setIsEditMode] = useState(false);
    const [useNewSheet, setUseNewSheet] = useState(true); // Toggle between old and new sheet
    const [showChat, setShowChat] = useState(false);

    const chatSenderName = character?.name || username || 'Player';

    // Derive the player's actor ID from their character ID
    const myActorId = character && fightState
        ? Object.keys(fightState.stateView.combatants).find(id => id === character.id) ?? null
        : null;

    // Auto-activate fight tab when a fight starts; return to character tab when it ends
    useEffect(() => {
        if (fightState) {
            setCurrentView('fight');
        } else if (currentView === 'fight') {
            setCurrentView('character');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fightState]);

    // --- Keyboard Shortcuts ---
    const shortcutActions: ShortcutAction[] = React.useMemo(() => [
        { id: 'tab-character', label: 'shortcuts.action.tabCharacter', category: 'shortcuts.category.navigation', defaultBinding: { key: '1' }, handler: () => setCurrentView('character') },
        { id: 'tab-notebook', label: 'shortcuts.action.tabNotebook', category: 'shortcuts.category.navigation', defaultBinding: { key: '2' }, handler: () => setCurrentView('notebook') },
        { id: 'tab-map', label: 'shortcuts.action.tabMap', category: 'shortcuts.category.navigation', defaultBinding: { key: '3' }, handler: () => setCurrentView('map') },
        { id: 'tab-journal', label: 'shortcuts.action.tabJournal', category: 'shortcuts.category.navigation', defaultBinding: { key: '4' }, handler: () => setCurrentView('journal') },
        { id: 'tab-quests', label: 'shortcuts.action.tabQuests', category: 'shortcuts.category.navigation', defaultBinding: { key: '5' }, handler: () => setCurrentView('quests') },
        { id: 'tab-calendar', label: 'shortcuts.action.tabCalendar', category: 'shortcuts.category.navigation', defaultBinding: { key: '6' }, handler: () => setCurrentView('calendar') },
        { id: 'focus-chat', label: 'shortcuts.action.focusChat', category: 'shortcuts.category.actions', defaultBinding: { key: 'c' }, handler: () => setShowChat(true) },
        { id: 'dice-tray', label: 'shortcuts.action.diceTray', category: 'shortcuts.category.actions', defaultBinding: { key: 'd' }, handler: () => setTestModalInfo({ id: 'quick', name: 'Quick Roll', value: 0 }) },
        { id: 'open-codex', label: 'shortcuts.action.openCodex', category: 'shortcuts.category.actions', defaultBinding: { key: 'k', ctrl: true } },
        { id: 'help', label: 'shortcuts.action.help', category: 'shortcuts.category.actions', defaultBinding: { key: 'M' } },
        { id: 'close-modal', label: 'shortcuts.action.closeModal', category: 'shortcuts.category.actions', defaultBinding: { key: 'Escape' }, handler: () => {
            if (isShopModalOpen) setIsShopModalOpen(false);
            else if (isTalentModalOpen) setIsTalentModalOpen(false);
            else if (isCareerChangeModalOpen) setIsCareerChangeModalOpen(false);
            else if (testModalInfo) setTestModalInfo(null);
            else if (showChat) setShowChat(false);
            else if (currentView === 'calendar') setCurrentView('character');
        }},
    ], [isShopModalOpen, isTalentModalOpen, isCareerChangeModalOpen, testModalInfo, showChat]);

    const { shortcuts, overrides, conflicts, isHelpOpen, setHelpOpen, rebind, resetBinding, resetAll } = useKeyboardShortcuts({ actions: shortcutActions, enabled: isAuthenticated });
    const [showShortcutSettings, setShowShortcutSettings] = useState(false);

    const handleSkillClick = (skillId: string, skillName: string, skillValue: number) => {
        setTestModalInfo({ id: skillId, name: skillName, value: skillValue });
    };

    const handleCharacteristicClick = (charId: string, charName: string, charValue: number) => {
        setTestModalInfo({ id: charId, name: charName, value: charValue });
    }

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

    // Handle weapon attack/defense roll click - opens the talent selection modal for the roll
    const handleWeaponRoll = (weapon: Weapon, skillId: string, skillName: string, skillValue: number, weaponDamage: number) => {
        setWeaponRollInfo({ weapon, skillId, skillName, skillValue, weaponDamage });
    };

    // Handle defense roll (Dodge) click
    const handleDefendRoll = (skillId: string, skillName: string, skillValue: number) => {
        setDefenseRollInfo({ skillId, skillName, skillValue });
    };

    // Handle the actual weapon roll after talent selection
    const handleWeaponRollComplete = (result: TestResultMessage['payload']) => {
        if (!character || !weaponRollInfo) return;

        const message: RollWithIntentMessage = {
            type: 'ROLL_WITH_INTENT',
            payload: {
                characterId: character.id,
                characterName: character.name,
                skillId: weaponRollInfo.skillId,
                skillName: result.testName,
                targetNumber: result.targetNumber,
                rollResult: result.rollResult,
                successLevel: result.successLevel,
                weaponId: weaponRollInfo.weapon.id,
                weaponName: weaponRollInfo.weapon.name,
                weaponDamage: weaponRollInfo.weaponDamage,
                usedTalents: result.usedTalents,
                fortuneSpent: result.fortuneSpent,
                corruptionGained: result.corruptionGained,
            }
        };
        sendMessage(message);
        setWeaponRollInfo(null);
    };

    // Handle the actual defense roll after talent selection
    const handleDefenseRollComplete = (result: TestResultMessage['payload']) => {
        if (!character) return;

        const message: RollWithIntentMessage = {
            type: 'ROLL_WITH_INTENT',
            payload: {
                characterId: character.id,
                characterName: character.name,
                skillId: defenseRollInfo?.skillId || '',
                skillName: result.testName,
                targetNumber: result.targetNumber,
                rollResult: result.rollResult,
                successLevel: result.successLevel,
                usedTalents: result.usedTalents,
                fortuneSpent: result.fortuneSpent,
                corruptionGained: result.corruptionGained,
            }
        };

        sendMessage(message);
        setDefenseRollInfo(null);
    };

    const handleSendChatMessage = (content: string) => {
        const message: ChatSendMessage = {
            type: 'CHAT_SEND',
            payload: {
                content,
                senderName: chatSenderName
            }
        };
        sendMessage(message);
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

    // Handle shop evaluation request (LEGACY)
    const handleRequestEvaluate = (shopId: string, instanceId: string) => {
        if (!character) return;

        const message: ShopEvaluateRequestMessage = {
            type: 'SHOP_EVALUATE_REQUEST',
            payload: {
                shopId,
                instanceId,
                characterId: character.id,
                characterName: character.name,
                rollResult: 0, // GM will handle the roll
                successLevel: 0
            }
        };
        sendMessage(message);
        alert('Evaluation request sent to GM');
    };

    // Handle shop purchase request (LEGACY)
    const handleShopPurchaseRequest = (shopId: string, instanceId: string, quantity: number) => {
        if (!character) return;

        const message: ShopPurchaseRequestMessage = {
            type: 'SHOP_PURCHASE_REQUEST',
            payload: {
                shopId,
                instanceId,
                characterId: character.id,
                quantity
            }
        };
        sendMessage(message);
        alert('Purchase request sent to GM');
    };

    const handleOpposedTestRoll = (
        rollResult: number,
        successLevel: number,
        fortuneSpent: number,
        corruptionGained: number
    ) => {
        if (!character || !opposedTestRequest) return;

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

    const handleNotebookChange = (updated: Notebook) => {
        const message: NotebookUpdateMessage = {
            type: 'NOTEBOOK_UPDATE',
            payload: { notebook: updated },
        };
        sendMessage(message);
    }

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

    const handleQuestUpdate = (quest: Quest) => {
        const message: QuestUpdateMessage = {
            type: 'QUEST_UPDATE',
            payload: { quest },
        };
        sendMessage(message);
    };

    const handleQuestDelete = (questId: string) => {
        const message: QuestDeleteMessage = {
            type: 'QUEST_DELETE',
            payload: { questId },
        };
        sendMessage(message);
    };

    const handleGoToMapFromQuest = (locationId: string) => {
        const location = mapData.locations.find(l => l.id === locationId);
        if (location) {
            setCurrentView('map');
            handleLocationSelect(location);
        }
    };

    const handleTokenMove = useCallback((tokenId: string, x: number, y: number) => {
        const message: TokenMoveMessage = {
            type: 'TOKEN_MOVE',
            payload: { tokenId, x, y }
        };
        sendMessage(message);
    }, [sendMessage]);

    const handleAddPin = useCallback((x: number, y: number, label: string) => {
        if (!userId || !character) return;

        const pin: UserMapPin = {
            id: `pin-${userId}-${Date.now()}`,
            playerId: userId,
            characterId: character.id,
            mapId: activeMapId, // Associate pin with current map
            x,
            y,
            label,
            color: playerColor || '#888888'
        };
        const message: MapAddPinMessage = {
            type: 'MAP_ADD_PIN',
            payload: { pin }
        };
        sendMessage(message);
    }, [userId, character, playerColor, sendMessage, activeMapId]);

    const handleRemovePin = useCallback((pinId: string) => {
        const message: MapRemovePinMessage = {
            type: 'MAP_REMOVE_PIN',
            payload: { pinId }
        };
        sendMessage(message);
    }, [sendMessage]);

    const handleMapPing = useCallback((x: number, y: number) => {
        const message: MapPingRequestMessage = {
            type: 'MAP_PING_REQUEST',
            payload: { x, y }
        };
        sendMessage(message);
    }, [sendMessage]);

    const activeCharacter = isAdvancementMode ? draftCharacter : character;

    if (!isAuthenticated) {
        return (
            <div>
                <ConnectionScreen
                    onConnect={connect}
                    error={authError || undefined}
                    isConnecting={isConnected && !isAuthenticated}
                />
                <Update />
            </div>
        );
    }

    return (
        <CodexProvider dataSources={codexDataSources}>
        <div className="player-app-container">
            {/* Navigation tabs */}
            {character && (
                <div style={{
                    position: 'fixed',
                    top: '10px',
                    left: '10px',
                    display: 'grid',
                    gap: '10px',
                    zIndex: 1011
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
                            fontSize: '0.75rem'
                        }}
                    >
                        ⚔️ Character
                    </button>
                    <button
                        onClick={() => setCurrentView('notebook')}
                        style={{
                            padding: '10px 20px',
                            background: currentView === 'notebook' ? '#2d5016' : '#2c1810',
                            color: '#d4af37',
                            border: currentView === 'notebook' ? '2px solid #3d6f1f' : '2px solid #8b6914',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '0.75rem',
                            minWidth: '10%'
                        }}
                    >
                        📓 Notebook
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
                            fontSize: '0.75rem'
                        }}
                    >
                        🗺️ Map
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
                            fontSize: '0.75rem',
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
                        onClick={() => setCurrentView('quests')}
                        style={{
                            padding: '10px 20px',
                            background: currentView === 'quests' ? '#2d5016' : '#2c1810',
                            color: '#d4af37',
                            border: currentView === 'quests' ? '2px solid #3d6f1f' : '2px solid #8b6914',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '0.75rem',
                            position: 'relative'
                        }}
                    >
                        📋 Quests
                        {quests.filter(q => q.status === 'active').length > 0 && (
                            <span style={{
                                position: 'absolute',
                                top: '-5px',
                                right: '-5px',
                                background: '#2d5016',
                                color: '#fff',
                                borderRadius: '50%',
                                width: '20px',
                                height: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem'
                            }}>
                                {quests.filter(q => q.status === 'active').length}
                            </span>
                        )}
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
                            fontSize: '0.75rem',
                            minWidth: '10%'
                        }}
                    >
                        ⚖️ Reputation
                    </button>
                    {calendarDate && (
                        <button
                            onClick={() => setCurrentView('calendar')}
                            style={{
                                padding: '10px 20px',
                                background: currentView === 'calendar' ? '#2d5016' : '#2c1810',
                                color: '#d4af37',
                                border: currentView === 'calendar' ? '2px solid #3d6f1f' : '2px solid #8b6914',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '0.75rem',
                                minWidth: '10%'
                            }}
                        >
                            📅 Calendar
                        </button>
                    )}
                    {fightState && (
                        <button
                            onClick={() => setCurrentView('fight')}
                            style={{
                                padding: '10px 20px',
                                background: currentView === 'fight' ? '#3d1f00' : '#2c1810',
                                color: '#b54a42',
                                border: currentView === 'fight' ? '2px solid #b54a42' : '2px solid #7a2520',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '0.75rem',
                                minWidth: '10%',
                                animation: pendingDecision?.actorId === myActorId ? 'pulse 1s ease-in-out infinite' : undefined,
                            }}
                        >
                            ⚔ Fight
                        </button>
                    )}
                    <button
                        onClick={() => setShowChat(!showChat)}
                        style={{
                            padding: '10px 20px',
                            background: showChat ? '#1a3a5c' : '#2c1810',
                            color: '#d4af37',
                            border: showChat ? '2px solid #4a7ba7' : '2px solid #8b6914',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '0.75rem',
                            minWidth: '10%',
                            position: 'relative'
                        }}
                    >
                        💬 Chat
                        {chatMessages.length > 0 && (
                            <span style={{
                                position: 'absolute',
                                top: '-5px',
                                right: '-5px',
                                background: '#4a7ba7',
                                color: '#fff',
                                borderRadius: '50%',
                                width: '8px',
                                height: '8px',
                            }} />
                        )}
                    </button>
                    <CodexNavButton />
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
                            onClick={() => setIsCareerChangeModalOpen(true)} className='advanceControlButton' style={{ background: '#2d5016', borderColor: '#3d6f1f', bottom: '17%' }}>
                            Change Career
                        </button>
                    )}
                    {isAdvancementMode && draftCharacter && (
                        <div className="advancement-controls">
                            <h3>Advancement Mode</h3>
                            <p>XP Available: {draftCharacter.xp.current}</p>
                            {/* We'll calculate spent XP later */}
                            <button onClick={() => setIsTalentModalOpen(true)}>Buy Talents</button>
                            <button onClick={handleConfirmAdvancement}>Confirm Changes</button>
                            <button onClick={handleCancelAdvancement}>Cancel</button>
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
                                onWeaponRoll={handleWeaponRoll}
                                onDefendRoll={handleDefendRoll}
                                advancementMode={isAdvancementMode}
                                onCharacteristicAdvance={handleAdvanceCharacteristic}
                                onSkillAdvance={handleAdvanceSkill}
                                onPurchaseClick={() => setIsShopModalOpen(true)}
                                showPurchaseButton={!isAdvancementMode}
                                currentUserId={character.userId || undefined}
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
                </>
            )}

            {/* Journal View */}
            {currentView === 'journal' && (
                <JournalView journal={journalEntries} />
            )}

            {/* Quest Journal View */}
            {currentView === 'quests' && (
                <QuestJournal
                    quests={quests}
                    locations={mapData.locations}
                    mapPinStates={mapPinStates}
                    characterId={character?.id || ''}
                    onQuestUpdate={handleQuestUpdate}
                    onQuestDelete={handleQuestDelete}
                    onGoToMap={handleGoToMapFromQuest}
                />
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
                    <div style={{ flex: 1, position: 'relative' }}>
                        <MapView
                            mapData={currentMapData}
                            mapPinStates={mapPinStates}
                            characters={[character]}
                            isGM={false}
                            viewState={mapViewState}
                            onViewStateChange={setMapViewState}
                            incomingPing={mapPing}
                            tokens={tokens.filter(t => t.mapId === activeMapId)}
                            locationTags={locationTags}
                            userPins={userPins.filter(p => p.playerId === userId && p.mapId === activeMapId)}
                            onTokenMove={handleTokenMove}
                            onAddPin={handleAddPin}
                            onRemovePin={handleRemovePin}
                            onMapPing={handleMapPing}
                            playerColor={playerColor || undefined}
                            currentUserId={userId || undefined}
                            currentCharacterId={character.id || undefined}
                            gridScale={currentMapData.gridSize}
                            factions={factions}
                            locationTerritories={locationTerritories}
                            characterReputations={character.reputations || []}
                        />
                        {/* Current Map Indicator */}
                        <div style={{
                            position: 'absolute',
                            top: '10px',
                            left: '10px',
                            padding: '8px 16px',
                            background: 'rgba(26, 15, 10, 0.9)',
                            border: '2px solid #8b4513',
                            borderRadius: '6px',
                            color: '#d4af37',
                            fontWeight: 'bold',
                            fontSize: '0.9rem',
                            zIndex: 10,
                        }}>
                            🗺️ {currentMapData.name}
                        </div>
                    </div>
                    <div style={{ width: '25vw', height: '100vh', overflowY: 'auto', backgroundColor: '#1c1c1c', borderLeft: '2px solid #444', position: 'absolute', right: 0, top: 0 }}>
                        <DiscoveredLocationsList
                            locations={currentMapData.locations}
                            mapPinStates={mapPinStates}
                            onLocationSelect={handleLocationSelect}
                            onFilterTagsChange={setLocationTags}
                        />
                    </div>
                </div>
            )}

            {/* Map Transition Overlay */}
            <MapTransitionOverlay
                isVisible={isMapTransitioning}
                destinationName={currentMapData.name}
                onTransitionComplete={() => setIsMapTransitioning(false)}
            />

            {/* Reputation View */}
            {currentView === 'reputation' && character && (
                <ReputationDisplay character={character} factions={factions} />
            )}

            {/* Calendar View */}
            {currentView === 'calendar' && calendarDate && (
                <PlayerTimeline
                    currentDate={calendarDate}
                    events={calendarEvents}
                    weather={calendarWeather}
                    onClose={() => setCurrentView('character')}
                />
            )}

            {/* Notebook View */}
            {currentView === 'notebook' && (
                <div style={{ paddingLeft: '30%', width: '80vw', height: '100vh' }}>
                    <NotebookView
                        notebook={notebook}
                        editable={true}
                        onChange={handleNotebookChange}
                    />
                </div>
            )}

            {/* Fight View */}
            {currentView === 'fight' && fightState && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1010, paddingLeft: '130px' }}>
                    <PlayerFightScreen
                        fightState={fightState}
                        pendingDecision={pendingDecision}
                        myActorId={myActorId}
                        character={character}
                        onSubmitDecision={submitDecision}
                    />
                </div>
            )}

            {/* Date/Weather Widget (shown in non-calendar views when calendar data is available) */}
            {calendarDate && currentView !== 'calendar' && currentView !== 'map' && (
                <div style={{
                    position: 'fixed',
                    top: '10px',
                    right: '20px',
                    zIndex: 1015
                }}>
                    <DateWeatherWidget
                        currentDate={calendarDate}
                        weather={calendarWeather}
                        onClick={() => setCurrentView('calendar')}
                    />
                </div>
            )}

            {createCharacterWizardOpen && (
                <CharacterCreationWizard
                    onClose={() => setCreateCharacterWizardOpen(false)}
                    onComplete={handleCreateCharacterComplete}
                />
            )}

            {/* Chat Panel */}
            {showChat && (
                <div style={{
                    position: 'fixed',
                    right: '20px',
                    bottom: '20px',
                    width: '360px',
                    height: '450px',
                    zIndex: 1020,
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
                    borderRadius: '8px',
                    overflow: 'hidden'
                }}>
                    <ChatBox
                        messages={chatMessages}
                        onSendMessage={handleSendChatMessage}
                        senderName={chatSenderName}
                        onClose={() => setShowChat(false)}
                        showHeader={true}
                    />
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
                    onRoll={handleDefenseRollComplete}
                />
            )}

            {weaponRollInfo && character && (
                <TalentSelectionModal
                    character={character}
                    testName={`${weaponRollInfo.weapon.name}`}
                    testId={weaponRollInfo.skillId}
                    baseTarget={weaponRollInfo.skillValue}
                    fortunePoints={character.status.fortune.current}
                    corruptionCurrent={character.status.corruption.current}
                    corruptionMax={character.status.corruption.max}
                    onClose={() => setWeaponRollInfo(null)}
                    onRoll={handleWeaponRollComplete}
                />
            )}

            {defenseRollInfo && character && (
                <TalentSelectionModal
                    character={character}
                    testName={`Dodge (${defenseRollInfo.skillName})`}
                    testId={defenseRollInfo.skillId}
                    baseTarget={defenseRollInfo.skillValue}
                    fortunePoints={character.status.fortune.current}
                    corruptionCurrent={character.status.corruption.current}
                    corruptionMax={character.status.corruption.max}
                    onClose={() => setDefenseRollInfo(null)}
                    onRoll={handleDefenseRollComplete}
                />
            )}

            {character && (
                <ActionBar
                    character={character}
                    onCharacterUpdate={handleEditModeCharacterUpdate}
                    onSkillExecute={handleDefendRoll}
                    onWeaponExecute={handleWeaponRoll}
                    onCharacteristicExecute={handleCharacteristicClick}
                />
            )}

            <Update />

            {/* Codex System */}
            <CommandPalette />
            <CodexViewer />
            <CodexPopupModal />

            {/* Keyboard Shortcuts Help */}
            <ShortcutsHelpOverlay
                shortcuts={shortcuts}
                isOpen={isHelpOpen}
                onClose={() => setHelpOpen(false)}
                onOpenSettings={() => setShowShortcutSettings(true)}
            />
            {showShortcutSettings && (
                <ShortcutsSettings
                    shortcuts={shortcuts}
                    conflicts={conflicts}
                    onRebind={rebind}
                    onResetBinding={resetBinding}
                    onResetAll={resetAll}
                    onClose={() => setShowShortcutSettings(false)}
                />
            )}
        </div>
        </CodexProvider>
    );
};

export default PlayerApp;