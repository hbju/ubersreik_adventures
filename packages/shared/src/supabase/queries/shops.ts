/**
 * Shop CRUD queries
 */
import { getSupabase } from '../client';
import { assembleShopDefinition, assembleShopInventoryItem } from './assemblers';
import type { ShopDefinition, ShopInventoryItem, ShopState, ShopInventoryState } from '../../types/wfrp.types';

export async function getShopInventoryState(campaignId: string): Promise<ShopInventoryState> {
  const sb = getSupabase();
  const { data: shops, error: shopErr } = await sb.from('shop_definitions')
    .select('*, shop_inventory_items(*)')
    .eq('campaign_id', campaignId);
  if (shopErr) throw shopErr;

  const result: ShopInventoryState = {
    shops: {},
    lastGlobalRestock: new Date().toISOString(),
  };

  for (const shop of (shops ?? [])) {
    const def = assembleShopDefinition(shop);
    result.shops[def.id] = {
      shopId: def.id,
      lastRestockDate: new Date().toISOString(),
      inventory: (shop.shop_inventory_items ?? []).map(assembleShopInventoryItem),
      playerAccess: [],
    };
  }

  return result;
}

export async function getCustomShopDefinitions(campaignId: string): Promise<ShopDefinition[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from('shop_definitions')
    .select('*')
    .eq('campaign_id', campaignId);
  if (error) throw error;
  return (data ?? []).map(assembleShopDefinition);
}

export async function upsertShopDefinition(campaignId: string, shop: ShopDefinition) {
  const sb = getSupabase();
  const { data, error } = await sb.from('shop_definitions').upsert({
    campaign_id: campaignId,
    shop_key: shop.id,
    name: shop.name,
    location_id: shop.locationId || null,
    category: shop.category,
    is_custom: true,
    base_stock: shop.baseStock,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteShopDefinition(campaignId: string, shopKey: string) {
  const sb = getSupabase();
  const { error } = await sb.from('shop_definitions')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('shop_key', shopKey);
  if (error) throw error;
}

/**
 * Replace the entire inventory for a shop.
 */
export async function setShopInventory(shopDbId: string, campaignId: string, items: ShopInventoryItem[]) {
  const sb = getSupabase();

  // Delete existing
  await sb.from('shop_inventory_items').delete().eq('shop_id', shopDbId);

  if (items.length) {
    const { error } = await sb.from('shop_inventory_items').insert(
      items.map(item => ({
        shop_id: shopDbId,
        campaign_id: campaignId,
        base_item_id: item.baseItemId,
        base_item_type: item.baseItemType,
        name_override: item.nameOverride ?? null,
        modification: item.modification,
        qualities: item.qualities,
        flaws: item.flaws,
        base_price: item.basePrice,
        display_price: item.displayPrice || null,
        quantity: item.quantity,
        is_identified: item.isIdentified,
      }))
    );
    if (error) throw error;
  }
}

/**
 * Get filtered shop items for a player (hides unidentified qualities/flaws via RPC).
 */
export async function getShopInventoryForPlayer(shopDbId: string, campaignId: string): Promise<ShopInventoryItem[]> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('get_shop_inventory_for_player', {
    p_shop_id: shopDbId,
    p_campaign_id: campaignId,
  });
  if (error) throw error;
  return (data ?? []).map(assembleShopInventoryItem);
}
