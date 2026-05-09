import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LanguageSwitcher,
  getCampaignsForUser,
  getCharacters,
  getSupabaseClient,
  joinCampaignWithCode,
  type Campaign,
} from '@wfrp/shared'
import { LAST_CAMPAIGN_STORAGE_KEY } from '../constants'
import { useAuth } from '../context/AuthContext'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type CampaignRow = {
  campaign: Campaign
  gmDisplayName: string
  characterName: string | null
}

export function CampaignListScreen() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [rows, setRows] = useState<CampaignRow[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [joinCampaignId, setJoinCampaignId] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joinBusy, setJoinBusy] = useState(false)
  const [joinMessage, setJoinMessage] = useState<string | null>(null)

  const loadRows = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setListError(null)
    try {
      const client = getSupabaseClient()
      const cr = await getCampaignsForUser(client, user.id)
      if (cr.error || cr.data == null) {
        setListError(cr.error?.message ?? 'Could not load campaigns')
        setRows([])
        return
      }

      const campaigns = cr.data
      const gmIds = [...new Set(campaigns.map((c) => c.gm_user_id))]
      const { data: profiles } = await client.from('profiles').select('id, display_name').in('id', gmIds)
      const gmMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.display_name as string]))

      const next: CampaignRow[] = []
      for (const c of campaigns) {
        const ch = await getCharacters(client, c.id, { userId: user.id })
        const mine = ch.data?.find((row) => row.user_id === user.id)
        next.push({
          campaign: c,
          gmDisplayName: gmMap[c.gm_user_id] ?? '—',
          characterName: mine?.name ?? null,
        })
      }
      setRows(next)
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : 'Could not load campaigns')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  useEffect(() => {
    const fromQuery = searchParams.get('join') ?? searchParams.get('campaign')
    if (fromQuery) {
      setJoinCampaignId(fromQuery.trim())
    }
  }, [searchParams])

  async function handleJoin(e: FormEvent) {
    e.preventDefault()
    setJoinMessage(null)
    const id = joinCampaignId.trim()
    if (!UUID_RE.test(id)) {
      setJoinMessage('Enter a valid campaign ID (UUID).')
      return
    }
    if (!joinCode.trim()) {
      setJoinMessage('Enter the join code from your GM.')
      return
    }
    setJoinBusy(true)
    try {
      const client = getSupabaseClient()
      const result = await joinCampaignWithCode(client, id, joinCode)
      if (result.error) {
        setJoinMessage(result.error.message)
        return
      }
      setJoinMessage('Joined successfully.')
      setJoinCode('')
      await loadRows()
    } finally {
      setJoinBusy(false)
    }
  }

  function enterCampaign(c: Campaign) {
    localStorage.setItem(LAST_CAMPAIGN_STORAGE_KEY, c.id)
    navigate(`/play/${c.id}`)
  }

  return (
    <div className="w-full max-w-2xl px-4">
      <div className="card parchment text-left">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mb-1 border-0 pb-0 text-2xl">{t('campaign.selectorTitle')}</h1>
            <p className="mb-0 text-sm text-[var(--color-ink-faded)]">
              {user?.email ? (
                <span>{t('campaign.welcomeBack', { name: user.email })}</span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher />
            <button type="button" className="min-h-[40px] px-3 py-2 text-sm" onClick={() => void logout()}>
              {t('auth.logout')}
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-[var(--color-ink-faded)]">{t('campaign.loading')}</p>
        ) : listError ? (
          <p className="text-[var(--color-blood-red-dark)]">{listError}</p>
        ) : rows.length === 0 ? (
          <div className="mb-6 rounded border border-[var(--color-leather-light)] bg-[var(--color-parchment-dark)]/40 p-4">
            <p className="mb-2 font-semibold">No campaigns yet</p>
            <p className="mb-0 text-sm text-[var(--color-ink-faded)]">
              If your GM added you by email in the GM app, tap Refresh. To join with an invite code, use the form
              below (your GM must set a join code on the campaign).
            </p>
          </div>
        ) : (
          <ul className="mb-8 flex flex-col gap-3">
            {rows.map(({ campaign, gmDisplayName, characterName }) => (
              <li key={campaign.id}>
                <button
                  type="button"
                  className="w-full min-h-[52px] rounded border border-[var(--color-leather-medium)] bg-[var(--color-vellum)] px-4 py-3 text-left shadow-sm transition hover:border-[var(--color-gold)]"
                  onClick={() => enterCampaign(campaign)}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-heading text-lg text-[var(--color-ink)]">{campaign.name}</span>
                  </div>
                  <div className="mt-1 text-sm text-[var(--color-ink-faded)]">
                    GM: <strong className="text-[var(--color-ink)]">{gmDisplayName}</strong>
                    {' · '}
                    Character:{' '}
                    <strong className="text-[var(--color-ink)]">{characterName ?? 'Unassigned'}</strong>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mb-6 flex flex-wrap gap-2">
          <button type="button" className="min-h-[44px]" onClick={() => void loadRows()} disabled={loading}>
            Refresh list
          </button>
        </div>

        <div className="border-t border-[var(--color-leather-light)] pt-6">
          <h2 className="mb-2 mt-0 border-0 pb-0 text-xl">Join a campaign</h2>
          <p className="mb-4 text-sm text-[var(--color-ink-faded)]">
            Shareable link: append <code>?join=&lt;campaign-id&gt;</code> to this page’s URL to pre-fill the ID. You
            still need the join code from your GM unless they added you manually—then use Refresh.
          </p>
          <form className="flex flex-col gap-3" onSubmit={handleJoin}>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">Campaign ID</span>
              <input
                className="min-h-[44px] w-full font-mono text-sm"
                value={joinCampaignId}
                onChange={(ev) => setJoinCampaignId(ev.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                autoComplete="off"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">Join code</span>
              <input
                className="min-h-[44px] w-full"
                value={joinCode}
                onChange={(ev) => setJoinCode(ev.target.value)}
                placeholder="From your GM"
                autoComplete="off"
              />
            </label>
            {joinMessage ? (
              <p className="text-sm text-[var(--color-ink-faded)]">{joinMessage}</p>
            ) : null}
            <button type="submit" className="min-h-[48px] w-full sm:w-auto" disabled={joinBusy}>
              {joinBusy ? 'Joining…' : 'Join with code'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
