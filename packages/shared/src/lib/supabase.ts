import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

export type TypedSupabaseClient = SupabaseClient<Database>;

let clientInstance: TypedSupabaseClient | null = null;

/**
 * Create a typed Supabase client.
 * If called multiple times with the same params, reuses the existing instance.
 */
export function createSupabaseClient(url: string, anonKey: string): TypedSupabaseClient {
  if (clientInstance) {
    return clientInstance;
  }

  clientInstance = createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  });

  return clientInstance;
}

/**
 * Get the existing Supabase client instance.
 * Throws if createSupabaseClient has not been called first.
 */
export function getSupabaseClient(): TypedSupabaseClient {
  if (!clientInstance) {
    throw new Error(
      'Supabase client not initialized. Call createSupabaseClient(url, anonKey) first.'
    );
  }
  return clientInstance;
}

/**
 * Reset the client instance (useful for testing or re-initialization).
 */
export function resetSupabaseClient(): void {
  clientInstance = null;
}
