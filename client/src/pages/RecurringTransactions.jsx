import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Repeat, Calendar } from 'lucide-react';

import AppHeader from '../components/AppHeader.jsx';
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

export default function RecurringTransactions() {
  const { accounts, loadAll } = useFinance();
  const toast = useToast();
  const [recurring, setRecurring] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('debit');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newFrequency, setNewFrequency] = useState('monthly');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newAccountId, setNewAccountId] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const loadRecurring = async () => {
    try {
      const res = await api.get(apiPaths.recurringTransactions);
      setRecurring(res.data);
    } catch (err) {
      console.error('Failed to load recurring transactions:', err);
    }
  };

  useEffect(() => {
    loadRecurring();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setNewName('');
    setNewType('debit');
    setNewAmount('');
    setNewCategory('');
    setNewDescription('');
    setNewFrequency('monthly');
    setNewStartDate('');
    setNewEndDate('');
    setNewAccountId(accounts[0]?.id ? String(accounts[0].id) : '');
    setAddOpen(true);
  };

  const openEdit = (rt) => {
    setEditingId(rt.id);
    setNewName(rt.name);
    setNewType(rt.type);
    setNewAmount(String(rt.amount));
    setNewCategory(rt.category);
    setNewDescription(rt.description || '');
    setNewFrequency(rt.frequency);
    setNewStartDate(rt.start_date);
    setNewEndDate(rt.end_date || '');
    setNewAccountId(rt.account_id ? String(rt.account_id) : '');
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!newName || !newAmount || !newCategory || !newFrequency || !newStartDate) {
      toast.push('Name, amount, category, frequency, and start date are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      if (editingId) {
        await api.put(`${apiPaths.recurringTransactions}/${editingId}`, {
          name: newName.trim(),
          type: newType,
          amount: Number(newAmount),
          category: newCategory.trim(),
          description: newDescription.trim() || null,
          frequency: newFrequency,
          start_date: newStartDate,
          end_date: newEndDate || null,
          account_id: newAccountId ? Number(newAccountId) : null,
        });
        toast.push('Recurring transaction updated', 'success');
      } else {
        await api.post(apiPaths.recurringTransactions, {
          name: newName.trim(),
          type: newType,
          amount: Number(newAmount),
          category: newCategory.trim(),
          description: newDescription.trim() || null,
          frequency: newFrequency,
          start_date: newStartDate,
          end_date: newEndDate || null,
          account_id: newAccountId ? Number(newAccountId) : null,
        });
        toast.push('Recurring transaction added', 'success');
      }
      await loadRecurring();
      await loadAll();
      setAddOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to save recurring transaction', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (rtId) => {
    try {
      await api.delete(`${apiPaths.recurringTransactions}/${rtId}`);
      toast.push('Recurring transaction deleted', 'success');
      await loadRecurring();
      setDeleteConfirm(null);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to delete recurring transaction', 'error');
    }
  };

  const handleProcess = async (rtId) => {
    try {
      await api.post(`${apiPaths.recurringTransactions}/${rtId}/process`);
      toast.push('Transaction processed successfully', 'success');
      await loadRecurring();
      await loadAll();
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to process transaction', 'error');
    }
  };

  return (
    <>
      <AppHeader title="Recurring" action={<button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3"><Plus size={14} /> Add</button>} />
      <main className="px-4 pt-3 space-y-4">
        {recurring.length === 0 ? (
          <div className="card p-6 text-center text-sm text-text-muted">No recurring transactions set up.</div>
        ) : null}
        {recurring.map((rt) => {
          const days = daysUntil(rt.next_due);
          const overdue = days !== null && days < 0;
          const dueToday = days === 0;
          return (
            <div key={rt.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">{rt.name}</div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleProcess(rt.id)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ color: 'var(--positive)' }}
                  >
                    <Repeat size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(rt)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ color: 'var(--accent)' }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(rt.id)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ color: 'var(--negative)' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
                <span className="px-2 py-1 rounded" style={{ backgroundColor: rt.type === 'credit' ? 'var(--positive-alpha)' : 'var(--negative-alpha)', color: rt.type === 'credit' ? 'var(--positive)' : 'var(--negative)' }}>
                  {rt.type.toUpperCase()}
                </span>
                <span>·</span>
                <span>{rt.frequency}</span>
                <span>·</span>
                <span className="font-mono">{formatBDT(rt.amount)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Calendar size={14} />
                <span>Next due: {rt.next_due || '—'}</span>
                {days !== null && (
                  <span style={{ color: overdue ? 'var(--negative)' : dueToday ? 'var(--warning)' : '' }}>
                    ({overdue ? `${Math.abs(days)}d overdue` : dueToday ? 'Today' : `${days}d`})
                  </span>
                )}
              </div>
              {rt.account_name && (
                <div className="text-xs text-text-muted mt-2">
                  Account: {rt.account_name}
                </div>
              )}
            </div>
          );
        })}
      </main>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={editingId ? 'Edit Recurring' : 'Add Recurring'}>
        <label className="block text-xs text-text-muted mb-1">Name</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Netflix Subscription"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Type</label>
        <select
          className="input mb-3"
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
        >
          <option value="debit">Expense (Debit)</option>
          <option value="credit">Income (Credit)</option>
        </select>

        <label className="block text-xs text-text-muted mb-1">Amount (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 500"
          value={newAmount}
          onChange={(e) => setNewAmount(e.target.value.replace(/[^\d]/g, ''))}
        />

        <label className="block text-xs text-text-muted mb-1">Category</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Entertainment"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Description (optional)</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Monthly subscription"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Frequency</label>
        <select
          className="input mb-3"
          value={newFrequency}
          onChange={(e) => setNewFrequency(e.target.value)}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>

        <label className="block text-xs text-text-muted mb-1">Start date</label>
        <input
          className="input mb-3"
          type="date"
          value={newStartDate}
          onChange={(e) => setNewStartDate(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">End date (optional)</label>
        <input
          className="input mb-3"
          type="date"
          value={newEndDate}
          onChange={(e) => setNewEndDate(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Account (optional)</label>
        <select
          className="input mb-4"
          value={newAccountId}
          onChange={(e) => setNewAccountId(e.target.value)}
        >
          <option value="">No account</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {formatBDT(a.balance)}
            </option>
          ))}
        </select>

        <ActionButton variant="primary" className="w-full" loading={addLoading} onClick={handleAdd}>
          {editingId ? 'Update' : 'Add'}
        </ActionButton>
      </BottomSheet>

      <BottomSheet open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete Recurring">
        <p className="text-sm text-text-muted mb-4">Are you sure you want to delete this recurring transaction?</p>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</ActionButton>
        </div>
      </BottomSheet>
    </>
  );
}
