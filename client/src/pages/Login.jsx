import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import api, { apiPaths } from '../api/client';
import { useFinance } from '../context/FinanceContext';

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.3 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.4 1.1 7.3 2.8l5.7-5.7C33.6 6.5 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.6 0 19.5-8.6 19.5-19.5 0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c2.8 0 5.4 1.1 7.3 2.8l5.7-5.7C33.6 6.5 29 4.5 24 4.5 16.3 4.5 9.6 8.8 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 43.5c5 0 9.5-1.9 12.9-5l-6-4.9C29 35 26.6 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.2 16.2 43.5 24 43.5z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.4 5.6l6 4.9c-.4.4 6.6-4.8 6.6-14 0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

export default function Login() {
  const location = useLocation();
  const { loadMe, loadAll } = useFinance();

  const hasOauthError = new URLSearchParams(location.search).has('error');
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(hasOauthError ? "Google sign-in failed. Please try again." : '');
  const [busy, setBusy] = useState(false);

  const handleGoogle = () => {
    const base = import.meta.env.VITE_API_BASE_URL || '';
    window.location.href = `${base}/api/auth/google`;
  };

  const switchMode = (next) => {
    setMode(next);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const endpoint = mode === 'register' ? apiPaths.register : apiPaths.loginEmail;
      const payload = mode === 'register' ? { name: name.trim(), email, password } : { email, password };
      await api.post(endpoint, payload);
      const user = await loadMe();
      if (user) await loadAll();
    } catch (err) {
      setError(err?.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center">
      <div
        className="flex items-center justify-center rounded-2xl mb-5"
        style={{ width: 68, height: 68, background: 'var(--accent-soft)', border: '1px solid var(--border)' }}
      >
        <span className="font-display font-bold" style={{ fontSize: 34, color: 'var(--accent)' }}>৳</span>
      </div>
      <div className="font-display font-bold" style={{ fontSize: 30 }}>FinSlate</div>
      <p className="text-sm mt-1 mb-7" style={{ color: 'var(--text-muted)' }}>Your finances. Simplified.</p>

      <div className="w-full max-w-xs flex flex-col gap-4">
        {/* Mode toggle */}
        <div className="card flex p-1 gap-1">
          <button
            type="button"
            onClick={() => switchMode('signin')}
            className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: mode === 'signin' ? 'var(--accent)' : 'transparent',
              color: mode === 'signin' ? '#0a0d18' : 'var(--text-muted)',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: mode === 'register' ? 'var(--accent)' : 'transparent',
              color: mode === 'register' ? '#0a0d18' : 'var(--text-muted)',
            }}
          >
            Create Account
          </button>
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={handleGoogle}
          className="card flex items-center justify-center gap-3 px-5 py-3 w-full"
          style={{ background: '#fff', color: '#1F1F1F', borderColor: '#fff' }}
        >
          <GoogleIcon />
          <span className="font-semibold">Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>or</span>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>

        {/* Email / password form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === 'register' && (
            <input
              className="input"
              type="text"
              placeholder="Full name"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <input
            className="input"
            type="email"
            placeholder="Email address"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder={mode === 'register' ? 'Password (min 8 chars)' : 'Password'}
            required
            minLength={mode === 'register' ? 8 : 1}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <p className="text-xs text-left" style={{ color: 'var(--negative)' }}>{error}</p>
          )}

          <button type="submit" disabled={busy} className="btn btn-primary w-full">
            {busy ? 'Please wait…' : mode === 'register' ? 'Create Account' : 'Sign In'}
          </button>
        </form>
      </div>

      <p className="text-[11px] mt-10 max-w-xs" style={{ color: 'var(--text-muted)' }}>
        FinSlate stores your finances in a private database. We never share your data.
      </p>
    </div>
  );
}
