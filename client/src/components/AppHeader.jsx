import { ChevronLeft, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext.jsx';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function AppHeader({ title, back = false, action }) {
  const { user, logout } = useFinance();
  const navigate = useNavigate();

  return (
    <header
      className="sticky top-0 z-20 px-4 py-3 flex items-center gap-3"
      style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}
    >
      {back ? (
        <button type="button" onClick={() => navigate(-1)} className="text-text-muted">
          <ChevronLeft size={22} />
        </button>
      ) : user?.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.name || ''}
          className="rounded-full"
          style={{ width: 36, height: 36, objectFit: 'cover' }}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center text-sm font-semibold"
          style={{ width: 36, height: 36, background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          {(user?.name || 'F')[0]}
        </div>
      )}
      <div className="flex-1 min-w-0">
        {title ? (
          <div className="text-base font-semibold truncate">{title}</div>
        ) : (
          <>
            <div className="text-xs text-text-muted">{greeting()},</div>
            <div className="text-sm font-semibold truncate">{user?.name || 'there'}</div>
          </>
        )}
      </div>
      {action || (
        <button type="button" onClick={logout} className="text-text-muted" aria-label="Sign out">
          <LogOut size={18} />
        </button>
      )}
    </header>
  );
}
