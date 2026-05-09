import { useMemo, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher, type Character } from '@wfrp/shared'

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const { t } = useTranslation()

  return (
    <div className="card parchment mx-auto max-w-md text-left">
      <h1 className="mb-4 text-center">{t('connection.title')}</h1>
      <p className="mb-6 text-center text-sm text-[var(--color-ink-faded)]">
        {t('connection.subtitle')}
      </p>
      <button type="button" className="w-full" onClick={onLogin}>
        {t('connection.connectButton')}
      </button>
    </div>
  )
}

function HomePage({ onLogout }: { onLogout: () => void }) {
  const { t } = useTranslation()
  const sample: Pick<Character, 'name'> = useMemo(
    () => ({ name: 'Shared types OK' }),
    [],
  )

  const supabaseReady =
    Boolean(import.meta.env.VITE_SUPABASE_URL?.length) &&
    Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY?.length)

  return (
    <div className="card parchment mx-auto max-w-lg text-left">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="mb-0 border-0 pb-0">{t('menu.session')}</h1>
        <LanguageSwitcher />
      </div>
      <p className="mb-2">
        <strong>{sample.name}</strong> — {t('common.cancel')}
      </p>
      <p className="mb-4 text-sm text-[var(--color-ink-faded)]">
        Supabase env: {supabaseReady ? 'variables set' : 'configure .env (see .env.example)'}
      </p>
      <button type="button" onClick={onLogout}>
        {t('common.back')}
      </button>
    </div>
  )
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  return (
    <BrowserRouter>
      <div id="app" className="w-full min-h-screen flex flex-col items-center justify-center p-6">
        <Routes>
          <Route
            path="/login"
            element={
              isAuthenticated ? (
                <Navigate to="/" replace />
              ) : (
                <LoginPage onLogin={() => setIsAuthenticated(true)} />
              )
            }
          />
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <HomePage onLogout={() => setIsAuthenticated(false)} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
