/**
 * ShortcutsHelpOverlay — generic help overlay showing all active keyboard shortcuts.
 * Triggered by the '?' shortcut.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ResolvedShortcut } from '../../types/shortcuts.types';
import { formatBinding } from '../../utils/shortcuts';

interface ShortcutsHelpOverlayProps {
    shortcuts: ResolvedShortcut[];
    isOpen: boolean;
    onClose: () => void;
    onOpenSettings?: () => void;
}

export const ShortcutsHelpOverlay: React.FC<ShortcutsHelpOverlayProps> = ({ shortcuts, isOpen, onClose, onOpenSettings }) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    // Group shortcuts by category
    const grouped = shortcuts.reduce<Record<string, ResolvedShortcut[]>>((acc, s) => {
        const cat = t(s.category);
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(s);
        return acc;
    }, {});

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.7)',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: '#1a0e08',
                    border: '2px solid #8b6914',
                    borderRadius: '12px',
                    padding: '24px 32px',
                    maxWidth: '600px',
                    width: '90%',
                    maxHeight: '80vh',
                    overflowY: 'auto',
                    color: '#d4af37',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#d4af37' }}>
                        {t('shortcuts.title')}
                    </h2>
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

                {Object.entries(grouped).map(([category, items]) => (
                    <div key={category} style={{ marginBottom: '16px' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#a08030', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {category}
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 16px' }}>
                            {items.map((shortcut) => (
                                <React.Fragment key={shortcut.id}>
                                    <span style={{ fontSize: '0.85rem', color: '#c8a84080' }}>
                                        {t(shortcut.label)}
                                    </span>
                                    <kbd style={{
                                        background: '#2c1810',
                                        border: '1px solid #5a3a20',
                                        borderRadius: '4px',
                                        padding: '2px 8px',
                                        fontSize: '0.8rem',
                                        fontFamily: 'monospace',
                                        color: '#d4af37',
                                        textAlign: 'center',
                                        minWidth: '32px',
                                    }}>
                                        {formatBinding(shortcut.binding)}
                                    </kbd>
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                ))}

                <div style={{ marginTop: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                    <p style={{ fontSize: '0.75rem', color: '#666', margin: 0 }}>
                        {t('shortcuts.helpHint')}
                    </p>
                    {onOpenSettings && (
                        <button
                            onClick={() => { onClose(); onOpenSettings(); }}
                            style={{
                                background: '#2c1810',
                                border: '1px solid #5a3a20',
                                borderRadius: '4px',
                                color: '#d4af37',
                                padding: '6px 16px',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                            }}
                        >
                            {t('shortcuts.customize')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
