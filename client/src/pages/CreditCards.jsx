import { useState } from 'react';
import { Plus, Pencil, Trash2, CreditCard } from 'lucide-react';

import AppHeader from '../components/AppHeader.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import ActionButton from '../components/ActionButton.jsx';
import BottomSheet from '../components/BottomSheet.jsx';
import { useFinance } from '../context/FinanceContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { apiPaths } from '../api/client';
import { formatBDT } from '../utils/formatBDT';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
}

function maskedNumber(id) {
  // Stable fake number for visual purposes only.
  const seed = String(1000 + (id * 7919) % 8999);
  return `•••• •••• •••• ${seed}`;
}

export default function CreditCards() {
  const { creditCards, accounts, loadAll } = useFinance();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payCardId, setPayCardId] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payAccountId, setPayAccountId] = useState('');

  const openAdd = () => {
    setEditingId(null);
    setNewName('');
    setNewLimit('');
    setNewDueDate('');
    setAddOpen(true);
  };

  const openEdit = (card) => {
    setEditingId(card.id);
    setNewName(card.card_name);
    setNewLimit(String(card.credit_limit));
    setNewDueDate(card.payment_due_day || '');
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!newName || !newLimit) {
      toast.push('Name and limit are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      if (editingId) {
        await api.put(`${apiPaths.creditCards}/${editingId}`, {
          card_name: newName.trim(),
          credit_limit: Number(newLimit),
          payment_due_day: newDueDate ? Number(newDueDate) : null,
        });
        toast.push('Credit card updated', 'success');
      } else {
        await api.post(apiPaths.creditCards, {
          card_name: newName.trim(),
          credit_limit: Number(newLimit),
          payment_due_day: newDueDate ? Number(newDueDate) : null,
        });
        toast.push('Credit card added', 'success');
      }
      await loadAll();
      setAddOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to save credit card', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (cardId) => {
    try {
      await api.delete(`${apiPaths.creditCards}/${cardId}`);
      toast.push('Credit card deleted', 'success');
      await loadAll();
      setDeleteConfirm(null);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to delete credit card', 'error');
    }
  };

  const openPay = (card) => {
    setPayCardId(card.id);
    setPayAmount(String(card.current_outstanding));
    setPayAccountId(accounts[0]?.id ? String(accounts[0].id) : '');
    setPayOpen(true);
  };

  const handlePay = async () => {
    if (!payAmount) {
      toast.push('Payment amount is required', 'error');
      return;
    }
    setPayLoading(true);
    try {
      await api.post(`${apiPaths.creditCards}/${payCardId}/pay`, {
        amount: Number(payAmount),
        account_id: payAccountId ? Number(payAccountId) : null,
      });
      toast.push('Payment successful', 'success');
      await loadAll();
      setPayOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to process payment', 'error');
    } finally {
      setPayLoading(false);
    }
  };

  return (
    <>
      <AppHeader title="Credit Cards" action={<button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3"><Plus size={14} /> Add</button>} />
      <main className="px-4 pt-3 space-y-4">
        {creditCards.length === 0 ? (
          <div className="card p-6 text-center text-sm text-text-muted">No credit cards on file.</div>
        ) : null}
        {creditCards.map((c) => {
          const pct = c.credit_limit > 0 ? (Number(c.current_outstanding) / Number(c.credit_limit)) * 100 : 0;
          return (
            <div key={c.id} className="space-y-2">
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold">{c.card_name}</div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openPay(c)}
                      className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                      style={{ color: 'var(--positive)' }}
                      disabled={c.current_outstanding <= 0}
                    >
                      <CreditCard size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                      style={{ color: 'var(--accent)' }}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(c.id)}
                      className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                      style={{ color: 'var(--negative)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-text-muted mb-2">
                  {c.payment_due_day ? `Due day: ${c.payment_due_day}` : ''}
                </div>
                <div className="mt-8 font-mono text-lg tracking-widest">{maskedNumber(c.id)}</div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="text-[10px] uppercase opacity-70">Outstanding</div>
                    <div className="font-mono text-base">{formatBDT(c.current_outstanding)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase opacity-70">Due day</div>
                    <div className="font-mono text-sm">
                      {c.payment_due_day || '—'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-1">
                <div className="flex justify-between text-[11px] text-text-muted mb-1">
                  <span>Utilisation</span>
                  <span className="font-mono">
                    {formatBDT(c.current_outstanding)} / {formatBDT(c.credit_limit)}
                  </span>
                </div>
                <ProgressBar
                  value={Number(c.current_outstanding)}
                  max={Number(c.credit_limit)}
                  color={pct > 80 ? 'var(--negative)' : pct > 50 ? 'var(--warning)' : 'var(--accent)'}
                />
              </div>
            </div>
          );
        })}
      </main>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={editingId ? 'Edit Credit Card' : 'Add Credit Card'}>
        <label className="block text-xs text-text-muted mb-1">Card name</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. DBBL Visa"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Credit limit (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 100000"
          value={newLimit}
          onChange={(e) => setNewLimit(e.target.value.replace(/[^\d]/g, ''))}
        />

        <label className="block text-xs text-text-muted mb-1">Due date (optional)</label>
        <input
          className="input mb-4"
          type="date"
          value={newDueDate}
          onChange={(e) => setNewDueDate(e.target.value)}
        />

        <ActionButton variant="primary" className="w-full" loading={addLoading} onClick={handleAdd}>
          {editingId ? 'Update Credit Card' : 'Add Credit Card'}
        </ActionButton>
      </BottomSheet>

      <BottomSheet open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete Credit Card">
        <p className="text-sm text-text-muted mb-4">Are you sure you want to delete this credit card?</p>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</ActionButton>
        </div>
      </BottomSheet>

      <BottomSheet open={payOpen} onClose={() => setPayOpen(false)} title="Pay Credit Card">
        <label className="block text-xs text-text-muted mb-1">Payment amount (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 5000"
          value={payAmount}
          onChange={(e) => setPayAmount(e.target.value.replace(/[^\d]/g, ''))}
        />

        <label className="block text-xs text-text-muted mb-1">Pay from account (optional)</label>
        <select
          className="input mb-4"
          value={payAccountId}
          onChange={(e) => setPayAccountId(e.target.value)}
        >
          <option value="">No account (just clear debt)</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {formatBDT(a.current_balance)}
            </option>
          ))}
        </select>

        <ActionButton variant="primary" className="w-full" loading={payLoading} onClick={handlePay}>
          Pay
        </ActionButton>
      </BottomSheet>
    </>
  );
}
