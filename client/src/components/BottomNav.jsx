import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Wallet, Receipt, BarChart3, MoreHorizontal, X } from 'lucide-react';

const coreTabs = [
  { to: '/', label: 'Dashboard', icon: Home, end: true },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/transactions', label: 'Transactions', icon: Receipt },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

const moreTabs = [
  { to: '/cards', label: 'Cards', icon: 'CreditCard' },
  { to: '/loan', label: 'Loan', icon: 'Landmark' },
  { to: '/dps', label: 'DPS', icon: 'PiggyBank' },
  { to: '/budgets', label: 'Budgets', icon: 'Target' },
  { to: '/recurring', label: 'Recurring', icon: 'Repeat' },
  { to: '/fixed-deposits', label: 'Fixed Deposits', icon: 'Lock' },
  { to: '/recurring-deposits', label: 'Recurring Deposits', icon: 'TrendingUp' },
  { to: '/income', label: 'Income Sources', icon: 'DollarSign' },
  { to: '/investments', label: 'Investments', icon: 'LineChart' },
  { to: '/insurance', label: 'Insurance', icon: 'Shield' },
  { to: '/cashback', label: 'Cashback/Rewards', icon: 'Gift' },
];

const iconMap = {
  CreditCard: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>,
  Landmark: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>,
  PiggyBank: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 1.5 4-1 1.5-1 2.5-1 2.5s1 1.5 2.5 1.5c2.5 0 2.5-2.5 2.5-2.5s.5 1 1.5 1c1.5 0 2.5-1.5 2.5-2.5 0-2-1-3-1-3s1-1.5 1-2.5c0-1-.5-1.5-1.5-2.5z"/><circle cx="9" cy="9" r="0.5"/><path d="M6 5h.01"/><path d="M10 5h.01"/></svg>,
  Target: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  Repeat: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/><path d="M21 3H9"/></svg>,
  Lock: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  TrendingUp: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  DollarSign: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  LineChart: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>,
  Shield: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>,
  Gift: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.88 4.88 0 0 1 12 5a4.88 4.88 0 0 1 4.5 3 2.5 2.5 0 0 1 0 5"/></svg>,
};

export default function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 mx-auto z-30"
        style={{ maxWidth: 'var(--max-width)' }}
      >
        <div
          className="flex border-t bg-bg-surface/95 backdrop-blur"
          style={{
            borderColor: 'var(--border)',
            paddingBottom: 'env(safe-area-inset-bottom, 0)',
          }}
        >
          {coreTabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `bn-tab ${isActive ? 'active' : ''}`}
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
                  <span>{label}</span>
                  <span
                    className="block rounded-full"
                    style={{
                      width: 4,
                      height: 4,
                      background: isActive ? 'var(--accent)' : 'transparent',
                      marginTop: 1,
                    }}
                  />
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className="bn-tab"
          >
            <MoreHorizontal size={20} strokeWidth={1.8} />
            <span>More</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 max-w-md mx-auto bg-bg-surface rounded-t-2xl p-4"
            style={{ maxHeight: '70vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">More</h2>
              <button onClick={() => setMoreOpen(false)} className="p-1">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {moreTabs.map(({ to, label, icon: iconName }) => {
                const IconComponent = iconMap[iconName];
                return (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg border"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    {IconComponent && <IconComponent />}
                    <span className="text-sm text-center">{label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
