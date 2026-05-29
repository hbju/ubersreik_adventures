/**
 * useKeyboardShortcuts hook.
 * Listens to keydown events, skips when an editable element is focused,
 * matches bindings, and dispatches action handlers.
 * Supports user override persistence via localStorage.
 */

import { useEffect, useMemo, useCallback, useState } from 'react';
import type { ShortcutAction, ShortcutOverrides, ResolvedShortcut } from '../types/shortcuts.types';
import { eventMatchesBinding, isEditableElement, resolveShortcuts, detectConflicts } from '../utils/shortcuts';
import type { ShortcutConflict } from '../types/shortcuts.types';

const STORAGE_KEY = 'wfrp-shortcut-overrides';

function loadOverrides(): ShortcutOverrides {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore corrupt data */ }
    return {};
}

function saveOverrides(overrides: ShortcutOverrides): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

export interface UseKeyboardShortcutsOptions {
    actions: ShortcutAction[];
    enabled?: boolean;
}

export interface UseKeyboardShortcutsReturn {
    /** Currently resolved shortcuts (defaults merged with overrides) */
    shortcuts: ResolvedShortcut[];
    /** Current user overrides */
    overrides: ShortcutOverrides;
    /** Current conflicts */
    conflicts: ShortcutConflict[];
    /** Rebind an action to a new key */
    rebind: (actionId: string, binding: import('../types/shortcuts.types').KeyBinding) => void;
    /** Reset a single action to its default binding */
    resetBinding: (actionId: string) => void;
    /** Reset all bindings to defaults */
    resetAll: () => void;
    /** Whether the help overlay is open */
    isHelpOpen: boolean;
    /** Toggle the help overlay */
    setHelpOpen: (open: boolean) => void;
}

export function useKeyboardShortcuts({ actions, enabled = true }: UseKeyboardShortcutsOptions): UseKeyboardShortcutsReturn {
    const [overrides, setOverrides] = useState<ShortcutOverrides>(loadOverrides);
    const [isHelpOpen, setHelpOpen] = useState(false);

    const shortcuts = useMemo(() => resolveShortcuts(actions, overrides), [actions, overrides]);
    const conflicts = useMemo(() => detectConflicts(shortcuts), [shortcuts]);

    // Persist overrides whenever they change
    useEffect(() => {
        saveOverrides(overrides);
    }, [overrides]);

    const rebind = useCallback((actionId: string, binding: import('../types/shortcuts.types').KeyBinding) => {
        setOverrides((prev) => ({ ...prev, [actionId]: binding }));
    }, []);

    const resetBinding = useCallback((actionId: string) => {
        setOverrides((prev) => {
            const next = { ...prev };
            delete next[actionId];
            return next;
        });
    }, []);

    const resetAll = useCallback(() => {
        setOverrides({});
    }, []);

    // Keydown listener
    useEffect(() => {
        if (!enabled) return;

        const handler = (event: KeyboardEvent) => {
            // Skip if focus is in an editable element
            if (isEditableElement(event.target)) return;

            for (const shortcut of shortcuts) {
                if (eventMatchesBinding(event, shortcut.binding)) {
                    // Special case: help overlay toggle
                    if (shortcut.id === 'help') {
                        event.preventDefault();
                        setHelpOpen((v) => !v);
                        return;
                    }
                    if (shortcut.handler) {
                        event.preventDefault();
                        shortcut.handler();
                    }
                    return;
                }
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [enabled, shortcuts]);

    return {
        shortcuts,
        overrides,
        conflicts,
        rebind,
        resetBinding,
        resetAll,
        isHelpOpen,
        setHelpOpen,
    };
}
