import React, { createContext, useContext } from 'react';
import { useQuests } from '../hooks/useQuests';

type QuestContextValue = ReturnType<typeof useQuests>;

const QuestContext = createContext<QuestContextValue | null>(null);

export function useQuestContext(): QuestContextValue {
  const ctx = useContext(QuestContext);
  if (!ctx) throw new Error('useQuestContext must be used within QuestProvider');
  return ctx;
}

export function QuestProvider({ children }: { children: React.ReactNode }) {
  const value = useQuests();
  return <QuestContext.Provider value={value}>{children}</QuestContext.Provider>;
}
