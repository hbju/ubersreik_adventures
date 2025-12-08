/**
 * Shop Generator Utility
 * Generates random shop inventory based on WFRP4e availability rules
 */

import {
  ShopDefinition,
  ShopInventoryItem,
  ShopState,
  ItemAvailability,
  ItemModification,
  Weapon,
  Armor,
  Item
} from '../types/wfrp.types';

// Availability chances for City tier (Ubersreik)
const AVAILABILITY_CHANCES: Record<ItemAvailability, number> = {
  'Common': 100,  // Always in stock
  'Scarce': 90,   // 90% chance
  'Rare': 45,     // 45% chance
  'Exotic': 0     // GM manual only
};

// Availability step adjustments
const AVAILABILITY_ORDER: ItemAvailability[] = ['Common', 'Scarce', 'Rare', 'Exotic'];

// Quantity dice by availability
const QUANTITY_DICE: Record<ItemAvailability, { max: number }> = {
  'Common': { max: 10 },  // 1d10
  'Scarce': { max: 5 },   // 1d5
  'Rare': { max: 2 },     // 1d2
  'Exotic': { max: 1 }    // 1
};

// Modification probabilities (total = 100%)
const MODIFICATION_CHANCES = {
  flawed: 20,   // 20% chance
  quality: 10,  // 10% chance
  standard: 70  // 70% chance
};

const MODIFICATIONS_IDS = ['durable', 'fine', 'lightweight', 'practical', 'ugly', 'shoddy', 'unreliable', 'bulky'];

/**
 * Generate a random number between 1 and max (inclusive)
 */
function rollDice(max: number): number {
  return Math.floor(Math.random() * max) + 1;
}

/**
 * Roll d100 (1-100)
 */
function rollD100(): number {
  return rollDice(100);
}

/**
 * Determine item modification (standard, quality, or flawed)
 */
function determineModification(): ItemModification {
  const roll = rollD100();
  if (roll <= MODIFICATION_CHANCES.flawed) {
    return 'flawed';
  } else if (roll <= MODIFICATION_CHANCES.flawed + MODIFICATION_CHANCES.quality) {
    return 'quality';
  }
  return 'standard';
}

/**
 * Adjust availability based on modification
 * Quality items are harder to find (step down)
 * Flawed items are easier to find (step up)
 */
function adjustAvailability(
  baseAvailability: ItemAvailability,
  modification: ItemModification
): ItemAvailability {
  const currentIndex = AVAILABILITY_ORDER.indexOf(baseAvailability);
  
  if (modification === 'quality') {
    // Harder to find - step down (towards Exotic)
    const newIndex = Math.min(currentIndex + 1, AVAILABILITY_ORDER.length - 1);
    return AVAILABILITY_ORDER[newIndex];
  } else if (modification === 'flawed') {
    // Easier to find - step up (towards Common)
    const newIndex = Math.max(currentIndex - 1, 0);
    return AVAILABILITY_ORDER[newIndex];
  }
  
  return baseAvailability;
}

/**
 * Parse a price string into brass pennies
 * Supports formats like: "1 GC", "10 S", "5 B", "1 GC 2 S 3 B"
 */
export function parsePriceToBrass(priceStr: string): number {
  if (!priceStr || priceStr === 'Varies' || priceStr === '-') {
    return 0;
  }

  let totalBrass = 0;
  
  // Handle complex price strings like "1 GC 2 S 3 B"
  const gcMatch = priceStr.match(/(\d+)\s*GC/i);
  const sMatch = priceStr.match(/(\d+)\s*S/i);
  const bMatch = priceStr.match(/(\d+)\s*B/i);
  
  if (gcMatch) {
    totalBrass += parseInt(gcMatch[1]) * 240; // 1 GC = 240 brass
  }
  if (sMatch) {
    totalBrass += parseInt(sMatch[1]) * 12; // 1 S = 12 brass
  }
  if (bMatch) {
    totalBrass += parseInt(bMatch[1]);
  }
  
  return totalBrass;
}

/**
 * Calculate modified price based on quality/flaw
 */
function calculatePrice(basePrice: number, modification: ItemModification): number {
  if (modification === 'quality') {
    return basePrice * 2; // Quality items cost double
  } else if (modification === 'flawed') {
    return Math.floor(basePrice / 2); // Flawed items cost half
  }
  return basePrice;
}

/**
 * Get random quality or flaw for an item based on its type
 */
function getRandomQualityOrFlaw(
  itemType: 'weapon' | 'armor' | 'item',
  isQuality: boolean,
  qualitiesFlawsData: Array<{ id: string; name: string; type: string; equipment: string }>
): string | null {
  // Filter qualities/flaws that apply to this item type
  const applicable = qualitiesFlawsData.filter(qf => {
    const matchesType = qf.type === (isQuality ? 'quality' : 'flaw');
    return matchesType && MODIFICATIONS_IDS.includes(qf.id);
  });
  
  if (applicable.length === 0) {
    return null;
  }
  
  const randomIndex = Math.floor(Math.random() * applicable.length);
  return applicable[randomIndex].id;
}

/**
 * Generate a name override for modified items
 */
function generateNameOverride(
  baseName: string,
  modification: ItemModification,
  qualities: string[],
  flaws: string[],
  qualitiesFlawsData: Array<{ id: string; name: string; type: string; equipment: string }>
): string | undefined {
  if (modification === 'standard') {
    return undefined;
  }

  return baseName;
  /** TODO better implement this later
  // Find the quality or flaw name
  if (modification === 'quality' && qualities.length > 0) {
    const qualityDef = qualitiesFlawsData.find(q => q.id === qualities[0]);
    if (qualityDef) {
      return `${qualityDef.name} ${baseName}`;
    }
  } else if (modification === 'flawed' && flaws.length > 0) {
    const flawDef = qualitiesFlawsData.find(f => f.id === flaws[0]);
    if (flawDef) {
      return `${flawDef.name} ${baseName}`;
    }
  }
  
  return modification === 'quality' ? `Fine ${baseName}` : `Flawed ${baseName}`;
  
   * 
   */
}

/**
 * Generate a unique instance ID
 */
function generateInstanceId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Normalize availability string to proper case
 */
function normalizeAvailability(availability: string | null | undefined): ItemAvailability {
  if (!availability) return 'Common';
  const lower = availability.toLowerCase();
  if (lower === 'common') return 'Common';
  if (lower === 'scarce') return 'Scarce';
  if (lower === 'rare') return 'Rare';
  if (lower === 'exotic') return 'Exotic';
  return 'Common';
}

/**
 * Determine the type of an item based on its properties
 */
function getItemType(item: Weapon | Armor | Item): 'weapon' | 'armor' | 'item' {
  if ('damage' in item && 'reach' in item) {
    return 'weapon';
  } else if ('ap' in item && 'locations' in item) {
    return 'armor';
  }
  return 'item';
}

export interface GeneratorData {
  weapons: Weapon[];
  armor: Armor[];
  items: Item[];
  qualitiesFlaws: Array<{ id: string; name: string; type: string; equipment: string }>;
}

/**
 * Generate daily stock for a single shop
 */
export function generateDailyStock(
  shop: ShopDefinition,
  gameData: GeneratorData
): ShopInventoryItem[] {
  const inventory: ShopInventoryItem[] = [];
  
  // Create lookup maps
  const weaponsById = new Map(gameData.weapons.map(w => [w.id, w]));
  const armorById = new Map(gameData.armor.map(a => [a.id, a]));
  const itemsById = new Map(gameData.items.map(i => [i.id, i]));
  
  for (const itemId of shop.baseStock) {
    // Find the base item
    let baseItem: Weapon | Armor | Item | undefined;
    let itemType: 'weapon' | 'armor' | 'item';
    
    if (weaponsById.has(itemId)) {
      baseItem = weaponsById.get(itemId);
      itemType = 'weapon';
    } else if (armorById.has(itemId)) {
      baseItem = armorById.get(itemId);
      itemType = 'armor';
    } else if (itemsById.has(itemId)) {
      baseItem = itemsById.get(itemId);
      itemType = 'item';
    } else {
      console.warn(`Item not found: ${itemId}`);
      continue;
    }
    
    if (!baseItem) continue;
    
    // Determine modification
    const modification = determineModification();
    
    // Get base availability and adjust for modification
    const baseAvailability = normalizeAvailability(baseItem.availability);
    const effectiveAvailability = adjustAvailability(baseAvailability, modification);
    
    // Roll for availability
    const availabilityChance = AVAILABILITY_CHANCES[effectiveAvailability];
    const availabilityRoll = rollD100();
    
    if (availabilityRoll > availabilityChance) {
      // Item not available today
      continue;
    }
    
    // Roll quantity
    const quantityDice = QUANTITY_DICE[effectiveAvailability];
    const quantity = rollDice(quantityDice.max);
    
    // Determine qualities/flaws
    const qualities: string[] = [];
    const flaws: string[] = [];
    
    if (modification === 'quality') {
      const quality = getRandomQualityOrFlaw(itemType, true, gameData.qualitiesFlaws);
      if (quality) qualities.push(quality);
    } else if (modification === 'flawed') {
      const flaw = getRandomQualityOrFlaw(itemType, false, gameData.qualitiesFlaws);
      if (flaw) flaws.push(flaw);
    }
    
    // Calculate price
    const basePriceInBrass = parsePriceToBrass(baseItem.price);
    const modifiedPrice = calculatePrice(basePriceInBrass, modification);
    
    // Generate name override
    const nameOverride = generateNameOverride(
      baseItem.name,
      modification,
      qualities,
      flaws,
      gameData.qualitiesFlaws
    );
    
    // Create inventory item
    const inventoryItem: ShopInventoryItem = {
      instanceId: generateInstanceId(),
      baseItemId: itemId,
      baseItemType: itemType,
      nameOverride,
      modification,
      qualities,
      flaws,
      basePrice: modifiedPrice,
      displayPrice: baseItem.price,
      quantity,
      isIdentified: false // Players see generic info by default
    };
    
    inventory.push(inventoryItem);
  }
  
  return inventory;
}

/**
 * Generate stock for all shops
 */
export function generateAllShopsStock(
  shops: ShopDefinition[],
  gameData: GeneratorData
): Record<string, ShopState> {
  const shopStates: Record<string, ShopState> = {};
  const now = new Date().toISOString();
  
  for (const shop of shops) {
    const inventory = generateDailyStock(shop, gameData);
    
    shopStates[shop.id] = {
      shopId: shop.id,
      lastRestockDate: now,
      inventory,
      playerAccess: [] // No players have access by default
    };
  }
  
  return shopStates;
}

/**
 * Format price in brass pennies to display string
 */
export function formatPriceFromBrass(brassPennies: number): string {
  if (brassPennies <= 0) return '0 B';
  
  const gc = Math.floor(brassPennies / 240);
  const remaining = brassPennies % 240;
  const ss = Math.floor(remaining / 12);
  const bp = remaining % 12;
  
  const parts: string[] = [];
  if (gc > 0) parts.push(`${gc} GC`);
  if (ss > 0) parts.push(`${ss} S`);
  if (bp > 0 || parts.length === 0) parts.push(`${bp} B`);
  
  return parts.join(' ');
}
