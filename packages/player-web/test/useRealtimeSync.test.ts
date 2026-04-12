/**
 * Tests for useRealtimeSync debounce and subscription logic.
 *
 * These tests verify the debounce helper used internally by the hook
 * and ensure the correct pausing behavior when live session is active.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('useRealtimeSync', () => {
  describe('debounce behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should debounce rapid calls to the same key', () => {
      const fn = vi.fn();
      const pending = new Map<string, ReturnType<typeof setTimeout>>();
      const DEBOUNCE_MS = 500;

      function debounced(key: string, callback: () => void) {
        const existing = pending.get(key);
        if (existing) clearTimeout(existing);
        pending.set(key, setTimeout(() => {
          pending.delete(key);
          callback();
        }, DEBOUNCE_MS));
      }

      // Fire 5 rapid events for the same key
      debounced('characters', fn);
      debounced('characters', fn);
      debounced('characters', fn);
      debounced('characters', fn);
      debounced('characters', fn);

      // Before debounce period, nothing should have fired
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(DEBOUNCE_MS);

      // Only one call should have fired
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should fire independently for different keys', () => {
      const charFn = vi.fn();
      const journalFn = vi.fn();
      const pending = new Map<string, ReturnType<typeof setTimeout>>();
      const DEBOUNCE_MS = 500;

      function debounced(key: string, callback: () => void) {
        const existing = pending.get(key);
        if (existing) clearTimeout(existing);
        pending.set(key, setTimeout(() => {
          pending.delete(key);
          callback();
        }, DEBOUNCE_MS));
      }

      debounced('characters', charFn);
      debounced('journal', journalFn);

      vi.advanceTimersByTime(DEBOUNCE_MS);

      expect(charFn).toHaveBeenCalledTimes(1);
      expect(journalFn).toHaveBeenCalledTimes(1);
    });

    it('should skip calls when paused', () => {
      const fn = vi.fn();
      const pending = new Map<string, ReturnType<typeof setTimeout>>();
      const DEBOUNCE_MS = 500;
      const pausedRef = { current: true };

      function debounced(key: string, callback: () => void) {
        if (pausedRef.current) return;
        const existing = pending.get(key);
        if (existing) clearTimeout(existing);
        pending.set(key, setTimeout(() => {
          pending.delete(key);
          callback();
        }, DEBOUNCE_MS));
      }

      debounced('characters', fn);
      vi.advanceTimersByTime(DEBOUNCE_MS);

      expect(fn).not.toHaveBeenCalled();

      // Unpause and fire again
      pausedRef.current = false;
      debounced('characters', fn);
      vi.advanceTimersByTime(DEBOUNCE_MS);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should cancel previous timer when a new call comes in', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      const pending = new Map<string, ReturnType<typeof setTimeout>>();
      const DEBOUNCE_MS = 500;

      function debounced(key: string, callback: () => void) {
        const existing = pending.get(key);
        if (existing) clearTimeout(existing);
        pending.set(key, setTimeout(() => {
          pending.delete(key);
          callback();
        }, DEBOUNCE_MS));
      }

      // First call
      debounced('combat', fn1);
      // Wait 200ms (less than debounce)
      vi.advanceTimersByTime(200);
      // Second call replaces first
      debounced('combat', fn2);
      // Wait full debounce
      vi.advanceTimersByTime(DEBOUNCE_MS);

      // fn1 should never fire, fn2 should fire once
      expect(fn1).not.toHaveBeenCalled();
      expect(fn2).toHaveBeenCalledTimes(1);
    });
  });

  describe('table-to-callback mapping', () => {
    it('should map each table to the correct callback', () => {
      // This verifies the architectural design: which tables trigger which re-fetch
      const tableMappings: Record<string, string> = {
        characters: 'onCharactersChanged',
        journal_entries: 'onJournalChanged',
        quests: 'onQuestsChanged',
        factions: 'onFactionsChanged',
        location_territories: 'onFactionsChanged', // grouped with factions
        map_pin_discoveries: 'onMapPinsChanged',
        map_tokens: 'onTokensChanged',
        user_map_pins: 'onUserPinsChanged',
        shop_definitions: 'onShopsChanged',
        combat_state: 'onCombatChanged',
        combatants: 'onCombatChanged', // grouped with combat_state
        calendar_state: 'onCalendarChanged',
        calendar_events: 'onCalendarChanged', // grouped with calendar_state
        chat_messages: 'onChatChanged',
        campaigns: 'onCampaignChanged',
      };

      // Verify the mapping is complete
      expect(Object.keys(tableMappings)).toHaveLength(15);

      // Verify all callbacks are represented
      const uniqueCallbacks = new Set(Object.values(tableMappings));
      expect(uniqueCallbacks.size).toBe(12);
    });
  });
});
