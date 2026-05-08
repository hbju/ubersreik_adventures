import React, { createContext, useContext } from 'react';
import { useShops } from '../hooks/useShops';

type ShopContextValue = ReturnType<typeof useShops>;

const ShopContext = createContext<ShopContextValue | null>(null);

export function useShopContext(): ShopContextValue {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShopContext must be used within ShopProvider');
  return ctx;
}

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const value = useShops();
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}
