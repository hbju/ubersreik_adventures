import { getGroupedSkill, getTalentInitiativeBonus, isSkillGrouped, MapDisplay, MapView, recalculateCharacterTalentBonuses, Skill, getTalentCharacteristicBonus, useGameData, CharacterCreationWizard, CharacterTemplate, generateCharacterFromTemplate, MapTokensUpdateMessage, ChatBox, ChatMessage, parseChatCommand, executeDiceRoll, ActiveMapUpdateMessage, UserPinsUpdateMessage } from '@wfrp/shared';
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

import {
    DiscoveredLocationsList, 
    getAvailableAdvancements,
    calculateEffectiveMaxWounds,
    Character,
    User,
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
    UpdateInitiativeTrackerMessage,
    OpposedTestResultMessage,
    Armor,
    Weapon,
    Item,
    Condition,
    Advantages,
    JournalEntry,
    MapPinState,
    CareerChangeResponseMessage,
    Location,
    Talent,
    TalentSelectionModal,
    Faction,
    FactionUpdateMessage,
    ShopInventoryState,
    ShopDefinition,
    Quest,
    QueuedRoll,
} from '@wfrp/shared';
import { CampaignState, MapToken, UserMapPin } from '@wfrp/shared/src/types/wfrp.types';

import React, { useState, useEffect, useRef, useMemo } from 'react';

import './App.css';
import CareerManager from './components/CareerManager';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';
import ShopBrowser from './components/ShopBrowser';

interface ServerStatusData {
    ip: string;
    port: number;
    clients: string[];
}

function App() {
    const { t } = useTranslation();

    const { skills, talents, careers, items, weapons, armor, conditions, shops: shopDefinitions, mapData, maps, mapsList } = useGameData();

    // Active map management
    const [activeMapId, setActiveMapId] = useState<string>('ubersreik_city');
    const activeMapIdRef = useRef(activeMapId);
    const [showMapSelector, setShowMapSelector] = useState(false);

    // Get the current active map data
    const currentMapData = useMemo(() => {
        return maps[activeMapId] || mapData;
    }, [maps, activeMapId, mapData]);

    const calculateMaxWounds = (character: Character) => {
        return calculateEffectiveMaxWounds(character, talents);
    }

    const calculateMaxCorruption = (character: Character) => {
        return calculateCharacteristicBonus(character.characteristics.wp) + calculateCharacteristicBonus(character.characteristics.t);
    }

    const [serverInfo, setServerInfo] = useState({ ip: 'Loading...', port: 0 });
    const [connectedPlayers, setConnectedPlayers] = useState<string[]>([]);
    const [saving, setSaving] = useState<boolean>(false);

    const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

    const [characters, setCharacters] = useState<Character[]>([]);
    const charactersRef = useRef(characters);
    const [users, setUsers] = useState<User[]>([]);
    const usersRef = useRef(users);
    const [journal, setJournal] = useState<JournalEntry[]>([]);
    const journalRef = useRef(journal);
    const [mapPinStates, setMapPinStates] = useState<Record<string, MapPinState>>({});
    const mapPinStatesRef = useRef(mapPinStates);
    const [mapPing, setMapPing] = useState<{ x: number; y: number; color: string; userId: string } | null>(null);
    const [mapViewState, setMapViewState] = useState<{ scale: number; offsetX: number; offsetY: number }>({ scale: 0.3, offsetX: 126, offsetY: -26 });
    const [assignedCharacters, setAssignedCharacters] = useState<string[]>([]);
    const [openSheetIds, setOpenSheetIds] = useState<string[]>([]);
    const [combatants, setCombatants] = useState<Combatant[]>([]);
    const [currentTurnId, setCurrentTurnId] = useState<string | null>(null);
    const [currentAdvantage, setCurrentAdvantage] = useState<Advantages>({ playerAdvantage: 0, enemyAdvantage: 0 });

    const [showGameLog, setShowGameLog] = useState(false);
    const [showShopManager, setShowShopManager] = useState(false);
    const [showShopConfigurator, setShowShopConfigurator] = useState(false);
    const [showDiceTray, setShowDiceTray] = useState(false);
    const [showCharacterWizard, setShowCharacterWizard] = useState(false);
    const [showCombatResolver, setShowCombatResolver] = useState(false);
    const [showJournalManager, setShowJournalManager] = useState(false);
    const [showUserManager, setShowUserManager] = useState(false);
    const [showCareerManager, setShowCareerManager] = useState<Character | null>(null);
    const [showAtmospherePanel, setShowAtmospherePanel] = useState(false);
    const [showFactionManager, setShowFactionManager] = useState(false);
    const [showReputationPanel, setShowReputationPanel] = useState(false);
    const [showTemplateManager, setShowTemplateManager] = useState(false);
    const [showQuestJournal, setShowQuestJournal] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [factions, setFactions] = useState<Faction[]>([]);
    const factionsRef = useRef(factions);
    const [quests, setQuests] = useState<Quest[]>([]);
    const questsRef = useRef(quests);
    const [characterTemplates, setCharacterTemplates] = useState<CharacterTemplate[]>([]);
    const characterTemplatesRef = useRef(characterTemplates);
    const [customShopDefinitions, setCustomShopDefinitions] = useState<ShopDefinition[]>([]);
    const customShopDefinitionsRef = useRef(customShopDefinitions);
    const [shopInventory, setShopInventory] = useState<ShopInventoryState | undefined>(undefined);
    const shopInventoryRef = useRef(shopInventory);
    const [tokens, setTokens] = useState<MapToken[]>([]);
    const tokensRef = useRef(tokens);
    const [userPins, setUserPins] = useState<UserMapPin[]>([]);
    const userPinsRef = useRef(userPins);
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

    // Merge default shop definitions with custom ones
    // Custom definitions override defaults with the same ID
    const allShopDefinitions = useMemo(() => {
        const customIds = new Set(customShopDefinitions.map(s => s.id));
        const baseShops = shopDefinitions.filter(s => !customIds.has(s.id));
        return [...baseShops, ...customShopDefinitions];
    }, [shopDefinitions, customShopDefinitions]);

    // Merge default templates with custom ones
    // Custom templates override defaults with the same ID
    const { defaultTemplates } = useGameData();
    const allTemplates = useMemo(() => {
        const customIds = new Set(characterTemplates.map(t => t.id));
        const baseTemplates = (defaultTemplates || []).filter(t => !customIds.has(t.id));
        return [...baseTemplates, ...characterTemplates];
    }, [defaultTemplates, characterTemplates]);

    const addLogEntry = (type: LogEntry['type'], content: string, messageCode?: string, params?: Record<string, any>) => {
        const newEntry: LogEntry = { id: new Date().toISOString() + Math.random().toString(36), type, content, messageCode, params };
        setLogEntries(prev => [...prev, newEntry]);
    };


    useEffect(() => {
        if (!saving) return;

        console.log("Saving data, characters:", characters);
        const campaignData: CampaignState = {
            characters: characters,
            users: users,
            journal: journal,
            quests: quests,
            mapPinStates: mapPinStates,
            factions: factions,
            shopInventory: shopInventory,
            customShopDefinitions: customShopDefinitions,
            characterTemplates: characterTemplates,
            tokens: tokens,
            userPins: userPins,
            playerColors: {},
            maps: maps, // Include all maps
            activeMapId: activeMapId, // Current active map
            version: '1.0.0',
            lastModified: new Date().toISOString(),
        };
        window.ipcRenderer.saveData(campaignData);

        charactersRef.current = characters;
        usersRef.current = users;
        journalRef.current = journal;
        questsRef.current = quests;
        mapPinStatesRef.current = mapPinStates;
        factionsRef.current = factions;
        shopInventoryRef.current = shopInventory;
        customShopDefinitionsRef.current = customShopDefinitions;
        characterTemplatesRef.current = characterTemplates;
        tokensRef.current = tokens;
        userPinsRef.current = userPins;
        activeMapIdRef.current = activeMapId;

    }, [characters, users, journal, quests, mapPinStates, factions, shopInventory, customShopDefinitions, characterTemplates, activeMapId]);

    const handleCharacterUpdate = (updatedCharacter: Character) => {
        const recaculatedCharacter = recalculateCharacterTalentBonuses(updatedCharacter, talents);

        const updatedCharacters = charactersRef.current.map(char =>
            char.id === recaculatedCharacter.id ? recaculatedCharacter : char
        );

        setCharacters(updatedCharacters);

        const newMessage: AssignCharacterMessage = {
            type: "ASSIGN_CHARACTER",
            payload: { character: recaculatedCharacter }
        };

        window.ipcRenderer.sendToPlayer(recaculatedCharacter.userId || '', newMessage);
    }

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

    const handleWizardComplete = (newCharacter: Character) => {
        const updatedCharacters = [...charactersRef.current, newCharacter];
        setCharacters(updatedCharacters);
        setShowCharacterWizard(false);
        addLogEntry('system', `Created new character: ${newCharacter.name}`, 'logs.character_created', { name: newCharacter.name });
    };

    const handleGenerateNPC = () => {
        const newNPC = generateRandomNpc(careers, skills);
        const updatedCharacters = [...charactersRef.current, newNPC];
        setCharacters(updatedCharacters);
    }

    const handleDeleteCharacter = (characterId: string) => {
        console.log("trying to delete " + characterId);
        const characterToDelete = charactersRef.current.find(c => c.id === characterId);
        if (!characterToDelete) return;

        console.log("deleting " + characterId);
        if (window.confirm(`Are you sure you want to delete ${characterToDelete.name}? This cannot be undone.`)) {
            const updatedCharacters = charactersRef.current.filter(char => char.id !== characterId);
            setCharacters(updatedCharacters);
            setOpenSheetIds(prev => prev.filter(id => id !== characterId));
        }
    };

    const handlePlaceToken = (characterId: string) => {
        const character = charactersRef.current.find(c => c.id === characterId);
        if (!character) return;
        
        // Use spawn point if available, otherwise default position
        const spawnPoint = currentMapData.spawnPoint || { x: 1000, y: 1000 };
        
        const newToken: MapToken = {
            id: crypto.randomUUID(),
            characterId: character.id,
            mapId: activeMapIdRef.current,
            x: spawnPoint.x,
            y: spawnPoint.y,
        };
        setTokens(prev => [...prev, newToken]);
    }

    // Handle switching maps
    const handleSwitchMap = (mapId: string, moveTokens: boolean) => {
        const newMap = maps[mapId];
        if (!newMap) return;

        setActiveMapId(mapId);
        activeMapIdRef.current = mapId;

        // If moveTokens is true, update all player tokens to new map with spawn point
        if (moveTokens && newMap.spawnPoint) {
            const updatedTokens = tokensRef.current.map(token => ({
                ...token,
                mapId: mapId,
                x: newMap.spawnPoint!.x,
                y: newMap.spawnPoint!.y,
            }));
            setTokens(updatedTokens);

            // Broadcast updated tokens
            const tokenMessage: MapTokensUpdateMessage = {
                type: 'MAP_TOKENS_UPDATE',
                payload: { tokens: updatedTokens }
            };
            window.ipcRenderer.sendToAllPlayers(tokenMessage);
        }

        // Broadcast the map switch to all players
        const mapSwitchMessage: ActiveMapUpdateMessage = {
            type: 'ACTIVE_MAP_UPDATE',
            payload: { 
                activeMapId: mapId,
                spawnPoint: newMap.spawnPoint
            }
        };
        window.ipcRenderer.sendToAllPlayers(mapSwitchMessage);

        addLogEntry('system', `Switched to map: ${newMap.name}`, 'logs.map_switched', { mapName: newMap.name });
    };

    // Handle setting spawn point via right-click
    const handleSetSpawnPoint = (x: number, y: number) => {
        // This would require updating the map data in the campaign state
        // For now, we'll just log it - full implementation would need backend support
        addLogEntry('system', `Spawn point set at (${Math.round(x)}, ${Math.round(y)}) for ${currentMapData.name}`, 'logs.spawn_point_set', { x: Math.round(x), y: Math.round(y), mapName: currentMapData.name });
    };

    const handleTokenMove = (tokenId: string, x: number, y: number) => {
        setTokens(prev =>
            prev.map(token =>
                token.id === tokenId ? { ...token, x, y } : token
            )
        );

        const message : MapTokensUpdateMessage = {
            type: 'MAP_TOKENS_UPDATE',
            payload: {
                tokens: tokensRef.current.map(token =>
                    token.id === tokenId ? { ...token, x, y } : token
                )
            }
        };

        window.ipcRenderer.sendToAllPlayers(message);
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
            baseInitiative: calculateCharacteristicBonus(character.characteristics.i) + getTalentInitiativeBonus(character, talents),
            baseAg: calculateCharacteristicBonus(character.characteristics.ag),
            isPlayer: assignedCharacters.includes(character.id),
            conditions: character.conditions.map(cond => [cond.id, ...Array(cond.stack - 1).fill(cond.id)]).flat(),
        };
        if (combatants.length === 0) {
            setCurrentAdvantage({ playerAdvantage: 0, enemyAdvantage: 0 });
        }
        setCombatants(prev => [...prev, newCombatant]);
    };

    const handleUpdateCombatant = (updatedCombatant: Combatant) => {
        const char = charactersRef.current.find(c => c.id === updatedCombatant.sourceId);
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
        setCombatants(prev => prev.map(c => c.id === updatedCombatant.id ? updatedCombatant : c));
    };

    const handleClearCombatants = () => {
        setCombatants([]);
        setCurrentAdvantage({ playerAdvantage: 0, enemyAdvantage: 0 });
        setCurrentTurnId(null);
    };

    const handleUpdateJournal = (updatedJournal: JournalEntry[]) => {
        setJournal(updatedJournal);
    };

    // User Management Functions
    const hashPassword = (password: string): string => {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    };

    const handleCreateUser = (username: string, password: string) => {
        const newUser: User = {
            id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            username,
            passwordHash: hashPassword(password),
            characterId: null,
            createdAt: new Date().toISOString(),
        };
        const updatedUsers = [...usersRef.current, newUser];
        setUsers(updatedUsers);
        addLogEntry('info', `User created: ${username}`, 'logs.user_created', { username });
    };

    const handleDeleteUser = (userId: string) => {
        const user = usersRef.current.find(u => u.id === userId);
        if (!user) return;

        // If user had a character assigned, clear the character's userId
        if (user.characterId) {
            const updatedCharacters = charactersRef.current.map(char =>
                char.id === user.characterId ? { ...char, userId: null } : char
            );
            setCharacters(updatedCharacters);
        }

        const updatedUsers = usersRef.current.filter(u => u.id !== userId);
        setUsers(updatedUsers);
        addLogEntry('info', `User deleted: ${user.username}`, 'logs.user_deleted', { username: user.username });
    };

    const handleAssignCharacterToUser = (userId: string, characterId: string | null) => {
        const user = usersRef.current.find(u => u.id === userId);
        if (!user) return;

        const updatedUsers = usersRef.current.map(u =>
            u.id === userId ? { ...u, characterId } : u
        );
        setUsers(updatedUsers);

        let updatedCharacters = [...charactersRef.current];

        // Clear previous assignment
        if (user.characterId) {
            const oldChar = charactersRef.current.find(c => c.id === user.characterId);
            if (oldChar) {
                updatedCharacters = charactersRef.current.map(char =>
                    char.id === user.characterId ? { ...char, userId: null } : char
                );
                setCharacters(updatedCharacters);
            }
        }

        // Update character's user assignment
        if (characterId) {
            // Clear any other user assigned to this character
            const otherUsersWithChar = usersRef.current.filter(u => u.id !== userId && u.characterId === characterId);
            let finalUsers = updatedUsers;
            if (otherUsersWithChar.length > 0) {
                finalUsers = updatedUsers.map(u =>
                    otherUsersWithChar.some(ou => ou.id === u.id) ? { ...u, characterId: null } : u
                );
                setUsers(finalUsers);
            }

            updatedCharacters = updatedCharacters.map(char =>
                char.id === characterId ? { ...char, userId } : char
            );
            setCharacters(updatedCharacters);
            const message: AssignCharacterMessage = {
                type: "ASSIGN_CHARACTER",
                payload: { character: updatedCharacters.find(c => c.id === characterId)! }
            };
            window.ipcRenderer.sendToPlayer(userId, message);

            const character = charactersRef.current.find(c => c.id === characterId);
            addLogEntry('info', `User ${user.username} assigned to character ${character?.name}`, 'logs.user_assigned', { username: user.username, characterName: character?.name });
        } else {
            addLogEntry('info', `User ${user.username} unassigned from character`, 'logs.user_unassigned', { username: user.username });
        }
    };

    const handleTogglePinDiscovery = (locationId: string, characterIds: string[]) => {
        console.log(`Toggling pin discovery for location ${locationId} and characters ${characterIds.join(', ')}`);
        const currentPinState = mapPinStatesRef.current[locationId] || { playerDiscovered: [] };

        const updatedPlayerDiscovered = [...currentPinState.playerDiscovered];
        characterIds.forEach(characterId => {
            const isCurrentlyDiscovered = currentPinState.playerDiscovered.includes(characterId);
            if (isCurrentlyDiscovered) {
                updatedPlayerDiscovered.splice(updatedPlayerDiscovered.indexOf(characterId), 1);
            } else {
                updatedPlayerDiscovered.push(characterId);
            }
        });

        const updatedMapPinStates = {
            ...mapPinStates,
            [locationId]: {
                ...currentPinState,
                playerDiscovered: updatedPlayerDiscovered
            }
        };

        console.log(`Updated pin state for location ${locationId}:`, updatedMapPinStates[locationId]);
        setMapPinStates(updatedMapPinStates);
    };

    const handleBackupCampaign = async () => {
        try {
            const result = await window.ipcRenderer.backupCampaign();
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

        const updatedCharacters = charactersRef.current.map(char => ({
            ...char,
            status: {
                ...char.status,
                fortune: {
                    ...char.status.fortune,
                    current: char.status.fate.current
                }
            }
        }));

        setCharacters(updatedCharacters);

        // Send updates to players
        updatedCharacters.forEach(char => {
            const newMessage: AssignCharacterMessage = {
                type: "ASSIGN_CHARACTER",
                payload: { character: char }
            };
            if (char.userId) {
                window.ipcRenderer.sendToPlayer(char.userId, newMessage);
            }
        });

        addLogEntry('system', 'Session started. Fortune points reset.', 'logs.session_started');
    };

    const handleCorruptionTest = (characterId: string) => {
        const character = charactersRef.current.find(c => c.id === characterId);
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
        const character = charactersRef.current.find(c => c.id === result.characterId);
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
        ? shopInventoryRef.current?.shops[browsingShopId]!
        : null;
    const currentBrowsingShopDefinition = browsingShopId
        ? allShopDefinitions.find(sd => sd.id === browsingShopId)!
        : null;


    useEffect(() => {
        // Load initial data on component mount
        window.ipcRenderer.getInitialData().then((data: any) => {
            if (!data)
                return;

            if (data.characters && data.characters.length > 0) {
                const updatedCharacters = data.characters.map((char: Character) => ({
                    ...char, status: { ...char.status, corruption: { ...char.status.corruption, max: calculateMaxCorruption(char) } }
                }));
                skills.filter(s => s.type === 'skill' && s.classification === 'basic').forEach(skillDef => {
                    updatedCharacters.forEach((char: Character) => {
                        if (!char.skills.find(s => s.id === skillDef.id)) {
                            char.skills.push({ id: skillDef.id, name: skillDef.name, characteristic: skillDef.characteristic, advances: 0, modifier: 0, talents: 0 });
                        }
                    });
                });
                setCharacters(updatedCharacters);
                console.log('Loaded campaign data from file system:', data);
            }
            if (data.users) {
                setUsers(data.users);
            }
            if (data.journal) {
                setJournal(data.journal);
            }

            // Initialize mapPinStates if not present
            if (data.mapPinStates) {
                setMapPinStates(data.mapPinStates);
            } else {
                // Create initial map pin states for all locations
                const initialMapPinStates: Record<string, MapPinState> = {};
                mapData.locations.forEach((location) => {
                    initialMapPinStates[location.id] = {
                        playerDiscovered: [],
                    };
                });
                setMapPinStates(initialMapPinStates);
            }

            // Load factions if present
            if (data.factions) {
                setFactions(data.factions);
            }

            // Load shop inventory if present
            if (data.shopInventory) {
                setShopInventory(data.shopInventory);
            }

            // Load custom shop definitions if present
            if (data.customShopDefinitions) {
                setCustomShopDefinitions(data.customShopDefinitions);
            }

            // Load character templates if present
            if (data.characterTemplates) {
                setCharacterTemplates(data.characterTemplates);
            }

            // Load quests if present
            if (data.quests) {
                setQuests(data.quests);
            }

            if (data.tokens) {
                setTokens(data.tokens);
            }

            if (data.userPins) {
                setUserPins(data.userPins);
            }

            setSaving(true);
        }).catch((error: any) => {
            console.error('Failed to load initial data:', error);
        });

        // Listen for data updates from the main process
        const cleanupDataUpdateListener = window.ipcRenderer.onDataUpdated((data: any) => {
            if (data && data.characters) {
                setCharacters(data.characters);
                console.log('Received data update from main process : ', data);
            }
            if (data && data.journal) {
                setJournal(data.journal);
            }
            if (data && data.mapPinStates) {
                setMapPinStates(data.mapPinStates);
            }
            if (data && data.quests) {
                setQuests(data.quests);
            }
            if (data && data.tokens) {
                setTokens(data.tokens);
            }
            if (data && data.userPins) {
                setUserPins(data.userPins);
            }
        });

        const cleanupMapPingReceivedListener = window.ipcRenderer.onMapPingReceived(({ x, y, color, userId }: { x: number, y: number, color: string, userId: string }) => {
            setMapPing({ x, y, color, userId });
            setTimeout(() => {
                setMapPing(null);
            }, 300);
        });

        window.ipcRenderer.getChatHistory().then((history: ChatMessage[]) => {
            if (history && history.length > 0) {
                setChatMessages(history);
            }
        });

        const cleanupChatMessageListener = window.ipcRenderer.onChatMessage((message: ChatMessage) => {
            setChatMessages(prev => [...prev, message]);
        });


        return () => {
            cleanupDataUpdateListener();
            cleanupMapPingReceivedListener();
            cleanupChatMessageListener();
        };
    }, []);

    useEffect(() => {
        window.ipcRenderer.getServerStatus().then((info) => {
            setServerInfo(info);
        });


        const listener = (newStatus: ServerStatusData) => {
            setServerInfo(newStatus);
            setConnectedPlayers(newStatus.clients);
        };
        const cleanupStatusListener = window.ipcRenderer.onServerStatusUpdate(listener);

        const cleanupMessageListener = window.ipcRenderer.onPlayerMessageReceived((message: ClientToServerMessage) => {
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
                const currUsers = usersRef.current;
                const user = currUsers.find(u => u.username === message.payload.userId);
                if (user) {
                    newChar.userId = user.id;
                    const newUser = { ...user, characterId: newChar.id };
                    const updatedUsers = currUsers.map(u => u.id === user.id ? newUser : u);
                    setUsers(updatedUsers);
                }

                handleWizardComplete(newChar);

                const assignMessage: AssignCharacterMessage = {
                    type: "ASSIGN_CHARACTER",
                    payload: { character: newChar }
                };
                window.ipcRenderer.sendToPlayer(newChar.userId || '', assignMessage);

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
                // Store the result for CombatResolver
                setOpposedTestResults(prev => {
                    const newMap = new Map(prev);
                    const key = `${testId}-${role}`;
                    newMap.set(key, message.payload);
                    return newMap;
                });
            }

            // Not used anymore, should be reimplemented later
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

                    // Remove conditions if successful
                    if (successLevel >= 0) {
                        const combatant = combatants.find(c => c.sourceId === characterId);
                        if (combatant && combatant.conditions) {
                            console.log(combatant.conditions);
                            const conditionsToRemove = Math.min(1 + successLevel, combatant.conditions.filter(c => c === conditionId).length);
                            const updatedConditions = [...combatant.conditions];

                            // Remove the specified number of conditions
                            for (let i = 0; i < conditionsToRemove; i++) {
                                const index = updatedConditions.indexOf(conditionId);
                                if (index > -1) {
                                    updatedConditions.splice(index, 1);
                                }
                            }

                            // Add Fatigued condition for certain conditions when all are removed
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

            // Handle Roll With Intent (async opposed tests / roll queue)
            if (message.type === 'ROLL_WITH_INTENT') {
                const { characterId, characterName, skillId, skillName, targetNumber, rollResult, successLevel, weaponId, weaponName, weaponDamage, usedTalents, fortuneSpent, corruptionGained } = message.payload;
                
                const character = charactersRef.current.find(c => c.id === characterId);
                if (character) {
                    // Update fortune/corruption on character
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

                // Create queued roll
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

                // Add to roll queue (limit size)
                setRollQueue(prev => {
                    const newQueue = [queuedRoll, ...prev];
                    return newQueue.slice(0, MAX_ROLL_QUEUE_SIZE);
                });

                // Log the roll
                const slSign = successLevel >= 0 ? '+' : '';
                addLogEntry(
                    'roll',
                    `${characterName} Skill: ${skillName} - Rolled ${rollResult} vs ${targetNumber}. SL: ${slSign}${Math.round(successLevel)}${weaponName ? ` (${weaponName})` : ''}`
                );
            }

            // Handle shop evaluate request
            if (message.type === 'SHOP_EVALUATE_REQUEST') {
                const { shopId, instanceId, characterId, characterName } = message.payload;
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

            // Handle shop purchase request
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
        });

        return () => {
            cleanupStatusListener();
            cleanupMessageListener();
        };
    }, []);

    // Broadcast initiative tracker updates to all players
    useEffect(() => {
        if (combatants.length > 0 || currentTurnId !== null) {
            const message: UpdateInitiativeTrackerMessage = {
                type: 'UPDATE_INITIATIVE_TRACKER',
                payload: {
                    combatants,
                    currentTurnId,
                    currentAdvantage: currentAdvantage
                }
            };
            window.ipcRenderer.sendToAllPlayers(message);
        }
        else {
            const message: UpdateInitiativeTrackerMessage = {
                type: 'UPDATE_INITIATIVE_TRACKER',
                payload: {
                    combatants,
                    currentTurnId,
                    currentAdvantage: currentAdvantage
                }
            };
            window.ipcRenderer.sendToAllPlayers(message);
        }
    }, [combatants, currentTurnId, currentAdvantage]);

    const handleSendChatMessage = (content: string) => {
        const parsed = parseChatCommand(content);
        
        let chatMessage: ChatMessage;

        if (parsed.isRollCommand) {
            if (parsed.diceRequest) {
                const rollResult = executeDiceRoll(parsed.diceRequest);
                chatMessage = {
                    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    timestamp: Date.now(),
                    senderId: 'gm',
                    senderName: 'GM',
                    senderColor: '#d4af37', 
                    type: 'roll',
                    content: `Rolling ${rollResult.formula}`,
                    isPrivate: parsed.isPrivate,
                    data: rollResult
                };
            } else {
                const errorMessage: ChatMessage = {
                    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    timestamp: Date.now(),
                    senderId: 'system',
                    senderName: 'System',
                    type: 'error',
                    content: parsed.errorMessage || 'Invalid dice syntax',
                    isPrivate: parsed.isPrivate,
                };
                setChatMessages(prev => [...prev, errorMessage]);
                return;
            }
        } else {
            chatMessage = {
                id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: Date.now(),
                senderId: 'gm',
                senderName: 'GM',
                senderColor: '#d4af37',
                type: 'chat',
                content,
                isPrivate: parsed.isPrivate,
            };
        }

        setChatMessages(prev => [...prev, chatMessage]);
        
        window.ipcRenderer.sendChatMessage(chatMessage);
    };

    const handleItemSelectorClose = () => {
        setShowItemSelector(null);
    };

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

    const handleTalentSelectorClose = () => {
        setShowTalentSelector(null);
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
        <div>
            <Footer
                ip={serverInfo.ip}
                port={serverInfo.port}
                clients={connectedPlayers}
                onShowUserManager={() => setShowUserManager(true)}
                onBackup={handleBackupCampaign}
                onStartSession={handleStartSession}
                onShowJournal={() => setShowJournalManager(true)}
                onShowQuestJournal={() => setShowQuestJournal(true)}
                onShowShop={() => setShowShopManager(!showShopManager)}
                onShowShopConfigurator={() => setShowShopConfigurator(true)}
                onShowDiceTray={() => setShowDiceTray(!showDiceTray)}
                onShowAtmospherePanel={() => setShowAtmospherePanel(!showAtmospherePanel)}
                onShowFactionManager={() => setShowFactionManager(true)}
                onShowReputationPanel={() => setShowReputationPanel(true)}
                onShowTemplateManager={() => setShowTemplateManager(true)}
                onShowChat={() => setShowChat(!showChat)}
                onShowGameLog={() => setShowGameLog(true)}
            />

            { showGameLog && (
                <GameLog entries={logEntries} onClose={() => setShowGameLog(false)} />
            )}

            <CharacterRoster
                characters={characters}
                users={users}
                openSheetIds={openSheetIds}
                onToggleCharacterSheet={handleToggleCharacterSheet}
                onAssignCharacter={handleAssignCharacterToUser}
                onCreateCharacter={handleCreateCharacter}
                onGenerateNpc={handleGenerateNPC}
                onDeleteCharacter={handleDeleteCharacter}
                onAddCombatant={handleAddCombatant}
                onFightButtonClick={() => setShowCombatResolver(true)}
                tokens={tokens}
                onPlaceToken={handlePlaceToken}
                onRemoveToken={(tokenId) => setTokens(prev => prev.filter(t => t.id !== tokenId))}
            />

            {Object.keys(combatants).length > 0 && (
                <InitiativeTracker
                    combatants={combatants}
                    onSetCombatants={setCombatants}
                    onUpdateCombatant={handleUpdateCombatant}
                    onClearCombatants={handleClearCombatants}
                    currentTurnId={currentTurnId}
                    onSetCurrentTurnId={setCurrentTurnId}
                    onUpdateAdvantages={(advantage) => setCurrentAdvantage(advantage)}
                    advantages={currentAdvantage}
                    characters={characters}
                    onSendToPlayer={(charId: string, message) => {
                        const character = characters.find(c => c.id === charId);
                        if (!character || !character.userId) return;
                        const userId = character.userId;
                        window.ipcRenderer.sendToPlayer(userId, message);
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
                        mapPinStates={mapPinStates}
                        characters={characters}
                        isGM={true}
                        viewState={mapViewState}
                        onViewStateChange={setMapViewState}
                        onTogglePinDiscovery={handleTogglePinDiscovery}
                        onMapPing={(x, y) => {
                            window.ipcRenderer.sendToAllPlayers({
                                type: 'MAP_PING',
                                payload: { x, y }
                            });
                        }}
                        incomingPing={mapPing}
                        shops={shopInventory ? Object.values(shopInventory.shops) : []}
                        onViewWares={handleViewWares}
                        tokens={tokens.filter(t => t.mapId === activeMapId)}
                        onTokenMove={handleTokenMove}
                        userPins={userPins.filter(p => p.mapId === activeMapId)}
                        gridScale={currentMapData.gridSize}
                    />
                    {/* Map Selector Button */}
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
                <div style={{ width: '25vw', height: '100vh', overflowY: 'auto', backgroundColor: '#1c1c1c', borderLeft: '2px solid #444', position: 'absolute', right: 0, top: 0 }}>
                    <DiscoveredLocationsList
                        locations={currentMapData.locations}
                        mapPinStates={mapPinStates}
                        onLocationSelect={handleLocationSelect}
                        isGm={true}
                    />
                </div>
            </div>

            {/* Map Selector Modal */}
            {showMapSelector && (
                <MapSelector
                    maps={mapsList}
                    activeMapId={activeMapId}
                    onSwitchMap={handleSwitchMap}
                    onClose={() => setShowMapSelector(false)}
                />
            )}

            {showCombatResolver && (<CombatResolver
                characters={characters}
                combatants={combatants}
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
                    window.ipcRenderer.sendToPlayer(userId, message);
                }}
                onLogEntry={addLogEntry}
                onUpdateCharacter={handleCharacterUpdate}
                onUpdateCombatant={handleUpdateCombatant}
                onUpdateAdvantage={(team, amount) => {
                    team === 'players'
                        ? setCurrentAdvantage(prev => ({ ...prev, playerAdvantage: prev.playerAdvantage + amount }))
                        : setCurrentAdvantage(prev => ({ ...prev, enemyAdvantage: prev.enemyAdvantage + amount }));
                }}
                onClose={() => { setShowCombatResolver(false); }}
            />
            )}

            {showAtmospherePanel && <AtmospherePanel onClose={() => setShowAtmospherePanel(false)} />}

            {showShopManager && (
                <ShopManager
                    onClose={() => setShowShopManager(false)}
                    shopInventory={shopInventory}
                    onShopInventoryChange={(updatedInventory) => {
                        setShopInventory(updatedInventory);
                    }}
                    characters={characters}
                    shops={allShopDefinitions}
                />
            )}

            {showTemplateManager && (
                <TemplateManager
                    onClose={() => setShowTemplateManager(false)}
                    templates={allTemplates}
                    onTemplatesChange={(updatedTemplates) => {
                        // Only save custom templates (those modified from default)
                        setCharacterTemplates(updatedTemplates);
                    }}
                    onGenerateCharacter={(newCharacter) => {
                        const updatedCharacters = [...charactersRef.current, newCharacter];
                        setCharacters(updatedCharacters);
                        addLogEntry('system', `Generated NPC from template: ${newCharacter.name}`, 'logs.npc_generated', { name: newCharacter.name });
                    }}
                    existingCharacterNames={characters.map(c => c.name)}
                />
            )}

            {currentBrowsingShop && (
                <ShopBrowser
                    shop={currentBrowsingShop}
                    shopDefinition={currentBrowsingShopDefinition ? currentBrowsingShopDefinition : undefined}
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
                    <ChatBox
                        messages={chatMessages}
                        onSendMessage={handleSendChatMessage}
                        senderName="GM"
                        onClose={() => setShowChat(false)}
                        showHeader={true}
                    />
                </div>
            )}

            {showFactionManager && (
                <FactionManager
                    factions={factions}
                    locations={mapData.locations}
                    onUpdateFactions={(updatedFactions) => {
                        setFactions(updatedFactions);
                        const message: FactionUpdateMessage = {
                            type: 'FACTION_UPDATE',
                            payload: { factions: updatedFactions }
                        };
                        window.ipcRenderer.sendToAllPlayers(message);
                    }}
                    onClose={() => setShowFactionManager(false)}
                />
            )}

            {showReputationPanel && (
                <CharacterReputationPanel
                    characters={characters}
                    factions={factions}
                    onCharacterUpdate={handleCharacterUpdate}
                    onClose={() => setShowReputationPanel(false)}
                />
            )}

            {showShopConfigurator && (
                <ShopConfigurator
                    shops={allShopDefinitions}
                    onUpdateShops={(updatedShops) => {
                        setCustomShopDefinitions(updatedShops);
                    }}
                    onClose={() => setShowShopConfigurator(false)}
                />
            )}

            {showCharacterWizard && (
                <CharacterCreationWizard
                    onClose={() => setShowCharacterWizard(false)}
                    onComplete={handleWizardComplete}
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
                            users={users}
                            characters={characters}
                            onCreateUser={handleCreateUser}
                            onDeleteUser={handleDeleteUser}
                            onAssignCharacter={handleAssignCharacterToUser}
                        />
                    </div>
                </div>
            )}

            {showJournalManager && (
                <JournalManager
                    journal={journal}
                    characters={characters}
                    onUpdateJournal={handleUpdateJournal}
                    onClose={() => setShowJournalManager(false)}
                />
            )}

            {showQuestJournal && (
                <QuestJournalViewer
                    quests={quests}
                    locations={mapData.locations}
                    onClose={() => setShowQuestJournal(false)}
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
                        users={users}
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
        </div>
    );
}

export default App;