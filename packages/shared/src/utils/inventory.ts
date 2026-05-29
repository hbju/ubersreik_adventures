import { useGameData } from '..';
import { Character, Currency, Weapon, Armor, Item } from '../types/wfrp.types';
import { normalizeArmorLocations } from './armorLocations';

export { normalizeArmorLocations } from './armorLocations';


function getItemsData(): { armors: Partial<Record<string, Armor[]>>, weapons: Partial<Record<string, Weapon[]>>, items: Partial<Record<string, Item[]>> } {
    const gameData = useGameData();

    const ArmorData = gameData.armor;
    const WeaponData = gameData.weapons;
    const ItemData = gameData.items;

    return {
        armors: Object.groupBy(ArmorData as Armor[], a => a.id),
        weapons: Object.groupBy(WeaponData as Weapon[], w => w.id),
        items: Object.groupBy(ItemData as Item[], i => i.id)
    };
}

/**
 * Calculate total encumbrance for a character.
 * Equipped armor counts as max(0, enc - 1) towards the total.
 */
export function calculateTotalEncumbrance(character: Character): number {
    const { armors, weapons, items } = getItemsData();
    const equippedArmor = character.inventory.equippedArmor || {};
    const equippedWeapons = character.inventory.equippedWeapons || {};
    const equippedItems = character.inventory.equippedItems || {};
    
    // Armor: equipped armor has enc reduced by 1 (minimum 0)
    const armorEnc = Object.entries(character.inventory.armor).reduce((sum, [itemId, count]) => {
        const baseEnc = armors[itemId]?.[0]?.enc || 0;
        const isEquipped = equippedArmor[itemId] === true;
        const effectiveEnc = isEquipped ? Math.max(0, baseEnc - 1) : baseEnc;
        return sum + (effectiveEnc * count);
    }, 0);
    
    const weaponEnc = Object.entries(character.inventory.weapons).reduce((sum, [itemId, count]) => {
        return sum + ((weapons[itemId]?.[0]?.enc || 0) * count);
    }, 0);
    
    const itemEnc = Object.entries(character.inventory.items).reduce((sum, [itemId, count]) => {
        return sum + ((items[itemId]?.[0]?.enc || 0) * count);
    }, 0);
    
    return armorEnc + weaponEnc + itemEnc;
}

/**
 * Check if an armor piece is flexible (can be layered with rigid armor).
 * An armor is flexible if it has the 'Flexible' quality.
 */
export function isArmorFlexible(armor: Armor): boolean {
    return armor.qualities.some(q => q.toLowerCase().includes('flexible'));
}

export function isArmorSoftLeather(armor: Armor): boolean {
    return armor.type === 'Soft Leather';
}



/**
 * Check if two armor pieces have overlapping locations.
 */
function hasOverlappingLocations(locations1: string[], locations2: string[]): boolean {
    const norm1 = normalizeArmorLocations(locations1);
    const norm2 = normalizeArmorLocations(locations2);
    return norm1.some(loc => norm2.includes(loc));
}

/**
 * Validate and apply armor equip, handling layering rules.
 * When equipping armor, if there's a conflict with existing rigid armor,
 * the existing armor will be unequipped.
 * 
 * Returns an updated character with the armor equipped and any conflicts resolved.
 */
export function validateArmorEquip(
    character: Character,
    newArmorId: string,
    armorData: Armor[]
): Character {
    const armorById = Object.fromEntries(armorData.map(a => [a.id, a]));
    const newArmor = armorById[newArmorId];
    
    if (!newArmor) {
        // Armor not found in data, just mark as equipped without validation
        return {
            ...character,
            inventory: {
                ...character.inventory,
                equippedArmor: {
                    ...character.inventory.equippedArmor,
                    [newArmorId]: true
                }
            }
        };
    }
    
    const newArmorIsFlexible = isArmorFlexible(newArmor);
    const newArmorIsSoftLeather = isArmorSoftLeather(newArmor);
    const equippedArmor = character.inventory.equippedArmor || {};
    const updatedEquippedArmor = { ...equippedArmor };
    
    for (const [existingArmorId, isEquipped] of Object.entries(equippedArmor)) {
        if (!isEquipped) continue;
        if (existingArmorId === newArmorId) continue;
        
        const existingArmor = armorById[existingArmorId];
        if (!existingArmor) continue;
        
        if (!hasOverlappingLocations(newArmor.locations, existingArmor.locations)) {
            continue;
        }

        const existingIsFlexible = isArmorFlexible(existingArmor);
        const existingIsSoftLeather = isArmorSoftLeather(existingArmor);
                
        // flexible can be worn if existing is not; soft leather can be worn if existing is not.
        if (newArmorIsFlexible != existingIsFlexible || newArmorIsSoftLeather != existingIsSoftLeather) {
            continue;
        }
        updatedEquippedArmor[existingArmorId] = false;
    }
    
    updatedEquippedArmor[newArmorId] = true;
    
    return {
        ...character,
        inventory: {
            ...character.inventory,
            equippedArmor: updatedEquippedArmor
        }
    };
}

/**
 * Toggle weapon equipped state.
 */
export function toggleWeaponEquipped(character: Character, weaponId: string): Character {
    const equippedWeapons = character.inventory.equippedWeapons || {};
    const isCurrentlyEquipped = equippedWeapons[weaponId] === true;
    
    return {
        ...character,
        inventory: {
            ...character.inventory,
            equippedWeapons: {
                ...equippedWeapons,
                [weaponId]: !isCurrentlyEquipped
            }
        }
    };
}

/**
 * Toggle item equipped state.
 */
export function toggleItemEquipped(character: Character, itemId: string): Character {
    const equippedItems = character.inventory.equippedItems || {};
    const isCurrentlyEquipped = equippedItems[itemId] === true;
    
    return {
        ...character,
        inventory: {
            ...character.inventory,
            equippedItems: {
                ...equippedItems,
                [itemId]: !isCurrentlyEquipped
            }
        }
    };
}

/**
 * Toggle armor equipped state with layering validation.
 * If equipping, validates against layering rules.
 * If unequipping, simply marks as unequipped.
 */
export function toggleArmorEquipped(
    character: Character,
    armorId: string,
    armorData: Armor[]
): Character {
    const equippedArmor = character.inventory.equippedArmor || {};
    const isCurrentlyEquipped = equippedArmor[armorId] === true;
    
    if (isCurrentlyEquipped) {
        return {
            ...character,
            inventory: {
                ...character.inventory,
                equippedArmor: {
                    ...equippedArmor,
                    [armorId]: false
                }
            }
        };
    } else {
        return validateArmorEquip(character, armorId, armorData);
    }
}

export function toPennies(currency: Currency): number {
    return (currency.gc * 240) + (currency.ss * 12) + currency.bp;
}

export function equilibrateCurrency(currency: Currency): Currency {
    const totalPennies = toPennies(currency);
    const gc = Math.floor(totalPennies / 240);
    const ss = Math.floor((totalPennies % 240) / 12);
    const bp = totalPennies % 12;
    return { gc, ss, bp };
}
