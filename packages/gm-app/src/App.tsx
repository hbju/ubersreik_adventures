import { getGroupedSkill, getTalentInitiativeBonus, isSkillGrouped, MapView, recalculateCharacterTalentBonuses, Skill, getTalentCharacteristicBonus, useGameData, CharacterCreationWizard, LocationTerritory, CodexProvider, CommandPalette, CodexViewer, CodexPopupModal, useRealtimeSync } from '@wfrp/shared';
import type { CodexDataSources } from '@wfrp/shared';
import CombatResolver from './components/combatResolver/CombatResolver';
import CharacterRoster from './components/characterRoster/CharacterRoster';
import AtmospherePanel from './components/atmospherePanel/AtmospherePanel';
import InitiativeTracker from './components/initiativeTracker/InitiativeTracker';
import Footer from './components/footer/Footer';
import { ShopManager } from './components/ShopManager';
import { PurchaseRequestModal } from './components/PurchaseRequestModal';
import { JournalManager } from './components/JournalManager';
import { UserManager } from './components/UserManager';
import CareerChangeApprovalModal from './components/CareerChangeApprovalModal';
import DiceTray from './components/DiceTray';
import { ItemSelectorModal } from './components/ItemSelectorModal';
import { TalentSelectorModal } from './components/TalentSelectorModal';
import { FactionManager } from './components/factions/FactionManager';
import { CharacterReputationPanel } from './components/factions/CharacterReputationPanel';
import { ShopConfigurator } from './components/shops/config';
import { TemplateManager } from './components/TemplateManager';
import MinionSheet from './components/MinionSheet';
import { SecretsManager } from './components/SecretsManager';
import { QuestJournalViewer } from './components/quests/QuestJournalViewer';
import { MapSelector } from './components/map/MapSelector';
import { AudioProvider } from './context/AudioContext';
import { AudioSidebar, LibraryManager } from './components/audio';
import { TimelineManager } from './components/timeline';
import { DramatisPersonae } from './components/lore/DramatisPersonae';
import { LoreEditor } from './components/lore/LoreEditor';
import NPCGeneratorWizard from './components/generator/NPCGeneratorWizard';
import LoginScreen from './components/LoginScreen';
import CampaignSelector from './components/CampaignSelector';
import { useAppContext } from './context/AppContext';

import {
    getAvailableAdvancements,
    calculateEffectiveMaxWounds,
    Character,
    Combatant,
    Currency,
    generateRandomNpc,
    calculateCharacteristicBonus,
    PlayerCharacterSheet,
    AssignCharacterMessage,
    ClientToServerMessage,
    GameLog,
    LogEntry,
    equilibrateCurrency,
    OpposedTestResultMessage,
    Armor,
    Weapon,
    Item,
    Condition,
    CareerChangeResponseMessage,
    Location,
    Talent,
    TalentSelectionModal,
    QueuedRoll,
    exportCampaignBackupFromSupabase,
} from '@wfrp/shared';
import { CharacterProvider, useCharacterContext } from './context/CharacterContext';
import { UserProvider, useUserContext } from './context/UserContext';
import { CharacterTemplateProvider, useCharacterTemplateContext } from './context/CharacterTemplateContext';
import { CombatProvider, useCombatContext } from './context/CombatContext';
import { JournalProvider, useJournalContext } from './context/JournalContext';
import { QuestProvider, useQuestContext } from './context/QuestContext';
import { FactionProvider, useFactionContext } from './context/FactionContext';
import { MapProvider, useMapContext } from './context/MapContext';
import { ShopProvider, useShopContext } from './context/ShopContext';
import { CalendarProvider, useCalendarContext } from './context/CalendarContext';
import { ChatProvider } from './context/ChatContext';
import { GmCampaignRealtimeProvider, useGmCampaignRealtime } from './context/GmCampaignRealtimeContext';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

import './App.css';
import sidebarStyles from './components/SidebarToggle.module.css';
import CareerManager from './components/CareerManager';
import { useTranslation } from 'react-i18next';
import ShopBrowser from './components/ShopBrowser';
import GmChatPanel from './components/chat/GmChatPanel';

function App() {
    const { t } = useTranslation();
    const { user, currentCampaignId, loading: authLoading } = useAppContext();

    // Auth & campaign gating — show login/campaign screens before main UI
    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-stone-900">
                <p className="text-stone-400 text-lg">{t('auth.restoringSession', 'Restoring session…')}</p>
            </div>
        );
    }

    if (!user) {
        return <LoginScreen />;
    }

    if (!currentCampaignId) {
        return <CampaignSelector />;
    }

    return (
    <CharacterProvider>
        <UserProvider>
            <CharacterTemplateProvider>
                <GmCampaignRealtimeProvider>
                <CombatProvider>
                    <JournalProvider>
                        <QuestProvider>
                            <FactionProvider>
                                <MapProvider>
                                    <ShopProvider>
                                        <CalendarProvider>
                                            <ChatProvider>
                                                <GmDashboard />
                                            </ChatProvider>
                                        </CalendarProvider>
                                    </ShopProvider>
                                </MapProvider>
                            </FactionProvider>
                        </QuestProvider>
                    </JournalProvider>
                </CombatProvider>
                </GmCampaignRealtimeProvider>
            </CharacterTemplateProvider>
        </UserProvider>
    </CharacterProvider>
    );
}


function GmDashboard() {
    const { t } = useTranslation();
    const { serviceContext, user } = useAppContext();
    const { characters, replaceCharacter, createCharacter: ctxCreateCharacter, deleteCharacter: ctxDeleteCharacter, fetchCharacters } = useCharacterContext();
    const { users, createUser, deleteUser, setUserCharacter } = useUserContext();
    const { templates: characterTemplates, replaceAllTemplates } = useCharacterTemplateContext();
    const {
        combatState,
        addCombatant,
        updateCombatant,
        fetchCombatState,
        broadcastOpposedTestRequest,
        broadcastConditionTestRequest,
    } = useCombatContext();
    const { entries: journal, fetchEntries } = useJournalContext();
    const { quests, fetchQuests } = useQuestContext();
    const { factions, locationTerritories, setTerritory, fetchFactions } = useFactionContext();
    const { shopDefinitions: contextShops, shopInventory, fetchShops } = useShopContext();
    const { calendarState, fetchCalendar } = useCalendarContext();
    const {
        activeMap,
        activeMapId,
        pinStates,
        tokens,
        activeTokens,
        userPins,
        activeUserPins,
        updatePinState,
        moveToken,
        addToken,
        removeToken,
        sendMapPing,
        fetchMaps,
    } = useMapContext();

    // Ref to access latest characters inside stable useEffect closures
    const charactersRef = useRef(characters);
    useEffect(() => { charactersRef.current = characters; }, [characters]);

    const combatStateRef = useRef(combatState);
    useEffect(() => { combatStateRef.current = combatState; }, [combatState]);

    const { skills, talents, careers, conditions, qualities, shops: shopDefinitions, mapData, maps, motivations } = useGameData();

    // Codex data sources (memoised to avoid rebuilding index on every render)
    const codexDataSources: CodexDataSources = React.useMemo(() => ({
        talents, skills, careers, conditions, qualities: qualities ?? [],
    }), [talents, skills, careers, conditions, qualities]);

    const [showMapSelector, setShowMapSelector] = useState(false);

    // Get the current active map data
    const currentMapData = useMemo(() => {
        return activeMap || mapData;
    }, [activeMap, mapData]);

    const calculateMaxWounds = (character: Character) => {
        return calculateEffectiveMaxWounds(character, talents);
    }

    const calculateMaxCorruption = (character: Character) => {
        return calculateCharacteristicBonus(character.characteristics.wp) + calculateCharacteristicBonus(character.characteristics.t);
    }

    const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

    const [mapPing, setMapPing] = useState<{ x: number; y: number; color: string; userId: string } | null>(null);
    const [mapViewState, setMapViewState] = useState<{ scale: number; offsetX: number; offsetY: number }>({ scale: 0.3, offsetX: 126, offsetY: -26 });
    const [assignedCharacters, setAssignedCharacters] = useState<string[]>([]);
    const [openSheetIds, setOpenSheetIds] = useState<string[]>([]);
    const [showGameLog, setShowGameLog] = useState(false);
    const [showShopManager, setShowShopManager] = useState(false);
    const [showShopConfigurator, setShowShopConfigurator] = useState(false);
    const [showDiceTray, setShowDiceTray] = useState(false);
    const [showCharacterWizard, setShowCharacterWizard] = useState(false);
    const [showNPCGenerator, setShowNPCGenerator] = useState(false);
    const [showCombatResolver, setShowCombatResolver] = useState(false);
    const [showJournalManager, setShowJournalManager] = useState(false);
    const [showUserManager, setShowUserManager] = useState(false);
    const [showCareerManager, setShowCareerManager] = useState<Character | null>(null);
    const [showAtmospherePanel, setShowAtmospherePanel] = useState(false);
    const [showFactionManager, setShowFactionManager] = useState(false);
    const [showReputationPanel, setShowReputationPanel] = useState(false);
    const [showTemplateManager, setShowTemplateManager] = useState(false);
    const [showQuestJournal, setShowQuestJournal] = useState(false);
    const [showTimelineManager, setShowTimelineManager] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [showLibraryManager, setShowLibraryManager] = useState(false);
    const [showDramatisPersonae, setShowDramatisPersonae] = useState(false);
    const [loreEditorCharacter, setLoreEditorCharacter] = useState<Character | null>(null);
    const [leftSidebarMode, setLeftSidebarMode] = useState<'roster' | 'audio'>('roster');
    const [testModalInfo, setTestModalInfo] = useState<{ id: string, name: string, value: number, charId: string } | null>(null);
    const [purchaseRequest, setPurchaseRequest] = useState<{
        playerName: string;
        item: Armor | Weapon | Item;
        playerCurrency: Currency;
        charId: string;
    } | null>(null);
    const [careerChangeRequest, setCareerChangeRequest] = useState<{
        characterId: string;
        characterName: string;
        newCareerId: string;
        newCareerLevelId: string;
        newCareerName: string;
        newCareerLevelName: string;
        xpCost: number;
    } | null>(null);
    const [shopEvaluateRequest, setShopEvaluateRequest] = useState<{
        shopId: string;
        instanceId: string;
        characterId: string;
        characterName: string;
    } | null>(null);
    const [shopPurchaseRequest, setShopPurchaseRequest] = useState<{
        shopId: string;
        instanceId: string;
        characterId: string;
        characterName: string;
        quantity: number;
    } | null>(null);
    const [opposedTestResults, setOpposedTestResults] = useState<Map<string, OpposedTestResultMessage['payload']>>(new Map());
    
    // Roll Queue for async opposed tests
    const [rollQueue, setRollQueue] = useState<QueuedRoll[]>([]);
    const MAX_ROLL_QUEUE_SIZE = 10;

    const [showItemSelector, setShowItemSelector] = useState<string | null>(null);
    const [showTalentSelector, setShowTalentSelector] = useState<string | null>(null);

    const [browsingShopId, setBrowsingShopId] = useState<string | null>(null);

    // Merge default templates with custom ones
    // Custom templates override defaults with the same ID
    const { defaultTemplates } = useGameData();
    const allTemplates = useMemo(() => {
        const customIds = new Set(characterTemplates.map(t => t.id));
        const baseTemplates = (defaultTemplates || []).filter(t => !customIds.has(t.id));
        return [...baseTemplates, ...characterTemplates];
    }, [defaultTemplates, characterTemplates]);

    const usersWithAssignments = useMemo(() => {
        return users.map((user) => {
            const assignedCharacter = characters.find((character) => character.userId === user.id);
            return {
                ...user,
                characterId: assignedCharacter?.id ?? user.characterId ?? null,
            };
        });
    }, [characters, users]);
    const usersRef = useRef(usersWithAssignments);
    useEffect(() => { usersRef.current = usersWithAssignments; }, [usersWithAssignments]);

    const realtimeCallbacks = useMemo(() => ({
        characters: fetchCharacters,
        quests: () => fetchQuests(),
        journal: fetchEntries,
        factions: fetchFactions,
        maps: fetchMaps,
        shops: fetchShops,
        combat: fetchCombatState,
        calendar: fetchCalendar,
    }), [fetchCalendar, fetchCharacters, fetchCombatState, fetchEntries, fetchFactions, fetchMaps, fetchQuests, fetchShops]);

    useRealtimeSync({
        serviceContext,
        callbacks: realtimeCallbacks,
    });

    const {
        lastLatencyMs: broadcastLatencyMs,
        onlineUsers,
        isUserOnline,
        connectionState: broadcastConnectionState,
        mapPingBridgeRef,
        relayGmMessage,
        registerPlayerRelayHandler,
    } = useGmCampaignRealtime();

    useEffect(() => {
        mapPingBridgeRef.current.activeMapId = activeMapId;
    }, [activeMapId, mapPingBridgeRef]);

    useEffect(() => {
        mapPingBridgeRef.current.showMapPing = (ping) => {
            setMapPing({
                x: ping.position.x,
                y: ping.position.y,
                color: ping.color ?? '#d4af37',
                userId: ping.userId ?? 'unknown',
            });
            setTimeout(() => setMapPing(null), 300);
        };
        return () => {
            mapPingBridgeRef.current.showMapPing = null;
        };
    }, [mapPingBridgeRef]);

    const presenceOnlinePlayerCount = useMemo(
        () => [...onlineUsers.values()].filter((p) => p.role === 'player').length,
        [onlineUsers],
    );

    useEffect(() => {
        if (broadcastLatencyMs == null) return;
        console.log(`[Broadcast latency] ${broadcastLatencyMs}ms`);
    }, [broadcastLatencyMs]);

    const addLogEntry = useCallback((type: LogEntry['type'], content: string, messageCode?: string, params?: Record<string, any>) => {
        const newEntry: LogEntry = { id: new Date().toISOString() + Math.random().toString(36), type, content, messageCode, params };
        setLogEntries(prev => [...prev, newEntry]);
    }, []);

    const handleCharacterUpdate = useCallback((updatedCharacter: Character) => {
        const recaculatedCharacter = recalculateCharacterTalentBonuses(updatedCharacter, talents);

        replaceCharacter(recaculatedCharacter);

        const newMessage: AssignCharacterMessage = {
            type: "ASSIGN_CHARACTER",
            payload: { character: recaculatedCharacter }
        };

        if (recaculatedCharacter.userId) {
            void relayGmMessage(newMessage, recaculatedCharacter.userId);
        }
    }, [replaceCharacter, talents, relayGmMessage]);

    const handleToggleCharacterSheet = (characterId: string) => {
        setOpenSheetIds(prevOpenIds =>
            prevOpenIds.includes(characterId) ? prevOpenIds.filter(id => id !== characterId) : [...prevOpenIds, characterId]
        );
    }

    const handleXpAward = (characterId: string, amount: number) => {
        const character = characters.find(c => c.id === characterId);
        if (!character) return;
        const newChar = { ...character, xp: { ...character.xp, current: character.xp.current + amount } };
        handleCharacterUpdate(newChar);
        addLogEntry('system', `Awarded ${amount} XP to character ${characterId}.`, 'logs.xp_awarded', { amount, characterId });
    };

    const handleCurrencyAward = (characterId: string, amount: { gc: number; ss: number; bp: number }) => {
        const character = characters.find(c => c.id === characterId);
        if (!character) return;

        const newCurrency = equilibrateCurrency({ ...character.currency });
        const remainingGc = newCurrency.gc + amount.gc;
        if (remainingGc < 0) {
            newCurrency.gc = 0;
            newCurrency.ss = 0;
            newCurrency.bp = 0;
        } else {
            newCurrency.gc = remainingGc;
        }
        const remainingSs = newCurrency.ss + amount.ss;
        if (remainingSs < 0) {
            const ssToGc = Math.ceil(Math.abs(remainingSs) / 20);
            newCurrency.gc = Math.max(newCurrency.gc - ssToGc, 0);
            newCurrency.ss = remainingSs + ssToGc * 20;
        } else {
            newCurrency.ss = remainingSs;
        }
        const remainingBp = newCurrency.bp + amount.bp;
        if (remainingBp < 0) {
            const bpToSs = Math.ceil(Math.abs(remainingBp) / 12);
            newCurrency.ss = Math.max(newCurrency.ss - bpToSs, 0);
            newCurrency.bp = remainingBp + bpToSs * 12;
        } else {
            newCurrency.bp = remainingBp;
        }
        const newChar = { ...character, currency: newCurrency };
        handleCharacterUpdate(newChar);
        addLogEntry('system', `Awarded currency to character ${characterId}: ${amount.gc || 0} GC, ${amount.ss || 0} SS, ${amount.bp || 0} BP.`, 'logs.currency_awarded', { characterId, gc: amount.gc || 0, ss: amount.ss || 0, bp: amount.bp || 0 });
    };

    const handleCreateCharacter = () => {
        setShowCharacterWizard(true);
    };

    const handleWizardComplete = useCallback((newCharacter: Character) => {
        ctxCreateCharacter(newCharacter);
        setShowCharacterWizard(false);
        addLogEntry('system', `Created new character: ${newCharacter.name}`, 'logs.character_created', { name: newCharacter.name });
    }, [ctxCreateCharacter, addLogEntry]);

    const handleGenerateNPC = () => {
        const newNPC = generateRandomNpc(careers, skills);
        ctxCreateCharacter(newNPC);
    }

    const handleGenerateNPCDetailed = () => {
        setShowNPCGenerator(true);
    }

    const handleNPCGeneratorComplete = (newCharacter: Character) => {
        ctxCreateCharacter(newCharacter);
        setShowNPCGenerator(false);
        addLogEntry('system', `Generated NPC: ${newCharacter.name}`, 'logs.npc_generated', { name: newCharacter.name });
    }

    const handlePlaceToken = (characterId: string) => {
        const character = characters.find(c => c.id === characterId);
        if (!character) return;
        
        // Use spawn point if available, otherwise default position
        const spawnPoint = currentMapData.spawnPoint || { x: 1000, y: 1000 };

        addToken(character, spawnPoint.x, spawnPoint.y);
    }

    const handleTokenMove = (tokenId: string, x: number, y: number) => {
        moveToken(tokenId, x, y);
    };

    const handleAddCombatant = (character: Character) => {
        // Prevent adding the same character twice
        if (combatState.combatants.some(c => c.sourceId === character.id)) return;

        const newCombatant: Combatant = {
            id: crypto.randomUUID(),
            sourceId: character.id,
            name: character.name,
            initiative: null,
            currentWounds: character.status.wounds.current,
            maxWounds: calculateMaxWounds(character),
            baseInitiative: calculateCharacteristicBonus(character.characteristics.i) + getTalentInitiativeBonus(character, talents),
            baseAg: calculateCharacteristicBonus(character.characteristics.ag),
            isPlayer: assignedCharacters.includes(character.id),
            conditions: character.conditions.map(cond => [cond.id, ...Array(cond.stack - 1).fill(cond.id)]).flat(),
        };
        addCombatant(newCombatant);
    };

    const handleUpdateCombatant = useCallback((updatedCombatant: Combatant) => {
        const char = characters.find(c => c.id === updatedCombatant.sourceId);
        if (char) {
            // sync wounds & conditions back to character sheet
            const conds = updatedCombatant.conditions || [];
            const counts = new Map<string, number>();
            conds.forEach(condId => {
                counts.set(condId, (counts.get(condId) || 0) + 1);
            });
            const newConds: Condition[] = counts.size > 0 ? Array.from(counts.entries()).map(([id, stack]) => {
                const existingCond = conditions.find(c => c.id === id);
                if (existingCond) {
                    return { ...existingCond, stack: stack };
                }
                return { id, name: id, description: '', stack };
            }) : [];
            const newChar = { ...char, status: { ...char.status, wounds: { ...char.status.wounds, current: updatedCombatant.currentWounds }, corruption: { ...char.status.corruption, max: calculateMaxCorruption(char) } }, conditions: newConds };
            handleCharacterUpdate(newChar);
        }
        updateCombatant(updatedCombatant);
    }, [characters, conditions, handleCharacterUpdate, updateCombatant]);

    const handlePlayerRelayMessage = useCallback((message: ClientToServerMessage) => {
            console.log("Received message from player:", message);
            if (message.type === 'TEST_RESULT') {
                const { characterId, testName, targetNumber, rollResult, successLevel, fortuneSpent, corruptionGained } = message.payload;
                const outcome = successLevel >= 0
                    ? `${successLevel} Success Level(s)`
                    : `${Math.abs(successLevel)} Failure Level(s)`;
                const character = charactersRef.current.find(c => c.id === characterId);
                if (!character) return;

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
                            current: character.status.corruption.current + corruptionGained
                        }
                    }
                };
                handleCharacterUpdate(updatedCharacter);
                addLogEntry(
                    'roll',
                    `${character.name} tests ${testName}: Rolled ${rollResult} vs ${targetNumber}. [${outcome}] Fortune spent: ${fortuneSpent}, Corruption gained: ${corruptionGained}`,
                    'logs.test_result',
                    { name: character.name, testName, rollResult, targetNumber, outcome, fortuneSpent, corruptionGained }
                );
            }

            if (message.type === 'CHARACTER_CREATE') {
                const newChar = message.payload.character;
                const rosterUser = usersRef.current.find(u => u.username === message.payload.userId || u.id === message.payload.userId);
                if (rosterUser) {
                    newChar.userId = rosterUser.id;
                    setUserCharacter(rosterUser.id, newChar.id);
                }

                handleWizardComplete(newChar);

                const assignMessage: AssignCharacterMessage = {
                    type: "ASSIGN_CHARACTER",
                    payload: { character: newChar }
                };
                if (newChar.userId) {
                    void relayGmMessage(assignMessage, newChar.userId);
                }

                addLogEntry('system', `New character created: ${newChar.name}`, 'logs.character_created', { name: newChar.name });
            }

            if (message.type === 'CHARACTER_UPDATE') {
                const updatedChar = message.payload.character;
                handleCharacterUpdate(updatedChar);
                addLogEntry('system', `${updatedChar.name}'s character sheet has been updated.`, 'logs.character_updated', { name: updatedChar.name });
            }

            if (message.type === 'REQUEST_PURCHASE') {
                const item = message.payload.item;

                const character = charactersRef.current.find(c => c.id === message.payload.characterId);
                if (character) {
                    setPurchaseRequest({
                        playerName: character.name,
                        item: item,
                        playerCurrency: character.currency,
                        charId: message.payload.characterId,
                    });
                }
            }

            if (message.type === 'CAREER_CHANGE_REQUEST') {
                const { characterId, characterName, newCareerId, newCareerLevelId, newCareerName, newCareerLevelName, xpCost } = message.payload;
                setCareerChangeRequest({
                    characterId,
                    characterName,
                    newCareerId,
                    newCareerLevelId,
                    newCareerName,
                    newCareerLevelName,
                    xpCost
                });
                addLogEntry('system', `${characterName} requests career change to ${newCareerName} - ${newCareerLevelName} for ${xpCost} XP.`, 'logs.career_change_request', { characterName, newCareerName, newCareerLevelName, xpCost });
            }

            if (message.type === 'OPPOSED_TEST_RESULT') {
                const { testId, characterId, role, rollResult, successLevel, fortuneSpent, corruptionGained } = message.payload;
                const character = charactersRef.current.find(c => c.id === characterId);
                if (character) {
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
                    handleCharacterUpdate(updatedCharacter);

                    addLogEntry(
                        'roll',
                        `${character.name} (${role}) rolled ${rollResult} with SL ${successLevel >= 0 ? '+' : ''}${Math.round(successLevel)}`
                    );
                }
                setOpposedTestResults(prev => {
                    const newMap = new Map(prev);
                    const key = `${testId}-${role}`;
                    newMap.set(key, message.payload);
                    return newMap;
                });
            }

            if (message.type === 'CONDITION_TEST_RESULT') {
                const { characterId, conditionId, rollResult, successLevel, targetNumber } = message.payload;
                const character = charactersRef.current.find(c => c.id === characterId);
                if (character) {
                    const outcome = successLevel >= 0
                        ? `Success (${successLevel} SL)`
                        : `Failure (${successLevel} SL)`;

                    addLogEntry(
                        'roll',
                        `${character.name} tests to remove ${conditionId}: Rolled ${rollResult} vs ${targetNumber}. [${outcome}]`
                    );

                    if (successLevel >= 0) {
                        const combatant = combatStateRef.current.combatants.find(c => c.sourceId === characterId);
                        if (combatant && combatant.conditions) {
                            console.log(combatant.conditions);
                            const conditionsToRemove = Math.min(1 + successLevel, combatant.conditions.filter(c => c === conditionId).length);
                            const updatedConditions = [...combatant.conditions];

                            for (let i = 0; i < conditionsToRemove; i++) {
                                const index = updatedConditions.indexOf(conditionId);
                                if (index > -1) {
                                    updatedConditions.splice(index, 1);
                                }
                            }

                            const shouldAddFatigued = ['condition_broken', 'condition_poisoned', 'condition_stunned', 'condition_unconscious'].includes(conditionId);
                            const allRemoved = !updatedConditions.includes(conditionId);

                            if (shouldAddFatigued && allRemoved) {
                                updatedConditions.push('condition_fatigued');
                                addLogEntry('system', `${character.name} gains Fatigued condition after recovering from ${conditionId}.`);
                            }
                            console.log(`Removing ${conditionsToRemove} ${conditionId} condition(s) from ${character.name}`);
                            handleUpdateCombatant({ ...combatant, conditions: updatedConditions });
                            addLogEntry('system', `${character.name} removed ${conditionsToRemove} ${conditionId} condition(s).`);
                        }
                    }
                }
            }

            if (message.type === 'ROLL_WITH_INTENT') {
                const { characterId, characterName, skillId, skillName, targetNumber, rollResult, successLevel, weaponId, weaponName, weaponDamage, usedTalents, fortuneSpent, corruptionGained } = message.payload;

                const character = charactersRef.current.find(c => c.id === characterId);
                if (character) {
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
                                current: character.status.corruption.current + corruptionGained
                            }
                        }
                    };
                    handleCharacterUpdate(updatedCharacter);
                }

                const queuedRoll: QueuedRoll = {
                    id: crypto.randomUUID(),
                    characterId,
                    characterName,
                    skillId,
                    skillName,
                    rollResult,
                    targetNumber,
                    successLevel,
                    weaponId,
                    weaponName,
                    weaponDamage,
                    timestamp: Date.now(),
                    usedTalents,
                    fortuneSpent,
                    corruptionGained,
                };

                setRollQueue(prev => {
                    const newQueue = [queuedRoll, ...prev];
                    return newQueue.slice(0, MAX_ROLL_QUEUE_SIZE);
                });

                const slSign = successLevel >= 0 ? '+' : '';
                addLogEntry(
                    'roll',
                    `${characterName} Skill: ${skillName} - Rolled ${rollResult} vs ${targetNumber}. SL: ${slSign}${Math.round(successLevel)}${weaponName ? ` (${weaponName})` : ''}`
                );
            }

            if (message.type === 'SHOP_EVALUATE_REQUEST') {
                const { shopId, instanceId, characterId } = message.payload;
                const character = charactersRef.current.find(c => c.id === characterId);
                if (character) {
                    setShopEvaluateRequest({
                        shopId,
                        instanceId,
                        characterId,
                        characterName: character.name
                    });
                    addLogEntry('system', `${character.name} requests to evaluate an item in shop ${shopId}.`);
                }
            }

            if (message.type === 'SHOP_PURCHASE_REQUEST') {
                const { shopId, instanceId, characterId, quantity } = message.payload;
                const character = charactersRef.current.find(c => c.id === characterId);
                if (character) {
                    setShopPurchaseRequest({
                        shopId,
                        instanceId,
                        characterId,
                        characterName: character.name,
                        quantity
                    });
                    addLogEntry('system', `${character.name} requests to purchase from shop ${shopId}.`);
                }
            }
    }, [handleCharacterUpdate, handleWizardComplete, setUserCharacter, addLogEntry, handleUpdateCombatant, relayGmMessage]);

    useEffect(() => {
        return registerPlayerRelayHandler(handlePlayerRelayMessage);
    }, [registerPlayerRelayHandler, handlePlayerRelayMessage]);

    const handleCreateUser = async (username: string, password: string) => {
        const created = await createUser(username, password);
        if (created) {
            addLogEntry('info', `User created: ${username}`, 'logs.user_created', { username });
        }
    };

    const handleDeleteUser = async (userId: string) => {
        const user = usersWithAssignments.find(u => u.id === userId);
        if (!user) return;

        if (user.characterId) {
            const charToUnassign = characters.find(c => c.id === user.characterId);
            if (charToUnassign) {
                await replaceCharacter({ ...charToUnassign, userId: null });
            }
        }

        const removed = await deleteUser(userId);
        if (removed) {
            addLogEntry('info', `User deleted: ${user.username}`, 'logs.user_deleted', { username: user.username });
        }
    };

    const handleAssignCharacterToUser = async (userId: string, characterId: string | null) => {
        const user = usersWithAssignments.find(u => u.id === userId);
        if (!user) return;

        setUserCharacter(userId, characterId);

        if (user.characterId) {
            const oldChar = characters.find(c => c.id === user.characterId);
            if (oldChar) {
                await replaceCharacter({ ...oldChar, userId: null });
            }
        }

        if (characterId) {
            const otherUsersWithChar = usersWithAssignments.filter(u => u.id !== userId && u.characterId === characterId);
            otherUsersWithChar.forEach((otherUser) => setUserCharacter(otherUser.id, null));

            const charToAssign = characters.find(c => c.id === characterId);
            if (charToAssign) {
                const assignedChar = { ...charToAssign, userId };
                await replaceCharacter(assignedChar);
                const message: AssignCharacterMessage = {
                    type: "ASSIGN_CHARACTER",
                    payload: { character: assignedChar }
                };
                void relayGmMessage(message, userId);
            }

            const character = characters.find(c => c.id === characterId);
            addLogEntry('info', `User ${user.username} assigned to character ${character?.name}`, 'logs.user_assigned', { username: user.username, characterName: character?.name });
        } else {
            addLogEntry('info', `User ${user.username} unassigned from character`, 'logs.user_unassigned', { username: user.username });
        }
    };

    const handleTogglePinDiscovery = (locationId: string, characterIds: string[]) => {
        updatePinState(locationId, characterIds);
    };

    const handleUpdateTerritory = (locationId: string, territory: LocationTerritory | null) => {
        setTerritory(locationId, territory);
    };

    const handleBackupCampaign = async () => {
        if (!serviceContext) {
            addLogEntry('system', 'Backup failed: no campaign context.', 'logs.backup_failed', {});
            alert('Backup failed: no campaign loaded.');
            return;
        }
        try {
            const exportResult = await exportCampaignBackupFromSupabase(
                serviceContext.client,
                serviceContext.campaignId
            );
            if (exportResult.error || exportResult.data == null) {
                const msg = exportResult.error?.message ?? 'Could not export campaign from Supabase.';
                addLogEntry('system', `Backup failed: ${msg}`, 'logs.backup_failed', { error: msg });
                alert(`Backup failed: ${msg}`);
                return;
            }
            const json = JSON.stringify(exportResult.data, null, 2);
            const result = await window.ipcRenderer.backupCampaign(json);
            if (result.success) {
                addLogEntry('system', `Campaign backup created successfully at: ${result.path}`, 'logs.backup_success', { path: result.path });
                alert(`Backup created successfully!\nPath: ${result.path}`);
            } else {
                addLogEntry('system', `Backup failed: ${result.error}`, 'logs.backup_failed', { error: result.error });
                alert(`Backup failed: ${result.error}`);
            }
        } catch (error) {
            console.error('Backup error:', error);
            addLogEntry('system', `Backup failed: ${(error as Error).message}`, 'logs.backup_failed', { error: (error as Error).message });
            alert(`Backup failed: ${(error as Error).message}`);
        }
    };

    const handleStartSession = () => {
        if (!window.confirm("Start a new session? This will reset Fortune points for all characters.")) return;

        const updatedCharacters = characters.map(char => ({
            ...char,
            status: {
                ...char.status,
                fortune: {
                    ...char.status.fortune,
                    current: char.status.fate.current
                }
            }
        }));

        // Persist each updated character
        updatedCharacters.forEach(char => replaceCharacter(char));

        // Send updates to players
        updatedCharacters.forEach(char => {
            const newMessage: AssignCharacterMessage = {
                type: "ASSIGN_CHARACTER",
                payload: { character: char }
            };
            if (char.userId) {
                void relayGmMessage(newMessage, char.userId);
            }
        });

        addLogEntry('system', 'Session started. Fortune points reset.', 'logs.session_started');
    };

    const handleCorruptionTest = (characterId: string) => {
        const character = characters.find(c => c.id === characterId);
        if (!character) return;

        const totalWp = character.characteristics.wp.initial + character.characteristics.wp.advances + character.characteristics.wp.modifier + getTalentCharacteristicBonus(character, talents, 'wp');

        const roll = Math.floor(Math.random() * 100) + 1;
        const success = roll <= totalWp;

        let newCorruption = character.status.corruption.current;
        let logMsg = `${character.name} tests Corruption (Willpower ${totalWp}): Rolled ${roll}. `;
        const outcome = success ? t('logs.corruption_success') : t('logs.corruption_failure');

        if (success) {
            logMsg += "Success! No corruption gained.";
        } else {
            newCorruption += 1;
            logMsg += "Failure! Gained 1 Corruption point.";
        }

        addLogEntry('roll', logMsg, 'logs.corruption_test', { name: character.name, totalWp, roll, outcome });

        if (!success) {
            const maxCorruption = character.status.corruption.max;
            if (newCorruption > maxCorruption) {
                addLogEntry('system', `⚠️ ${character.name} has exceeded their Corruption Threshold! Mutation Check required!`, 'logs.corruption_threshold', { name: character.name });
                alert(`⚠️ ${character.name} has exceeded their Corruption Threshold! Mutation Check required!`);
            }

            const updatedCharacter = {
                ...character,
                status: {
                    ...character.status,
                    corruption: {
                        ...character.status.corruption,
                        current: newCorruption
                    }
                }
            };
            handleCharacterUpdate(updatedCharacter);
        }
    };

    const handleRoll = (result: {
        characterId: string;
        testName: string;
        targetNumber: number;
        rollResult: number;
        successLevel: number;
        usedTalents?: { name: string; rank: number; }[];
        fortuneSpent: number;
        corruptionGained: number;
    }) => {
        const character = characters.find(c => c.id === result.characterId);
        if (!character) return;

        addLogEntry(
            'roll',
            `${character.name} tests ${result.testName}: Rolled ${result.rollResult} vs ${result.targetNumber}. [${result.successLevel >= 0 ? `${result.successLevel} Success Level(s)` : `${Math.abs(result.successLevel)} Failure Level(s)`}] Fortune spent: ${result.fortuneSpent}, Corruption gained: ${result.corruptionGained}`,
        );
    }

    // Handle opening shop browser from location panel
    const handleViewWares = (shopId: string) => {
        setBrowsingShopId(shopId);
    };

    // Get current shop being browsed
    const currentBrowsingShop = browsingShopId
        ? shopInventory?.shops[browsingShopId]!
        : null;

    const handleItemSelected = (item: Armor | Weapon | Item, charId: string) => {
        const character = characters.find(c => c.id === charId);
        if (!character) return;

        const updatedCharacter: Character = {
            ...character
        };

        if ('damage' in item) {
            if (!Object.keys(updatedCharacter.inventory.weapons).includes(item.id)) {
                updatedCharacter.inventory.weapons[item.id] = 1;
            }
            else {
                updatedCharacter.inventory.weapons[item.id] += 1;
            }
        }
        else if ('ap' in item) {
            if (!Object.keys(updatedCharacter.inventory.armor).includes(item.id)) {
                updatedCharacter.inventory.armor[item.id] = 1;
            }
            else {
                updatedCharacter.inventory.armor[item.id] += 1;
            }
        }
        else {
            if (!Object.keys(updatedCharacter.inventory.items).includes(item.id)) {
                updatedCharacter.inventory.items[item.id] = 1;
            }
            else {
                updatedCharacter.inventory.items[item.id] += 1;
            }
        }

        handleCharacterUpdate(updatedCharacter);
        addLogEntry('system', `${item.name} added to ${character.name}'s inventory.`, 'logs.item_added', { itemName: item.name, characterName: character.name });
        setShowItemSelector(null);
    }

    const handleRemoveItemFromCharacter = (itemId: string, charId: string) => {
        const character = characters.find(c => c.id === charId);
        if (!character) return;

        const updatedCharacter: Character = {
            ...character
        };

        if (Object.keys(updatedCharacter.inventory.weapons).includes(itemId)) {
            if (updatedCharacter.inventory.weapons[itemId] > 1) {
                updatedCharacter.inventory.weapons[itemId] -= 1;
            }
            else {
                delete updatedCharacter.inventory.weapons[itemId];
            }
        }
        else if (Object.keys(updatedCharacter.inventory.armor).includes(itemId)) {
            if (updatedCharacter.inventory.armor[itemId] > 1) {
                updatedCharacter.inventory.armor[itemId] -= 1;
            }
            else {
                delete updatedCharacter.inventory.armor[itemId];
            }
        }
        else if (Object.keys(updatedCharacter.inventory.items).includes(itemId)) {
            if (updatedCharacter.inventory.items[itemId] > 1) {
                updatedCharacter.inventory.items[itemId] -= 1;
            }
            else {
                delete updatedCharacter.inventory.items[itemId];
            }
        }
        else {
            console.error("Item not found in inventory: " + itemId);
            return;
        }

        handleCharacterUpdate(updatedCharacter);
        addLogEntry('system', `${itemId} removed from ${character.name}'s inventory.`, 'logs.item_removed', { itemName: itemId, characterName: character.name });
    };

    const handleTalentSelected = (talent: Talent, charId: string) => {
        const character = characters.find(c => c.id === charId);
        if (!character) return;

        let updatedCharacter: Character = {
            ...character
        };
        const updatedTalents = updatedCharacter.talents;
        if (Object.keys(updatedTalents).includes(talent.id)) {
            updatedTalents[talent.id] += 1;
        }
        else {
            updatedTalents[talent.id] = 1;
        }

        updatedCharacter = recalculateCharacterTalentBonuses(updatedCharacter, talents);

        updatedCharacter.status.wounds.max = calculateMaxWounds(updatedCharacter);

        handleCharacterUpdate(updatedCharacter);
        addLogEntry('system', `${talent.name} added to ${character.name}'s talents.`, 'logs.talent_added', { talentName: talent.name, characterName: character.name });
        setShowTalentSelector(null);
    }

    return (
        <CodexProvider dataSources={codexDataSources}>
        <AudioProvider>
        <div>
            <Footer
                ip="Supabase"
                port={0}
                clients={[]}
                presenceOnlinePlayerCount={presenceOnlinePlayerCount}
                presenceChannelConnected={broadcastConnectionState === 'CONNECTED'}
                onShowUserManager={() => setShowUserManager(true)}
                onBackup={handleBackupCampaign}
                onStartSession={handleStartSession}
                onShowJournal={() => setShowJournalManager(true)}
                onShowQuestJournal={() => setShowQuestJournal(true)}
                onShowCalendar={() => setShowTimelineManager(true)}
                onShowShop={() => setShowShopManager(!showShopManager)}
                onShowShopConfigurator={() => setShowShopConfigurator(true)}
                onShowDiceTray={() => setShowDiceTray(!showDiceTray)}
                onShowAtmospherePanel={() => setShowAtmospherePanel(!showAtmospherePanel)}
                onShowFactionManager={() => setShowFactionManager(true)}
                onShowReputationPanel={() => setShowReputationPanel(true)}
                onShowTemplateManager={() => setShowTemplateManager(true)}
                onShowDramatisPersonae={() => setShowDramatisPersonae(true)}
                onShowChat={() => setShowChat(!showChat)}
                onShowGameLog={() => setShowGameLog(true)}
            />

            { showGameLog && (
                <GameLog entries={logEntries} onClose={() => setShowGameLog(false)} />
            )}

            {/* Left Sidebar with Tab Toggle */}
            <div className={sidebarStyles.sidebarContainer}>
                {/* Tab Strip */}
                <div className={sidebarStyles.sidebarTabs}>
                    <button
                        className={`${sidebarStyles.sidebarTab} ${leftSidebarMode === 'roster' ? sidebarStyles.active : ''}`}
                        onClick={() => setLeftSidebarMode('roster')}
                        title={t('sidebar.characterRoster', 'Character Roster')}
                    >
                        👥
                        <span className={sidebarStyles.sidebarTabTooltip}>
                            {t('sidebar.characterRoster', 'Character Roster')}
                        </span>
                    </button>
                    <button
                        className={`${sidebarStyles.sidebarTab} ${leftSidebarMode === 'audio' ? sidebarStyles.active : ''}`}
                        onClick={() => setLeftSidebarMode('audio')}
                        title={t('sidebar.audioControls', 'Audio Controls')}
                    >
                        🎵
                        <span className={sidebarStyles.sidebarTabTooltip}>
                            {t('sidebar.audioControls', 'Audio Controls')}
                        </span>
                    </button>
                    <div className={sidebarStyles.sidebarDivider} />
                    <button
                        className={sidebarStyles.manageLibraryBtn}
                        onClick={() => setShowLibraryManager(true)}
                        title={t('audio.libraryManager', 'Music Library')}
                    >
                        ⚙️
                    </button>
                </div>

                {/* Sidebar Content */}
                <div className={sidebarStyles.sidebarContent}>
                    {leftSidebarMode === 'roster' ? (
                        <CharacterRoster
                            users={usersWithAssignments}
                            openSheetIds={openSheetIds}
                            onToggleCharacterSheet={handleToggleCharacterSheet}
                            onAssignCharacter={handleAssignCharacterToUser}
                            onCreateCharacter={handleCreateCharacter}
                            onGenerateNpc={handleGenerateNPC}
                            onGenerateNpcDetailed={handleGenerateNPCDetailed}
                            onAddCombatant={handleAddCombatant}
                            onFightButtonClick={() => setShowCombatResolver(true)}
                            tokens={tokens}
                            onPlaceToken={handlePlaceToken}
                            onRemoveToken={(tokenId) => removeToken(tokenId)}
                        />
                    ) : (
                        <AudioSidebar
                            onOpenLibraryManager={() => setShowLibraryManager(true)}
                        />
                    )}
                </div>
            </div>

            {combatState.combatants.length > 0 && (
                <InitiativeTracker
                    onUpdateCombatant={handleUpdateCombatant}
                    characters={characters}
                    onSendToPlayer={(charId: string, message) => {
                        const character = characters.find(c => c.id === charId);
                        if (!character || !character.userId) return;
                        const userId = character.userId;
                        void broadcastConditionTestRequest(userId, message.payload);
                        void relayGmMessage(message, userId);
                    }}
                />)}

            <div style={{
                display: 'flex',
                width: '100vw',
                height: '100vh',
                position: 'fixed',
                top: 0,
                left: 0
            }}>
                <div style={{ flex: 1 }}>
                    <MapView
                        mapData={currentMapData}
                        mapPinStates={pinStates}
                        characters={characters}
                        isGM={true}
                        viewState={mapViewState}
                        onViewStateChange={setMapViewState}
                        onTogglePinDiscovery={handleTogglePinDiscovery}
                        onMapPing={(x, y) => {
                            void sendMapPing(x, y, '#d4af37');
                        }}
                        incomingPing={mapPing}
                        shops={shopInventory ? Object.values(shopInventory.shops) : []}
                        onViewWares={handleViewWares}
                        tokens={activeTokens}
                        onTokenMove={handleTokenMove}
                        userPins={activeUserPins}
                        gridScale={currentMapData.gridSize}
                        factions={factions}
                        locationTerritories={locationTerritories}
                        onUpdateTerritory={handleUpdateTerritory}
                    />
                    <button
                        onClick={() => setShowMapSelector(true)}
                        style={{
                            position: 'absolute',
                            top: '10px',
                            left: '25%',
                            zIndex: 1020,
                            padding: '8px 16px',
                            background: 'linear-gradient(135deg, #4a3020 0%, #2a1810 100%)',
                            border: '2px solid #8b4513',
                            borderRadius: '6px',
                            color: '#d4af37',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}
                        title={t('map.selector.openSelector', 'Open Map Selector')}
                    >
                        🗺️ {currentMapData.name}
                    </button>
                </div>
            </div>

            {/* Map Selector Modal */}
            {showMapSelector && (
                <MapSelector
                    onClose={() => setShowMapSelector(false)}
                />
            )}

            {showCombatResolver && (<CombatResolver
                characters={characters}
                opposedTestResults={opposedTestResults}
                rollQueue={rollQueue}
                onRemoveFromQueue={(rollId: string) => {
                    setRollQueue(prev => prev.filter(r => r.id !== rollId));
                }}
                onClearOpposedTestResult={(testId: string, role: 'attacker' | 'defender') => {
                    setOpposedTestResults(prev => {
                        const newMap = new Map(prev);
                        newMap.delete(`${testId}-${role}`);
                        return newMap;
                    });
                }}
                onSendToPlayer={(charId: string, message) => {
                    const character = characters.find(c => c.id === charId);
                    if (!character || !character.userId) return;
                    const userId = character.userId;
                    if (message.type === 'REQUEST_OPPOSED_TEST') {
                        void broadcastOpposedTestRequest(userId, message.payload);
                    }
                    void relayGmMessage(message, userId);
                }}
                onLogEntry={addLogEntry}
                onUpdateCharacter={handleCharacterUpdate}
                onClose={() => { setShowCombatResolver(false); }}
            />
            )}

            {showAtmospherePanel && <AtmospherePanel onClose={() => setShowAtmospherePanel(false)} />}

            {showShopManager && (
                <ShopManager
                    onClose={() => setShowShopManager(false)}
                    characters={characters}
                />
            )}

            {showTemplateManager && (
                <TemplateManager
                    onClose={() => setShowTemplateManager(false)}
                    templates={allTemplates}
                    onTemplatesChange={async (updatedTemplates) => {
                        await replaceAllTemplates(updatedTemplates);
                    }}
                    onGenerateCharacter={(newCharacter) => {
                        ctxCreateCharacter(newCharacter);
                        addLogEntry('system', `Generated NPC from template: ${newCharacter.name}`, 'logs.npc_generated', { name: newCharacter.name });
                    }}
                    existingCharacterNames={characters.map(c => c.name)}
                />
            )}

            {/* Dramatis Personae View */}
            {showDramatisPersonae && (
                <DramatisPersonae
                    characters={characters}
                    motivations={motivations}
                    onClose={() => setShowDramatisPersonae(false)}
                    onOpenLoreEditor={(character) => {
                        setLoreEditorCharacter(character);
                    }}
                />
            )}

            {/* Lore Editor Modal */}
            {loreEditorCharacter && (
                <LoreEditor
                    character={loreEditorCharacter}
                    characters={characters}
                    motivations={motivations}
                    onCharacterUpdate={(updatedCharacter) => {
                        handleCharacterUpdate(updatedCharacter);
                        setLoreEditorCharacter(updatedCharacter);
                    }}
                    onOtherCharacterUpdate={(updatedCharacter) => {
                        handleCharacterUpdate(updatedCharacter);
                    }}
                    onClose={() => setLoreEditorCharacter(null)}
                />
            )}

            {currentBrowsingShop && (
                <ShopBrowser
                    shopId={currentBrowsingShop.shopId}
                    onClose={() => setBrowsingShopId(null)}
                    isGm={true}
                />
            )}


            {showDiceTray && <DiceTray onClose={() => setShowDiceTray(false)} onLogEntry={addLogEntry} />}

            {showChat && (
                <div style={{
                    position: 'fixed',
                    right: '20px',
                    bottom: '80px',
                    width: '380px',
                    height: '500px',
                    zIndex: 1010,
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
                    borderRadius: '8px',
                    overflow: 'hidden'
                }}>
                    <GmChatPanel onClose={() => setShowChat(false)} />
                </div>
            )}

            {showFactionManager && (
                <FactionManager
                    locations={mapData.locations}
                    onClose={() => setShowFactionManager(false)}
                />
            )}

            {showReputationPanel && (
                <CharacterReputationPanel
                    characters={characters}
                    onCharacterUpdate={handleCharacterUpdate}
                    onClose={() => setShowReputationPanel(false)}
                />
            )}

            {showShopConfigurator && (
                <ShopConfigurator
                    onClose={() => setShowShopConfigurator(false)}
                />
            )}

            {showCharacterWizard && (
                <CharacterCreationWizard
                    onClose={() => setShowCharacterWizard(false)}
                    onComplete={handleWizardComplete}
                />
            )}

            {showNPCGenerator && (
                <NPCGeneratorWizard
                    onClose={() => setShowNPCGenerator(false)}
                    onComplete={handleNPCGeneratorComplete}
                />
            )}

            {showUserManager && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.8)',
                    zIndex: 1100,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '20px'
                }}>
                    <div style={{ maxWidth: '1400px', width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
                        <button
                            onClick={() => setShowUserManager(false)}
                            style={{
                                position: 'absolute',
                                top: '30px',
                                right: '30px',
                                background: '#8b0000',
                                border: '2px solid #d4af37',
                                color: '#d4af37',
                                padding: '10px 20px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '16px',
                                zIndex: 1001
                            }}
                        >
                            ✖ Close
                        </button>
                        <UserManager
                            users={usersWithAssignments}
                            characters={characters}
                            onCreateUser={handleCreateUser}
                            onDeleteUser={handleDeleteUser}
                            onAssignCharacter={handleAssignCharacterToUser}
                            isUserOnline={isUserOnline}
                        />
                    </div>
                </div>
            )}

            {showJournalManager && (
                <JournalManager
                    characters={characters}
                    onClose={() => setShowJournalManager(false)}
                />
            )}

            {showQuestJournal && (
                <QuestJournalViewer
                    locations={mapData.locations}
                    onClose={() => setShowQuestJournal(false)}
                />
            )}

            {showTimelineManager && (
                <TimelineManager
                    onClose={() => setShowTimelineManager(false)}
                />
            )}

            {purchaseRequest && (
                <PurchaseRequestModal
                    playerName={purchaseRequest.playerName}
                    item={purchaseRequest.item}
                    playerCurrency={purchaseRequest.playerCurrency}
                    userId={characters.find(c => c.id === purchaseRequest.charId)?.userId || ''}
                    onClose={() => setPurchaseRequest(null)}
                    onApprove={(item) => {
                        const character = characters.find(c => c.id === purchaseRequest.charId);
                        if (character) {
                            const priceParts = item.price.split(' ');
                            const amount = parseInt(priceParts[0]);
                            const currencyType = priceParts[1];

                            const currencyChange = {
                                gc: currencyType === 'GC' ? -amount : 0,
                                ss: currencyType === 'S' ? -amount : 0,
                                bp: currencyType === 'P' ? -amount : 0,
                            };

                            const newCurrency = equilibrateCurrency({ ...character.currency });
                            newCurrency.gc += currencyChange.gc;
                            newCurrency.ss += currencyChange.ss;
                            newCurrency.bp += currencyChange.bp;
                            const equilibratedCurrency = equilibrateCurrency(newCurrency);

                            const updatedInventory = { ...character.inventory };
                            if ('damage' in item) {
                                updatedInventory.weapons = { ...character.inventory.weapons };
                                if (updatedInventory.weapons[item.id]) {
                                    updatedInventory.weapons[item.id] += 1;
                                } else {
                                    updatedInventory.weapons[item.id] = 1;
                                }
                            } else if ('ap' in item) {
                                updatedInventory.armor = { ...character.inventory.armor };
                                if (updatedInventory.armor[item.id]) {
                                    updatedInventory.armor[item.id] += 1;
                                } else {
                                    updatedInventory.armor[item.id] = 1;
                                }
                            } else {
                                updatedInventory.items = { ...character.inventory.items };
                                if (updatedInventory.items[item.id]) {
                                    updatedInventory.items[item.id] += 1;
                                } else {
                                    updatedInventory.items[item.id] = 1;
                                }
                            }
                            const updatedCharacter: Character = {
                                ...character,
                                currency: equilibratedCurrency,
                                inventory: updatedInventory,
                            };

                            handleCharacterUpdate(updatedCharacter);
                            addLogEntry('system', `${character.name} purchased ${item.name} for ${item.price}.`, 'logs.purchase', { name: character.name, itemName: item.name, price: item.price });
                        }
                        setPurchaseRequest(null);
                    }}
                />
            )}

            {careerChangeRequest && (
                <CareerChangeApprovalModal
                    request={careerChangeRequest}
                    onApprove={() => {
                        const character = characters.find(c => c.id === careerChangeRequest.characterId);
                        if (character && careerChangeRequest) {
                            if (character.xp.current < careerChangeRequest.xpCost) {
                                const responseMessage: CareerChangeResponseMessage = {
                                    type: 'CAREER_CHANGE_RESPONSE',
                                    payload: {
                                        success: false,
                                        reason: 'Insufficient XP'
                                    }
                                };
                                window.ipcRenderer.sendToPlayer(character.userId || '', responseMessage);
                                addLogEntry('system', `Career change rejected: ${character.name} has insufficient XP.`);
                                setCareerChangeRequest(null);
                                return;
                            }
                            const newCareer = careers.find(c => c.id === careerChangeRequest.newCareerId);
                            if (!newCareer) {
                                const responseMessage: CareerChangeResponseMessage = {
                                    type: 'CAREER_CHANGE_RESPONSE',
                                    payload: {
                                        success: false,
                                        reason: 'Invalid Career'
                                    }
                                };
                                window.ipcRenderer.sendToPlayer(character.userId || '', responseMessage);
                                addLogEntry('system', `Career change rejected: ${character.name} has invalid career.`);
                                setCareerChangeRequest(null);
                                return;
                            }

                            const newCareerLevel = newCareer.career_level.find(lvl => lvl.id === careerChangeRequest.newCareerLevelId);
                            if (!newCareerLevel) {
                                const responseMessage: CareerChangeResponseMessage = {
                                    type: 'CAREER_CHANGE_RESPONSE',
                                    payload: {
                                        success: false,
                                        reason: 'Invalid Career Level'
                                    }
                                };
                                window.ipcRenderer.sendToPlayer(character.userId || '', responseMessage);
                                addLogEntry('system', `Career change rejected: ${character.name} has invalid career level.`);
                                setCareerChangeRequest(null);
                                return;
                            }

                            const availableAdvancements = getAvailableAdvancements(newCareer, newCareerLevel.lvl);
                            const updatedCharacter: Character = {
                                ...character,
                                currentCareerId: careerChangeRequest.newCareerId,
                                currentCareerLevelId: careerChangeRequest.newCareerLevelId,
                                xp: {
                                    current: character.xp.current - careerChangeRequest.xpCost,
                                    spent: character.xp.spent + careerChangeRequest.xpCost
                                },
                                careerHistory: [
                                    ...(character.careerHistory || []),
                                    {
                                        careerId: careerChangeRequest.newCareerId,
                                        careerLevelId: careerChangeRequest.newCareerLevelId,
                                        careerName: careerChangeRequest.newCareerName,
                                        levelName: careerChangeRequest.newCareerLevelName,
                                        level: careers
                                            .find(c => c.id === careerChangeRequest.newCareerId)
                                            ?.career_level.find(lvl => lvl.id === careerChangeRequest.newCareerLevelId)
                                            ?.lvl || 1,
                                        xpSpent: careerChangeRequest.xpCost,
                                        advancementType: 'characteristic' as const,
                                        advancementId: 'career_change',
                                        advancementName: `Career Change: ${careerChangeRequest.newCareerName} - ${careerChangeRequest.newCareerLevelName}`,
                                        timestamp: new Date().toISOString()
                                    }
                                ],
                                unlockedCharacteristicIds: availableAdvancements.characteristics,
                                unlockedSkillIds: availableAdvancements.skills,
                                unlockedTalentIds: availableAdvancements.talents,
                                skills: [
                                    ...character.skills,
                                    ...newCareerLevel.skills_ids.filter(skillId => !character.skills.some(s => s.id === skillId)).map((skillId: string) => {
                                        if (isSkillGrouped(skillId)) {
                                            const grouped = getGroupedSkill(skillId, skills);
                                            if (!grouped) return { id: "", name: "Unknown Skill", characteristic: "ws", advances: 0, talents: 0, modifier: 0 };
                                            return grouped;
                                        }
                                        const skillDef = skills.find((s: any) => s.id === skillId && s.type === 'skill');
                                        if (!skillDef) return { id: "", name: "Unknown Skill", characteristic: "ws", advances: 0, talents: 0, modifier: 0 };
                                        return {
                                            id: skillDef.id,
                                            name: skillDef.name,
                                            characteristic: skillDef.characteristic,
                                            advances: 0,
                                            talents: 0,
                                            modifier: 0
                                        };
                                    }).filter((s: Skill) => s.id !== "") // Filter out unknown skills
                                ]
                            };

                            handleCharacterUpdate(updatedCharacter);

                            const responseMessage: CareerChangeResponseMessage = {
                                type: 'CAREER_CHANGE_RESPONSE',
                                payload: {
                                    success: true,
                                    character: updatedCharacter
                                }
                            };
                            window.ipcRenderer.sendToPlayer(character.userId || '', responseMessage);
                            addLogEntry('system', `Career change approved: ${character.name} is now ${careerChangeRequest.newCareerName} - ${careerChangeRequest.newCareerLevelName}.`, 'logs.career_change_approved', { name: character.name, newCareerName: careerChangeRequest.newCareerName, newCareerLevelName: careerChangeRequest.newCareerLevelName });
                        }
                        setCareerChangeRequest(null);
                    }}
                    onReject={(reason) => {
                        const character = characters.find(c => c.id === careerChangeRequest?.characterId);
                        if (character) {
                            const responseMessage: CareerChangeResponseMessage = {
                                type: 'CAREER_CHANGE_RESPONSE',
                                payload: {
                                    success: false,
                                    reason: reason
                                }
                            };
                            window.ipcRenderer.sendToPlayer(character.userId || '', responseMessage);
                            addLogEntry('system', `Career change rejected for ${character.name}: ${reason}`, 'logs.career_change_rejected', { name: character.name, reason });
                        }
                        setCareerChangeRequest(null);
                    }}
                    onClose={() => setCareerChangeRequest(null)}
                />
            )}

            {openSheetIds.map(characterId => {
                const character = characters.find(char => char.id === characterId);

                if (!character) return null;

                if (character.isMinion) {
                    return (
                        <MinionSheet
                            key={character.id}
                            character={character}
                            onCharacterUpdate={(updates) => handleCharacterUpdate({ ...character, ...updates })}
                            onCharacteristicClick={(charId, charName, charValue) => setTestModalInfo({ id: charId, name: charName, value: charValue, charId: character.id })}
                            onSkillClick={(skillId, skillName, skillValue) => setTestModalInfo({ id: skillId, name: skillName, value: skillValue, charId: character.id })}
                            onFullViewClick={() => {
                                handleCharacterUpdate({ ...character, isMinion: false });
                            }}
                            onClose={() => handleToggleCharacterSheet(character.id)}
                        />
                    );
                }

                return (
                    <PlayerCharacterSheet
                        key={character.id}
                        character={character}
                        isEditMode={true}
                        onEditModeToggle={() => { }}
                        onCharacteristicClick={(charId, charName, charValue) => setTestModalInfo({ id: charId, name: charName, value: charValue, charId: character.id })}
                        onSkillClick={(skillId, skillName, skillValue) => setTestModalInfo({ id: skillId, name: skillName, value: skillValue, charId: character.id })}
                        onCharacterUpdate={(updates) => handleCharacterUpdate({ ...character, ...updates })}
                        isGM={true}
                        onXpAward={(amount) => handleXpAward(character.id, amount)}
                        onCareerManagementModalOpen={(char) => setShowCareerManager(char)}
                        onCurrencyAward={(amount) => handleCurrencyAward(character.id, amount)}
                        onRemoveTalent={(talentId) => {
                            const updatedTalents = { ...character.talents };
                            delete updatedTalents[talentId];
                            const updatedCharacter = { ...character, talents: updatedTalents };
                            updatedCharacter.status.wounds.max = calculateEffectiveMaxWounds(updatedCharacter, talents);
                            handleCharacterUpdate(updatedCharacter);
                        }}
                        onAddTalent={() => setShowTalentSelector(character.id)}
                        onCorruptionTest={() => handleCorruptionTest(character.id)}
                        onRemoveItem={(itemId, type) => handleRemoveItemFromCharacter(itemId, character.id)}
                        onAddItem={() => setShowItemSelector(character.id)}
                        onMinionViewClick={() => handleCharacterUpdate({ ...character, isMinion: true })}
                        onClose={() => handleToggleCharacterSheet(character.id)}
                        users={usersWithAssignments}
                        renderSecretsManager={(props) => (
                            <SecretsManager
                                character={props.character}
                                users={props.users}
                                onCharacterUpdate={props.onCharacterUpdate}
                            />
                        )}
                    />
                );
            })}

            {showItemSelector && (
                <ItemSelectorModal
                    onClose={() => setShowItemSelector(null)}
                    onSelect={(item) => handleItemSelected(item, showItemSelector)}
                />
            )}

            {showTalentSelector && (
                <TalentSelectorModal
                    onClose={() => setShowTalentSelector(null)}
                    onSelect={(talent) => handleTalentSelected(talent, showTalentSelector)}
                    character={characters.find(c => c.id == showTalentSelector)!}
                />
            )}

            {showCareerManager && (
                <CareerManager
                    character={showCareerManager}
                    onClose={() => setShowCareerManager(null)}
                    onCharacterUpdate={(char) => {
                        handleCharacterUpdate(char);
                        setShowCareerManager(char);
                    }}
                />
            )}

            {testModalInfo && (
                <TalentSelectionModal
                    character={characters.find(c => c.id === testModalInfo.charId)!}
                    testName={testModalInfo.name}
                    testId={testModalInfo.id}
                    baseTarget={testModalInfo.value}
                    fortunePoints={characters.find(c => c.id === testModalInfo.charId)!.status.fortune.current}
                    corruptionCurrent={characters.find(c => c.id === testModalInfo.charId)!.status.corruption.current}
                    corruptionMax={characters.find(c => c.id === testModalInfo.charId)!.status.corruption.max}
                    onClose={() => setTestModalInfo(null)}
                    onRoll={handleRoll}
                />
            )}

            {/* Music Library Manager */}
            {showLibraryManager && (
                <LibraryManager onClose={() => setShowLibraryManager(false)} />
            )}

            {/* Codex System */}
            <CommandPalette />
            <CodexViewer />
            <CodexPopupModal />
        </div>
        </AudioProvider>
        </CodexProvider>
    );
}

export default App;