import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, DollarSign, Calendar, Briefcase } from 'lucide-react';

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

export default function IncomeSources() {
  const { accounts, loadAll } = useFinance();
  const toast = useToast();
  const [incomes, setIncomes] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('Salary');
  const [newAmount, setNewAmount] = useState('');
  const [newFrequency, setNewFrequency] = useState('monthly');
  const [newAccountId, setNewAccountId] = useState('');
  const [newNextPayDate, setNewNextPayDate] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const loadIncomes = async () => {
    try {
      const res = await api.get(apiPaths.incomeSources);
      setIncomes(res.data);
    } catch (err) {
      console.error('Failed to load income sources:', err);
    }
  };

  useEffect(() => {
    loadIncomes();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setNewName('');
    setNewType('Salary');
    setNewAmount('');
    setNewFrequency('monthly');
    setNewAccountId(accounts[0]?.id ? String(accounts[0].id) : '');
    setNewNextPayDate('');
    setAddOpen(true);
  };

  const openEdit = (income) => {
    setEditingId(income.id);
    setNewName(income.name);
    setNewType(income.type);
    setNewAmount(String(income.amount));
    setNewFrequency(income.frequency);
    setNewAccountId(income.account_id ? String(income.account_id) : '');
    setNewNextPayDate(income.next_pay_date || '');
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!newName || !newType || !newAmount) {
      toast.push('Name, type, and amount are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      if (editingId) {
        await api.put(`${apiPaths.incomeSources}/${editingId}`, {
          name: newName.trim(),
          type: newType.trim(),
          amount: Number(newAmount),
          frequency: newFrequency,
          account_id: newAccountId ? Number(newAccountId) : null,
          next_pay_date: newNextPayDate || null,
        });
        toast.push('Income source updated', 'success');
      } else {
        await api.post(apiPaths.incomeSources, {
          name: newName.trim(),
          type: newType.trim(),
          amount: Number(newAmount),
          frequency: newFrequency,
          account_id: newAccountId ? Number(newAccountId) : null,
          next_pay_date: newNextPayDate || null,
        });
        toast.push('Income source added', 'success');
      }
      await loadIncomes();
      setAddOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to save income source', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (incomeId) => {
    try {
      await api.delete(`${apiPaths.incomeSources}/${incomeId}`);
      toast.push('Income source deleted', 'success');
      await loadIncomes();
      setDeleteConfirm(null);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to delete income source', 'error');
    }
  };

  const handlePostIncome = async (incomeId) => {
    try {
      await api.post(`${apiPaths.incomeSources}/${incomeId}/post`);
      toast.push('Income posted successfully', 'success');
      await loadIncomes();
      await loadAll();
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to post income', 'error');
    }
  };

  return (
    <>
      <AppHeader title="Income" action={<button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3"><Plus size={14} /> Add</button>} />
      <main className="px-4 pt-3 space-y-4">
        {incomes.length === 0 ? (
          <div className="card p-6 text-center text-sm text-text-muted">No income sources yet.</div>
        ) : null}
        {incomes.map((income) => {
          const days = daysUntil(income.next_pay_date);
          const dueToday = days === 0;
          const overdue = days !== null && days < 0;
          return (
            <div key={income.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">{income.name}</div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handlePostIncome(income.id)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ color: 'var(--positive)' }}
                  >
                    <DollarSign size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(income)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ color: 'var(--accent)' }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(income.id)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ color: 'var(--negative)' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
                <span className="px-2 py-1 rounded" style={{ backgroundColor: 'var(--positive-alpha)', color: 'var(--positive)' }}>
                  {income.type}
                </span>
                <span>·</span>
                <span className="font-mono">{formatBDT(income.amount)}</span>
                <span>·</span>
                <span>{income.frequency}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Calendar size={14} />
                <span>Next pay: {income.next_pay_date || 'Not set'}</span>
                {days !== null && (
                  <span style={{ color: overdue ? 'var(--negative)' : dueToday ? 'var(--warning)' : '' }}>
                    ({overdue ? `${Math.abs(days)}d overdue` : dueToday ? 'Today' : `${days}d`})
                  </span>
                )}
              </div>
              {income.account_name && (
                <div className="text-xs text-text-muted mt-2">
                  <div className="flex items-center gap-1">
                    <Briefcase size={12} />
                    Account: {income.account_name}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </main>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={editingId ? 'Edit Income' : 'Add Income'}>
        <label className="block text-xs text-text-muted mb-1">Name</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Main Salary"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Type</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Salary, Freelance, Business"
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Amount (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 50000"
          value={newAmount}
          onChange={(e) => setNewAmount(e.target.value.replace(/[^\d]/g, ''))}
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

        <label className="block text-xs text-text-muted mb-1">Account (optional)</label>
        <select
          className="input mb-3"
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

        <label className="block text-xs text-text-muted mb-1">Next pay date (optional)</label>
        <input
          className="input mb-4"
          type="date"
          value={newNextPayDate}
          onChange={(e) => setNewNextPayDate(e.target.value)}
        />

        <ActionButton variant="primary" className="w-full" loading={addLoading} onClick={handleAdd}>
          {editingId ? 'Update' : 'Add'}
        </ActionButton>
      </BottomSheet>

      <BottomSheet open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete Income">
        <p className="text-sm text-text-muted mb-4">Are you sure you want to delete this income source?</p>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</ActionButton>
        </div>
      </BottomSheet>
    </>
  );
}
