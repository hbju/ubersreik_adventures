import { describe, it, expect } from 'vitest';
import {
    normalizeBinding,
    bindingsEqual,
    eventMatchesBinding,
    isEditableElement,
    resolveShortcuts,
    detectConflicts,
    formatBinding,
} from '../src/utils/shortcuts';
import type { KeyBinding, ShortcutAction, ResolvedShortcut } from '../src/types/shortcuts.types';

/** Helper: create a minimal HTMLElement-like object for isEditableElement tests */
function mockElement(opts: { tagName: string; contentEditable?: string; closestResult?: boolean }): EventTarget {
    return {
        tagName: opts.tagName.toUpperCase(),
        isContentEditable: opts.contentEditable === 'true',
        closest: (_sel: string) => opts.closestResult ? {} : null,
    } as unknown as EventTarget;
}

describe('shortcuts utils', () => {
    describe('normalizeBinding', () => {
        it('fills missing modifiers with false', () => {
            const result = normalizeBinding({ key: 'a' });
            expect(result).toEqual({ key: 'a', ctrl: false, shift: false, alt: false });
        });

        it('lowercases key', () => {
            const result = normalizeBinding({ key: 'K', ctrl: true });
            expect(result).toEqual({ key: 'k', ctrl: true, shift: false, alt: false });
        });

        it('preserves all modifiers when set', () => {
            const result = normalizeBinding({ key: '?', ctrl: true, shift: true, alt: true });
            expect(result).toEqual({ key: '?', ctrl: true, shift: true, alt: true });
        });
    });

    describe('bindingsEqual', () => {
        it('matches identical simple bindings', () => {
            expect(bindingsEqual({ key: '1' }, { key: '1' })).toBe(true);
        });

        it('matches bindings with same modifiers', () => {
            expect(bindingsEqual(
                { key: 'k', ctrl: true },
                { key: 'K', ctrl: true }
            )).toBe(true);
        });

        it('treats missing modifier as false', () => {
            expect(bindingsEqual(
                { key: 'a' },
                { key: 'a', ctrl: false, shift: false, alt: false }
            )).toBe(true);
        });

        it('rejects different keys', () => {
            expect(bindingsEqual({ key: '1' }, { key: '2' })).toBe(false);
        });

        it('rejects different modifiers', () => {
            expect(bindingsEqual(
                { key: 'k', ctrl: true },
                { key: 'k', alt: true }
            )).toBe(false);
        });
    });

    describe('eventMatchesBinding', () => {
        it('matches simple key press', () => {
            const event = { key: '3', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false };
            expect(eventMatchesBinding(event, { key: '3' })).toBe(true);
        });

        it('matches Ctrl+K', () => {
            const event = { key: 'k', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false };
            expect(eventMatchesBinding(event, { key: 'k', ctrl: true })).toBe(true);
        });

        it('matches Meta (Cmd) as Ctrl', () => {
            const event = { key: 'k', ctrlKey: false, shiftKey: false, altKey: false, metaKey: true };
            expect(eventMatchesBinding(event, { key: 'k', ctrl: true })).toBe(true);
        });

        it('rejects when modifiers do not match', () => {
            const event = { key: 'k', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false };
            expect(eventMatchesBinding(event, { key: 'k' })).toBe(false);
        });

        it('is case-insensitive for key matching', () => {
            const event = { key: 'D', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false };
            expect(eventMatchesBinding(event, { key: 'd' })).toBe(true);
        });

        it('handles shift key', () => {
            const event = { key: '?', ctrlKey: false, shiftKey: true, altKey: false, metaKey: false };
            expect(eventMatchesBinding(event, { key: '?', shift: true })).toBe(true);
        });
    });

    describe('isEditableElement', () => {
        it('returns false for null', () => {
            expect(isEditableElement(null)).toBe(false);
        });

        it('returns true for input elements', () => {
            expect(isEditableElement(mockElement({ tagName: 'input' }))).toBe(true);
        });

        it('returns true for textarea elements', () => {
            expect(isEditableElement(mockElement({ tagName: 'textarea' }))).toBe(true);
        });

        it('returns true for contenteditable elements', () => {
            expect(isEditableElement(mockElement({ tagName: 'div', contentEditable: 'true' }))).toBe(true);
        });

        it('returns true for children of contenteditable', () => {
            expect(isEditableElement(mockElement({ tagName: 'span', closestResult: true }))).toBe(true);
        });

        it('returns false for regular div', () => {
            expect(isEditableElement(mockElement({ tagName: 'div' }))).toBe(false);
        });

        it('returns false for button', () => {
            expect(isEditableElement(mockElement({ tagName: 'button' }))).toBe(false);
        });
    });

    describe('resolveShortcuts', () => {
        const actions: ShortcutAction[] = [
            { id: 'action-1', label: 'Action 1', category: 'cat', defaultBinding: { key: '1' } },
            { id: 'action-2', label: 'Action 2', category: 'cat', defaultBinding: { key: '2' } },
        ];

        it('returns defaults when no overrides', () => {
            const result = resolveShortcuts(actions, {});
            expect(result[0].binding).toEqual({ key: '1' });
            expect(result[1].binding).toEqual({ key: '2' });
        });

        it('applies overrides', () => {
            const overrides = { 'action-1': { key: 'a', ctrl: true } };
            const result = resolveShortcuts(actions, overrides);
            expect(result[0].binding).toEqual({ key: 'a', ctrl: true });
            expect(result[1].binding).toEqual({ key: '2' });
        });

        it('preserves id, label, category', () => {
            const result = resolveShortcuts(actions, {});
            expect(result[0].id).toBe('action-1');
            expect(result[0].label).toBe('Action 1');
            expect(result[0].category).toBe('cat');
        });
    });

    describe('detectConflicts', () => {
        it('returns empty array when no conflicts', () => {
            const resolved: ResolvedShortcut[] = [
                { id: 'a', label: 'A', category: 'c', binding: { key: '1' } },
                { id: 'b', label: 'B', category: 'c', binding: { key: '2' } },
            ];
            expect(detectConflicts(resolved)).toEqual([]);
        });

        it('detects conflicting bindings', () => {
            const resolved: ResolvedShortcut[] = [
                { id: 'a', label: 'A', category: 'c', binding: { key: '1' } },
                { id: 'b', label: 'B', category: 'c', binding: { key: '1' } },
            ];
            const conflicts = detectConflicts(resolved);
            expect(conflicts).toHaveLength(1);
            expect(conflicts[0].actionIds).toEqual(['a', 'b']);
        });

        it('detects multiple conflicts', () => {
            const resolved: ResolvedShortcut[] = [
                { id: 'a', label: 'A', category: 'c', binding: { key: '1' } },
                { id: 'b', label: 'B', category: 'c', binding: { key: '1' } },
                { id: 'c', label: 'C', category: 'c', binding: { key: '2' } },
                { id: 'd', label: 'D', category: 'c', binding: { key: '2' } },
            ];
            const conflicts = detectConflicts(resolved);
            expect(conflicts).toHaveLength(2);
        });

        it('treats modifier differences as non-conflicting', () => {
            const resolved: ResolvedShortcut[] = [
                { id: 'a', label: 'A', category: 'c', binding: { key: 'k' } },
                { id: 'b', label: 'B', category: 'c', binding: { key: 'k', ctrl: true } },
            ];
            expect(detectConflicts(resolved)).toEqual([]);
        });
    });

    describe('formatBinding', () => {
        it('formats simple key', () => {
            expect(formatBinding({ key: '1' })).toBe('1');
        });

        it('formats Ctrl+K', () => {
            expect(formatBinding({ key: 'k', ctrl: true })).toBe('Ctrl+K');
        });

        it('formats complex combo', () => {
            expect(formatBinding({ key: 's', ctrl: true, shift: true })).toBe('Ctrl+Shift+S');
        });

        it('formats Escape as Esc', () => {
            expect(formatBinding({ key: 'Escape' })).toBe('Esc');
        });

        it('formats space key', () => {
            expect(formatBinding({ key: ' ' })).toBe('Space');
        });

        it('formats ? key', () => {
            expect(formatBinding({ key: '?' })).toBe('?');
        });

        it('uppercases single letter', () => {
            expect(formatBinding({ key: 'd' })).toBe('D');
        });

        it('formats Alt combo', () => {
            expect(formatBinding({ key: 'f', alt: true })).toBe('Alt+F');
        });
    });
});
