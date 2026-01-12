import React, { useState } from 'react';
import {
    Character,
    Armor,
    Weapon,
    Item,
    useGameData,
    EditableField,
    calculateTotalEncumbrance,
    calculateEffectiveMaxEncumbrance,
    QualityTooltip,
    toggleWeaponEquipped,
    toggleArmorEquipped,
    toggleItemEquipped
} from '@wfrp/shared';
import './InventoryTab.css';

interface InventoryTabProps {
    character: Character;
    isEditMode: boolean;
    onCharacterUpdate: (updates: Partial<Character>) => void;
    onPurchaseClick?: () => void;
    showPurchaseButton?: boolean;
    isGM?: boolean;
    onAddItem?: () => void;
    onRemoveItem?: (itemId: string, type: 'weapon' | 'armor' | 'item') => void;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({
    character,
    isEditMode,
    onCharacterUpdate,
    onPurchaseClick,
    showPurchaseButton = false,
    isGM = false,
    onAddItem,
    onRemoveItem,
}) => {
    const { weapons: weaponsData, armor: armorData, items: itemsData, talents } = useGameData();

    const [weaponsExpanded, setWeaponsExpanded] = useState(true);
    const [armorExpanded, setArmorExpanded] = useState(true);
    const [itemsExpanded, setItemsExpanded] = useState(true);

    // Create lookup maps
    const weaponById = Object.fromEntries((weaponsData as Weapon[]).map(w => [w.id, w]));
    const armorById = Object.fromEntries((armorData as Armor[]).map(a => [a.id, a]));
    const itemById = Object.fromEntries((itemsData as Item[]).map(i => [i.id, i]));

    // Calculate encumbrance
    const currentEncumbrance = calculateTotalEncumbrance(character);
    const maxEncumbrance = calculateEffectiveMaxEncumbrance(character, talents);

    // Equipped state helpers
    const isWeaponEquipped = (weaponId: string): boolean => {
        return character.inventory.equippedWeapons?.[weaponId] === true;
    };

    const isArmorEquipped = (armorId: string): boolean => {
        return character.inventory.equippedArmor?.[armorId] === true;
    };

    const isItemEquipped = (itemId: string): boolean => {
        return character.inventory.equippedItems?.[itemId] === true;
    };

    // Equipped toggle handlers
    const handleWeaponEquipToggle = (weaponId: string) => {
        const updatedCharacter = toggleWeaponEquipped(character, weaponId);
        onCharacterUpdate({ inventory: updatedCharacter.inventory });
    };

    const handleArmorEquipToggle = (armorId: string) => {
        const updatedCharacter = toggleArmorEquipped(character, armorId, armorData as Armor[]);
        onCharacterUpdate({ inventory: updatedCharacter.inventory });
    };

    const handleItemEquipToggle = (itemId: string) => {
        const updatedCharacter = toggleItemEquipped(character, itemId);
        onCharacterUpdate({ inventory: updatedCharacter.inventory });
    };

    // Currency handlers
    const handleCurrencyChange = (field: keyof Character['currency'], value: number) => {
        onCharacterUpdate({
            currency: {
                ...character.currency,
                [field]: Math.max(0, value)
            }
        });
    };

    // Item quantity handlers
    const handleWeaponQuantityChange = (weaponId: string, delta: number) => {
        const currentQty = character.inventory.weapons[weaponId] || 0;
        const newQty = Math.max(0, currentQty + delta);
        
        const updatedWeapons = { ...character.inventory.weapons };
        if (newQty === 0) {
            delete updatedWeapons[weaponId];
        } else {
            updatedWeapons[weaponId] = newQty;
        }
        
        onCharacterUpdate({
            inventory: {
                ...character.inventory,
                weapons: updatedWeapons
            }
        });
    };

    const handleArmorQuantityChange = (armorId: string, delta: number) => {
        const currentQty = character.inventory.armor[armorId] || 0;
        const newQty = Math.max(0, currentQty + delta);
        
        const updatedArmor = { ...character.inventory.armor };
        if (newQty === 0) {
            delete updatedArmor[armorId];
        } else {
            updatedArmor[armorId] = newQty;
        }
        
        onCharacterUpdate({
            inventory: {
                ...character.inventory,
                armor: updatedArmor
            }
        });
    };

    const handleItemQuantityChange = (itemId: string, delta: number) => {
        const currentQty = character.inventory.items[itemId] || 0;
        const newQty = Math.max(0, currentQty + delta);
        
        const updatedItems = { ...character.inventory.items };
        if (newQty === 0) {
            delete updatedItems[itemId];
        } else {
            updatedItems[itemId] = newQty;
        }
        
        onCharacterUpdate({
            inventory: {
                ...character.inventory,
                items: updatedItems
            }
        });
    };

    // Get inventory items with details
    const weaponItems = Object.entries(character.inventory.weapons)
        .filter(([_, qty]) => qty > 0)
        .map(([id, qty]) => ({ ...weaponById[id], quantity: qty }))
        .filter(item => item.id) as (Weapon & { quantity: number })[];

    const armorItems = Object.entries(character.inventory.armor)
        .filter(([_, qty]) => qty > 0)
        .map(([id, qty]) => ({ ...armorById[id], quantity: qty }))
        .filter(item => item.id) as (Armor & { quantity: number })[];

    const generalItems = Object.entries(character.inventory.items)
        .filter(([_, qty]) => qty > 0)
        .map(([id, qty]) => ({ ...itemById[id], quantity: qty }))
        .filter(item => item.id) as (Item & { quantity: number })[];

    const encumbrancePercentage = (currentEncumbrance / maxEncumbrance) * 100;
    const isOverEncumbered = currentEncumbrance > maxEncumbrance;

    return (
        <div className="inventory-tab">
            {/* GM Add Item Button */}
            {isGM && onAddItem && (
                <div className="gm-inventory-actions">
                    <button className="gm-action-btn add-btn" onClick={onAddItem}>+ Add Item</button>
                </div>
            )}
            
            {/* Encumbrance Bar */}
            <div className="encumbrance-panel">
                <div className="encumbrance-header">
                    <span className="encumbrance-label">Encumbrance:</span>
                    <span className={`encumbrance-value ${isOverEncumbered ? 'over' : ''}`}>
                        {currentEncumbrance} / {maxEncumbrance}
                    </span>
                </div>
                <div className="encumbrance-bar">
                    <div 
                        className={`encumbrance-fill ${isOverEncumbered ? 'over' : ''}`}
                        style={{ width: `${Math.min(encumbrancePercentage, 100)}%` }}
                    />
                </div>
                {isOverEncumbered && (
                    <p className="encumbrance-warning">You are over-encumbered!</p>
                )}
            </div>

            {/* Currency Panel */}
            <div className="currency-panel">
                <h3 className="panel-title">Wealth</h3>
                <div className="currency-grid">
                    <div className="currency-item gold">
                        <span className="currency-label">Gold Crowns</span>
                        <div className="currency-control">
                            {isEditMode && (
                                <button 
                                    className="currency-btn minus"
                                    onClick={() => handleCurrencyChange('gc', character.currency.gc - 1)}
                                >
                                    −
                                </button>
                            )}
                            <EditableField
                                value={character.currency.gc}
                                onChange={(val) => handleCurrencyChange('gc', val as number)}
                                isEditing={isEditMode}
                                type="number"
                                min={0}
                                className="currency-value"
                            />
                            {isEditMode && (
                                <button 
                                    className="currency-btn plus"
                                    onClick={() => handleCurrencyChange('gc', character.currency.gc + 1)}
                                >
                                    +
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="currency-item silver">
                        <span className="currency-label">Silver Shillings</span>
                        <div className="currency-control">
                            {isEditMode && (
                                <button 
                                    className="currency-btn minus"
                                    onClick={() => handleCurrencyChange('ss', character.currency.ss - 1)}
                                >
                                    −
                                </button>
                            )}
                            <EditableField
                                value={character.currency.ss}
                                onChange={(val) => handleCurrencyChange('ss', val as number)}
                                isEditing={isEditMode}
                                type="number"
                                min={0}
                                className="currency-value"
                            />
                            {isEditMode && (
                                <button 
                                    className="currency-btn plus"
                                    onClick={() => handleCurrencyChange('ss', character.currency.ss + 1)}
                                >
                                    +
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="currency-item brass">
                        <span className="currency-label">Brass Pennies</span>
                        <div className="currency-control">
                            {isEditMode && (
                                <button 
                                    className="currency-btn minus"
                                    onClick={() => handleCurrencyChange('bp', character.currency.bp - 1)}
                                >
                                    −
                                </button>
                            )}
                            <EditableField
                                value={character.currency.bp}
                                onChange={(val) => handleCurrencyChange('bp', val as number)}
                                isEditing={isEditMode}
                                type="number"
                                min={0}
                                className="currency-value"
                            />
                            {isEditMode && (
                                <button 
                                    className="currency-btn plus"
                                    onClick={() => handleCurrencyChange('bp', character.currency.bp + 1)}
                                >
                                    +
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Weapons Section */}
            <div className="inventory-section">
                <div 
                    className="section-header"
                    onClick={() => setWeaponsExpanded(!weaponsExpanded)}
                >
                    <span className="section-toggle">{weaponsExpanded ? '▼' : '▶'}</span>
                    <span className="section-title">Weapons ({weaponItems.length})</span>
                </div>
                {weaponsExpanded && (
                    <div className="section-content">
                        {weaponItems.length === 0 ? (
                            <p className="empty-message">No weapons in inventory</p>
                        ) : (
                            <div className="items-list">
                                {weaponItems.map(weapon => (
                                    <div key={weapon.id} className={`inventory-item ${isWeaponEquipped(weapon.id) ? 'equipped' : ''}`}>
                                        <div className="item-equipped-toggle">
                                            <button
                                                className={`equip-btn ${isWeaponEquipped(weapon.id) ? 'equipped' : ''}`}
                                                onClick={() => handleWeaponEquipToggle(weapon.id)}
                                                title={isWeaponEquipped(weapon.id) ? 'Unequip' : 'Equip'}
                                            >
                                                {isWeaponEquipped(weapon.id) ? '⚔️' : '✖️'}
                                            </button>
                                        </div>
                                        <div className="item-main">
                                            <span className="item-name">{weapon.name}</span>
                                            <span className="item-group">{weapon.group}</span>
                                            <span className="item-qualities">
                                                {weapon.qualities.map((quality, index) => (
                                                    <QualityTooltip
                                                        key={index}
                                                        qualityString={quality}
                                                        className="item-quality"
                                                    />
                                                ))}
                                            </span>
                                        </div>
                                        <div className="item-details">
                                            <span className="item-enc">Enc: {weapon.enc}</span>
                                        </div>
                                        <div className="item-quantity">
                                            {isEditMode && (
                                                <button 
                                                    className="qty-btn minus"
                                                    onClick={() => handleWeaponQuantityChange(weapon.id, -1)}
                                                >
                                                    −
                                                </button>
                                            )}
                                            <span className="qty-value">×{weapon.quantity}</span>
                                            {isEditMode && (
                                                <button 
                                                    className="qty-btn plus"
                                                    onClick={() => handleWeaponQuantityChange(weapon.id, 1)}
                                                >
                                                    +
                                                </button>
                                            )}
                                            {isGM && onRemoveItem && (
                                                <button 
                                                    className="gm-action-btn remove-btn item-remove"
                                                    onClick={() => onRemoveItem(weapon.id, 'weapon')}
                                                    title="Remove"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Armor Section */}
            <div className="inventory-section">
                <div 
                    className="section-header"
                    onClick={() => setArmorExpanded(!armorExpanded)}
                >
                    <span className="section-toggle">{armorExpanded ? '▼' : '▶'}</span>
                    <span className="section-title">Armor ({armorItems.length})</span>
                </div>
                {armorExpanded && (
                    <div className="section-content">
                        {armorItems.length === 0 ? (
                            <p className="empty-message">No armor in inventory</p>
                        ) : (
                            <div className="items-list">
                                {armorItems.map(armor => (
                                    <div key={armor.id} className={`inventory-item ${isArmorEquipped(armor.id) ? 'equipped' : ''}`}>
                                        <div className="item-equipped-toggle">
                                            <button
                                                className={`equip-btn ${isArmorEquipped(armor.id) ? 'equipped' : ''}`}
                                                onClick={() => handleArmorEquipToggle(armor.id)}
                                                title={isArmorEquipped(armor.id) ? 'Unequip' : 'Equip'}
                                            >
                                                {isArmorEquipped(armor.id) ? '🛡️' : '✖️'}
                                            </button>
                                        </div>
                                        <div className="item-main">
                                            <span className="item-name">{armor.name}</span>
                                            <span className="item-type">{armor.type}</span>
                                            <span className="item-qualities">
                                                {armor.qualities.map((quality, index) => (
                                                    <QualityTooltip
                                                        key={index}
                                                        qualityString={quality}
                                                        className="item-quality"
                                                    />
                                                ))}
                                            </span>
                                        </div>
                                        <div className="item-details">
                                            <span className="item-ap">AP: {armor.ap}</span>
                                            <span className="item-locations">{armor.locations.join(', ')}</span>
                                            <span className="item-enc">Enc: {armor.enc}{isArmorEquipped(armor.id) && armor.enc > 0 ? ` (${Math.max(0, armor.enc - 1)} worn)` : ''}</span>
                                        </div>
                                        <div className="item-quantity">
                                            {isEditMode && (
                                                <button 
                                                    className="qty-btn minus"
                                                    onClick={() => handleArmorQuantityChange(armor.id, -1)}
                                                >
                                                    −
                                                </button>
                                            )}
                                            <span className="qty-value">×{armor.quantity}</span>
                                            {isEditMode && (
                                                <button 
                                                    className="qty-btn plus"
                                                    onClick={() => handleArmorQuantityChange(armor.id, 1)}
                                                >
                                                    +
                                                </button>
                                            )}
                                            {isGM && onRemoveItem && (
                                                <button 
                                                    className="gm-action-btn remove-btn item-remove"
                                                    onClick={() => onRemoveItem(armor.id, 'armor')}
                                                    title="Remove"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* General Items Section */}
            <div className="inventory-section">
                <div 
                    className="section-header"
                    onClick={() => setItemsExpanded(!itemsExpanded)}
                >
                    <span className="section-toggle">{itemsExpanded ? '▼' : '▶'}</span>
                    <span className="section-title">Items ({generalItems.length})</span>
                </div>
                {itemsExpanded && (
                    <div className="section-content">
                        {generalItems.length === 0 ? (
                            <p className="empty-message">No items in inventory</p>
                        ) : (
                            <div className="items-list">
                                {generalItems.map(item => (
                                    <div key={item.id} className={`inventory-item ${isItemEquipped(item.id) ? 'equipped' : ''}`}>
                                        <div className="item-equipped-toggle">
                                            <button
                                                className={`equip-btn ${isItemEquipped(item.id) ? 'equipped' : ''}`}
                                                onClick={() => handleItemEquipToggle(item.id)}
                                                title={isItemEquipped(item.id) ? 'Unequip' : 'Equip'}
                                            >
                                                {isItemEquipped(item.id) ? '✓' : '✖️'}
                                            </button>
                                        </div>
                                        <div className="item-main">
                                            <span className="item-name">{item.name}</span>
                                        </div>
                                        <div className="item-details">
                                            <span className="item-enc">Enc: {item.enc}</span>
                                        </div>
                                        <div className="item-quantity">
                                            {isEditMode && (
                                                <button 
                                                    className="qty-btn minus"
                                                    onClick={() => handleItemQuantityChange(item.id, -1)}
                                                >
                                                    −
                                                </button>
                                            )}
                                            <span className="qty-value">×{item.quantity}</span>
                                            {isEditMode && (
                                                <button 
                                                    className="qty-btn plus"
                                                    onClick={() => handleItemQuantityChange(item.id, 1)}
                                                >
                                                    +
                                                </button>
                                            )}
                                            {isGM && onRemoveItem && (
                                                <button 
                                                    className="gm-action-btn remove-btn item-remove"
                                                    onClick={() => onRemoveItem(item.id, 'item')}
                                                    title="Remove"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Shop Button */}
            {showPurchaseButton && onPurchaseClick && (
                <div className="shop-section">
                    <button className="shop-button" onClick={onPurchaseClick}>
                        🛒 Visit Shop
                    </button>
                </div>
            )}
        </div>
    );
};

export default InventoryTab;
