import type { TypedSupabaseClient } from '../lib/supabase';

export interface ServiceContext {
  client: TypedSupabaseClient;
  campaignId: string;
  userId: string;
}

export function createServiceContext(
  client: TypedSupabaseClient,
  campaignId: string,
  userId: string
): ServiceContext {
  return { client, campaignId, userId };
}
