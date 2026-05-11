import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown } from 'lucide-react';

import AppHeader from '../components/AppHeader.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import ActionButton from '../components/ActionButton.jsx';
import BottomSheet from '../components/BottomSheet.jsx';
import { useFinance } from '../context/FinanceContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { apiPaths } from '../api/client';
import { formatBDT } from '../utils/formatBDT';

export default function Budgets() {
  const toast = useToast();
  const [budgets, setBudgets] = useState([]);
  const [spending, setSpending] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newPeriod, setNewPeriod] = useState('monthly');
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const loadBudgets = async () => {
    try {
      const [budgetsRes, spendingRes] = await Promise.all([
        api.get(apiPaths.budgets),
        api.get(`${apiPaths.budgets}/spending?period=monthly`),
      ]);
      setBudgets(budgetsRes.data);
      setSpending(spendingRes.data);
    } catch (err) {
      console.error('Failed to load budgets:', err);
    }
  };

  useEffect(() => {
    loadBudgets();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setNewCategory('');
    setNewAmount('');
    setNewPeriod('monthly');
    setAddOpen(true);
  };

  const openEdit = (budget) => {
    setEditingId(budget.id);
    setNewCategory(budget.category);
    setNewAmount(String(budget.amount));
    setNewPeriod(budget.period);
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!newCategory || !newAmount) {
      toast.push('Category and amount are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      if (editingId) {
        await api.put(`${apiPaths.budgets}/${editingId}`, {
          category: newCategory.trim(),
          amount: Number(newAmount),
          period: newPeriod,
        });
        toast.push('Budget updated', 'success');
      } else {
        await api.post(apiPaths.budgets, {
          category: newCategory.trim(),
          amount: Number(newAmount),
          period: newPeriod,
        });
        toast.push('Budget added', 'success');
      }
      await loadBudgets();
      setAddOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to save budget', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (budgetId) => {
    try {
      await api.delete(`${apiPaths.budgets}/${budgetId}`);
      toast.push('Budget deleted', 'success');
      await loadBudgets();
      setDeleteConfirm(null);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to delete budget', 'error');
    }
  };

  const getSpendingForCategory = (category) => {
    const found = spending.find((s) => s.category === category);
    return found ? Number(found.spent) : 0;
  };

  return (
    <>
      <AppHeader title="Budgets" action={<button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3"><Plus size={14} /> Add</button>} />
      <main className="px-4 pt-3 space-y-4">
        {budgets.length === 0 ? (
          <div className="card p-6 text-center text-sm text-text-muted">No budgets set yet.</div>
        ) : null}
        {budgets.map((b) => {
          const spent = getSpendingForCategory(b.category);
          const budgetAmount = Number(b.amount);
          const pct = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
          const overBudget = spent > budgetAmount;
          return (
            <div key={b.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">{b.category}</div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(b)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ color: 'var(--accent)' }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(b.id)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ color: 'var(--negative)' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm mb-2">
                <div className="flex items-center gap-2">
                  <TrendingDown size={16} style={{ color: 'var(--negative)' }} />
                  <span className="text-text-muted">Spent</span>
                  <span className="font-mono">{formatBDT(spent)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} style={{ color: 'var(--accent)' }} />
                  <span className="text-text-muted">Budget</span>
                  <span className="font-mono">{formatBDT(budgetAmount)}</span>
                </div>
              </div>
              <div className="px-1">
                <div className="flex justify-between text-[11px] text-text-muted mb-1">
                  <span>{overBudget ? 'Over budget' : 'Used'}</span>
                  <span className="font-mono">
                    {pct.toFixed(1)}%
                  </span>
                </div>
                <ProgressBar
                  value={Math.min(spent, budgetAmount)}
                  max={budgetAmount}
                  color={overBudget ? 'var(--negative)' : pct > 80 ? 'var(--warning)' : 'var(--positive)'}
                />
                {overBudget && (
                  <div className="text-xs text-[var(--negative)] mt-2">
                    Over budget by {formatBDT(spent - budgetAmount)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </main>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={editingId ? 'Edit Budget' : 'Add Budget'}>
        <label className="block text-xs text-text-muted mb-1">Category</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Food, Transport, Entertainment"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Budget amount (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 10000"
          value={newAmount}
          onChange={(e) => setNewAmount(e.target.value.replace(/[^\d]/g, ''))}
        />

        <label className="block text-xs text-text-muted mb-1">Period</label>
        <select
          className="input mb-4"
          value={newPeriod}
          onChange={(e) => setNewPeriod(e.target.value)}
        >
          <option value="monthly">Monthly</option>
          <option value="weekly">Weekly</option>
          <option value="yearly">Yearly</option>
        </select>

        <ActionButton variant="primary" className="w-full" loading={addLoading} onClick={handleAdd}>
          {editingId ? 'Update Budget' : 'Add Budget'}
        </ActionButton>
      </BottomSheet>

      <BottomSheet open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete Budget">
        <p className="text-sm text-text-muted mb-4">Are you sure you want to delete this budget?</p>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</ActionButton>
        </div>
      </BottomSheet>
    </>
  );
}
