import { createContext, useContext, useMemo, type ReactNode } from 'react'
import {
  createServiceContext,
  getSupabaseClient,
  usePlayerData,
  type ServiceContext,
} from '@wfrp/shared'
import { useAuth } from './AuthContext'

export interface PlayerSessionContextValue {
  campaignId: string
  campaignName: string
  serviceContext: ServiceContext
  playerData: ReturnType<typeof usePlayerData>
}

const PlayerSessionContext = createContext<PlayerSessionContextValue | null>(null)

interface Props {
  campaignId: string
  campaignName: string
  children: ReactNode
}

export function PlayerSessionProvider({ campaignId, campaignName, children }: Props) {
  const { user } = useAuth()

  const serviceContext = useMemo(() => {
    if (!user?.id) return null
    const client = getSupabaseClient()
    return createServiceContext(client, campaignId, user.id)
  }, [campaignId, user?.id])

  const playerData = usePlayerData({
    serviceContext,
    username: user?.user_metadata?.display_name ?? user?.email ?? null,
  })

  if (!serviceContext) return null

  return (
    <PlayerSessionContext.Provider
      value={{ campaignId, campaignName, serviceContext, playerData }}
    >
      {children}
    </PlayerSessionContext.Provider>
  )
}

export function usePlayerSession(): PlayerSessionContextValue {
  const ctx = useContext(PlayerSessionContext)
  if (!ctx) {
    throw new Error('usePlayerSession must be used within PlayerSessionProvider')
  }
  return ctx
}
