import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher, getCampaignsForUser, getSupabaseClient, type Campaign } from '@wfrp/shared'
import { LAST_CAMPAIGN_STORAGE_KEY } from '../constants'
import { useAuth } from '../context/AuthContext'

export function PlayerCampaignHome() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, logout } = useAuth()
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
      <div className="card parchment mx-auto max-w-lg w-full text-center">
        <p className="mb-0 text-[var(--color-ink-faded)]">{t('campaign.loading')}</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-3xl px-4">
      <div className="card parchment text-left">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mb-1 border-0 pb-0 text-2xl">{campaign.name}</h1>
            <p className="mb-0 text-sm text-[var(--color-ink-faded)]">
              Player session — full character and play UI will land here in later PBIs.
            </p>
          </div>
          <LanguageSwitcher />
        </header>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="min-h-[44px]" onClick={() => navigate('/campaigns')}>
            {t('campaign.selectorTitle')}
          </button>
          <button type="button" className="min-h-[44px]" onClick={() => void logout()}>
            {t('auth.logout')}
          </button>
        </div>
      </div>
    </div>
  )
}
