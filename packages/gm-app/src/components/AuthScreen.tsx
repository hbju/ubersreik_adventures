import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface AuthScreenProps {
    onAuthenticated: (user: any) => void;
}

export default function AuthScreen({ onAuthenticated }: AuthScreenProps) {
    const { t } = useTranslation();
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (mode === 'register' && password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            if (mode === 'login') {
                const result = await window.ipcRenderer.authSignIn(email, password);
                if (result.success) {
                    onAuthenticated(result.user);
                } else {
                    setError(result.error || 'Login failed');
                }
            } else {
                const result = await window.ipcRenderer.authSignUp(email, password);
                if (result.success) {
                    onAuthenticated(result.user);
                } else {
                    setError(result.error || 'Registration failed');
                }
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-stone-900" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', position: 'absolute' }}>
            <div className="bg-stone-800 border border-stone-700 rounded-lg p-8 w-full max-w-md shadow-xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-amber-400 mb-2">
                        WFRP Game Master
                    </h1>
                    <p className="text-stone-400 text-sm">
                        {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-stone-300 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full px-3 py-2 bg-stone-700 border border-stone-600 rounded text-stone-200 focus:outline-none focus:border-amber-500"
                            placeholder="your@email.com"
                            required
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-stone-300 mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full px-3 py-2 bg-stone-700 border border-stone-600 rounded text-stone-200 focus:outline-none focus:border-amber-500"
                            placeholder="••••••••"
                            required
                            minLength={6}
                        />
                    </div>

                    {mode === 'register' && (
                        <div>
                            <label className="block text-sm text-stone-300 mb-1">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                className="w-full px-3 py-2 bg-stone-700 border border-stone-600 rounded text-stone-200 focus:outline-none focus:border-amber-500"
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-900/30 border border-red-700 text-red-300 px-3 py-2 rounded text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-600 text-white font-semibold rounded transition-colors"
                    >
                        {loading
                            ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                            : (mode === 'login' ? 'Sign In' : 'Create Account')
                        }
                    </button>
                </form>

                {/* Toggle mode */}
                <div className="mt-6 text-center">
                    <button
                        onClick={() => {
                            setMode(mode === 'login' ? 'register' : 'login');
                            setError(null);
                        }}
                        className="text-amber-800 hover:text-amber-700 text-sm"
                    >
                        {mode === 'login'
                            ? "Don't have an account? Register"
                            : 'Already have an account? Sign in'
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}
