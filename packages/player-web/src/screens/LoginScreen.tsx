import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher, signIn, signUp } from '@wfrp/shared'

type Mode = 'signin' | 'signup'

export function LoginScreen() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'signup') {
        const name = displayName.trim() || 'Player'
        await signUp(email.trim(), password, name)
      } else {
        await signIn(email.trim(), password)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-md px-4">
      <div className="card parchment text-left">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mb-2 border-0 pb-0 text-center text-2xl md:text-left">{t('auth.title')}</h1>
            <p className="mb-0 text-sm text-[var(--color-ink-faded)]">{t('connection.subtitle')}</p>
          </div>
          <LanguageSwitcher />
        </div>

        <div className="mb-6 flex rounded border border-[var(--color-leather-light)] p-1">
          <button
            type="button"
            className={`flex-1 rounded px-3 py-2 text-sm uppercase tracking-wide ${
              mode === 'signin' ? 'bg-[var(--color-gold)] text-[var(--color-leather-dark)]' : ''
            }`}
            onClick={() => {
              setMode('signin')
              setError(null)
            }}
          >
            {t('auth.loginTab')}
          </button>
          <button
            type="button"
            className={`flex-1 rounded px-3 py-2 text-sm uppercase tracking-wide ${
              mode === 'signup' ? 'bg-[var(--color-gold)] text-[var(--color-leather-dark)]' : ''
            }`}
            onClick={() => {
              setMode('signup')
              setError(null)
            }}
          >
            {t('auth.signupTab')}
          </button>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-[var(--color-ink)]">{t('auth.displayNameLabel')}</span>
              <input
                required
                autoComplete="name"
                className="w-full min-h-[44px]"
                value={displayName}
                onChange={(ev) => setDisplayName(ev.target.value)}
                placeholder={t('auth.displayNamePlaceholder')}
              />
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-[var(--color-ink)]">{t('auth.emailLabel')}</span>
            <input
              required
              type="email"
              autoComplete="email"
              className="w-full min-h-[44px]"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder={t('auth.emailPlaceholder')}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-[var(--color-ink)]">{t('auth.passwordLabel')}</span>
            <input
              required
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              className="w-full min-h-[44px]"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
            />
          </label>

          {error && (
            <p className="rounded border border-[var(--color-blood-red)] bg-[var(--color-parchment-dark)] px-3 py-2 text-sm text-[var(--color-blood-red-dark)]">
              {error}
            </p>
          )}

          <button type="submit" className="mt-2 w-full min-h-[48px]" disabled={submitting}>
            {submitting
              ? t('auth.submitting')
              : mode === 'signup'
                ? t('auth.signupButton')
                : t('auth.loginButton')}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[var(--color-ink-faded)]">{t('connection.helpText')}</p>
      </div>
    </div>
  )
}
