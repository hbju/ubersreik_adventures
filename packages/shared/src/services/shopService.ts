import type { TypedSupabaseClient } from '../lib/supabase';
import type { Database, Json } from '../types/database.types';
import { ErrorCode, failure, success, type ServiceResult } from '../types/errors';
import { mapSupabaseError } from './baseService';

// --- Types ---

type ShopRow = Database['public']['Tables']['shop_definitions']['Row'];
type ShopInsert = Database['public']['Tables']['shop_definitions']['Insert'];
type ShopUpdate = Database['public']['Tables']['shop_definitions']['Update'];

export type { ShopRow, ShopInsert, ShopUpdate };

// --- Service Functions ---

/**
 * Get all shops for a campaign.
 */
export async function getShops(
  client: TypedSupabaseClient,
  campaignId: string
): Promise<ServiceResult<ShopRow[]>> {
  const { data, error } = await client
    .from('shop_definitions')
    .select('*')
    .eq('campaign_id', campaignId);

  if (error) return mapSupabaseError<ShopRow[]>(error);
  return success((data ?? []) as ShopRow[]);
}

/**
 * Get a single shop by ID.
 */
export async function getShopById(
  client: TypedSupabaseClient,
  shopId: string
): Promise<ServiceResult<ShopRow>> {
  const { data, error } = await client
    .from('shop_definitions')
    .select('*')
    .eq('id', shopId)
    .single();

  if (error) return mapSupabaseError<ShopRow>(error);
  return success(data as ShopRow);
}

/**
 * Create a new shop.
 */
export async function createShop(
  client: TypedSupabaseClient,
  campaignId: string,
  shopData: Omit<ShopInsert, 'campaign_id'>
): Promise<ServiceResult<ShopRow>> {
  const { data, error } = await client
    .from('shop_definitions')
    .insert({ ...shopData, campaign_id: campaignId })
    .select()
    .single();

  if (error) return mapSupabaseError<ShopRow>(error);
  return success(data as ShopRow);
}

/**
 * Update a shop's metadata.
 */
export async function updateShop(
  client: TypedSupabaseClient,
  shopId: string,
  updates: ShopUpdate
): Promise<ServiceResult<ShopRow>> {
  const { data, error } = await client
    .from('shop_definitions')
    .update(updates)
    .eq('id', shopId)
    .select()
    .single();

  if (error) return mapSupabaseError<ShopRow>(error);
  return success(data as ShopRow);
}

/**
 * Delete a shop.
 */
export async function deleteShop(
  client: TypedSupabaseClient,
  shopId: string
): Promise<ServiceResult<void>> {
  const { error } = await client
    .from('shop_definitions')
    .delete()
    .eq('id', shopId);

  if (error) return mapSupabaseError<void>(error);
  return success(undefined as void);
}

/**
 * Replace the entire inventory JSONB for a shop.
 */
export async function updateInventory(
  client: TypedSupabaseClient,
  shopId: string,
  inventory: Json
): Promise<ServiceResult<ShopRow>> {
  const { data, error } = await client
    .from('shop_definitions')
    .update({ inventory })
    .eq('id', shopId)
    .select()
    .single();

  if (error) return mapSupabaseError<ShopRow>(error);
  return success(data as ShopRow);
}

/**
 * Remove a single item from a shop's inventory by index.
 * Fetches current inventory, splices the item, writes back.
 */
export async function removeInventoryItem(
  client: TypedSupabaseClient,
  shopId: string,
  itemIndex: number
): Promise<ServiceResult<ShopRow>> {
  const { data: shop, error: fetchError } = await client
    .from('shop_definitions')
    .select('inventory')
    .eq('id', shopId)
    .single();

  if (fetchError) return mapSupabaseError<ShopRow>(fetchError);

  const inventory = (shop as { inventory: Json }).inventory;
  if (!Array.isArray(inventory)) {
    return failure<ShopRow>(ErrorCode.VALIDATION_ERROR, 'Inventory is not an array');
  }

  if (itemIndex < 0 || itemIndex >= inventory.length) {
    return failure<ShopRow>(
      ErrorCode.VALIDATION_ERROR,
      `Item index ${itemIndex} out of bounds (0-${inventory.length - 1})`
    );
  }

  const updated = [...inventory];
  updated.splice(itemIndex, 1);

  const { data, error } = await client
    .from('shop_definitions')
    .update({ inventory: updated as Json })
    .eq('id', shopId)
    .select()
    .single();

  if (error) return mapSupabaseError<ShopRow>(error);
  return success(data as ShopRow);
}
