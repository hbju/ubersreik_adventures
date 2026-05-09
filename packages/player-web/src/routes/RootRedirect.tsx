import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { getCampaignsForUser, getSupabaseClient } from '@wfrp/shared'
import { ConfigMissing } from '../components/ConfigMissing'
import { LoadingCard } from '../components/LoadingCard'
import { LAST_CAMPAIGN_STORAGE_KEY } from '../constants'
import { useAuth } from '../context/AuthContext'

/**
 * Logged-in entry: resume last campaign if still valid, else single-campaign shortcut, else campaign list.
 */
export function RootRedirect() {
  const { configured, loading, session } = useAuth()
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!configured || loading) return

    if (!session?.user?.id) {
      setReady(true)
      return
    }

    let cancelled = false
    const client = getSupabaseClient()
    getCampaignsForUser(client, session.user.id)
      .then((r) => {
        if (cancelled) return
        const list = r.data ?? []
        const last = localStorage.getItem(LAST_CAMPAIGN_STORAGE_KEY)
        if (last && list.some((c) => c.id === last)) {
          navigate(`/play/${last}`, { replace: true })
        } else if (list.length === 1) {
          navigate(`/play/${list[0].id}`, { replace: true })
        } else {
          navigate('/campaigns', { replace: true })
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [configured, loading, session, navigate])

  if (!configured) {
    return <ConfigMissing />
  }
  if (loading) {
    return <LoadingCard />
  }
  if (!session) {
    return <Navigate to="/login" replace />
  }
  if (!ready) {
    return <LoadingCard />
  }
  return null
}
