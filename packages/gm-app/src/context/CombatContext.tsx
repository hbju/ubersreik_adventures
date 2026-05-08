import React, { createContext, useContext } from 'react';
import { useCombat } from '../hooks/useCombat';

type CombatContextValue = ReturnType<typeof useCombat>;

const CombatContext = createContext<CombatContextValue | null>(null);

export function useCombatContext(): CombatContextValue {
  const ctx = useContext(CombatContext);
  if (!ctx) throw new Error('useCombatContext must be used within CombatProvider');
  return ctx;
}

export function CombatProvider({ children }: { children: React.ReactNode }) {
  const value = useCombat();
  return <CombatContext.Provider value={value}>{children}</CombatContext.Provider>;
}
