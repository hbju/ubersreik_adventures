/**
 * ShortcutsSettings — rebinding panel.
 * Lists all actions with current bindings. Click to capture a new key combo.
 * Shows live conflict warnings.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { KeyBinding, ResolvedShortcut, ShortcutConflict } from '../../types/shortcuts.types';
import { formatBinding, bindingsEqual } from '../../utils/shortcuts';

interface ShortcutsSettingsProps {
    shortcuts: ResolvedShortcut[];
    conflicts: ShortcutConflict[];
    onRebind: (actionId: string, binding: KeyBinding) => void;
    onResetBinding: (actionId: string) => void;
    onResetAll: () => void;
    onClose: () => void;
}

export const ShortcutsSettings: React.FC<ShortcutsSettingsProps> = ({
    shortcuts,
    conflicts,
    onRebind,
    onResetBinding,
    onResetAll,
    onClose,
}) => {
    const { t } = useTranslation();
    const [capturing, setCapturing] = useState<string | null>(null);

    // Capture keydown when in rebind mode
    useEffect(() => {
        if (!capturing) return;

        const handler = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            // Ignore lone modifier keys
            if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

            const newBinding: KeyBinding = {
                key: e.key,
                ctrl: e.ctrlKey || e.metaKey || undefined,
                shift: e.shiftKey || undefined,
                alt: e.altKey || undefined,
            };
            // Clean up falsy modifiers
            if (!newBinding.ctrl) delete newBinding.ctrl;
            if (!newBinding.shift) delete newBinding.shift;
            if (!newBinding.alt) delete newBinding.alt;

            onRebind(capturing, newBinding);
            setCapturing(null);
        };

        window.addEventListener('keydown', handler, true);
        return () => window.removeEventListener('keydown', handler, true);
    }, [capturing, onRebind]);

    // Cancel capture on Escape
    const handleEscape = useCallback((e: KeyboardEvent) => {
        if (capturing && e.key === 'Escape') {
            setCapturing(null);
        }
    }, [capturing]);

    useEffect(() => {
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [handleEscape]);

    const getConflictForAction = (actionId: string): ShortcutConflict | undefined => {
        return conflicts.find(c => c.actionIds.includes(actionId));
    };

    // Group by category
    const grouped = shortcuts.reduce<Record<string, ResolvedShortcut[]>>((acc, s) => {
        const cat = t(s.category);
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(s);
        return acc;
    }, {});

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.7)',
        }} onClick={onClose}>
            <div style={{
                background: '#1a0e08',
                border: '2px solid #8b6914',
                borderRadius: '12px',
                padding: '24px 32px',
                maxWidth: '700px',
                width: '90%',
                maxHeight: '85vh',
                overflowY: 'auto',
                color: '#d4af37',
            }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#d4af37' }}>
                        {t('shortcuts.settings')}
                    </h2>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={onResetAll}
                            style={{
                                background: '#3a1a0a',
                                border: '1px solid #8b4513',
                                borderRadius: '4px',
                                color: '#d4af37',
                                padding: '4px 12px',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                            }}
                        >
                            {t('shortcuts.resetAll')}
                        </button>
                        <button
                            onClick={onClose}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#d4af37',
                                fontSize: '1.5rem',
                                cursor: 'pointer',
                                padding: '4px 8px',
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {Object.entries(grouped).map(([category, items]) => (
                    <div key={category} style={{ marginBottom: '20px' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#a08030', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {category}
                        </h3>
                        {items.map(shortcut => {
                            const conflict = getConflictForAction(shortcut.id);
                            const isCapturing = capturing === shortcut.id;
                            return (
                                <div key={shortcut.id} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '6px 0',
                                    borderBottom: '1px solid #2c1810',
                                    gap: '12px',
                                }}>
                                    <span style={{ flex: 1, fontSize: '0.85rem', color: '#c8a840' }}>
                                        {t(shortcut.label)}
                                    </span>

                                    <button
                                        onClick={() => setCapturing(isCapturing ? null : shortcut.id)}
                                        style={{
                                            background: isCapturing ? '#4a2a0a' : '#2c1810',
                                            border: `1px solid ${conflict ? '#cc3333' : isCapturing ? '#d4af37' : '#5a3a20'}`,
                                            borderRadius: '4px',
                                            padding: '4px 12px',
                                            fontSize: '0.8rem',
                                            fontFamily: 'monospace',
                                            color: isCapturing ? '#fff' : '#d4af37',
                                            cursor: 'pointer',
                                            minWidth: '80px',
                                            textAlign: 'center',
                                        }}
                                    >
                                        {isCapturing ? t('shortcuts.pressKey') : formatBinding(shortcut.binding)}
                                    </button>

                                    <button
                                        onClick={() => onResetBinding(shortcut.id)}
                                        title={t('shortcuts.resetOne')}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#666',
                                            cursor: 'pointer',
                                            fontSize: '0.75rem',
                                            padding: '4px',
                                        }}
                                    >
                                        ↺
                                    </button>

                                    {conflict && (
                                        <span style={{ fontSize: '0.7rem', color: '#cc3333' }}>
                                            ⚠ {t('shortcuts.conflict')}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}

                <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '16px', textAlign: 'center' }}>
                    {t('shortcuts.settingsHint')}
                </p>
            </div>
        </div>
    );
};
