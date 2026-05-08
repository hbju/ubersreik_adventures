import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';

type Mode = 'login' | 'signup';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { supabase } = useAppContext();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) {
          setError(authError.message);
        }
      } else {
        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        });
        if (authError) {
          setError(authError.message);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-900" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
      <div className="w-full max-w-md p-8 bg-stone-800 rounded-lg shadow-xl border border-amber-900/30">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-amber-500 font-serif">
            {t('auth.title', 'Ubersreik Adventures')}
          </h1>
          <p className="mt-2 text-stone-400 text-sm">
            {t('auth.subtitle', 'Game Master Tools')}
          </p>
        </div>

        {/* Tab toggle */}
        <div className="flex mb-6 border-b border-stone-700">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            className={`flex-1 pb-2 text-sm font-medium transition-colors ${
              mode === 'login'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-stone-500 hover:text-stone-300'
            }`}
          >
            {t('auth.loginTab', 'Sign In')}
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null); }}
            className={`flex-1 pb-2 text-sm font-medium transition-colors ${
              mode === 'signup'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-stone-500 hover:text-stone-300'
            }`}
          >
            {t('auth.signupTab', 'Create Account')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm text-stone-300 mb-1">
                {t('auth.displayNameLabel', 'Display Name')}
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-stone-700 border border-stone-600 rounded text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                placeholder={t('auth.displayNamePlaceholder', 'Your name')}
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-stone-300 mb-1">
              {t('auth.emailLabel', 'Email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2 bg-stone-700 border border-stone-600 rounded text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
              placeholder={t('auth.emailPlaceholder', 'you@example.com')}
            />
          </div>

          <div>
            <label className="block text-sm text-stone-300 mb-1">
              {t('auth.passwordLabel', 'Password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={6}
              className="w-full px-3 py-2 bg-stone-700 border border-stone-600 rounded text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
              placeholder={t('auth.passwordPlaceholder', '••••••••')}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900/40 border border-red-700 rounded text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 px-4 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded transition-colors"
          >
            {submitting
              ? t('auth.submitting', 'Please wait…')
              : mode === 'login'
                ? t('auth.loginButton', 'Sign In')
                : t('auth.signupButton', 'Create Account')}
          </button>
        </form>
      </div>
    </div>
  );
}
