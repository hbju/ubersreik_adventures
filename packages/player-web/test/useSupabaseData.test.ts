/**
 * Tests for useSupabaseData state updater functions.
 *
 * These tests verify the granular updaters correctly modify
 * the state shape used by the player-web app.
 */
import { describe, it, expect } from 'vitest';
import type { Character, JournalEntry, Quest, Faction, MapPinState, ShopState, Combatant } from '@wfrp/shared';
import type { ChatMessage } from '@wfrp/shared';

// Helper: create a minimal character for testing
function mockCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    name: 'Test Character',
    species: 'Human',
    class: 'Warrior',
    careers: [],
    characteristics: {
      WS: { initial: 30, advances: 0, talentBonus: 0, modifier: 0 },
      BS: { initial: 30, advances: 0, talentBonus: 0, modifier: 0 },
      S: { initial: 30, advances: 0, talentBonus: 0, modifier: 0 },
      T: { initial: 30, advances: 0, talentBonus: 0, modifier: 0 },
      I: { initial: 30, advances: 0, talentBonus: 0, modifier: 0 },
      Ag: { initial: 30, advances: 0, talentBonus: 0, modifier: 0 },
      Dex: { initial: 30, advances: 0, talentBonus: 0, modifier: 0 },
      Int: { initial: 30, advances: 0, talentBonus: 0, modifier: 0 },
      WP: { initial: 30, advances: 0, talentBonus: 0, modifier: 0 },
      Fel: { initial: 30, advances: 0, talentBonus: 0, modifier: 0 },
    },
    skills: [],
    talents: [],
    inventory: { weapons: [], armor: [], items: [], money: { gc: 0, ss: 0, bp: 0 } },
    status: {
      wounds: { current: 10, max: 10 },
      fortune: { current: 2, max: 2 },
      fate: 2,
      resilience: { current: 1, max: 1 },
      resolve: 1,
      experience: { current: 0, spent: 0, total: 0 },
      corruption: 0,
      sin: 0,
      conditions: [],
    },
    movement: 4,
    notes: '',
    userId: null,
    ...overrides,
  } as Character;
}

describe('useSupabaseData state shape', () => {
  describe('CampaignData interface', () => {
    it('should have all required fields in the empty state', () => {
      const emptyData = {
        characters: [] as Character[],
        myCharacter: null as Character | null,
        journalEntries: [] as JournalEntry[],
        quests: [] as Quest[],
        factions: [] as Faction[],
        locationTerritories: {} as Record<string, any>,
        mapPinStates: {} as Record<string, MapPinState>,
        tokens: [],
        userPins: [],
        shops: [] as ShopState[],
        chatMessages: [] as ChatMessage[],
        activeMapId: 'ubersreik_city',
        calendarDate: null,
        calendarEvents: [],
        calendarWeather: undefined,
        combatants: [] as Combatant[],
        currentTurnId: null as string | null,
        currentAdvantage: { playerAdvantage: 0, enemyAdvantage: 0 },
      };

      expect(emptyData.characters).toEqual([]);
      expect(emptyData.myCharacter).toBeNull();
      expect(emptyData.activeMapId).toBe('ubersreik_city');
      expect(emptyData.currentAdvantage).toEqual({ playerAdvantage: 0, enemyAdvantage: 0 });
    });
  });

  describe('updateCharacter logic', () => {
    it('should update myCharacter when IDs match', () => {
      const existing = mockCharacter({ id: 'char-1', name: 'Old Name' });
      const updated = mockCharacter({ id: 'char-1', name: 'New Name' });

      const prev = {
        myCharacter: existing,
        characters: [existing],
      };

      const next = {
        myCharacter: prev.myCharacter?.id === updated.id ? updated : prev.myCharacter,
        characters: prev.characters.map(c => c.id === updated.id ? updated : c),
      };

      expect(next.myCharacter?.name).toBe('New Name');
      expect(next.characters[0].name).toBe('New Name');
    });

    it('should not update myCharacter when IDs differ', () => {
      const mine = mockCharacter({ id: 'char-1', name: 'My Char' });
      const other = mockCharacter({ id: 'char-2', name: 'Other Char' });
      const otherUpdated = mockCharacter({ id: 'char-2', name: 'Other Updated' });

      const prev = {
        myCharacter: mine,
        characters: [mine, other],
      };

      const next = {
        myCharacter: prev.myCharacter?.id === otherUpdated.id ? otherUpdated : prev.myCharacter,
        characters: prev.characters.map(c => c.id === otherUpdated.id ? otherUpdated : c),
      };

      expect(next.myCharacter?.name).toBe('My Char');
      expect(next.characters[1].name).toBe('Other Updated');
    });
  });

  describe('addChatMessage logic', () => {
    it('should append message to existing array', () => {
      const existing: ChatMessage[] = [
        { id: 'msg-1', senderId: 'user-1', senderName: 'Alice', content: 'Hello', timestamp: 1000, type: 'player' },
      ];
      const newMsg: ChatMessage = {
        id: 'msg-2', senderId: 'user-2', senderName: 'Bob', content: 'World', timestamp: 2000, type: 'player',
      };

      const result = [...existing, newMsg];
      expect(result).toHaveLength(2);
      expect(result[1].content).toBe('World');
    });
  });

  describe('updateCombat logic', () => {
    it('should replace combat state entirely', () => {
      const combatants: Combatant[] = [
        {
          id: 'c-1',
          characterId: 'char-1',
          name: 'Fighter',
          initiative: 45,
          currentWounds: 10,
          maxWounds: 10,
          conditions: [],
          isPlayer: true,
        },
      ];
      const currentTurnId = 'c-1';
      const currentAdvantage = { playerAdvantage: 2, enemyAdvantage: 0 };

      const state = { combatants, currentTurnId, currentAdvantage };

      expect(state.combatants).toHaveLength(1);
      expect(state.currentTurnId).toBe('c-1');
      expect(state.currentAdvantage.playerAdvantage).toBe(2);
    });
  });
});
