/**
 * Supabase Manager for GM App Electron Main Process.
 * Handles client initialization, authentication, and campaign state.
 */
import { supabase } from '@wfrp/shared';
const { initSupabase, getSupabase } = supabase;

let currentCampaignId: string | null = null;

// ─── Initialization ─────────────────────────────────────────────────────────

/**
 * Initialize the Supabase client using env variables.
 * Must be called once at app startup before any Supabase operations.
 */
export function initializeSupabase(): void {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

  if (!url || !key) {
    console.warn('[SUPABASE] Missing SUPABASE_URL or SUPABASE_ANON_KEY. Supabase features disabled.' + "\n url: " + (url ? url : 'missing') + "\n key: " + (key ? '[REDACTED]' : 'missing'));
    return;
  }

  initSupabase(url, key);
  console.log('[SUPABASE] Client initialized');
}

/**
 * Check if the Supabase client has been initialized.
 */
export function isSupabaseInitialized(): boolean {
  try {
    getSupabase();
    return true;
  } catch {
    return false;
  }
}

// ─── Authentication ─────────────────────────────────────────────────────────

/**
 * Sign in with email and password via Supabase Auth.
 */
export async function signIn(email: string, password: string) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  console.log(`[SUPABASE] Signed in as ${data.user?.email}`);
  return { user: data.user, session: data.session };
}

/**
 * Sign up a new account via Supabase Auth.
 */
export async function signUp(email: string, password: string) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  console.log(`[SUPABASE] Signed up: ${data.user?.email}`);
  return { user: data.user, session: data.session };
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  const sb = getSupabase();
  const { error } = await sb.auth.signOut();
  if (error) throw error;
  currentCampaignId = null;
  console.log('[SUPABASE] Signed out');
}

/**
 * Get the current authenticated user, or null.
 */
export async function getCurrentUser() {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

/**
 * Get the current Supabase session.
 */
export async function getSession() {
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

/**
 * Check if the user is currently authenticated.
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}

// ─── Campaign Management ────────────────────────────────────────────────────

export function getCurrentCampaignId(): string | null {
  return currentCampaignId;
}

export function setCurrentCampaignId(id: string | null): void {
  currentCampaignId = id;
  console.log(`[SUPABASE] Active campaign: ${id || 'none'}`);
}
