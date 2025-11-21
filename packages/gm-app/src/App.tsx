import { allSkillsAndCharacteristics, calculateEffectiveMaxWounds, DiscoveredLocationsList, getAvailableAdvancements, getGroupedSkill, getTalentInitiativeBonus, isSkillGrouped, MapDisplay, MapView, recalculateCharacterTalentBonuses, Skill, getTalentCharacteristicBonus, WeaponData, ArmorData, ItemData } from '@wfrp/shared';
import CombatResolver from './components/combatResolver/CombatResolver';
import CharacterRoster from './components/characterRoster/CharacterRoster';
import AtmospherePanel from './components/atmospherePanel/AtmospherePanel';
import InitiativeTracker from './components/initiativeTracker/InitiativeTracker';
import ServerStatus from './components/server/ServerStatus';
import { ShopManager } from './components/ShopManager';
import { PurchaseRequestModal } from './components/PurchaseRequestModal';
import { JournalManager } from './components/JournalManager';
import { UserManager } from './components/UserManager';
import CareerChangeApprovalModal from './components/CareerChangeApprovalModal';
import DiceTray from './components/DiceTray';
import CharacterCreationWizard from './components/CharacterCreationWizard';
import { ItemSelectorModal } from './components/ItemSelectorModal';
import { TalentSelectorModal } from './components/TalentSelectorModal';

import {
    Character,
    User,
    Combatant,
    Currency,
    generateRandomNpc,
    createBlankCharacter,
    gameData,
    conditionsData,
    calculateCharacteristicBonus,
    CharacterSheet,
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
    CareerChangeRequestMessage,
    CareerChangeResponseMessage,
    careersData,
    Career,
    Location,
    Talent
} from '@wfrp/shared';

import React, { useState, useEffect, useRef } from 'react';

import './App.css';
import CareerManager from './components/CareerManager';
import { useTranslation } from 'react-i18next';

interface ServerStatusData {
    ip: string;
    port: number;
    clients: string[];
}

function App() {
    const { t } = useTranslation();

    const calculateMaxWounds = (character: Character) => {
        return calculateEffectiveMaxWounds(character);
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
    const [mapViewState, setMapViewState] = useState<{ scale: number; offsetX: number; offsetY: number }>({ scale: 0.3, offsetX: 126, offsetY: -26 });
    const [assignedCharacters, setAssignedCharacters] = useState<string[]>([]);
    const [openSheetIds, setOpenSheetIds] = useState<string[]>([]);
    const [combatants, setCombatants] = useState<Combatant[]>([]);
    const [currentTurnId, setCurrentTurnId] = useState<string | null>(null);
    const [currentAdvantage, setCurrentAdvantage] = useState<Advantages>({ playerAdvantage: 0, enemyAdvantage: 0 });

    const [showShopManager, setShowShopManager] = useState(false);
    const [showDiceTray, setShowDiceTray] = useState(false);
    const [showCharacterWizard, setShowCharacterWizard] = useState(false);
    const [showCombatResolver, setShowCombatResolver] = useState(false);
    const [showJournalManager, setShowJournalManager] = useState(false);
    const [showUserManager, setShowUserManager] = useState(false);
    const [showCareerManager, setShowCareerManager] = useState<Character | null>(null);
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
    const [opposedTestResults, setOpposedTestResults] = useState<Map<string, OpposedTestResultMessage['payload']>>(new Map());

    const [showItemSelector, setShowItemSelector] = useState<string | null>(null);
    const [showTalentSelector, setShowTalentSelector] = useState<string | null>(null);

    const addLogEntry = (type: LogEntry['type'], content: string) => {
        const newEntry: LogEntry = { id: new Date().toISOString() + Math.random().toString(36), type, content };
        setLogEntries(prev => [...prev, newEntry]);
    };


    useEffect(() => {
        if (!saving) return;

        console.log("Saving data, characters:", characters);
        const campaignData = {
            characters: characters,
            users: users,
            journal: journal,
            mapPinStates: mapPinStates,
            version: '1.0.0',
            lastModified: new Date().toISOString(),
        };
        window.ipcRenderer.saveData(campaignData);

        charactersRef.current = characters;
        usersRef.current = users;
        journalRef.current = journal;
        mapPinStatesRef.current = mapPinStates;

    }, [characters, users, journal, mapPinStates]);

    const handleCharacterUpdate = (updatedCharacter: Character) => {
        const updatedCharacters = charactersRef.current.map(char =>
            char.id === updatedCharacter.id ? updatedCharacter : char
        );

        setCharacters(updatedCharacters);

        const newMessage: AssignCharacterMessage = {
            type: "ASSIGN_CHARACTER",
            payload: { character: updatedCharacter }
        };

        window.ipcRenderer.sendToPlayer(updatedCharacter.userId || '', newMessage);
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
        addLogEntry('system', `Awarded ${amount} XP to character ${characterId}.`);
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
        addLogEntry('system', `Awarded currency to character ${characterId}: ${amount.gc || 0} GC, ${amount.ss || 0} SS, ${amount.bp || 0} BP.`);
    };

    const handleCreateCharacter = () => {
        setShowCharacterWizard(true);
    };

    const handleWizardComplete = (newCharacter: Character) => {
        const updatedCharacters = [...charactersRef.current, newCharacter];
        setCharacters(updatedCharacters);
        setShowCharacterWizard(false);
        addLogEntry('system', `Created new character: ${newCharacter.name}`);

        // If we want to assign it immediately or just let it be in the roster
    };

    const handleGenerateNPC = () => {
        const newNPC = generateRandomNpc();
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
            baseInitiative: calculateCharacteristicBonus(character.characteristics.i) + getTalentInitiativeBonus(character),
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
                const existingCond = conditionsData.find(c => c.id === id);
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
        addLogEntry('info', `User created: ${username}`);
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
        addLogEntry('info', `User deleted: ${user.username}`);
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
            addLogEntry('info', `User ${user.username} assigned to character ${character?.name}`);
        } else {
            addLogEntry('info', `User ${user.username} unassigned from character`);
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
                addLogEntry('system', `Campaign backup created successfully at: ${result.path}`);
                alert(`Backup created successfully!\nPath: ${result.path}`);
            } else {
                addLogEntry('system', `Backup failed: ${result.error}`);
                alert(`Backup failed: ${result.error}`);
            }
        } catch (error) {
            console.error('Backup error:', error);
            addLogEntry('system', `Backup failed: ${(error as Error).message}`);
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

        addLogEntry('system', 'Session started. Fortune points reset.');
    };

    const handleCorruptionTest = (characterId: string) => {
        const character = charactersRef.current.find(c => c.id === characterId);
        if (!character) return;

        const totalWp = character.characteristics.wp.initial + character.characteristics.wp.advances + character.characteristics.wp.modifier + getTalentCharacteristicBonus(character, 'wp');

        const roll = Math.floor(Math.random() * 100) + 1;
        const success = roll <= totalWp;

        let newCorruption = character.status.corruption.current;
        let logMsg = `${character.name} tests Corruption (Willpower ${totalWp}): Rolled ${roll}. `;

        if (success) {
            logMsg += "Success! No corruption gained.";
        } else {
            newCorruption += 1;
            logMsg += "Failure! Gained 1 Corruption point.";
        }

        addLogEntry('roll', logMsg);

        if (!success) {
            const maxCorruption = character.status.corruption.max;
            if (newCorruption > maxCorruption) {
                addLogEntry('system', `⚠️ ${character.name} has exceeded their Corruption Threshold! Mutation Check required!`);
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

    useEffect(() => {
        // Load initial data on component mount
        window.ipcRenderer.getInitialData().then((data: any) => {
            if (!data)
                return;

            if (data.characters && data.characters.length > 0) {
                const updatedCharacters = data.characters.map((char: Character) => ({
                    ...char, status: { ...char.status, wounds: { current: Math.min(char.status.wounds.current, calculateMaxWounds(char)), max: calculateMaxWounds(char) }, corruption: { ...char.status.corruption, max: calculateMaxCorruption(char) } }
                }));
                allSkillsAndCharacteristics.filter(s => s.type === 'skill' && s.classification === 'basic').forEach(skillDef => {
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
                gameData.locations.forEach((location) => {
                    initialMapPinStates[location.id] = {
                        playerDiscovered: [],
                    };
                });
                setMapPinStates(initialMapPinStates);
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
        });

        return () => {
            cleanupDataUpdateListener();
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
                            current: Math.min(character.status.corruption.current + corruptionGained, character.status.corruption.max)
                        }
                    }
                };
                handleCharacterUpdate(updatedCharacter);
                addLogEntry(
                    'roll',
                    `${character.name} tests ${testName}: Rolled ${rollResult} vs ${targetNumber}. [${outcome}] Fortune spent: ${fortuneSpent}, Corruption gained: ${corruptionGained}`
                );
            }

            if (message.type === 'CHARACTER_UPDATE') {
                const updatedChar = message.payload.character;
                handleCharacterUpdate(updatedChar);
                addLogEntry('system', `${updatedChar.name}'s character sheet has been updated.`);
            }

            if (message.type === 'REQUEST_PURCHASE') {
                const item = message.payload.item;
                // Find the character associated with this socket
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
                addLogEntry('system', `${characterName} requests career change to ${newCareerName} - ${newCareerLevelName} for ${xpCost} XP.`);
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
        addLogEntry('system', `${item.name} added to ${character.name}'s inventory.`);
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
        addLogEntry('system', `${itemId} removed from ${character.name}'s inventory.`);
    };

    const handleTalentSelectorClose = () => {
        setShowTalentSelector(null);
    };

    const handleTalentSelected = (talent: Talent, charId: string) => {
        const character = characters.find(c => c.id === charId);
        if (!character) return;

        const updatedCharacter: Character = {
            ...character
        };
        const talents = updatedCharacter.talents;
        if (Object.keys(talents).includes(talent.id)) {
            talents[talent.id] += 1;
        }
        else {
            talents[talent.id] = 1;
        }

        updatedCharacter.status.wounds.max = calculateEffectiveMaxWounds(updatedCharacter);

        handleCharacterUpdate(updatedCharacter);
        addLogEntry('system', `${talent.name} added to ${character.name}'s talents.`);
        setShowTalentSelector(null);
    }

    return (
        <div className="App">
            <ServerStatus
                ip={serverInfo.ip}
                port={serverInfo.port}
                clients={connectedPlayers} />

            <div style={{
                position: 'fixed',
                bottom: '40px',
                left: '10px',
                display: 'flex',
                gap: '10px',
                zIndex: 1010
            }}>
                <button
                    onClick={() => setShowUserManager(true)}
                    style={{
                        padding: '10px 20px',
                        background: '#2d5016',
                        color: '#d4af37',
                        border: '2px solid #3d6f1f',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px'
                    }}
                >
                    👤 {t('menu.users')}
                </button>
                <button
                    onClick={handleBackupCampaign}
                    style={{
                        padding: '10px 20px',
                        background: '#2d5016',
                        color: '#d4af37',
                        border: '2px solid #3d6f1f',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px'
                    }}
                >
                    💾 {t('menu.backup')}
                </button>
                <button
                    onClick={handleStartSession}
                    style={{
                        padding: '10px 20px',
                        background: '#2d5016',
                        color: '#d4af37',
                        border: '2px solid #3d6f1f',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px'
                    }}
                >
                    🌅 {t('menu.startSession')}
                </button>
                <button
                    onClick={() => setShowJournalManager(true)}
                    style={{
                        padding: '10px 20px',
                        background: '#2d5016',
                        color: '#d4af37',
                        border: '2px solid #3d6f1f',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px'
                    }}
                >
                    📜 {t('menu.journal')}
                </button>
                <button
                    onClick={() => setShowShopManager(!showShopManager)}
                    style={{
                        padding: '10px 20px',
                        background: showShopManager ? '#8b6914' : '#2c1810',
                        color: '#d4af37',
                        border: '2px solid #8b6914',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px'
                    }}
                >
                    🏪 {t('menu.shop')}
                </button>
                <button
                    onClick={() => setShowDiceTray(!showDiceTray)}
                    style={{
                        padding: '10px 20px',
                        background: showDiceTray ? '#8b6914' : '#2c1810',
                        color: '#d4af37',
                        border: '2px solid #8b6914',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px'
                    }}
                >
                    🎲 {t('menu.dice')}
                </button>
            </div>

            <GameLog entries={logEntries} />

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
                left: 0,
                zIndex: 1000
            }}>
                <div style={{ flex: 1 }}>
                    <MapView
                        gameData={gameData}
                        mapPinStates={mapPinStates}
                        characters={characters}
                        isGM={true}
                        viewState={mapViewState}
                        onViewStateChange={setMapViewState}
                        onTogglePinDiscovery={handleTogglePinDiscovery}
                    />
                </div>
                <div style={{ width: '350px', height: '100vh', overflowY: 'auto', backgroundColor: '#1c1c1c', borderLeft: '2px solid #444', position: 'absolute', right: 0, top: 0 }}>
                    <DiscoveredLocationsList
                        locations={gameData.locations}
                        mapPinStates={mapPinStates}
                        onLocationSelect={handleLocationSelect}
                        isGm={true}
                    />
                </div>
            </div>

            {showCombatResolver && (<CombatResolver
                characters={characters}
                combatants={combatants}
                opposedTestResults={opposedTestResults}
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

            <AtmospherePanel />

            {showShopManager && <ShopManager onClose={() => setShowShopManager(false)} />}

            {showDiceTray && <DiceTray onClose={() => setShowDiceTray(false)} onLogEntry={addLogEntry} />}

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

            {purchaseRequest && (
                <PurchaseRequestModal
                    playerName={purchaseRequest.playerName}
                    item={purchaseRequest.item}
                    playerCurrency={purchaseRequest.playerCurrency}
                    userId={characters.find(c => c.id === purchaseRequest.charId)?.userId || ''}
                    onClose={() => setPurchaseRequest(null)}
                    onApprove={(item) => {
                        // Find the character and update their inventory and currency
                        const character = characters.find(c => c.id === purchaseRequest.charId);
                        if (character) {
                            // Parse the item price
                            const priceParts = item.price.split(' ');
                            const amount = parseInt(priceParts[0]);
                            const currencyType = priceParts[1];

                            // Calculate the currency to subtract
                            const currencyChange = {
                                gc: currencyType === 'GC' ? -amount : 0,
                                ss: currencyType === 'S' ? -amount : 0,
                                bp: currencyType === 'P' ? -amount : 0,
                            };

                            // Update character currency
                            const newCurrency = equilibrateCurrency({ ...character.currency });
                            newCurrency.gc += currencyChange.gc;
                            newCurrency.ss += currencyChange.ss;
                            newCurrency.bp += currencyChange.bp;
                            const equilibratedCurrency = equilibrateCurrency(newCurrency);

                            // Determine which inventory array to add to
                            const updatedInventory = { ...character.inventory };
                            if ('damage' in item) {
                                // It's a weapon
                                updatedInventory.weapons = { ...character.inventory.weapons };
                                if (updatedInventory.weapons[item.id]) {
                                    updatedInventory.weapons[item.id] += 1;
                                } else {
                                    updatedInventory.weapons[item.id] = 1;
                                }
                            } else if ('ap' in item) {
                                // It's armor
                                updatedInventory.armor = { ...character.inventory.armor };
                                if (updatedInventory.armor[item.id]) {
                                    updatedInventory.armor[item.id] += 1;
                                } else {
                                    updatedInventory.armor[item.id] = 1;
                                }
                            } else {
                                // It's a regular item
                                updatedInventory.items = { ...character.inventory.items };
                                if (updatedInventory.items[item.id]) {
                                    updatedInventory.items[item.id] += 1;
                                } else {
                                    updatedInventory.items[item.id] = 1;
                                }
                            }
                            // Update character
                            const updatedCharacter: Character = {
                                ...character,
                                currency: equilibratedCurrency,
                                inventory: updatedInventory,
                            };

                            handleCharacterUpdate(updatedCharacter);
                            addLogEntry('system', `${character.name} purchased ${item.name} for ${item.price}.`);
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
                            // Check if character has enough XP
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
                            const newCareer = (careersData as Career[]).find(c => c.id === careerChangeRequest.newCareerId);
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
                            // Update character's career, level, and XP
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
                                        level: (careersData as Career[])
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
                                            const grouped = getGroupedSkill(skillId);
                                            if (!grouped) return { id: "", name: "Unknown Skill", characteristic: "ws", advances: 0, talents: 0, modifier: 0 };
                                            return grouped;
                                        }
                                        const skillDef = allSkillsAndCharacteristics.find((s: any) => s.id === skillId && s.type === 'skill');
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
                            addLogEntry('system', `Career change approved: ${character.name} is now ${careerChangeRequest.newCareerName} - ${careerChangeRequest.newCareerLevelName}.`);
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
                            addLogEntry('system', `Career change rejected for ${character.name}: ${reason}`);
                        }
                        setCareerChangeRequest(null);
                    }}
                    onClose={() => setCareerChangeRequest(null)}
                />
            )}

            <div className="character-sheets-container">
                {openSheetIds.map(characterId => {
                    const character = characters.find(char => char.id === characterId);

                    if (!character) return null;

                    return (
                        <CharacterSheet
                            key={character.id}
                            character={character}
                            onCharacterUpdate={handleCharacterUpdate}
                            onXpAward={(amount) => handleXpAward(character.id, amount)}
                            onCareerManagementModalOpen={(char) => setShowCareerManager(char)}
                            onCurrencyAward={(amount) => handleCurrencyAward(character.id, amount)}
                            onRemoveTalent={(talentId) => {
                                const updatedTalents = { ...character.talents };
                                delete updatedTalents[talentId];
                                const updatedCharacter = { ...character, talents: updatedTalents };
                                updatedCharacter.status.wounds.max = calculateEffectiveMaxWounds(updatedCharacter);
                                handleCharacterUpdate(recalculateCharacterTalentBonuses(updatedCharacter));
                            }}
                            onAddTalent={() => setShowTalentSelector(character.id)}
                            onCorruptionTest={() => handleCorruptionTest(character.id)}
                            onRemoveItem={(itemId, type) => handleRemoveItemFromCharacter(itemId, character.id)}
                            onAddItem={() => setShowItemSelector(character.id)}
                        />
                    );
                })}
            </div>

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
        </div>
    );
}

export default App;