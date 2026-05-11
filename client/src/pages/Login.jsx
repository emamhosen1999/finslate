import { useLocation } from 'react-router-dom';

export default function Login() {
  const location = useLocation();
  const hasError = new URLSearchParams(location.search).has('error');

  const handleGoogle = () => {
    const base = import.meta.env.VITE_API_BASE_URL || '';
    window.location.href = `${base}/api/auth/google`;
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center">
      <div
        className="flex items-center justify-center rounded-2xl mb-6"
        style={{
          width: 72,
          height: 72,
          background: 'var(--accent-soft)',
          border: '1px solid var(--border)',
        }}
      >
        <span
          className="font-display font-bold"
          style={{ fontSize: 36, color: 'var(--accent)' }}
        >
          ৳
        </span>
      </div>
      <div className="font-display font-bold" style={{ fontSize: 32 }}>
        FinSlate
      </div>
      <p className="text-sm text-text-muted mt-1 mb-10">Your finances. Simplified.</p>

      <button
        type="button"
        onClick={handleGoogle}
        className="card flex items-center gap-3 px-5 py-3 w-full max-w-xs"
        style={{ background: '#fff', color: '#1F1F1F', borderColor: '#fff' }}
      >
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.3 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.4 1.1 7.3 2.8l5.7-5.7C33.6 6.5 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.6 0 19.5-8.6 19.5-19.5 0-1.2-.1-2.3-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c2.8 0 5.4 1.1 7.3 2.8l5.7-5.7C33.6 6.5 29 4.5 24 4.5 16.3 4.5 9.6 8.8 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 43.5c5 0 9.5-1.9 12.9-5l-6-4.9C29 35 26.6 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.2 16.2 43.5 24 43.5z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.4 5.6l6 4.9c-.4.4 6.6-4.8 6.6-14 0-1.2-.1-2.3-.4-3.5z" />
        </svg>
        <span className="font-semibold">Continue with Google</span>
      </button>

      {hasError ? (
        <div
          className="mt-4 text-xs"
          style={{ color: 'var(--negative)' }}
        >
          We couldn&apos;t sign you in. Please try again.
        </div>
      ) : null}

      <p className="text-[11px] text-text-muted mt-10 max-w-xs">
        FinSlate uses Google to identify you and a private MySQL database to store your finances. We never share your data.
      </p>
    </div>
  );
}
