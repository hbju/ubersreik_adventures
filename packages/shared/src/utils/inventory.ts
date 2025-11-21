import { useGameData } from '..';
import { Character, Currency, Weapon, Armor, Item } from '../types/wfrp.types';


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

export function calculateTotalEncumbrance(character: Character): number {
    const { armors, weapons, items } = getItemsData();
    const armorEnc = Object.entries(character.inventory.armor).reduce((sum, [item, count]) => sum + ((armors[item]?.[0]?.enc || 0) * count), 0);
    const weaponEnc = Object.entries(character.inventory.weapons).reduce((sum, [item, count]) => sum + ((weapons[item]?.[0]?.enc || 0) * count), 0);
    const itemEnc = Object.entries(character.inventory.items).reduce((sum, [item, count]) => sum + ((items[item]?.[0]?.enc || 0) * count), 0);
    return armorEnc + weaponEnc + itemEnc;
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
