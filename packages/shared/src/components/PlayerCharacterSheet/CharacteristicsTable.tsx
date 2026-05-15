import React from 'react';
import {
    Character,
    Characteristic,
    useGameData,
    EditableField
} from '@wfrp/shared';
import { getTalentCharacteristicBonus, calculateCharacteristicValue } from '@wfrp/shared';
import './CharacteristicsTable.css';

interface CharacteristicsTableProps {
    character: Character;
    isEditMode: boolean;
    advancementMode?: boolean;
    onCharacterUpdate: (updates: Partial<Character>) => void;
    onCharacteristicClick?: (charId: string, charName: string, charValue: number) => void;
    onCharacteristicAdvance?: (charKey: keyof Character['characteristics']) => void;
}

const CHAR_NAMES: Record<keyof Character['characteristics'], string> = {
    ws: 'WS',
    bs: 'BS',
    s: 'S',
    t: 'T',
    i: 'I',
    ag: 'Ag',
    dex: 'Dex',
    int: 'Int',
    wp: 'WP',
    fel: 'Fel'
};

const CHAR_FULL_NAMES: Record<keyof Character['characteristics'], string> = {
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

export const CharacteristicsTable: React.FC<CharacteristicsTableProps> = ({
    character,
    isEditMode,
    advancementMode = false,
    onCharacterUpdate,
    onCharacteristicClick,
    onCharacteristicAdvance
}) => {
    const { talents } = useGameData();

    const handleCharacteristicChange = (
        charKey: keyof Character['characteristics'],
        field: keyof Characteristic,
        value: number
    ) => {
        const updatedCharacteristics = {
            ...character.characteristics,
            [charKey]: {
                ...character.characteristics[charKey],
                [field]: Math.max(0, value)
            }
        };
        onCharacterUpdate({ characteristics: updatedCharacteristics });
    };

    const handleDragStart = (e: React.DragEvent, charKey: string, charName: string) => {
        e.dataTransfer.setData('application/action-type', 'characteristic');
        e.dataTransfer.setData('application/action-id', charKey);
        e.dataTransfer.setData('application/action-label', charName);
        e.dataTransfer.effectAllowed = 'copy';
    };

    const charKeys = Object.keys(character.characteristics) as Array<keyof Character['characteristics']>;
    // sort charKeys based on the order defined in CHAR_NAMES
    charKeys.sort((a, b) => {
        const order = Object.keys(CHAR_NAMES);
        return order.indexOf(a) - order.indexOf(b);
    });

    return (
        <div className="characteristics-panel">
            <h3 className="panel-title">Characteristics</h3>
            <div className="characteristics-table">
                {/* Header Row */}
                <div className="char-table-row header-row">
                    <div className="char-cell char-label"></div>
                    {charKeys.map(key => {
                        const isUnlocked = !character.unlockedCharacteristicIds ||
                            character.unlockedCharacteristicIds.map(id => id.toLowerCase()).includes(key);
                        return (
                            <div key={key} className={`char-cell char-header ${isUnlocked ? 'unlocked' : ''}`} title={CHAR_FULL_NAMES[key]}>
                                {CHAR_NAMES[key]}
                            </div>
                        )
                    })}
                </div>

                {/* Initial Row */}
                <div className="char-table-row">
                    <div className="char-cell char-label">Initial</div>
                    {charKeys.map(key => {
                        const char = character.characteristics[key];
                        const isUnlocked = !character.unlockedCharacteristicIds ||
                            character.unlockedCharacteristicIds.map(id => id.toLowerCase()).includes(key);
                        return (
                            <div key={key} className={`char-cell`}>
                                {isEditMode ? (
                                    <input
                                        type="number"
                                        value={char.initial}
                                        onChange={(e) => handleCharacteristicChange(key, 'initial', parseInt(e.target.value) || 0)}
                                        className="char-input"
                                        min={0}
                                    />
                                ) : (
                                    <span>{char.initial}</span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Advances Row */}
                <div className="char-table-row">
                    <div className="char-cell char-label">Advances</div>
                    {charKeys.map(key => {
                        const char = character.characteristics[key];
                        const isUnlocked = !character.unlockedCharacteristicIds ||
                            character.unlockedCharacteristicIds.map(id => id.toLowerCase()).includes(key);
                        return (
                            <div key={key} className={`char-cell ${advancementMode && isUnlocked ? 'advanceable' : ''}`}>
                                {isEditMode ? (
                                    <input
                                        type="number"
                                        value={char.advances}
                                        onChange={(e) => handleCharacteristicChange(key, 'advances', parseInt(e.target.value) || 0)}
                                        className="char-input"
                                        min={0}
                                    />
                                ) : (
                                    <>
                                        <span>{char.advances}</span>
                                        {advancementMode && isUnlocked && (
                                            <button
                                                className="advance-button"
                                                onClick={() => onCharacteristicAdvance?.(key)}
                                                title="Advance with XP"
                                            >
                                                +
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Talents Row */}
                <div className="char-table-row">
                    <div className="char-cell char-label">Talents</div>
                    {charKeys.map(key => {
                        const talentBonus = getTalentCharacteristicBonus(character, talents, key);
                        return (
                            <div key={key} className="char-cell talent-value">
                                {talentBonus || '—'}
                            </div>
                        );
                    })}
                </div>

                {/* Current/Total Row */}
                <div className="char-table-row total-row">
                    <div className="char-cell char-label">Current</div>
                    {charKeys.map(key => {
                        const char = character.characteristics[key];
                        const talentBonus = getTalentCharacteristicBonus(character, talents, key);
                        const total = char.initial + char.advances + talentBonus + char.modifier;
                        return (
                            <div key={key} className="char-cell char-total">
                                <button
                                    className="roll-button"
                                    onClick={() => onCharacteristicClick?.(key, CHAR_FULL_NAMES[key], total)}
                                    title={`Roll ${CHAR_FULL_NAMES[key]} - Drag to Action Bar`}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, key, CHAR_NAMES[key])}
                                >
                                    {total}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default CharacteristicsTable;
