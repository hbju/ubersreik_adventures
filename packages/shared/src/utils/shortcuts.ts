/**
 * Keyboard shortcut binding matcher and conflict detection utilities.
 * All functions are pure for easy testing.
 */

import type {
    KeyBinding,
    ShortcutAction,
    ShortcutOverrides,
    ResolvedShortcut,
    ShortcutConflict,
} from '../types/shortcuts.types';

/** Normalize a KeyBinding for comparison (fill missing modifiers with false) */
export function normalizeBinding(binding: KeyBinding): Required<KeyBinding> {
    return {
        key: binding.key.toLowerCase(),
        ctrl: binding.ctrl ?? false,
        shift: binding.shift ?? false,
        alt: binding.alt ?? false,
    };
}

/** Check if two bindings are equivalent */
export function bindingsEqual(a: KeyBinding, b: KeyBinding): boolean {
    const na = normalizeBinding(a);
    const nb = normalizeBinding(b);
    return na.key === nb.key && na.ctrl === nb.ctrl && na.shift === nb.shift && na.alt === nb.alt;
}

/** Check if a keyboard event matches a binding */
export function eventMatchesBinding(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'>, binding: KeyBinding): boolean {
    const norm = normalizeBinding(binding);
    const eventKey = event.key.toLowerCase();
    const eventCtrl = event.ctrlKey || event.metaKey;
    return eventKey === norm.key && eventCtrl === norm.ctrl && event.shiftKey === norm.shift && event.altKey === norm.alt;
}

/** Check if the event target is an editable element (input, textarea, contenteditable) */
export function isEditableElement(target: EventTarget | null): boolean {
    if (!target) return false;
    // Duck-type check for HTMLElement-like objects
    const el = target as { tagName?: string; isContentEditable?: boolean; closest?: (sel: string) => unknown };
    if (!el.tagName) return false;
    const tagName = el.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea') return true;
    if (el.isContentEditable) return true;
    // Also check if inside a contenteditable parent
    if (el.closest && el.closest('[contenteditable="true"]')) return true;
    return false;
}

/**
 * Merge default actions with user overrides to produce resolved shortcuts.
 */
export function resolveShortcuts(
    actions: ShortcutAction[],
    overrides: ShortcutOverrides
): ResolvedShortcut[] {
    return actions.map((action) => ({
        id: action.id,
        label: action.label,
        category: action.category,
        binding: overrides[action.id] ?? action.defaultBinding,
        handler: action.handler,
    }));
}

/**
 * Detect conflicts: two or more actions sharing the same effective binding.
 */
export function detectConflicts(resolved: ResolvedShortcut[]): ShortcutConflict[] {
    const conflicts: ShortcutConflict[] = [];
    for (let i = 0; i < resolved.length; i++) {
        for (let j = i + 1; j < resolved.length; j++) {
            if (bindingsEqual(resolved[i].binding, resolved[j].binding)) {
                conflicts.push({
                    binding: resolved[i].binding,
                    actionIds: [resolved[i].id, resolved[j].id],
                });
            }
        }
    }
    return conflicts;
}

/** Format a binding for display (e.g., "Ctrl+K", "1", "?") */
export function formatBinding(binding: KeyBinding): string {
    const parts: string[] = [];
    if (binding.ctrl) parts.push('Ctrl');
    if (binding.alt) parts.push('Alt');
    if (binding.shift) parts.push('Shift');

    // Display-friendly key name
    let keyDisplay = binding.key;
    if (keyDisplay === ' ') keyDisplay = 'Space';
    else if (keyDisplay === 'Escape') keyDisplay = 'Esc';
    else if (keyDisplay.length === 1) keyDisplay = keyDisplay.toUpperCase();

    parts.push(keyDisplay);
    return parts.join('+');
}
