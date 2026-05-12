import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home, Wallet, Receipt, BarChart3, MoreHorizontal, X,
  CreditCard, Landmark, PiggyBank, Target, Repeat, Lock,
  DollarSign, LineChart, Shield, User, TrendingUp, Bell,
  FileText, Briefcase, Tag, LayoutGrid
} from 'lucide-react';

const coreTabs = [
  { to: '/', label: 'Dashboard', icon: Home, end: true },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/transactions', label: 'Transactions', icon: Receipt },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

const sidebarSections = [
  {
    title: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: Home, end: true },
      { to: '/accounts', label: 'Accounts', icon: Wallet },
      { to: '/transactions', label: 'Transactions', icon: Receipt },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'Credit & Debt',
    items: [
      { to: '/cards', label: 'Credit Cards', icon: CreditCard },
      { to: '/loan', label: 'Loans', icon: Landmark },
      { to: '/personal-lending', label: 'Personal Lending', icon: DollarSign },
    ],
  },
  {
    title: 'Savings & Investments',
    items: [
      { to: '/dps', label: 'DPS', icon: PiggyBank },
      { to: '/fixed-deposits', label: 'Fixed Deposits', icon: Lock },
      { to: '/sanchayapatra', label: 'Sanchayapatra', icon: Landmark },
      { to: '/investments', label: 'Investments', icon: LineChart },
      { to: '/provident-fund', label: 'Provident Fund', icon: Briefcase },
    ],
  },
  {
    title: 'Planning',
    items: [
      { to: '/budgets', label: 'Budgets', icon: Target },
      { to: '/goals', label: 'Goals', icon: Target },
      { to: '/recurring', label: 'Recurring', icon: Repeat },
      { to: '/income', label: 'Income Sources', icon: DollarSign },
    ],
  },
  {
    title: 'Bills & Insurance',
    items: [
      { to: '/bills', label: 'Bills', icon: FileText },
      { to: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
      { to: '/insurance', label: 'Insurance', icon: Shield },
    ],
  },
  {
    title: 'Reports & More',
    items: [
      { to: '/net-worth', label: 'Net Worth', icon: TrendingUp },
      { to: '/reports', label: 'Reports', icon: FileText },
      { to: '/tax-records', label: 'Tax Records', icon: FileText },
      { to: '/notifications', label: 'Notifications', icon: Bell },
      { to: '/currency-management', label: 'Currency', icon: DollarSign },
      { to: '/tags', label: 'Tags', icon: Tag },
      { to: '/categories', label: 'Categories', icon: LayoutGrid },
      { to: '/profile', label: 'Profile', icon: User },
    ],
  },
];

const moreItems = sidebarSections.slice(1).flatMap((s) => s.items);

export default function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {/* ─── Sidebar (desktop lg+) ─── */}
      <aside className="sidebar-nav">
        <div className="nav-brand">Finslate</div>
        {sidebarSections.map((section) => (
          <div key={section.title}>
            <div className="nav-section">{section.title}</div>
            {section.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </aside>

      {/* ─── Bottom Nav (mobile/tablet) ─── */}
      <nav className="fixed inset-x-0 bottom-0 z-30 lg:hidden">
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
          <button onClick={() => setMoreOpen(true)} className="bn-tab">
            <MoreHorizontal size={20} strokeWidth={1.8} />
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* ─── More Sheet (mobile/tablet) ─── */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 lg:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 sm:max-w-lg mx-auto bg-bg-surface rounded-t-2xl p-4"
            style={{ maxHeight: '70vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">More</h2>
              <button onClick={() => setMoreOpen(false)} className="p-1">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {moreItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <Icon size={20} />
                  <span className="text-sm text-center">{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
