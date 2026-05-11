import { useState } from 'react';
import { Wallet, Smartphone, Banknote, Plus, Pencil, Trash2 } from 'lucide-react';

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
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const accountTx = selected
    ? (transactions || []).filter((t) => t.account_id === selected.id)
    : [];

  const openAdd = () => {
    setEditingId(null);
    setNewName('');
    setNewType('bank');
    setNewBalance('');
    setAddOpen(true);
  };

  const openEdit = (account) => {
    setEditingId(account.id);
    setNewName(account.name);
    setNewType(account.type);
    setNewBalance(String(account.balance));
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!newName || !newType) {
      toast.push('Name and type are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      if (editingId) {
        await api.put(`${apiPaths.accounts}/${editingId}`, {
          name: newName.trim(),
          type: newType,
          balance: Number(newBalance),
        });
        toast.push('Account updated', 'success');
      } else {
        await api.post(apiPaths.accounts, {
          name: newName.trim(),
          type: newType,
          balance: Number(newBalance) || 0,
        });
        toast.push('Account added', 'success');
      }
      await loadAll();
      setAddOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to save account', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`${apiPaths.accounts}/${id}`);
      toast.push('Account deleted', 'success');
      await loadAll();
      setDeleteConfirm(null);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to delete account', 'error');
    }
  };

  return (
    <>
      <AppHeader title="Accounts" action={<button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3"><Plus size={14} /> Add</button>} />
      <main className="px-4 pt-3 space-y-3">
        {accounts.map((a) => {
          const Icon = ICONS[a.type] || Wallet;
          return (
            <div key={a.id} className="card p-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelected(selected?.id === a.id ? null : a)}
                  className="flex-1 flex items-center gap-3 text-left"
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
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(a)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ color: 'var(--accent)' }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(a.id)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ color: 'var(--negative)' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {selected ? (
          <section className="mt-4">
            <div className="text-sm font-semibold mb-2">Transactions · {selected.name}</div>
            <TransactionFeed transactions={accountTx} emptyMessage="No transactions for this account yet." />
          </section>
        ) : null}
      </main>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={editingId ? 'Edit Account' : 'Add Account'}>
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
          {editingId ? 'Update Account' : 'Add Account'}
        </ActionButton>
      </BottomSheet>

      <BottomSheet open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete Account">
        <p className="text-sm text-text-muted mb-4">Are you sure you want to delete this account? This will also delete all associated transactions.</p>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</ActionButton>
        </div>
      </BottomSheet>
    </>
  );
}
