import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

// NOTE: We intentionally use the untyped SupabaseClient here because the
// Database type in types.ts is a hand-written placeholder. Once the Supabase
// project is live, regenerate types with `supabase gen types typescript` and
// switch to `SupabaseClient<Database>` for full type-safety.
let supabaseInstance: SupabaseClient<Database> | null = null;

/**
 * Initialize the Supabase client. Must be called once at app startup
 * before any queries are made.
 */
export function initSupabase(supabaseUrl: string, supabaseAnonKey: string): SupabaseClient<Database> {
  supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      }
  });
  return supabaseInstance;
}

/**
 * Get the initialized Supabase client instance.
 * Throws if initSupabase() hasn't been called yet.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!supabaseInstance) {
    throw new Error('Supabase client not initialized. Call initSupabase() first.');
  }
  return supabaseInstance;
}

/**
 * Reset the Supabase client instance (useful for testing or re-initialization).
 */
export function resetSupabase(): void {
  supabaseInstance = null;
}

export type { SupabaseClient, Database };
