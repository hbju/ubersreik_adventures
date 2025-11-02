import React, { useState } from 'react';
import { Character, Armor, Weapon, Item, Currency } from '../types/wfrp.types';
import { calculateTotalEncumbrance } from '../utils/inventory';
import { calculateCharacteristicBonus } from '../utils/skills';
import ArmorData from '../data/armor.json';
import WeaponData from '../data/weapons.json';
import ItemData from '../data/items.json';
import './InventoryView.css';

interface InventoryViewProps {
    character: Character;
    onPurchaseClick?: () => void;
    showPurchaseButton?: boolean;
}

const armorsById = Object.groupBy(ArmorData as Armor[], a => a.id);
const weaponsById = Object.groupBy(WeaponData as Weapon[], w => w.id);
const itemsById = Object.groupBy(ItemData as Item[], i => i.id);

const InventoryView: React.FC<InventoryViewProps> = ({ character, onPurchaseClick, showPurchaseButton = false }) => {
    const [armorExpanded, setArmorExpanded] = useState(true);
    const [weaponsExpanded, setWeaponsExpanded] = useState(true);
    const [itemsExpanded, setItemsExpanded] = useState(true);

    // Calculate encumbrance
    const currentEncumbrance = calculateTotalEncumbrance(character);
    const maxEncumbrance = 
        calculateCharacteristicBonus(character.characteristics.s) + 
        calculateCharacteristicBonus(character.characteristics.t);

    // Get armor items
    const armorItems = character.inventory.armor
        .map(id => armorsById[id]?.[0])
        .filter(Boolean) as Armor[];

    // Get weapon items
    const weaponItems = character.inventory.weapons
        .map(id => weaponsById[id]?.[0])
        .filter(Boolean) as Weapon[];

    // Get general items
    const generalItems = character.inventory.items
        .map(id => itemsById[id]?.[0])
        .filter(Boolean) as Item[];

    return (
        <div className="inventoryView">
            <div className="inventorySection">
                <div 
                    className="sectionHeader" 
                    onClick={() => setArmorExpanded(!armorExpanded)}
                >
                    <span className="sectionTitle">
                        {armorExpanded ? '▼' : '▶'} Armor ({armorItems.length})
                    </span>
                </div>
                {armorExpanded && (
                    <div className="sectionContent">
                        {armorItems.length === 0 ? (
                            <p className="emptyMessage">No armor in inventory</p>
                        ) : (
                            <div className="itemsList">
                                {armorItems.map((armor, index) => (
                                    <div key={`${armor.id}-${index}`} className="inventoryItem">
                                        <div className="itemHeader">
                                            <span className="itemName">{armor.name}</span>
                                            <span className="itemEnc">Enc: {armor.enc}</span>
                                        </div>
                                        <div className="itemDetails">
                                            <div className="detailRow">
                                                <span className="detailLabel">Type:</span>
                                                <span className="detailValue">{armor.type}</span>
                                            </div>
                                            <div className="detailRow">
                                                <span className="detailLabel">AP:</span>
                                                <span className="detailValue">{armor.ap}</span>
                                            </div>
                                            <div className="detailRow">
                                                <span className="detailLabel">Locations:</span>
                                                <span className="detailValue">{armor.locations.join(', ')}</span>
                                            </div>
                                            {armor.penalty && (
                                                <div className="detailRow">
                                                    <span className="detailLabel">Penalty:</span>
                                                    <span className="detailValue">{armor.penalty}</span>
                                                </div>
                                            )}
                                            {armor.qualities && armor.qualities.length > 0 && (
                                                <div className="detailRow">
                                                    <span className="detailLabel">Qualities:</span>
                                                    <span className="detailValue">{armor.qualities.join(', ')}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="inventorySection">
                <div 
                    className="sectionHeader" 
                    onClick={() => setWeaponsExpanded(!weaponsExpanded)}
                >
                    <span className="sectionTitle">
                        {weaponsExpanded ? '▼' : '▶'} Weapons ({weaponItems.length})
                    </span>
                </div>
                {weaponsExpanded && (
                    <div className="sectionContent">
                        {weaponItems.length === 0 ? (
                            <p className="emptyMessage">No weapons in inventory</p>
                        ) : (
                            <div className="itemsList">
                                {weaponItems.map((weapon, index) => {
                                    // SB + 3 ;
                                    const sb = calculateCharacteristicBonus(character.characteristics.s);
                                    const damageAddition = weapon.damage.replace('SB', sb.toString());
                                    const damage = damageAddition.includes('+') ? damageAddition.split('+').map(part => isNaN(Number(part)) ? part : Number(part)).reduce((a, b) => typeof a === 'number' && typeof b === 'number' ? a + b : `${a} + ${b}`) : damageAddition;
                                    return (
                                    <div key={`${weapon.id}-${index}`} className="inventoryItem">
                                        <div className="itemHeader">
                                            <span className="itemName">{weapon.name}</span>
                                            <span className="itemEnc">Enc: {weapon.enc}</span>
                                        </div>
                                        <div className="itemDetails">
                                            <div className="detailRow">
                                                <span className="detailLabel">Group:</span>
                                                <span className="detailValue">{weapon.group.charAt(0).toUpperCase() + weapon.group.slice(1)}</span>
                                            </div>
                                            <div className="detailRow">
                                                <span className="detailLabel">Damage:</span>
                                                <span className="detailValue">{damage}</span>
                                            </div>
                                            <div className="detailRow">
                                                <span className="detailLabel">Reach:</span>
                                                <span className="detailValue">{weapon.reach}</span>
                                            </div>
                                            {weapon.qualities && weapon.qualities.length > 0 && (
                                                <div className="detailRow">
                                                    <span className="detailLabel">Qualities:</span>
                                                    <span className="detailValue">{weapon.qualities.join(', ')}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )})}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="inventorySection">
                <div 
                    className="sectionHeader" 
                    onClick={() => setItemsExpanded(!itemsExpanded)}
                >
                    <span className="sectionTitle">
                        {itemsExpanded ? '▼' : '▶'} General Items ({generalItems.length})
                    </span>
                </div>
                {itemsExpanded && (
                    <div className="sectionContent">
                        {generalItems.length === 0 ? (
                            <p className="emptyMessage">No items in inventory</p>
                        ) : (
                            <div className="itemsList">
                                {generalItems.map((item, index) => (
                                    <div key={`${item.id}-${index}`} className="inventoryItem">
                                        <div className="itemHeader">
                                            <span className="itemName">{item.name}</span>
                                            <span className="itemEnc">Enc: {item.enc}</span>
                                        </div>
                                        <div className="itemDetails">
                                            <div className="detailRow">
                                                <span className="detailLabel">Price:</span>
                                                <span className="detailValue">{item.price}</span>
                                            </div>
                                            <div className="detailRow">
                                                <span className="detailLabel">Availability:</span>
                                                <span className="detailValue">{item.availability}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="inventoryFooter">
                {showPurchaseButton && onPurchaseClick && (
                    <div className="purchaseButtonContainer">
                        <button className="purchaseButton" onClick={onPurchaseClick}>
                            🛒 Purchase Items
                        </button>
                    </div>
                )}
                
                <div className="footerContent">
                    <div className="currencyDisplay">
                        <h4>Currency</h4>
                        <div className="currencyValues">
                            <span className="currency gc">{character.currency.gc} GC</span>
                            <span className="currency ss">{character.currency.ss} SS</span>
                            <span className="currency bp">{character.currency.bp} BP</span>
                        </div>
                    </div>

                    <div className="encumbranceDisplay">
                        <h4>Encumbrance</h4>
                        <div className="encumbranceBar">
                            <span className={`encumbranceValue ${currentEncumbrance > maxEncumbrance ? 'overEncumbered' : ''}`}>
                                {currentEncumbrance} / {maxEncumbrance}
                            </span>
                            <div className="progressBar">
                                <div 
                                    className={`progressFill ${currentEncumbrance > maxEncumbrance ? 'overEncumbered' : ''}`}
                                    style={{ width: `${Math.min((currentEncumbrance / maxEncumbrance) * 100, 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InventoryView;
