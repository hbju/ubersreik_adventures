import React, { createContext, useContext } from 'react';
import { useJournal } from '../hooks/useJournal';

type JournalContextValue = ReturnType<typeof useJournal>;

const JournalContext = createContext<JournalContextValue | null>(null);

export function useJournalContext(): JournalContextValue {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error('useJournalContext must be used within JournalProvider');
  return ctx;
}

export function JournalProvider({ children }: { children: React.ReactNode }) {
  const value = useJournal();
  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}
