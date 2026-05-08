import React, { createContext, useContext } from 'react';
import { useMap } from '../hooks/useMap';

type MapContextValue = ReturnType<typeof useMap>;

const MapContext = createContext<MapContextValue | null>(null);

export function useMapContext(): MapContextValue {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error('useMapContext must be used within MapProvider');
  return ctx;
}

export function MapProvider({ children }: { children: React.ReactNode }) {
  const value = useMap();
  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}
