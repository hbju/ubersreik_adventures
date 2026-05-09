import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import {
  createSupabaseClient,
  getSession,
  onAuthStateChange,
  signOut as supabaseSignOut,
} from '@wfrp/shared'

export type AuthContextValue = {
  configured: boolean
  loading: boolean
  session: Session | null
  user: User | null
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const url = import.meta.env.VITE_SUPABASE_URL ?? ''
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
  const configured = Boolean(url?.trim() && key?.trim())

  useEffect(() => {
    if (!configured) {
      setLoading(false)
      return
    }

    createSupabaseClient(url.trim(), key.trim())

    let cancelled = false
    getSession().then((s) => {
      if (!cancelled) {
        setSession(s)
        setLoading(false)
      }
    })

    const sub = onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })

    return () => {
      cancelled = true
      sub.unsubscribe()
    }
  }, [configured, url, key])

  const logout = useCallback(async () => {
    await supabaseSignOut()
    setSession(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      loading,
      session,
      user: session?.user ?? null,
      logout,
    }),
    [configured, loading, session, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
