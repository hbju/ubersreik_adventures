import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@wfrp/shared';
import './App.css';

// Hooks
import { useSupabaseData } from './hooks/useSupabaseData';
import { useLiveSession } from './hooks/useLiveSession';
import type { LiveSessionCallbacks } from './hooks/useLiveSession';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import type { RealtimeSyncCallbacks } from './hooks/useRealtimeSync';

// Local components
import { LoginScreen } from './components/LoginScreen';
import { CampaignSelect } from './components/CampaignSelect';
import { GmConnectBanner } from './components/GmConnectBanner';

// Shared imports
import {
  Character,
  CharacterCreationWizard,
  CharacterUpdateMessage,
  RequestPurchaseMessage,
  OpposedTestResultMessage,
  ConditionTestResultMessage,
  MapView,
  DiscoveredLocationsList,
  recalculateCharacterTalentBonuses,
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
  ChatSendMessage,
  Weapon,
  RollWithIntentMessage,
  DateWeatherWidget,
  Quest,
  QuestUpdateMessage,
  QuestDeleteMessage,
  CodexProvider,
  CommandPalette,
  CodexViewer,
  CodexPopupModal,
  useCodex,
} from '@wfrp/shared';
import type { CodexDataSources } from '@wfrp/shared';
import InitiativeTracker from './components/initiativeTracker/InitiativeTracker';

// Lazy-loaded local re-exports of shared components that the player web app also needs
// (These exist in player-app/src/components but we can create thin wrappers or copy them)

/** App entry point – handles auth gating, campaign selection, and main player UI */
const App: React.FC = () => {
  const [authReady, setAuthReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  // Bootstrap: check existing Supabase session
  useEffect(() => {
    const sb = supabase.initSupabase(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
    );

    sb.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
      setAuthReady(true);
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!authReady) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginScreen onAuthenticated={() => setIsLoggedIn(true)} />;
  }

  if (!campaignId) {
    return <CampaignSelect onSelect={setCampaignId} />;
  }

  return <PlayerApp campaignId={campaignId} onLeaveCampaign={() => setCampaignId(null)} />;
};

// ─── Codex Nav Button (needs useCodex inside CodexProvider) ─────────────────

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
        minWidth: '10%',
      }}
    >
      📚 Codex
    </button>
  );
};

// ─── Main Player App ────────────────────────────────────────────────────────

interface PlayerAppProps {
  campaignId: string;
  onLeaveCampaign: () => void;
}

const PlayerApp: React.FC<PlayerAppProps> = ({ campaignId, onLeaveCampaign }) => {
  const { skills, talents, careers, items, weapons, armor, conditions, qualities, shops: shopDefinitions, mapData, maps, mapsList } = useGameData();

  const codexDataSources: CodexDataSources = useMemo(() => ({
    talents, skills, careers, conditions, qualities: qualities ?? [],
  }), [talents, skills, careers, conditions, qualities]);

  // ── Supabase data (initial load & state) ──────────────────────────────────
  const supabaseData = useSupabaseData(campaignId);
  const {
    myCharacter: supabaseCharacter,
    loading: dataLoading,
    error: dataError,
    // Updaters wired to live session callbacks
    updateCharacter,
    updateJournalEntries,
    updateQuests,
    updateFactions,
    updateMapPinStates,
    updateTokens,
    updateUserPins,
    updateShops,
    updateCombat,
    updateCalendar,
    updateChatMessages,
    addChatMessage,
    updateActiveMapId,
  } = supabaseData;

  // ── Live session (Socket.io to GM) ────────────────────────────────────────
  const liveCallbacks: LiveSessionCallbacks = useMemo(() => ({
    onCharacterUpdate: updateCharacter,
    onJournalUpdate: updateJournalEntries,
    onMapPinStatesUpdate: updateMapPinStates,
    onFactionUpdate: updateFactions,
    onShopStateUpdate: updateShops,
    onQuestSync: updateQuests,
    onTokensUpdate: updateTokens,
    onUserPinsUpdate: updateUserPins,
    onChatMessage: addChatMessage,
    onChatHistory: updateChatMessages,
    onCombatUpdate: updateCombat,
    onCalendarSync: updateCalendar,
    onActiveMapUpdate: updateActiveMapId,
  }), [updateCharacter, updateJournalEntries, updateMapPinStates, updateFactions, updateShops, updateQuests, updateTokens, updateUserPins, addChatMessage, updateChatMessages, updateCombat, updateCalendar, updateActiveMapId]);

  const liveSession = useLiveSession(liveCallbacks);

  // ── Supabase Realtime subscriptions (paused when Socket.io live session is active) ──
  const realtimeCallbacks: RealtimeSyncCallbacks = useMemo(() => ({
    onCharactersChanged: supabaseData.refetchCharacters,
    onJournalChanged: supabaseData.refetchJournal,
    onQuestsChanged: supabaseData.refetchQuests,
    onFactionsChanged: supabaseData.refetchFactions,
    onMapPinsChanged: supabaseData.refetchMapPins,
    onTokensChanged: supabaseData.refetchTokens,
    onUserPinsChanged: supabaseData.refetchUserPins,
    onShopsChanged: supabaseData.refetchShops,
    onCombatChanged: supabaseData.refetchCombat,
    onCalendarChanged: supabaseData.refetchCalendar,
    onChatChanged: supabaseData.refetchChat,
    onCampaignChanged: supabaseData.refetchCampaign,
  }), [supabaseData.refetchCharacters, supabaseData.refetchJournal, supabaseData.refetchQuests,
       supabaseData.refetchFactions, supabaseData.refetchMapPins, supabaseData.refetchTokens,
       supabaseData.refetchUserPins, supabaseData.refetchShops, supabaseData.refetchCombat,
       supabaseData.refetchCalendar, supabaseData.refetchChat, supabaseData.refetchCampaign]);

  useRealtimeSync(campaignId, liveSession.isConnected, realtimeCallbacks);

  // ── Local UI state ────────────────────────────────────────────────────────
  const character = supabaseData.myCharacter;
  const [isAdvancementMode, setIsAdvancementMode] = useState(false);
  const [draftCharacter, setDraftCharacter] = useState<Character | null>(null);
  const [testModalInfo, setTestModalInfo] = useState<{ id: string; name: string; value: number } | null>(null);
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
  const [currentView, setCurrentView] = useState<'character' | 'journal' | 'quests' | 'map' | 'reputation' | 'calendar'>('character');
  const [isCareerChangeModalOpen, setIsCareerChangeModalOpen] = useState(false);
  const [canChangeCareer, setCanChangeCareer] = useState(false);
  const [mapViewState, setMapViewState] = useState({ scale: 0.3, offsetX: 126, offsetY: -26 });
  const [locationTags, setLocationTags] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const currentMapData = useMemo(() => {
    return maps[supabaseData.activeMapId] || mapData;
  }, [maps, supabaseData.activeMapId, mapData]);

  const chatSenderName = character?.name || 'Player';

  // ── Career change detection ───────────────────────────────────────────────
  useEffect(() => {
    if (character && character.currentCareerId && character.currentCareerLevelId) {
      setCanChangeCareer(hasCompletedCurrentLevel(character, careers));
    } else {
      setCanChangeCareer(false);
    }
  }, [character, careers]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSkillClick = (skillId: string, skillName: string, skillValue: number) => {
    setTestModalInfo({ id: skillId, name: skillName, value: skillValue });
  };

  const handleCharacteristicClick = (charId: string, charName: string, charValue: number) => {
    setTestModalInfo({ id: charId, name: charName, value: charValue });
  };

  const handleRoll = (result: TestResultMessage['payload']) => {
    liveSession.sendMessage({ type: 'TEST_RESULT', payload: result });
  };

  const handleWeaponRoll = (weapon: Weapon, skillId: string, skillName: string, skillValue: number, weaponDamage: number) => {
    setWeaponRollInfo({ weapon, skillId, skillName, skillValue, weaponDamage });
  };

  const handleDefendRoll = (skillId: string, skillName: string, skillValue: number) => {
    setDefenseRollInfo({ skillId, skillName, skillValue });
  };

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
      },
    };
    liveSession.sendMessage(message);
    setWeaponRollInfo(null);
  };

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
      },
    };
    liveSession.sendMessage(message);
    setDefenseRollInfo(null);
  };

  const handleSendChatMessage = (content: string) => {
    const message: ChatSendMessage = {
      type: 'CHAT_SEND',
      payload: { content, senderName: chatSenderName },
    };
    liveSession.sendMessage(message);
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
    liveSession.sendMessage(message);
    setIsAdvancementMode(false);
    setDraftCharacter(null);
  };

  const handleCreateCharacterComplete = (newCharacter: Character) => {
    const message: CharacterCreateMessage = {
      type: 'CHARACTER_CREATE',
      payload: { character: newCharacter, userId: '' },
    };
    liveSession.sendMessage(message);
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
      };
      const newCareerHistory = draftCharacter.careerHistory ? [...draftCharacter.careerHistory, careerHistoryEntry] : [careerHistoryEntry];
      const newDraft = { ...draftCharacter, careerHistory: newCareerHistory };
      newDraft.characteristics[charName].advances += 1;
      newDraft.xp.current -= cost;
      setDraftCharacter(newDraft);
    }
  };

  const handleAdvanceSkill = (skillId: string) => {
    if (!draftCharacter) return;
    let skill = draftCharacter.skills.find(s => s.id === skillId);
    if (!skill) {
      const baseSkill = skills.filter(s => s.type === 'skill').find(s => s.id === skillId);
      if (baseSkill) {
        skill = { ...baseSkill, advances: 0, talents: 0, modifier: 0 };
        draftCharacter.skills.push(skill);
      } else return;
    }
    const cost = calculateSkillAdvanceCost(skill.advances, true);
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
      };
      const newCareerHistory = draftCharacter.careerHistory ? [...draftCharacter.careerHistory, careerHistoryEntry] : [careerHistoryEntry];
      const newDraft = { ...draftCharacter, careerHistory: newCareerHistory };
      const skillToUpdate = newDraft.skills.find(s => s.id === skillId);
      if (skillToUpdate) {
        skillToUpdate.advances += 1;
        newDraft.xp.current -= cost;
        setDraftCharacter(newDraft);
      }
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
        advancementName: talents.find(t => t.id === talentId)?.name || 'Unknown',
        timestamp: Date.now().toString(),
      };
      const newCareerHistory = draftCharacter.careerHistory ? [...draftCharacter.careerHistory, careerHistoryEntry] : [careerHistoryEntry];
      const newDraft = { ...draftCharacter, careerHistory: newCareerHistory };
      newDraft.xp.current -= cost;
      newDraft.talents[talentId] = (newDraft.talents[talentId] || 0) + 1;
      setDraftCharacter(recalculateCharacterTalentBonuses(newDraft, talents));
    }
  };

  const handleRequestPurchase = (item: { name: string; [key: string]: unknown }) => {
    if (!character) return;
    const message: RequestPurchaseMessage = {
      type: 'REQUEST_PURCHASE',
      payload: { item: item as any, characterId: character.id },
    };
    liveSession.sendMessage(message);
    setIsShopModalOpen(false);
  };

  const handleOpposedTestRoll = (
    rollResult: number,
    successLevel: number,
    fortuneSpent: number,
    corruptionGained: number,
  ) => {
    if (!character || !liveSession.opposedTestRequest) return;
    const message: OpposedTestResultMessage = {
      type: 'OPPOSED_TEST_RESULT',
      payload: {
        testId: liveSession.opposedTestRequest.testId,
        characterId: character.id,
        role: liveSession.opposedTestRequest.role,
        rollResult,
        successLevel,
        fortuneSpent,
        corruptionGained,
      },
    };
    liveSession.sendMessage(message);
    liveSession.setOpposedTestRequest(null);
  };

  const handleConditionTestRoll = (testId: string, roll: number, sl: number, targetNumber: number) => {
    if (!character || !liveSession.conditionTestRequest) return;
    const message: ConditionTestResultMessage = {
      type: 'CONDITION_TEST_RESULT',
      payload: {
        testId,
        conditionId: liveSession.conditionTestRequest.conditionId,
        rollResult: roll,
        successLevel: sl,
        characterId: character.id,
        targetNumber,
      },
    };
    liveSession.sendMessage(message);
    liveSession.setConditionTestRequest(null);
  };

  const handleCareerChangeRequest = (careerId: string, careerLevelId: string, careerName: string, levelName: string, xpCost: number) => {
    if (!character) return;
    liveSession.sendMessage({
      type: 'CAREER_CHANGE_REQUEST' as any,
      payload: {
        characterId: character.id,
        characterName: character.name,
        newCareerId: careerId,
        newCareerLevelId: careerLevelId,
        newCareerName: careerName,
        newCareerLevelName: levelName,
        xpCost,
      },
    });
    setIsCareerChangeModalOpen(false);
  };

  const handleEditModeCharacterUpdate = (updates: Partial<Character>) => {
    if (!character) return;
    const message: PlayerUpdateCharacterMessage = {
      type: 'PLAYER_UPDATE_CHARACTER',
      payload: { characterId: character.id, updates },
    };
    liveSession.sendMessage(message);
  };

  const handleLocationSelect = (location: Location) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const targetX = viewportWidth / 2 - location.coords.x * mapViewState.scale;
    const targetY = viewportHeight / 2 - location.coords.y * mapViewState.scale;
    setMapViewState({ scale: mapViewState.scale, offsetX: targetX, offsetY: targetY });
  };

  const handleQuestUpdate = (quest: Quest) => {
    liveSession.sendMessage({ type: 'QUEST_UPDATE', payload: { quest } } as QuestUpdateMessage);
  };

  const handleQuestDelete = (questId: string) => {
    liveSession.sendMessage({ type: 'QUEST_DELETE', payload: { questId } } as QuestDeleteMessage);
  };

  const handleGoToMapFromQuest = (locationId: string) => {
    const location = currentMapData.locations.find((l: Location) => l.id === locationId);
    if (location) {
      setCurrentView('map');
      handleLocationSelect(location);
    }
  };

  const handleTokenMove = useCallback((tokenId: string, x: number, y: number) => {
    liveSession.sendMessage({ type: 'TOKEN_MOVE', payload: { tokenId, x, y } } as TokenMoveMessage);
  }, [liveSession]);

  const handleAddPin = useCallback((x: number, y: number, label: string) => {
    if (!character) return;
    const pin: UserMapPin = {
      id: `pin-${character.userId || 'web'}-${Date.now()}`,
      playerId: character.userId || '',
      characterId: character.id,
      mapId: supabaseData.activeMapId,
      x,
      y,
      label,
      color: liveSession.playerColor || '#888888',
    };
    liveSession.sendMessage({ type: 'MAP_ADD_PIN', payload: { pin } } as MapAddPinMessage);
  }, [character, supabaseData.activeMapId, liveSession]);

  const handleRemovePin = useCallback((pinId: string) => {
    liveSession.sendMessage({ type: 'MAP_REMOVE_PIN', payload: { pinId } } as MapRemovePinMessage);
  }, [liveSession]);

  const handleMapPing = useCallback((x: number, y: number) => {
    liveSession.sendMessage({ type: 'MAP_PING_REQUEST', payload: { x, y } } as MapPingRequestMessage);
  }, [liveSession]);

  const activeCharacter = isAdvancementMode ? draftCharacter : character;

  // ── Loading / Error states ────────────────────────────────────────────────

  if (dataLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading campaign data...</p>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h2>Error</h2>
          <div className="auth-error">{dataError}</div>
          <button onClick={onLeaveCampaign} style={{ marginTop: '16px', width: '100%' }}>
            Back to Campaigns
          </button>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <CodexProvider dataSources={codexDataSources}>
      <div className="player-app-container">
        {/* GM live session connection banner */}
        <GmConnectBanner
          isConnected={liveSession.isConnected}
          isAuthenticated={liveSession.isAuthenticated}
          error={liveSession.connectionError}
          onConnect={liveSession.connect}
          onDisconnect={liveSession.disconnect}
        />

        {/* Navigation tabs */}
        {character && (
          <div style={{
            position: 'fixed',
            top: '40px',
            left: '10px',
            display: 'grid',
            gap: '10px',
            zIndex: 1011,
          }}>
            {([
              { key: 'character', label: '⚔️ Character' },
              { key: 'journal', label: '📜 Journal', badge: supabaseData.journalEntries.length || undefined },
              { key: 'map', label: '🗺️ Map' },
              { key: 'quests', label: '📋 Quests', badge: supabaseData.quests.filter(q => q.status === 'active').length || undefined },
              { key: 'reputation', label: '⚖️ Reputation' },
              ...(supabaseData.calendarDate ? [{ key: 'calendar', label: '📅 Calendar' }] : []),
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setCurrentView(tab.key as typeof currentView)}
                style={{
                  padding: '10px 20px',
                  background: currentView === tab.key ? '#2d5016' : '#2c1810',
                  color: '#d4af37',
                  border: currentView === tab.key ? '2px solid #3d6f1f' : '2px solid #8b6914',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.75rem',
                  position: 'relative',
                }}
              >
                {tab.label}
                {'badge' in tab && tab.badge && (
                  <span style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-5px',
                    background: tab.key === 'quests' ? '#2d5016' : '#8b0000',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}

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
                position: 'relative',
              }}
            >
              💬 Chat
              {supabaseData.chatMessages.length > 0 && (
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

            <button
              onClick={onLeaveCampaign}
              style={{
                padding: '10px 20px',
                background: '#2c1810',
                color: '#d4af37',
                border: '2px solid #8b6914',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.65rem',
                marginTop: '10px',
              }}
            >
              ← Campaigns
            </button>
          </div>
        )}

        {/* Initiative tracker (always visible when combat active) */}
        <InitiativeTracker
          combatants={supabaseData.combatants}
          currentTurnId={supabaseData.currentTurnId}
          advantages={supabaseData.currentAdvantage}
          currentCharacterId={character?.id}
        />

        {/* ── Character View ─────────────────────────────────────────────── */}
        {currentView === 'character' && (
          <>
            {character && !isAdvancementMode && liveSession.isAuthenticated && (
              <button onClick={handleEnterAdvancement} className="advanceControlButton">
                Advance Character
              </button>
            )}
            {canChangeCareer && liveSession.isAuthenticated && (
              <button
                onClick={() => setIsCareerChangeModalOpen(true)}
                className="advanceControlButton"
                style={{ background: '#2d5016', borderColor: '#3d6f1f', bottom: '17%' }}
              >
                Change Career
              </button>
            )}
            {isAdvancementMode && draftCharacter && (
              <div className="advancement-controls">
                <h3>Advancement Mode</h3>
                <p>XP Available: {draftCharacter.xp.current}</p>
                <button onClick={() => setIsTalentModalOpen(true)}>Buy Talents</button>
                <button onClick={handleConfirmAdvancement}>Confirm Changes</button>
                <button onClick={handleCancelAdvancement}>Cancel</button>
              </div>
            )}
            {/* Talent buying modal */}
            {/* TalentModal is player-app local — for now users use the inline TalentSelectionModal from shared */}

            {character ? (
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
                showPurchaseButton={!isAdvancementMode && liveSession.isAuthenticated}
                currentUserId={character.userId || undefined}
              />
            ) : (
              <div className="waiting-screen">
                <h1>Campaign Loaded</h1>
                <p>No character assigned to your account yet.</p>
                {liveSession.isAuthenticated && (
                  <button onClick={() => setCreateCharacterWizardOpen(true)}>
                    Create Character
                  </button>
                )}
                <p style={{ fontSize: '0.85rem', marginTop: '16px', color: 'var(--color-ink-faded)' }}>
                  Ask your GM to assign a character to your account.
                </p>
              </div>
            )}
          </>
        )}

        {/* ── Journal View ───────────────────────────────────────────────── */}
        {currentView === 'journal' && (
          <div style={{ padding: '40px 80px', maxWidth: '900px', margin: '0 auto' }}>
            {supabaseData.journalEntries.length === 0 ? (
              <div className="waiting-screen">
                <p>No journal entries yet.</p>
              </div>
            ) : (
              supabaseData.journalEntries.map(entry => (
                <div key={entry.id} style={{
                  background: 'var(--color-parchment)',
                  border: '2px solid var(--color-leather-medium)',
                  padding: '20px',
                  marginBottom: '16px',
                }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem' }}>{entry.title}</h3>
                  <div style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-body)', lineHeight: 1.7 }}
                    dangerouslySetInnerHTML={{ __html: entry.content }}
                  />
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Quest Journal View ─────────────────────────────────────────── */}
        {currentView === 'quests' && (
          <div style={{ padding: '40px 80px', maxWidth: '900px', margin: '0 auto' }}>
            {supabaseData.quests.length === 0 ? (
              <div className="waiting-screen"><p>No quests yet.</p></div>
            ) : (
              supabaseData.quests.map(quest => (
                <div key={quest.id} style={{
                  background: 'var(--color-parchment)',
                  border: '2px solid var(--color-leather-medium)',
                  padding: '20px',
                  marginBottom: '16px',
                }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem' }}>{quest.title}</h3>
                  <p style={{ color: 'var(--color-ink-faded)', fontSize: '0.85rem', margin: '0 0 8px' }}>
                    Status: {quest.status}
                  </p>
                  {quest.description && (
                    <p style={{ color: 'var(--color-ink)', margin: '0 0 8px' }}>{quest.description}</p>
                  )}
                  {quest.objectives && quest.objectives.length > 0 && (
                    <ul style={{ margin: '8px 0', paddingLeft: '20px', color: 'var(--color-ink)' }}>
                      {quest.objectives.map((obj, i) => (
                        <li key={i} style={{ textDecoration: obj.isCompleted ? 'line-through' : 'none', opacity: obj.isCompleted ? 0.6 : 1 }}>
                          {obj.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Map View ───────────────────────────────────────────────────── */}
        {currentView === 'map' && character && (
          <div style={{ display: 'flex', width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0, zIndex: 1000 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <MapView
                mapData={currentMapData}
                mapPinStates={supabaseData.mapPinStates}
                characters={[character]}
                isGM={false}
                viewState={mapViewState}
                onViewStateChange={setMapViewState}
                incomingPing={liveSession.mapPing}
                tokens={supabaseData.tokens.filter(t => t.mapId === supabaseData.activeMapId)}
                locationTags={locationTags}
                userPins={supabaseData.userPins.filter(p => p.mapId === supabaseData.activeMapId)}
                onTokenMove={handleTokenMove}
                onAddPin={handleAddPin}
                onRemovePin={handleRemovePin}
                onMapPing={handleMapPing}
                playerColor={liveSession.playerColor || undefined}
                currentUserId={character.userId || undefined}
                currentCharacterId={character.id}
                gridScale={currentMapData.gridSize}
                factions={supabaseData.factions}
                locationTerritories={supabaseData.locationTerritories}
                characterReputations={character.reputations || []}
              />
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
                mapPinStates={supabaseData.mapPinStates}
                onLocationSelect={handleLocationSelect}
                onFilterTagsChange={setLocationTags}
              />
            </div>
          </div>
        )}

        {/* ── Reputation View ────────────────────────────────────────────── */}
        {currentView === 'reputation' && character && (
          <div style={{ padding: '40px 80px', maxWidth: '900px', margin: '0 auto' }}>
            <h2>Reputation</h2>
            {(!character.reputations || character.reputations.length === 0) ? (
              <p style={{ color: 'var(--color-parchment)' }}>No faction reputations yet.</p>
            ) : (
              character.reputations.map((rep, i) => (
                <div key={i} style={{
                  background: 'var(--color-parchment)',
                  border: '2px solid var(--color-leather-medium)',
                  padding: '12px 16px',
                  marginBottom: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--color-ink)' }}>{rep.factionId}</span>
                  <span style={{ color: rep.value >= 0 ? '#2d5016' : '#8b0000', fontWeight: 'bold' }}>
                    {rep.value > 0 ? '+' : ''}{rep.value}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Calendar View ──────────────────────────────────────────────── */}
        {currentView === 'calendar' && supabaseData.calendarDate && (
          <div style={{ padding: '40px 80px', maxWidth: '900px', margin: '0 auto' }}>
            <h2>Calendar</h2>
            <DateWeatherWidget
              currentDate={supabaseData.calendarDate}
              weather={supabaseData.calendarWeather}
            />
            {supabaseData.calendarEvents.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                {supabaseData.calendarEvents.map((ev, i) => (
                  <div key={i} style={{
                    background: 'var(--color-parchment)',
                    border: '2px solid var(--color-leather-medium)',
                    padding: '12px',
                    marginBottom: '8px',
                  }}>
                    <strong style={{ color: 'var(--color-ink)' }}>{ev.title}</strong>
                    {ev.description && <p style={{ margin: '4px 0 0', color: 'var(--color-ink-faded)', fontSize: '0.9rem' }}>{ev.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Date/Weather widget (non-calendar views) */}
        {supabaseData.calendarDate && currentView !== 'calendar' && currentView !== 'map' && (
          <div style={{ position: 'fixed', top: '40px', right: '20px', zIndex: 1015 }}>
            <DateWeatherWidget
              currentDate={supabaseData.calendarDate}
              weather={supabaseData.calendarWeather}
              onClick={() => setCurrentView('calendar')}
            />
          </div>
        )}

        {/* Character creation wizard */}
        {createCharacterWizardOpen && (
          <CharacterCreationWizard
            onClose={() => setCreateCharacterWizardOpen(false)}
            onComplete={handleCreateCharacterComplete}
          />
        )}

        {/* Chat panel */}
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
            overflow: 'hidden',
          }}>
            <ChatBox
              messages={supabaseData.chatMessages}
              onSendMessage={handleSendChatMessage}
              senderName={chatSenderName}
              onClose={() => setShowChat(false)}
              showHeader={true}
            />
          </div>
        )}

        {/* Skill/characteristic test modal */}
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

        {/* Weapon roll modal */}
        {weaponRollInfo && character && (
          <TalentSelectionModal
            character={character}
            testName={weaponRollInfo.weapon.name}
            testId={weaponRollInfo.skillId}
            baseTarget={weaponRollInfo.skillValue}
            fortunePoints={character.status.fortune.current}
            corruptionCurrent={character.status.corruption.current}
            corruptionMax={character.status.corruption.max}
            onClose={() => setWeaponRollInfo(null)}
            onRoll={handleWeaponRollComplete}
          />
        )}

        {/* Defense roll modal */}
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

        {/* Codex system */}
        <CommandPalette />
        <CodexViewer />
        <CodexPopupModal />
      </div>
    </CodexProvider>
  );
};

export default App;
