import type { RealtimeChannel } from '@supabase/supabase-js';
import type { TypedSupabaseClient } from './supabase';
import type {
  ClientToServerMessage,
  ConditionTestResultMessage,
  OpposedTestResultMessage,
  RequestConditionTestMessage,
  RequestOpposedTestMessage,
  RollWithIntentMessage,
  ServerToClientMessage,
} from '../types/messaging.types';

export type EphemeralEventType =
  | 'ping'
  | 'opposed_test_request'
  | 'condition_test_request'
  | 'test_result'
  | 'roll_with_intent'
  | 'combat_action_prompt'
  /** Wrapped Socket-era GM→player message */
  | 'gm_relay'
  /** Wrapped Socket-era player→GM message */
  | 'player_relay';

export interface BroadcastEnvelope<TPayload> {
  eventType: EphemeralEventType;
  campaignId: string;
  payload: TPayload;
  targetUserId?: string;
  senderUserId?: string;
  sentAt: number;
}

export type PingPayload = {
  mapId: string;
  position: { x: number; y: number };
  userId?: string;
  color?: string;
};

export type OpposedTestRequestPayload = {
  targetUserId: string;
  message: RequestOpposedTestMessage['payload'];
};

export type ConditionTestRequestPayload = {
  targetUserId: string;
  message: RequestConditionTestMessage['payload'];
};

export type TestResultPayload =
  | OpposedTestResultMessage['payload']
  | ConditionTestResultMessage['payload'];

export type RollWithIntentPayload = RollWithIntentMessage['payload'];

export type GmRelayPayload = {
  message: ServerToClientMessage;
};

export type PlayerRelayPayload = {
  message: ClientToServerMessage;
};

export type CampaignPresenceRole = 'gm' | 'player';

/** Payload tracked on the campaign ephemeral channel (Presence). */
export interface CampaignPresenceTrackPayload {
  userId: string;
  displayName: string;
  characterId: string | null;
  role: CampaignPresenceRole;
  online_at: string;
}

export type CampaignPresenceState = CampaignPresenceTrackPayload;

export function createCampaignChannel(
  supabase: TypedSupabaseClient,
  campaignId: string
): RealtimeChannel {
  return supabase.channel(`campaign:${campaignId}:ephemeral`, {
    config: {
      broadcast: { self: true, ack: false },
      presence: { key: '' },
    },
  });
}

export async function broadcast<TPayload>(
  channel: RealtimeChannel,
  eventType: EphemeralEventType,
  envelope: BroadcastEnvelope<TPayload>
): Promise<'ok' | 'timed out' | 'error'> {
  const status = await channel.send({
    type: 'broadcast',
    event: eventType,
    payload: envelope,
  });
  if (status === 'ok' || status === 'timed out' || status === 'error') {
    return status as 'ok' | 'timed out' | 'error';
  }
  return 'error';
}

export async function sendGmRelay(
  channel: RealtimeChannel,
  campaignId: string,
  message: ServerToClientMessage,
  opts?: { targetUserId?: string; senderUserId?: string }
) {
  return broadcast(channel, 'gm_relay', {
    eventType: 'gm_relay',
    campaignId,
    payload: { message },
    targetUserId: opts?.targetUserId,
    senderUserId: opts?.senderUserId,
    sentAt: Date.now(),
  });
}

export async function sendPlayerRelay(
  channel: RealtimeChannel,
  campaignId: string,
  message: ClientToServerMessage,
  senderUserId?: string
) {
  return broadcast(channel, 'player_relay', {
    eventType: 'player_relay',
    campaignId,
    payload: { message },
    senderUserId,
    sentAt: Date.now(),
  });
}

export async function sendPing(
  channel: RealtimeChannel,
  campaignId: string,
  mapId: string,
  position: { x: number; y: number },
  userId?: string,
  color?: string
) {
  return broadcast(channel, 'ping', {
    eventType: 'ping',
    campaignId,
    payload: { mapId, position, userId, color },
    senderUserId: userId,
    sentAt: Date.now(),
  });
}

export async function sendOpposedTestRequest(
  channel: RealtimeChannel,
  campaignId: string,
  targetUserId: string,
  testData: RequestOpposedTestMessage['payload'],
  senderUserId?: string
) {
  return broadcast(channel, 'opposed_test_request', {
    eventType: 'opposed_test_request',
    campaignId,
    payload: { targetUserId, message: testData },
    targetUserId,
    senderUserId,
    sentAt: Date.now(),
  });
}

export async function sendConditionTestRequest(
  channel: RealtimeChannel,
  campaignId: string,
  targetUserId: string,
  conditionData: RequestConditionTestMessage['payload'],
  senderUserId?: string
) {
  return broadcast(channel, 'condition_test_request', {
    eventType: 'condition_test_request',
    campaignId,
    payload: { targetUserId, message: conditionData },
    targetUserId,
    senderUserId,
    sentAt: Date.now(),
  });
}

export async function sendTestResult(
  channel: RealtimeChannel,
  campaignId: string,
  resultData: TestResultPayload,
  senderUserId?: string
) {
  return broadcast(channel, 'test_result', {
    eventType: 'test_result',
    campaignId,
    payload: resultData,
    senderUserId,
    sentAt: Date.now(),
  });
}

export async function sendRollWithIntent(
  channel: RealtimeChannel,
  campaignId: string,
  rollData: RollWithIntentPayload,
  senderUserId?: string
) {
  return broadcast(channel, 'roll_with_intent', {
    eventType: 'roll_with_intent',
    campaignId,
    payload: rollData,
    senderUserId,
    sentAt: Date.now(),
  });
}
