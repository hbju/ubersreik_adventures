/**
 * Keyboard shortcuts type definitions.
 * Used by both GM and Player apps.
 */

/** A key binding definition (modifier keys + main key) */
export interface KeyBinding {
    key: string;       // The key value (e.g. '1', 'c', 'k', '?', 'Escape')
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
}

/** Unique identifier for a shortcut action */
export type ShortcutActionId = string;

/** A single shortcut action definition */
export interface ShortcutAction {
    id: ShortcutActionId;
    label: string;             // i18n key for the action label
    category: string;          // i18n key for grouping in help overlay
    defaultBinding: KeyBinding;
    handler?: () => void;      // Set at mount time by the app
}

/** Complete manifest for an app's keyboard shortcuts */
export interface ShortcutManifest {
    actions: ShortcutAction[];
}

/** User override map: action id → custom binding */
export type ShortcutOverrides = Record<ShortcutActionId, KeyBinding>;

/** Resolved binding: an action with its effective (possibly overridden) binding */
export interface ResolvedShortcut {
    id: ShortcutActionId;
    label: string;
    category: string;
    binding: KeyBinding;
    handler?: () => void;
}

/** Conflict: two actions sharing the same binding */
export interface ShortcutConflict {
    binding: KeyBinding;
    actionIds: [ShortcutActionId, ShortcutActionId];
}
