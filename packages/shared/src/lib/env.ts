/**
 * Environment configuration for Supabase.
 * 
 * Both Vite apps (GM and Player) should define these in their .env files:
 *   VITE_SUPABASE_URL=https://your-project.supabase.co
 *   VITE_SUPABASE_ANON_KEY=your-anon-key
 * 
 * In Electron main process, use process.env directly.
 * In Vite renderer, use import.meta.env.
 */

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

/**
 * Read Supabase config from Vite environment variables (import.meta.env).
 * Use this in React renderer code.
 */
export function getSupabaseEnvFromVite(): SupabaseEnv {
  const url = (import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_URL;
  const anonKey = (import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.'
    );
  }

  return { url, anonKey };
}

/**
 * Read Supabase config from process.env (Node.js / Electron main process).
 * Use this in Electron main process code.
 */
export function getSupabaseEnvFromProcess(): SupabaseEnv {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your environment.'
    );
  }

  return { url, anonKey };
}
