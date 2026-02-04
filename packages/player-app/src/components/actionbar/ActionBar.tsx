import React, { useEffect, useCallback } from 'react';
import { ActionBarEntry, Character, Weapon, useGameData, calculateSkillValue, calculateCharacteristicValue } from '@wfrp/shared';
import { ActionSlot } from './ActionSlot';
import './ActionBar.css';

interface ActionBarProps {
    character: Character;
    onCharacterUpdate: (updates: Partial<Character>) => void;
    onSkillExecute: (skillId: string, skillName: string, skillValue: number) => void;
    onWeaponExecute: (weapon: Weapon, skillId: string, skillName: string, skillValue: number, weaponDamage: number) => void;
    onCharacteristicExecute?: (charId: string, charName: string, charValue: number) => void;
}

const SLOT_COUNT = 10;

export const ActionBar: React.FC<ActionBarProps> = ({
    character,
    onCharacterUpdate,
    onSkillExecute,
    onWeaponExecute,
    onCharacteristicExecute
}) => {
    const { weapons: weaponsData, skills: skillsData } = useGameData();

    // Get current action bar entries from character
    const actionBar = character.actionBar || [];

    // Get entry for a specific slot
    const getSlotEntry = (slotIndex: number): ActionBarEntry | null => {
        return actionBar.find(entry => entry.slotIndex === slotIndex) || null;
    };

    // Check if a weapon is equipped
    const isWeaponEquipped = (weaponId: string): boolean => {
        const equippedWeapons = character.inventory.equippedWeapons || {};
        return equippedWeapons[weaponId] === true;
    };

    // Handle dropping an item into a slot
    const handleDrop = (slotIndex: number, type: 'skill' | 'weapon' | 'characteristic', id: string, label: string) => {
        const newEntry: ActionBarEntry = {
            slotIndex,
            type,
            id,
            label
        };

        // Remove any existing entry in this slot
        const updatedActionBar = actionBar.filter(entry => entry.slotIndex !== slotIndex);
        updatedActionBar.push(newEntry);

        onCharacterUpdate({ actionBar: updatedActionBar });
    };

    // Handle clearing a slot
    const handleClear = (slotIndex: number) => {
        const updatedActionBar = actionBar.filter(entry => entry.slotIndex !== slotIndex);
        onCharacterUpdate({ actionBar: updatedActionBar });
    };

    // Execute an action bar entry
    const handleExecute = useCallback((entry: ActionBarEntry) => {
        if (entry.type === 'weapon') {
            // Check if weapon is equipped
            if (!isWeaponEquipped(entry.id)) {
                return; // Don't execute unequipped weapons
            }

            const weapon = (weaponsData as Weapon[]).find(w => w.id === entry.id);
            if (!weapon) return;

            // Determine if ranged or melee
            const group = weapon.group?.toLowerCase() || '';
            const isRanged = group.includes('bow') ||
                group.includes('crossbow') ||
                group.includes('blackpowder') ||
                group.includes('engineering') ||
                group.includes('sling') ||
                group.includes('thrown');

            // Get the skill for this weapon
            const skillId = isRanged
                ? 'ranged_' + (group || 'basic')
                : group === 'basic' ? 'melee' : 'melee_' + group;

            const skill = character.skills.find(s => s.id === skillId);

            let skillName: string;
            let skillValue: number;

            if (skill) {
                skillName = skill.name;
                skillValue = calculateSkillValue(skill, character);
            } else {
                // Fall back to base characteristic
                if (isRanged) {
                    skillName = 'Ballistic Skill';
                    skillValue = calculateCharacteristicValue(character.characteristics.bs);
                } else {
                    skillName = 'Weapon Skill';
                    skillValue = calculateCharacteristicValue(character.characteristics.ws);
                }
            }

            // Calculate weapon damage
            const damage = weapon.damage || '';
            let damageValue = 0;
            if (damage.includes('SB')) {
                const sb = Math.floor(calculateCharacteristicValue(character.characteristics.s) / 10);
                const match = damage.match(/SB([+-]?\d+)?/);
                if (match) {
                    const modifier = match[1] ? parseInt(match[1]) : 0;
                    damageValue = sb + modifier;
                }
            } else {
                damageValue = parseInt(damage) || 0;
            }

            onWeaponExecute(weapon, skillId, skillName, skillValue, damageValue);
        } else if (entry.type === 'skill') {
            const skill = character.skills.find(s => s.id === entry.id);
            if (skill) {
                const skillValue = calculateSkillValue(skill, character);
                onSkillExecute(skill.id, skill.name, skillValue);
            } else {
                // Try to find in all skills data (might be a basic skill without advances)
                const skillDef = skillsData.find((s: any) => s.id === entry.id);
                if (skillDef) {
                    const charKey = skillDef.characteristic.toLowerCase() as keyof Character['characteristics'];
                    const baseValue = calculateCharacteristicValue(character.characteristics[charKey]);
                    onSkillExecute(entry.id, skillDef.name, baseValue);
                }
            }
        } else if (entry.type === 'characteristic' && onCharacteristicExecute) {
            const charKey = entry.id.toLowerCase() as keyof Character['characteristics'];
            const charValue = calculateCharacteristicValue(character.characteristics[charKey]);
            const charNames: Record<string, string> = {
                ws: 'Weapon Skill',
                bs: 'Ballistic Skill',
                s: 'Strength',
                t: 'Toughness',
                i: 'Initiative',
                ag: 'Agility',
                dex: 'Dexterity',
                int: 'Intelligence',
                wp: 'Willpower',
                fel: 'Fellowship'
            };
            onCharacteristicExecute(entry.id, charNames[entry.id] || entry.label, charValue);
        }
    }, [character, weaponsData, skillsData, onSkillExecute, onWeaponExecute, onCharacteristicExecute]);

    // Keyboard listener for hotkeys
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if user is typing in an input field
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            // Check for modifier keys (don't trigger on Ctrl+1, Alt+1, etc.)
            if (e.ctrlKey || e.altKey || e.metaKey) {
                return;
            }

            // Map key to slot index
            let slotIndex: number | null = null;
            if (e.key >= '1' && e.key <= '9') {
                slotIndex = parseInt(e.key) - 1;
            } else if (e.key === '0') {
                slotIndex = 9;
            }

            if (slotIndex !== null) {
                const entry = getSlotEntry(slotIndex);
                if (entry) {
                    // Check if weapon is equipped before executing
                    if (entry.type === 'weapon' && !isWeaponEquipped(entry.id)) {
                        return;
                    }
                    e.preventDefault();
                    handleExecute(entry);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [actionBar, handleExecute]);

    return (
        <div className="action-bar">
            <div className="action-bar-slots">
                {Array.from({ length: SLOT_COUNT }, (_, i) => {
                    const entry = getSlotEntry(i);
                    return (
                        <ActionSlot
                            key={i}
                            slotIndex={i}
                            entry={entry}
                            isWeaponEquipped={entry?.type === 'weapon' ? isWeaponEquipped(entry.id) : true}
                            onDrop={handleDrop}
                            onClear={handleClear}
                            onExecute={handleExecute}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default ActionBar;
