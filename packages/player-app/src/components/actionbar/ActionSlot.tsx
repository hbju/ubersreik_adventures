import React from 'react';
import { ActionBarEntry } from '@wfrp/shared';
import './ActionBar.css';

export interface ActionSlotProps {
    slotIndex: number;
    entry: ActionBarEntry | null;
    isWeaponEquipped?: boolean; // Only relevant for weapon slots
    onDrop: (slotIndex: number, type: 'skill' | 'weapon' | 'characteristic', id: string, label: string) => void;
    onClear: (slotIndex: number) => void;
    onExecute: (entry: ActionBarEntry) => void;
}

export const ActionSlot: React.FC<ActionSlotProps> = ({
    slotIndex,
    entry,
    isWeaponEquipped = true,
    onDrop,
    onClear,
    onExecute
}) => {
    const displayKey = slotIndex === 9 ? '0' : String(slotIndex + 1);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        
        const type = e.dataTransfer.getData('application/action-type') as 'skill' | 'weapon' | 'characteristic';
        const id = e.dataTransfer.getData('application/action-id');
        const label = e.dataTransfer.getData('application/action-label');

        if (type && id && label) {
            onDrop(slotIndex, type, id, label);
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        if (entry) {
            onClear(slotIndex);
        }
    };

    const handleClick = () => {
        if (!entry) return;
        
        // Check if weapon is unequipped
        if (entry.type === 'weapon' && !isWeaponEquipped) {
            return; // Cannot execute unequipped weapon
        }
        
        onExecute(entry);
    };

    const getIcon = (): string => {
        if (!entry) return '';
        switch (entry.type) {
            case 'weapon':
                return '⚔️';
            case 'skill':
                return '🎲';
            case 'characteristic':
                return '📊';
            default:
                return '❓';
        }
    };

    const getTruncatedLabel = (label: string, maxLength: number = 4): string => {
        if (label.length <= maxLength) return label;
        return label.substring(0, maxLength);
    };

    const isEmpty = !entry;
    const isDisabled = entry?.type === 'weapon' && !isWeaponEquipped;

    return (
        <div
            className={`action-slot ${isEmpty ? 'empty' : ''} ${isDisabled ? 'disabled' : ''} ${entry?.type || ''}`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onContextMenu={handleContextMenu}
            onClick={handleClick}
            title={entry ? (isDisabled ? `${entry.label} (Must Equip First)` : entry.label) : 'Empty slot - Drag a skill or weapon here'}
        >
            <div className="slot-content">
                {entry && (
                    <>
                        <span className="slot-icon">{getIcon()}</span>
                        <span className="slot-label">{getTruncatedLabel(entry.label)}</span>
                    </>
                )}
            </div>
            <span className="slot-key">[{displayKey}]</span>
        </div>
    );
};

export default ActionSlot;
