import { NavLink } from 'react-router-dom';
import { Home, Wallet, CreditCard, Landmark, PiggyBank, Target, Repeat, Lock, TrendingUp, DollarSign, LineChart, Shield, Gift, BarChart3 } from 'lucide-react';

const tabs = [
  { to: '/', label: 'Dashboard', icon: Home, end: true },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/cards', label: 'Cards', icon: CreditCard },
  { to: '/loan', label: 'Loan', icon: Landmark },
  { to: '/dps', label: 'DPS', icon: PiggyBank },
  { to: '/budgets', label: 'Budgets', icon: Target },
  { to: '/recurring', label: 'Recurring', icon: Repeat },
  { to: '/fixed-deposits', label: 'FD', icon: Lock },
  { to: '/recurring-deposits', label: 'RD', icon: TrendingUp },
  { to: '/income', label: 'Income', icon: DollarSign },
  { to: '/investments', label: 'Invest', icon: LineChart },
  { to: '/insurance', label: 'Insurance', icon: Shield },
  { to: '/cashback', label: 'Rewards', icon: Gift },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export default function BottomNav() {
  return (
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
        {tabs.map(({ to, label, icon: Icon, end }) => (
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
      </div>
    </nav>
  );
}
