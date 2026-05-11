import { useState } from 'react';
import { Wallet, Smartphone, Banknote, Plus } from 'lucide-react';

import AppHeader from '../components/AppHeader.jsx';
import TransactionFeed from '../components/TransactionFeed.jsx';
import ActionButton from '../components/ActionButton.jsx';
import BottomSheet from '../components/BottomSheet.jsx';
import { useFinance } from '../context/FinanceContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { apiPaths } from '../api/client';
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
  const { accounts, transactions, loadAll } = useFinance();
  const toast = useToast();
  const [selected, setSelected] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('bank');
  const [newBalance, setNewBalance] = useState('');

  const accountTx = selected
    ? (transactions || []).filter((t) => t.account_id === selected.id)
    : [];

  const openAdd = () => {
    setNewName('');
    setNewType('bank');
    setNewBalance('');
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!newName || !newType) {
      toast.push('Name and type are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      await api.post(apiPaths.accounts, {
        name: newName.trim(),
        type: newType,
        balance: Number(newBalance) || 0,
      });
      await loadAll();
      toast.push('Account added', 'success');
      setAddOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to add account', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <>
      <AppHeader title="Accounts" action={<button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3"><Plus size={14} /> Add</button>} />
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

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title="Add Account">
        <label className="block text-xs text-text-muted mb-1">Name</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. DBBL Savings"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Type</label>
        <select className="input mb-3" value={newType} onChange={(e) => setNewType(e.target.value)}>
          <option value="bank">Bank</option>
          <option value="mobile_banking">Mobile Banking</option>
          <option value="cash">Cash</option>
        </select>

        <label className="block text-xs text-text-muted mb-1">Initial balance (BDT)</label>
        <input
          className="input mb-4"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 50000"
          value={newBalance}
          onChange={(e) => setNewBalance(e.target.value.replace(/[^\d]/g, ''))}
        />

        <ActionButton variant="primary" className="w-full" loading={addLoading} onClick={handleAdd}>
          Add Account
        </ActionButton>
      </BottomSheet>
    </>
  );
}
