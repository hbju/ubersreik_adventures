import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { getCampaignsForUser, getSupabaseClient, type Campaign } from '@wfrp/shared'
import { LAST_CAMPAIGN_STORAGE_KEY } from '../constants'
import { useAuth } from '../context/AuthContext'
import { PlayerModalProvider } from '../context/PlayerModalContext'
import { PlayerNavigationProvider } from '../context/PlayerNavigationContext'
import { PlayerSessionProvider } from '../context/PlayerSessionContext'
import { PlayerLayout } from '../components/layout/PlayerLayout'
import { PlayerModalHost } from '../components/layout/PlayerModalHost'

export function PlayerCampaignHome() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { user } = useAuth()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [denied, setDenied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (campaignId) {
      localStorage.setItem(LAST_CAMPAIGN_STORAGE_KEY, campaignId)
    }
  }, [campaignId])

  useEffect(() => {
    if (!user?.id || !campaignId) return
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setDenied(false)
      try {
        const client = getSupabaseClient()
        const r = await getCampaignsForUser(client, user.id)
        const list = r.data ?? []
        const found = list.find((c) => c.id === campaignId)
        if (cancelled) return
        if (!found) {
          setDenied(true)
          setCampaign(null)
        } else {
          setCampaign(found)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [user?.id, campaignId])

  if (!campaignId) {
    return <Navigate to="/campaigns" replace />
  }

  if (denied) {
    return <Navigate to="/campaigns" replace />
  }

  if (loading || !campaign) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center p-4">
        <div className="card parchment mx-auto max-w-lg w-full text-center">
          <p className="mb-0 text-[var(--color-ink-faded)]">Loading campaign…</p>
        </div>
      </div>
    )
  }

  return (
    <PlayerSessionProvider campaignId={campaign.id} campaignName={campaign.name}>
      <PlayerModalProvider>
        <PlayerNavigationProvider>
          <PlayerLayout />
          <PlayerModalHost />
        </PlayerNavigationProvider>
      </PlayerModalProvider>
    </PlayerSessionProvider>
  )
}
