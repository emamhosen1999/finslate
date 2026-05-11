import { useState } from 'react';
import { Wallet, Smartphone, Banknote } from 'lucide-react';

import AppHeader from '../components/AppHeader.jsx';
import TransactionFeed from '../components/TransactionFeed.jsx';
import { useFinance } from '../context/FinanceContext.jsx';
import { formatBDT } from '../utils/formatBDT';

const ICONS = {
  bank: Wallet,
  mobile_banking: Smartphone,
  cash: Banknote,
};

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Accounts() {
  const { accounts, transactions } = useFinance();
  const [selected, setSelected] = useState(null);

  const accountTx = selected
    ? (transactions || []).filter((t) => t.account_id === selected.id)
    : [];

  return (
    <>
      <AppHeader title="Accounts" />
      <main className="px-4 pt-3 space-y-3">
        {accounts.map((a) => {
          const Icon = ICONS[a.type] || Wallet;
          return (
            <button
              type="button"
              key={a.id}
              onClick={() => setSelected(selected?.id === a.id ? null : a)}
              className="card w-full p-4 flex items-center gap-3 text-left"
              style={{
                borderColor: selected?.id === a.id ? 'var(--accent)' : 'var(--border)',
              }}
            >
              <span
                className="rounded-full flex items-center justify-center"
                style={{
                  width: 40, height: 40,
                  background: 'var(--accent-soft)', color: 'var(--accent)',
                }}
              >
                <Icon size={20} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-semibold truncate">{a.name}</div>
                  <span
                    className="text-[10px] uppercase rounded-full px-2 py-[2px]"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                  >
                    {a.type.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-[11px] text-text-muted">Added {fmtDate(a.created_at)}</div>
              </div>
              <div className="text-right font-mono text-base">{formatBDT(a.balance)}</div>
            </button>
          );
        })}

        {selected ? (
          <section className="mt-4">
            <div className="text-sm font-semibold mb-2">Transactions · {selected.name}</div>
            <TransactionFeed transactions={accountTx} emptyMessage="No transactions for this account yet." />
          </section>
        ) : null}
      </main>
    </>
  );
}
