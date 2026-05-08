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
  supabase: TypedSupabaseClient;
  user: User | null;
  session: Session | null;
  currentCampaignId: string | null;
  serviceContext: ServiceContext | null;
  loading: boolean;
  selectCampaign: (campaignId: string) => void;
  clearCampaign: () => void;
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

  useEffect(() => {
    supabase.current.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

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
