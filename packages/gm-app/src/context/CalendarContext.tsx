import React, { createContext, useContext } from 'react';
import { useCalendar } from '../hooks/useCalendar';

type CalendarContextValue = ReturnType<typeof useCalendar>;

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function useCalendarContext(): CalendarContextValue {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error('useCalendarContext must be used within CalendarProvider');
  return ctx;
}

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const value = useCalendar();
  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}
