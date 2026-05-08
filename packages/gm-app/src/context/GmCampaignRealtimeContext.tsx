import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import {
  useBroadcast,
  type PingPayload,
  type BroadcastEnvelope,
  type PlayerRelayPayload,
  type ClientToServerMessage,
} from '@wfrp/shared';
import { useAppContext } from './AppContext';
import { buildGmPresenceProfile } from '@/lib/gmPresenceProfile';

export type GmCampaignRealtimeContextValue = ReturnType<typeof useBroadcast> & {
  mapPingBridgeRef: React.MutableRefObject<{
    activeMapId: string;
    showMapPing: ((payload: PingPayload) => void) | null;
  }>;
  registerPlayerRelayHandler: (handler: (message: ClientToServerMessage) => void) => () => void;
};

const GmCampaignRealtimeContext = createContext<GmCampaignRealtimeContextValue | null>(null);

export function GmCampaignRealtimeProvider({ children }: { children: React.ReactNode }) {
  const { serviceContext, user } = useAppContext();

  const mapPingBridgeRef = useRef<{
    activeMapId: string;
    showMapPing: ((payload: PingPayload) => void) | null;
  }>({ activeMapId: '', showMapPing: null });

  const playerRelayHandlerRef = useRef<(message: ClientToServerMessage) => void>(() => {});

  const registerPlayerRelayHandler = useCallback((handler: (message: ClientToServerMessage) => void) => {
    playerRelayHandlerRef.current = handler;
    return () => {
      playerRelayHandlerRef.current = () => {};
    };
  }, []);

  const presenceProfile = useMemo(
    () => buildGmPresenceProfile(user ?? null, serviceContext?.campaignId ?? null),
    [serviceContext?.campaignId, user?.email, user?.id, user?.user_metadata],
  );

  const handlers = useMemo(
    () => ({
      onPing: (envelope: BroadcastEnvelope<PingPayload>) => {
        const ping = envelope.payload;
        if (ping.mapId !== mapPingBridgeRef.current.activeMapId) return;
        mapPingBridgeRef.current.showMapPing?.(ping);
      },
      onPlayerRelay: (envelope: BroadcastEnvelope<PlayerRelayPayload>) => {
        playerRelayHandlerRef.current(envelope.payload.message);
      },
    }),
    [],
  );

  const broadcastApi = useBroadcast({
    supabase: serviceContext?.client ?? null,
    campaignId: serviceContext?.campaignId ?? null,
    userId: user?.id ?? null,
    presenceProfile,
    handlers,
  });

  const value = useMemo(
    () => ({
      ...broadcastApi,
      mapPingBridgeRef,
      registerPlayerRelayHandler,
    }),
    [broadcastApi, registerPlayerRelayHandler],
  );

  return (
    <GmCampaignRealtimeContext.Provider value={value}>
      {children}
    </GmCampaignRealtimeContext.Provider>
  );
}

export function useGmCampaignRealtime(): GmCampaignRealtimeContextValue {
  const ctx = useContext(GmCampaignRealtimeContext);
  if (!ctx) {
    throw new Error('useGmCampaignRealtime must be used within GmCampaignRealtimeProvider');
  }
  return ctx;
}
