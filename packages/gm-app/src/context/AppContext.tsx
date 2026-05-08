import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  createSupabaseClient,
  getSupabaseEnvFromVite,
  createServiceContext,
  type TypedSupabaseClient,
  type ServiceContext,
} from '@wfrp/shared';
import type { User, Session } from '@supabase/supabase-js';

interface AppContextValue {
  /** Supabase client (always available after init) */
  supabase: TypedSupabaseClient;
  /** Current authenticated user, null if not logged in */
  user: User | null;
  /** Current Supabase session */
  session: Session | null;
  /** Selected campaign ID */
  currentCampaignId: string | null;
  /** Pre-built service context (available once user + campaign are set) */
  serviceContext: ServiceContext | null;
  /** True while restoring session on startup */
  loading: boolean;

  /** Set the active campaign */
  selectCampaign: (campaignId: string) => void;
  /** Clear campaign selection (go back to selector) */
  clearCampaign: () => void;
  /** Sign out and reset state */
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const env = useRef(getSupabaseEnvFromVite());
  const supabase = useRef(createSupabaseClient(env.current.url, env.current.anonKey));

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [currentCampaignId, setCurrentCampaignId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount + listen for auth changes
  useEffect(() => {
    // Get initial session
    supabase.current.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.current.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const selectCampaign = useCallback((campaignId: string) => {
    setCurrentCampaignId(campaignId);
  }, []);

  const clearCampaign = useCallback(() => {
    setCurrentCampaignId(null);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.current.auth.signOut();
    setCurrentCampaignId(null);
    setUser(null);
    setSession(null);
  }, []);

  // Build service context when user + campaign are both available
  const serviceContext = React.useMemo(() => {
    if (!user || !currentCampaignId) return null;
    return createServiceContext(supabase.current, currentCampaignId, user.id);
  }, [user, currentCampaignId]);

  const value: AppContextValue = {
    supabase: supabase.current,
    user,
    session,
    currentCampaignId,
    serviceContext,
    loading,
    selectCampaign,
    clearCampaign,
    signOut,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
