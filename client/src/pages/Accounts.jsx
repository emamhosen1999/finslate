import { useState } from 'react';
import { Wallet, Smartphone, Banknote, Plus, Pencil, Trash2, ArrowRightLeft } from 'lucide-react';

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
  mutual_fund: Wallet,
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
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDescription, setTransferDescription] = useState('');

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
    setNewBalance(String(account.current_balance));
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
          current_balance: Number(newBalance),
        });
        toast.push('Account updated', 'success');
      } else {
        await api.post(apiPaths.accounts, {
          name: newName.trim(),
          type: newType,
          current_balance: Number(newBalance) || 0,
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

  const openTransfer = () => {
    setFromAccountId(accounts[0]?.id ? String(accounts[0].id) : '');
    setToAccountId(accounts[1]?.id ? String(accounts[1].id) : '');
    setTransferAmount('');
    setTransferDescription('');
    setTransferOpen(true);
  };

  const handleTransfer = async () => {
    if (!fromAccountId || !toAccountId || !transferAmount) {
      toast.push('From account, to account, and amount are required', 'error');
      return;
    }
    if (fromAccountId === toAccountId) {
      toast.push('Cannot transfer to the same account', 'error');
      return;
    }
    setTransferLoading(true);
    try {
      await api.post(apiPaths.transfers, {
        from_account_id: Number(fromAccountId),
        to_account_id: Number(toAccountId),
        amount: Number(transferAmount),
        note: transferDescription || null,
        transfer_date: new Date().toISOString().split('T')[0],
      });
      toast.push('Transfer successful', 'success');
      await loadAll();
      setTransferOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to transfer', 'error');
    } finally {
      setTransferLoading(false);
    }
  };

  return (
    <>
      <AppHeader 
        title="Accounts" 
        action={
          <div className="flex gap-2">
            <button 
              type="button" 
              onClick={openTransfer} 
              className="btn btn-ghost text-xs py-2 px-3"
              disabled={accounts.length < 2}
            >
              <ArrowRightLeft size={14} /> Transfer
            </button>
            <button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3">
              <Plus size={14} /> Add
            </button>
          </div>
        } 
      />
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
                  <div className="text-right font-mono text-base">{formatBDT(a.current_balance)}</div>
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
          <option value="mutual_fund">Mutual Fund</option>
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

      <BottomSheet open={transferOpen} onClose={() => setTransferOpen(false)} title="Transfer Between Accounts">
        <label className="block text-xs text-text-muted mb-1">From account</label>
        <select
          className="input mb-3"
          value={fromAccountId}
          onChange={(e) => setFromAccountId(e.target.value)}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {formatBDT(a.current_balance)}
            </option>
          ))}
        </select>

        <label className="block text-xs text-text-muted mb-1">To account</label>
        <select
          className="input mb-3"
          value={toAccountId}
          onChange={(e) => setToAccountId(e.target.value)}
        >
          {accounts.filter(a => String(a.id) !== fromAccountId).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {formatBDT(a.current_balance)}
            </option>
          ))}
        </select>

        <label className="block text-xs text-text-muted mb-1">Amount (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 5000"
          value={transferAmount}
          onChange={(e) => setTransferAmount(e.target.value.replace(/[^\d]/g, ''))}
        />

        <label className="block text-xs text-text-muted mb-1">Description (optional)</label>
        <input
          className="input mb-4"
          type="text"
          placeholder="e.g. Monthly allowance"
          value={transferDescription}
          onChange={(e) => setTransferDescription(e.target.value)}
        />

        <ActionButton variant="primary" className="w-full" loading={transferLoading} onClick={handleTransfer}>
          Transfer
        </ActionButton>
      </BottomSheet>
    </>
  );
}
