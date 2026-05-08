import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Character,
  Json,
  ShopDefinition,
  ShopInventoryState,
  ShopState,
} from '@wfrp/shared';
import {
  createShop as svcCreateShop,
  deleteShop as svcDeleteShop,
  getShops as svcGetShops,
  updateInventory as svcUpdateInventory,
  updateShop as svcUpdateShop,
  type ShopRow,
} from '@wfrp/shared';
import { useAppContext } from '../context/AppContext';

function rowToDefinition(row: ShopRow): ShopDefinition {
  return {
    id: row.id,
    name: row.name,
    locationId: row.location_id ?? '',
    category: row.category as ShopDefinition['category'],
    baseStock: row.base_stock ?? [],
  };
}

function rowToState(row: ShopRow): ShopState {
  return {
    shopId: row.id,
    lastRestockDate: row.last_restock_date ?? row.updated_at,
    inventory: (Array.isArray(row.inventory) ? row.inventory : []) as ShopState['inventory'],
    playerAccess: row.player_access ?? [],
  };
}

function getLatestRestock(rows: ShopRow[]): string {
  const values = rows.map((r) => r.last_restock_date ?? r.updated_at).filter(Boolean);
  return values.sort().at(-1) ?? new Date().toISOString();
}

function definitionToInsert(shop: ShopDefinition) {
  return {
    id: shop.id,
    name: shop.name,
    location_id: shop.locationId || null,
    category: shop.category,
    base_stock: shop.baseStock,
    inventory: [] as Json,
    player_access: [] as string[],
    is_custom: true,
  };
}

function definitionToUpdate(shop: ShopDefinition) {
  return {
    name: shop.name,
    location_id: shop.locationId || null,
    category: shop.category,
    base_stock: shop.baseStock,
    is_custom: true,
  };
}

export function useShops() {
  const { serviceContext } = useAppContext();
  const [shopRows, setShopRows] = useState<ShopRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchShops = useCallback(async () => {
    if (!serviceContext) return;
    setIsLoading(true);
    setError(null);
    const result = await svcGetShops(serviceContext.client, serviceContext.campaignId);
    if (result.error) {
      setError(result.error.message);
      setIsLoading(false);
      return;
    }
    setShopRows(result.data);
    setIsLoading(false);
  }, [serviceContext]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  const shopDefinitions = useMemo(
    () => shopRows.map(rowToDefinition),
    [shopRows]
  );

  const shopInventory = useMemo<ShopInventoryState>(() => {
    const shops: Record<string, ShopState> = {};
    shopRows.forEach((row) => {
      shops[row.id] = rowToState(row);
    });
    return {
      shops,
      lastGlobalRestock: getLatestRestock(shopRows),
    };
  }, [shopRows]);

  const upsertShop = useCallback(async (shop: ShopDefinition) => {
    if (!serviceContext) return;
    setIsMutating(true);
    const existing = shopRows.find((r) => r.id === shop.id);
    const result = existing
      ? await svcUpdateShop(serviceContext.client, shop.id, definitionToUpdate(shop))
      : await svcCreateShop(serviceContext.client, serviceContext.campaignId, definitionToInsert(shop));

    if (result.error) {
      setError(result.error.message);
      setIsMutating(false);
      return result;
    }
    setShopRows((prev) => {
      const index = prev.findIndex((r) => r.id === result.data.id);
      if (index < 0) return [...prev, result.data];
      return prev.map((r) => (r.id === result.data.id ? result.data : r));
    });
    setError(null);
    setIsMutating(false);
    return result;
  }, [serviceContext, shopRows]);

  const deleteShop = useCallback(async (shopId: string) => {
    if (!serviceContext) return;
    setIsMutating(true);
    const result = await svcDeleteShop(serviceContext.client, shopId);
    if (result.error) {
      setError(result.error.message);
      setIsMutating(false);
      return result;
    }
    setShopRows((prev) => prev.filter((r) => r.id !== shopId));
    setError(null);
    setIsMutating(false);
    return result;
  }, [serviceContext]);

  const updateShopState = useCallback(async (shopId: string, state: ShopState) => {
    if (!serviceContext) return;
    const previousRows = shopRows;
    const currentRow = shopRows.find((r) => r.id === shopId);
    if (!currentRow) return;

    // Optimistic local update while the two writes are in-flight.
    const optimisticRow: ShopRow = {
      ...currentRow,
      inventory: state.inventory as unknown as Json,
      player_access: state.playerAccess,
      last_restock_date: state.lastRestockDate,
    };
    setShopRows((prev) => prev.map((r) => (r.id === shopId ? optimisticRow : r)));
    setIsMutating(true);

    const [inventoryResult, metadataResult] = await Promise.all([
      svcUpdateInventory(serviceContext.client, shopId, state.inventory as unknown as Json),
      svcUpdateShop(serviceContext.client, shopId, {
        player_access: state.playerAccess,
        last_restock_date: state.lastRestockDate,
      }),
    ]);

    if (inventoryResult.error) {
      setError(inventoryResult.error.message);
      setShopRows(previousRows);
      setIsMutating(false);
      return inventoryResult;
    }
    if (metadataResult.error) {
      setError(metadataResult.error.message);
      setShopRows(previousRows);
      setIsMutating(false);
      return metadataResult;
    }

    const mergedRow: ShopRow = {
      ...metadataResult.data,
      inventory: inventoryResult.data.inventory,
    };
    setShopRows((prev) => prev.map((r) => (r.id === shopId ? mergedRow : r)));
    setError(null);
    setIsMutating(false);
    return metadataResult;
  }, [serviceContext, shopRows]);

  const updateInventoryState = useCallback(async (inventory: ShopInventoryState) => {
    if (!serviceContext) return;
    const previousRows = shopRows;
    const optimisticRows = shopRows.map((row) => {
      const nextState = inventory.shops[row.id];
      if (!nextState) return row;
      return {
        ...row,
        inventory: nextState.inventory as unknown as Json,
        player_access: nextState.playerAccess,
        last_restock_date: nextState.lastRestockDate,
      };
    });
    setShopRows(optimisticRows);
    setIsMutating(true);

    const updates = Object.entries(inventory.shops).map(async ([shopId, state]) => {
      const [inventoryResult, metadataResult] = await Promise.all([
        svcUpdateInventory(serviceContext.client, shopId, state.inventory as unknown as Json),
        svcUpdateShop(serviceContext.client, shopId, {
          player_access: state.playerAccess,
          last_restock_date: state.lastRestockDate,
        }),
      ]);
      if (inventoryResult.error) return inventoryResult.error.message;
      if (metadataResult.error) return metadataResult.error.message;
      return null;
    });

    const errors = await Promise.all(updates);
    const firstError = errors.find(Boolean);
    if (firstError) {
      setShopRows(previousRows);
      setError(firstError);
      setIsMutating(false);
      return false;
    }

    setError(null);
    setIsMutating(false);
    return true;
  }, [serviceContext, shopRows]);

  /** Legacy Socket.io broadcast removed — Supabase Realtime syncs shop_definitions to players. */
  const broadcastShopState = useCallback((_characters: Character[]) => {}, []);

  return {
    shopDefinitions,
    shopInventory,
    isLoading,
    isMutating,
    error,
    fetchShops,
    upsertShop,
    deleteShop,
    updateShopState,
    updateInventoryState,
    broadcastShopState,
  };
}
