import MapDisplay from './components/MapDisplay';
import CombatResolver from './components/combatResolver/CombatResolver';
import CharacterRoster from './components/characterRoster/CharacterRoster';
import AtmospherePanel from './components/atmospherePanel/AtmospherePanel';
import InitiativeTracker from './components/initiativeTracker/InitiativeTracker';

import {
    socket,
    Character,
    Combatant,
    generateRandomNpc,
    createBlankCharacter,
    gameData,
    calculateCharacteristicBonus,
    CharacterSheet,
    AssignCharacterMessage,
    AwardXpMessage,
    ClientToServerMessage,
    GameLog,
    LogEntry,
} from '@wfrp/shared';

import React, { useState, useEffect } from 'react';
import useLocalStorageState from './hooks/useLocalStorageState';

import './App.css';
import ServerStatus from './components/server/ServerStatus';

interface ServerStatusData {
    ip: string;
    port: number;
    clients: string[];
}

function App() {

    const calculateMaxWounds = (character: Character) => {
        return calculateCharacteristicBonus(character.characteristics.t) * 2
            + calculateCharacteristicBonus(character.characteristics.s)
            + calculateCharacteristicBonus(character.characteristics.wp)
    }

    const calculateMaxCorruption = (character: Character) => {
        return calculateCharacteristicBonus(character.characteristics.wp) + calculateCharacteristicBonus(character.characteristics.t);
    }

    const initChars = (gameData.characters as Character[]).map(c => (
        { ...c, status: { ...c.status, wounds: { ...c.status.wounds, max: calculateMaxWounds(c) }, corruption: { ...c.status.corruption, max: calculateMaxCorruption(c) } } }
    ));

    const [serverInfo, setServerInfo] = useState({ ip: 'Loading...', port: 0 });
    const [connectedPlayers, setConnectedPlayers] = useState<string[]>([]);

    const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

    const [characters, setCharacters] = useLocalStorageState<Character[]>('wfrp-gm-tools-characters', initChars);
    const [openSheetIds, setOpenSheetIds] = useState<string[]>([]);
    const [combatants, setCombatants] = useState<Combatant[]>([]);
    const [currentTurnId, setCurrentTurnId] = useState<string | null>(null);

    const addLogEntry = (type: LogEntry['type'], content: string) => {
        const newEntry: LogEntry = { id: new Date().toISOString(), type, content };
        setLogEntries(prev => [...prev, newEntry]);
    };

    const handleCharacterUpdate = (updatedCharacter: Character) => {
        setCharacters(prevChars =>
            prevChars.map(char =>
                char.id === updatedCharacter.id ? updatedCharacter : char
            )
        );
    }

    const handleToggleCharacterSheet = (characterId: string) => {
        setOpenSheetIds(prevOpenIds =>
            prevOpenIds.includes(characterId) ? prevOpenIds.filter(id => id !== characterId) : [...prevOpenIds, characterId]
        );
    }

    const handleAssignCharacter = (character: Character, socketId: string) => {
        const message: AssignCharacterMessage = {
            type: "ASSIGN_CHARACTER",
            payload: { character }
        };

        window.ipcRenderer.sendToPlayer(socketId, message);
        window.ipcRenderer.assignCharacterToPlayer(character.id, socketId);
        console.log('Assigned ' + character.name + ' to player ' + socketId)
    }

    const handleXpAward = (characterId: string, amount: number) => {
        const message: AwardXpMessage = { type: 'AWARD_XP', payload: { amount } };
        const character = characters.find(c => c.id === characterId);
        if (!character) return;
        const newChar = { ...character, xp: { ...character.xp, current: character.xp.current + amount } };
        setCharacters(prevChars =>
            prevChars.map(c => (c.id === characterId ? newChar : c))
        );
        window.ipcRenderer.sendToPlayer(characterId, message);
        addLogEntry('system', `Awarded ${amount} XP to character ${characterId}.`);
    };

    const handleCreateCharacter = () => {
        const newChar = createBlankCharacter();
        setCharacters(prev => [...prev, newChar]);
    };

    const handleGenerateNPC = () => {
        const newNPC = generateRandomNpc();
        setCharacters(prev => [...prev, newNPC]);
    }

    const handleDeleteCharacter = (characterId: string) => {
        console.log("trying to delete " + characterId);
        const characterToDelete = characters.find(c => c.id === characterId);
        if (!characterToDelete) return;

        console.log("deleting " + characterId);
        if (window.confirm(`Are you sure you want to delete ${characterToDelete.name}? This cannot be undone.`)) {
            setCharacters(prev => prev.filter(char => char.id !== characterId));
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
            baseInitiative: calculateCharacteristicBonus(character.characteristics.i),
            baseAg: calculateCharacteristicBonus(character.characteristics.ag),
            isPlayer: true,
        };
        setCombatants(prev => [...prev, newCombatant]);
    };

    const handleUpdateCombatant = (updatedCombatant: Combatant) => {
        setCombatants(prev => prev.map(c => c.id === updatedCombatant.id ? updatedCombatant : c));
    };

    const handleClearCombatants = () => {
        setCombatants([]);
        setCurrentTurnId(null);
    };

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
                const { characterName, testName, targetNumber, rollResult, successLevel } = message.payload;
                const outcome = successLevel >= 0
                    ? `${successLevel} Success Level(s)`
                    : `${Math.abs(successLevel)} Failure Level(s)`;

                addLogEntry(
                    'roll',
                    `${characterName} tests ${testName}: Rolled ${rollResult} vs ${targetNumber}. [${outcome}]`
                );
            }

            if (message.type === 'CHARACTER_UPDATE') {
                const updatedChar = message.payload.character;
                setCharacters(prevChars =>
                    prevChars.map(c => (c.id === updatedChar.id ? updatedChar : c))
                );
                const newMessage: AssignCharacterMessage = {
                    type: "ASSIGN_CHARACTER",
                    payload: {  character: updatedChar }
                };

                window.ipcRenderer.sendToPlayer(updatedChar.id, newMessage);
                addLogEntry('system', `${updatedChar.name}'s character sheet has been updated.`);
            }

        });

        return () => {
            cleanupStatusListener();
            cleanupMessageListener();
        };
    }, []);

    return (
        <div className="App">
            <ServerStatus
                ip={serverInfo.ip}
                port={serverInfo.port}
                clients={connectedPlayers} />

            <GameLog entries={logEntries} />

            <CharacterRoster
                characters={characters}
                openSheetIds={openSheetIds}
                onToggleCharacterSheet={handleToggleCharacterSheet}
                connectedPlayers={connectedPlayers}
                onAssignCharacter={handleAssignCharacter}
                onCreateCharacter={handleCreateCharacter}
                onGenerateNpc={handleGenerateNPC}
                onDeleteCharacter={handleDeleteCharacter}
                onAddCombatant={handleAddCombatant}
            />

            <InitiativeTracker
                combatants={combatants}
                onSetCombatants={setCombatants}
                onUpdateCombatant={handleUpdateCombatant}
                onClearCombatants={handleClearCombatants}
                currentTurnId={currentTurnId}
                onSetCurrentTurnId={setCurrentTurnId}
            />

            <MapDisplay gameData={gameData} />
            {/* <CombatResolver characters={characters} /> */}

            <AtmospherePanel />

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
                        />
                    );
                })}
            </div>
        </div>
    );
}

export default App;