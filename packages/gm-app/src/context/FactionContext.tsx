import React, { createContext, useContext } from 'react';
import { useFactions } from '../hooks/useFactions';

type FactionContextValue = ReturnType<typeof useFactions>;

const FactionContext = createContext<FactionContextValue | null>(null);

export function useFactionContext(): FactionContextValue {
  const ctx = useContext(FactionContext);
  if (!ctx) throw new Error('useFactionContext must be used within FactionProvider');
  return ctx;
}

export function FactionProvider({ children }: { children: React.ReactNode }) {
  const value = useFactions();
  return <FactionContext.Provider value={value}>{children}</FactionContext.Provider>;
}
