import { Character, Currency, Weapon, Armor, Item } from '../types/wfrp.types';
import { default as ItemData } from '../data/items.json';
import { default as ArmorData } from '../data/armor.json';
import { default as WeaponData } from '../data/weapons.json';

const armors = Object.groupBy(ArmorData as Armor[], a => a.id)
const weapons = Object.groupBy(WeaponData as Weapon[], w => w.id);
const items = Object.groupBy(ItemData as Item[], i => i.id);

export function calculateTotalEncumbrance(character: Character): number {
  const armorEnc = character.inventory.armor.reduce((sum, item) => sum + (armors[item]?.[0]?.enc || 0), 0);
  const weaponEnc = character.inventory.weapons.reduce((sum, item) => sum + (weapons[item]?.[0]?.enc || 0), 0);
  const itemEnc = character.inventory.items.reduce((sum, item) => sum + (items[item]?.[0]?.enc || 0), 0);
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
