import type { AuthChangeEvent, Session, Subscription } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase';
import type { Tables, TablesUpdate } from '../types/database.types';

export type Profile = Tables<'profiles'>;

/**
 * Sign up a new user with email, password, and display name.
 * The display_name is passed as user metadata so the database trigger
 * (handle_new_user) can populate the profiles table automatically.
 */
export async function signUp(email: string, password: string, displayName: string) {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Sign in with email and password.
 */
export async function signIn(email: string, password: string) {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  const client = getSupabaseClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

/**
 * Get the current session, or null if not authenticated.
 */
export async function getSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

/**
 * Get the current authenticated user's ID, or null.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id ?? null;
}

/**
 * Fetch a user's profile from the profiles table.
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
}

/**
 * Update a user's profile.
 */
export async function updateProfile(
  userId: string,
  updates: Omit<TablesUpdate<'profiles'>, 'id' | 'created_at'>
): Promise<Profile> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Subscribe to auth state changes (sign in, sign out, token refresh).
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): Subscription {
  const client = getSupabaseClient();
  const { data } = client.auth.onAuthStateChange(callback);
  return data.subscription;
}
