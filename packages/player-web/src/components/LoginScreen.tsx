import React, { useState } from 'react';
import { supabase } from '@wfrp/shared';

interface LoginScreenProps {
  onAuthenticated: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onAuthenticated }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const sb = supabase.getSupabase();

      if (isSignUp) {
        const { error: signUpError } = await sb.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        setError(null);
        onAuthenticated();
      } else {
        const { error: signInError } = await sb.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        onAuthenticated();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', position: 'absolute' }}>
      <h1 style={{ color: 'var(--color-gold)', textAlign: 'center', fontSize: '2rem' }}>
        Ubersreik Adventures
      </h1>
      <div className="auth-card">
        <h2>{isSignUp ? 'Create Account' : 'Sign In'}</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '16px', color: 'var(--color-ink-faded)', fontSize: '0.9rem' }}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <a href="#" onClick={e => { e.preventDefault(); setIsSignUp(!isSignUp); setError(null); }}>
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </a>
        </p>
      </div>
    </div>
  );
};
