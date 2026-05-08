import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { TypedSupabaseClient } from '../lib/supabase';
import {
  broadcast as sendGenericBroadcast,
  createCampaignChannel,
  sendConditionTestRequest as sendCondition,
  sendGmRelay,
  sendOpposedTestRequest as sendOpposed,
  sendPing as sendPingMessage,
  sendPlayerRelay,
  sendRollWithIntent as sendRollIntent,
  sendTestResult as sendResult,
  type BroadcastEnvelope,
  type CampaignPresenceState,
  type CampaignPresenceTrackPayload,
  type ConditionTestRequestPayload,
  type GmRelayPayload,
  type OpposedTestRequestPayload,
  type PingPayload,
  type PlayerRelayPayload,
  type RollWithIntentPayload,
  type TestResultPayload,
  type EphemeralEventType,
} from '../lib/broadcast';
import type {
  ClientToServerMessage,
  RequestConditionTestMessage,
  RequestOpposedTestMessage,
  ServerToClientMessage,
} from '../types/messaging.types';

type ConnectionState = 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';

const LATENCY_EVENT_TYPES = new Set<EphemeralEventType>(['ping', 'test_result', 'roll_with_intent']);

interface BroadcastHandlers {
  onPing?: (envelope: BroadcastEnvelope<PingPayload>) => void;
  onOpposedTestRequest?: (envelope: BroadcastEnvelope<OpposedTestRequestPayload>) => void;
  onConditionTestRequest?: (envelope: BroadcastEnvelope<ConditionTestRequestPayload>) => void;
  onTestResult?: (envelope: BroadcastEnvelope<TestResultPayload>) => void;
  onRollWithIntent?: (envelope: BroadcastEnvelope<RollWithIntentPayload>) => void;
  onGmRelay?: (envelope: BroadcastEnvelope<GmRelayPayload>) => void;
  onPlayerRelay?: (envelope: BroadcastEnvelope<PlayerRelayPayload>) => void;
  onAnyMessage?: (envelope: BroadcastEnvelope<unknown>) => void;
}

export interface UseBroadcastParams {
  supabase: TypedSupabaseClient | null;
  campaignId: string | null;
  userId?: string | null;
  handlers?: BroadcastHandlers;
  presenceProfile?: CampaignPresenceTrackPayload | null;
}

function mergePresenceState(raw: Record<string, unknown>): Map<string, CampaignPresenceState> {
  const map = new Map<string, CampaignPresenceState>();
  for (const presences of Object.values(raw)) {
    if (!Array.isArray(presences)) continue;
    for (const entry of presences) {
      if (!entry || typeof entry !== 'object') continue;
      const p = entry as Record<string, unknown>;
      const uid = typeof p.userId === 'string' ? p.userId : null;
      if (!uid) continue;
      map.set(uid, {
        userId: uid,
        displayName: typeof p.displayName === 'string' ? p.displayName : 'Unknown',
        characterId: typeof p.characterId === 'string' ? p.characterId : null,
        role: p.role === 'gm' ? 'gm' : 'player',
        online_at: typeof p.online_at === 'string' ? p.online_at : new Date().toISOString(),
      });
    }
  }
  return map;
}

export function useBroadcast({
  supabase,
  campaignId,
  userId,
  handlers = {},
  presenceProfile = null,
}: UseBroadcastParams) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const handlersRef = useRef<BroadcastHandlers>(handlers);
  const presenceProfileRef = useRef<CampaignPresenceTrackPayload | null>(presenceProfile);
  const [connectionState, setConnectionState] = useState<ConnectionState>('DISCONNECTED');
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Map<string, CampaignPresenceState>>(() => new Map());

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    presenceProfileRef.current = presenceProfile;
  }, [presenceProfile]);

  useEffect(() => {
    if (!supabase || !campaignId) {
      setConnectionState('DISCONNECTED');
      setOnlineUsers(new Map());
      return undefined;
    }

    const channel = createCampaignChannel(supabase, campaignId);
    channelRef.current = channel;

    const handleEnvelope = <TPayload,>(
      envelope: BroadcastEnvelope<TPayload>,
      handler?: (envelope: BroadcastEnvelope<TPayload>) => void
    ) => {
      if (envelope.targetUserId && userId && envelope.targetUserId !== userId) return;
      if (
        LATENCY_EVENT_TYPES.has(envelope.eventType) &&
        envelope.senderUserId &&
        userId &&
        envelope.senderUserId === userId
      ) {
        setLastLatencyMs(Math.max(0, Date.now() - envelope.sentAt));
      }
      handlersRef.current.onAnyMessage?.(envelope as BroadcastEnvelope<unknown>);
      handler?.(envelope);
    };

    const syncPresenceFromChannel = () => {
      setOnlineUsers(mergePresenceState(channel.presenceState() as Record<string, unknown>));
    };

    channel
      .on('broadcast', { event: 'ping' }, ({ payload }) =>
        handleEnvelope(payload as BroadcastEnvelope<PingPayload>, handlersRef.current.onPing))
      .on('broadcast', { event: 'opposed_test_request' }, ({ payload }) =>
        handleEnvelope(payload as BroadcastEnvelope<OpposedTestRequestPayload>, handlersRef.current.onOpposedTestRequest))
      .on('broadcast', { event: 'condition_test_request' }, ({ payload }) =>
        handleEnvelope(payload as BroadcastEnvelope<ConditionTestRequestPayload>, handlersRef.current.onConditionTestRequest))
      .on('broadcast', { event: 'test_result' }, ({ payload }) =>
        handleEnvelope(payload as BroadcastEnvelope<TestResultPayload>, handlersRef.current.onTestResult))
      .on('broadcast', { event: 'roll_with_intent' }, ({ payload }) =>
        handleEnvelope(payload as BroadcastEnvelope<RollWithIntentPayload>, handlersRef.current.onRollWithIntent))
      .on('broadcast', { event: 'gm_relay' }, ({ payload }) =>
        handleEnvelope(payload as BroadcastEnvelope<GmRelayPayload>, handlersRef.current.onGmRelay))
      .on('broadcast', { event: 'player_relay' }, ({ payload }) =>
        handleEnvelope(payload as BroadcastEnvelope<PlayerRelayPayload>, handlersRef.current.onPlayerRelay))
      .on('presence', { event: 'sync' }, syncPresenceFromChannel)
      .on('presence', { event: 'join' }, syncPresenceFromChannel)
      .on('presence', { event: 'leave' }, syncPresenceFromChannel)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionState('CONNECTED');
          syncPresenceFromChannel();
          const profile = presenceProfileRef.current;
          if (profile) {
            await channel.track({
              ...profile,
              online_at: new Date().toISOString(),
            });
          }
        } else if (status === 'CLOSED') {
          setConnectionState('DISCONNECTED');
          setOnlineUsers(new Map());
        } else {
          setConnectionState('RECONNECTING');
        }
      });

    return () => {
      setConnectionState('DISCONNECTED');
      setOnlineUsers(new Map());
      supabase.removeChannel(channel);
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [campaignId, supabase, userId]);

  useEffect(() => {
    const ch = channelRef.current;
    if (!ch || connectionState !== 'CONNECTED') return;
    if (!presenceProfile) return;
    void ch.track({
      ...presenceProfile,
      online_at: new Date().toISOString(),
    });
  }, [connectionState, presenceProfile]);

  const sendPing = useCallback(async (
    mapId: string,
    position: { x: number; y: number },
    actorUserId?: string,
    color?: string
  ) => {
    if (!channelRef.current || !campaignId) return;
    return sendPingMessage(channelRef.current, campaignId, mapId, position, actorUserId ?? userId ?? undefined, color);
  }, [campaignId, userId]);

  const sendOpposedTestRequest = useCallback(async (
    targetUserId: string,
    testData: RequestOpposedTestMessage['payload'],
    senderUserId?: string
  ) => {
    if (!channelRef.current || !campaignId) return;
    return sendOpposed(channelRef.current, campaignId, targetUserId, testData, senderUserId ?? userId ?? undefined);
  }, [campaignId, userId]);

  const sendConditionTestRequest = useCallback(async (
    targetUserId: string,
    conditionData: RequestConditionTestMessage['payload'],
    senderUserId?: string
  ) => {
    if (!channelRef.current || !campaignId) return;
    return sendCondition(channelRef.current, campaignId, targetUserId, conditionData, senderUserId ?? userId ?? undefined);
  }, [campaignId, userId]);

  const sendTestResult = useCallback(async (resultData: TestResultPayload, senderUserId?: string) => {
    if (!channelRef.current || !campaignId) return;
    return sendResult(channelRef.current, campaignId, resultData, senderUserId ?? userId ?? undefined);
  }, [campaignId, userId]);

  const sendRollWithIntent = useCallback(async (rollData: RollWithIntentPayload, senderUserId?: string) => {
    if (!channelRef.current || !campaignId) return;
    return sendRollIntent(channelRef.current, campaignId, rollData, senderUserId ?? userId ?? undefined);
  }, [campaignId, userId]);

  const broadcast = useCallback(async (eventType: EphemeralEventType, payload: unknown, targetUserId?: string) => {
    if (!channelRef.current || !campaignId) return;
    const envelope: BroadcastEnvelope<unknown> = {
      eventType,
      campaignId,
      payload,
      targetUserId,
      senderUserId: userId ?? undefined,
      sentAt: Date.now(),
    };
    return sendGenericBroadcast(channelRef.current, eventType, envelope);
  }, [campaignId, userId]);

  const relayGmMessage = useCallback(async (message: ServerToClientMessage, targetUserId?: string) => {
    if (!channelRef.current || !campaignId) return;
    return sendGmRelay(channelRef.current, campaignId, message, {
      targetUserId,
      senderUserId: userId ?? undefined,
    });
  }, [campaignId, userId]);

  const relayPlayerMessage = useCallback(async (message: ClientToServerMessage) => {
    if (!channelRef.current || !campaignId) return;
    return sendPlayerRelay(channelRef.current, campaignId, message, userId ?? undefined);
  }, [campaignId, userId]);

  const isUserOnline = useCallback((targetUserId: string) => onlineUsers.has(targetUserId), [onlineUsers]);

  return useMemo(() => ({
    connectionState,
    lastLatencyMs,
    onlineUsers,
    isUserOnline,
    sendPing,
    sendOpposedTestRequest,
    sendConditionTestRequest,
    sendTestResult,
    sendRollWithIntent,
    broadcast,
    relayGmMessage,
    relayPlayerMessage,
  }), [
    broadcast,
    connectionState,
    isUserOnline,
    lastLatencyMs,
    onlineUsers,
    relayGmMessage,
    relayPlayerMessage,
    sendConditionTestRequest,
    sendOpposedTestRequest,
    sendPing,
    sendRollWithIntent,
    sendTestResult,
  ]);
}
