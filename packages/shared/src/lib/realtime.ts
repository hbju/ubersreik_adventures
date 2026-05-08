import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

export type RealtimeConnectionState = 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';
export type RealtimeTable = keyof Database['public']['Tables'];

export type TableChangePayload<TTable extends RealtimeTable> =
  RealtimePostgresChangesPayload<Database['public']['Tables'][TTable]['Row']>;

interface SubscribeToTableOptions<TTable extends RealtimeTable> {
  supabase: SupabaseClient<Database>;
  table: TTable;
  callback: (payload: TableChangePayload<TTable>) => void;
  filter?: string;
  onConnectionStateChange?: (state: RealtimeConnectionState) => void;
}

const RECONNECT_DELAY_MS = 1500;

export function subscribeToTable<TTable extends RealtimeTable>({
  supabase,
  table,
  callback,
  filter,
  onConnectionStateChange,
}: SubscribeToTableOptions<TTable>): () => void {
  let channel: RealtimeChannel | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const clearReconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const mapStatusToState = (status: string): RealtimeConnectionState => {
    if (status === 'SUBSCRIBED') return 'CONNECTED';
    if (status === 'CLOSED') return 'DISCONNECTED';
    return 'RECONNECTING';
  };

  const scheduleReconnect = () => {
    if (disposed || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (!disposed) {
        createSubscription();
      }
    }, RECONNECT_DELAY_MS);
  };

  const createSubscription = () => {
    if (disposed) return;
    clearReconnect();

    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }

    const channelName = `rt:${String(table)}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: String(table),
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          callback(payload as TableChangePayload<TTable>);
        }
      )
      .subscribe((status) => {
        onConnectionStateChange?.(mapStatusToState(status));
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          scheduleReconnect();
        }
      });
  };

  createSubscription();

  return () => {
    disposed = true;
    clearReconnect();
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
    onConnectionStateChange?.('DISCONNECTED');
  };
}

type SharedOptions = {
  supabase: SupabaseClient<Database>;
  campaignId: string;
  onConnectionStateChange?: (state: RealtimeConnectionState) => void;
};

export function onCharacterChange(
  options: SharedOptions,
  callback: (payload: TableChangePayload<'characters'>) => void
) {
  return subscribeToTable({
    supabase: options.supabase,
    table: 'characters',
    filter: `campaign_id=eq.${options.campaignId}`,
    callback,
    onConnectionStateChange: options.onConnectionStateChange,
  });
}

export function onQuestChange(
  options: SharedOptions,
  callback: (payload: TableChangePayload<'quests'>) => void
) {
  return subscribeToTable({
    supabase: options.supabase,
    table: 'quests',
    filter: `campaign_id=eq.${options.campaignId}`,
    callback,
    onConnectionStateChange: options.onConnectionStateChange,
  });
}

export function onJournalChange(
  options: SharedOptions,
  callback: (payload: TableChangePayload<'journal_entries'>) => void
) {
  return subscribeToTable({
    supabase: options.supabase,
    table: 'journal_entries',
    filter: `campaign_id=eq.${options.campaignId}`,
    callback,
    onConnectionStateChange: options.onConnectionStateChange,
  });
}

export function onFactionChange(
  options: SharedOptions,
  callback: (payload: TableChangePayload<'factions'>) => void
) {
  return subscribeToTable({
    supabase: options.supabase,
    table: 'factions',
    filter: `campaign_id=eq.${options.campaignId}`,
    callback,
    onConnectionStateChange: options.onConnectionStateChange,
  });
}

export function onMapChange(
  options: SharedOptions,
  callback: (payload: TableChangePayload<'maps'>) => void
) {
  return subscribeToTable({
    supabase: options.supabase,
    table: 'maps',
    filter: `campaign_id=eq.${options.campaignId}`,
    callback,
    onConnectionStateChange: options.onConnectionStateChange,
  });
}

export function onShopChange(
  options: SharedOptions,
  callback: (payload: TableChangePayload<'shop_definitions'>) => void
) {
  return subscribeToTable({
    supabase: options.supabase,
    table: 'shop_definitions',
    filter: `campaign_id=eq.${options.campaignId}`,
    callback,
    onConnectionStateChange: options.onConnectionStateChange,
  });
}

export function onCombatChange(
  options: SharedOptions,
  callback: (payload: TableChangePayload<'combat_state'>) => void
) {
  return subscribeToTable({
    supabase: options.supabase,
    table: 'combat_state',
    filter: `campaign_id=eq.${options.campaignId}`,
    callback,
    onConnectionStateChange: options.onConnectionStateChange,
  });
}

export function onCalendarChange(
  options: SharedOptions,
  callback: (payload: TableChangePayload<'campaigns'>) => void
) {
  return subscribeToTable({
    supabase: options.supabase,
    table: 'campaigns',
    filter: `id=eq.${options.campaignId}`,
    callback,
    onConnectionStateChange: options.onConnectionStateChange,
  });
}
