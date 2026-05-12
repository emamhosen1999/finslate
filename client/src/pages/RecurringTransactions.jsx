import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Repeat, Calendar, Power } from 'lucide-react';

import AppHeader from '../components/AppHeader.jsx';
import ActionButton from '../components/ActionButton.jsx';
import BottomSheet from '../components/BottomSheet.jsx';
import { useFinance } from '../context/FinanceContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { apiPaths } from '../api/client';
import { formatBDT } from '../utils/formatBDT';

const RULE_TYPES = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'dps_installment', label: 'DPS Installment' },
  { value: 'loan_emi', label: 'Loan EMI' },
  { value: 'cc_payment', label: 'CC Payment' },
  { value: 'bill_payment', label: 'Bill Payment' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'insurance_premium', label: 'Insurance Premium' },
  { value: 'goal_contribution', label: 'Goal Contribution' },
];

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi_weekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const defaultForm = {
  name: '',
  rule_type: 'expense',
  amount: '',
  description: '',
  frequency: 'monthly',
  day_of_month: '',
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  source_account_id: '',
  destination_account_id: '',
  auto_create_transaction: true,
};

export default function RecurringTransactions() {
  const { accounts, loadAll } = useFinance();
  const toast = useToast();
  const [rules, setRules] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formData, setFormData] = useState({ ...defaultForm });

  const loadRules = async () => {
    try {
      const res = await api.get(apiPaths.recurringRules);
      setRules(res.data);
    } catch (err) {
      console.error('Failed to load recurring rules:', err);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const set = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));

  const openAdd = () => {
    setEditingId(null);
    setFormData({ ...defaultForm, source_account_id: accounts[0]?.id ? String(accounts[0].id) : '' });
    setAddOpen(true);
  };

  const openEdit = (rule) => {
    setEditingId(rule.id);
    setFormData({
      name: rule.name,
      rule_type: rule.rule_type,
      amount: String(rule.amount),
      description: rule.description || '',
      frequency: rule.frequency,
      day_of_month: rule.day_of_month ? String(rule.day_of_month) : '',
      start_date: rule.start_date ? rule.start_date.split('T')[0] : '',
      end_date: rule.end_date ? rule.end_date.split('T')[0] : '',
      source_account_id: rule.source_account_id ? String(rule.source_account_id) : '',
      destination_account_id: rule.destination_account_id ? String(rule.destination_account_id) : '',
      auto_create_transaction: !!rule.auto_create_transaction,
    });
    setAddOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.amount || !formData.frequency || !formData.start_date) {
      toast.push('Name, amount, frequency, and start date are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        rule_type: formData.rule_type,
        amount: Number(formData.amount),
        description: formData.description.trim() || null,
        frequency: formData.frequency,
        day_of_month: formData.day_of_month ? Number(formData.day_of_month) : null,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        source_account_id: formData.source_account_id ? Number(formData.source_account_id) : null,
        destination_account_id: formData.destination_account_id ? Number(formData.destination_account_id) : null,
        auto_create_transaction: formData.auto_create_transaction,
      };
      if (editingId) {
        await api.put(`${apiPaths.recurringRules}/${editingId}`, payload);
        toast.push('Recurring rule updated', 'success');
      } else {
        await api.post(apiPaths.recurringRules, payload);
        toast.push('Recurring rule added', 'success');
      }
      await loadRules();
      await loadAll();
      setAddOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to save recurring rule', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (ruleId) => {
    try {
      await api.delete(`${apiPaths.recurringRules}/${ruleId}`);
      toast.push('Recurring rule deleted', 'success');
      await loadRules();
      setDeleteConfirm(null);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to delete recurring rule', 'error');
    }
  };

  const handleProcess = async (ruleId) => {
    try {
      await api.post(`${apiPaths.recurringRules}/${ruleId}/process`);
      toast.push('Transaction processed', 'success');
      await loadRules();
      await loadAll();
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to process', 'error');
    }
  };

  const handleToggleActive = async (rule) => {
    try {
      await api.put(`${apiPaths.recurringRules}/${rule.id}`, { is_active: !rule.is_active });
      await loadRules();
    } catch (err) {
      toast.push('Failed to toggle status', 'error');
    }
  };

  const typeColors = {
    income: { bg: 'var(--positive-alpha)', fg: 'var(--positive)' },
    expense: { bg: 'var(--negative-alpha)', fg: 'var(--negative)' },
  };

  return (
    <>
      <AppHeader title="Recurring" action={<button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3"><Plus size={14} /> Add</button>} />
      <main className="px-4 pt-3 space-y-4">
        {rules.length === 0 ? (
          <div className="card p-6 text-center text-sm text-text-muted">No recurring rules set up.</div>
        ) : null}
        {rules.map((rule) => {
          const days = daysUntil(rule.next_due_date);
          const overdue = days !== null && days < 0;
          const dueToday = days === 0;
          const colors = typeColors[rule.rule_type] || { bg: 'var(--bg-elevated)', fg: 'var(--text-muted)' };
          return (
            <div key={rule.id} className="card p-4" style={{ opacity: rule.is_active ? 1 : 0.5 }}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold truncate">{rule.name}</div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => handleProcess(rule.id)} className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors" style={{ color: 'var(--positive)' }} title="Process now">
                    <Repeat size={14} />
                  </button>
                  <button type="button" onClick={() => handleToggleActive(rule)} className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors" style={{ color: rule.is_active ? 'var(--positive)' : 'var(--text-muted)' }} title={rule.is_active ? 'Deactivate' : 'Activate'}>
                    <Power size={14} />
                  </button>
                  <button type="button" onClick={() => openEdit(rule)} className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors" style={{ color: 'var(--accent)' }}>
                    <Pencil size={14} />
                  </button>
                  <button type="button" onClick={() => setDeleteConfirm(rule.id)} className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors" style={{ color: 'var(--negative)' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
                <span className="px-2 py-0.5 rounded" style={{ backgroundColor: colors.bg, color: colors.fg }}>
                  {rule.rule_type.replace(/_/g, ' ')}
                </span>
                <span>·</span>
                <span>{rule.frequency.replace(/_/g, '-')}</span>
                <span>·</span>
                <span className="font-mono">{formatBDT(rule.amount)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Calendar size={12} />
                <span>Next: {rule.next_due_date ? new Date(rule.next_due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}</span>
                {days !== null && (
                  <span style={{ color: overdue ? 'var(--negative)' : dueToday ? 'var(--warning)' : '' }}>
                    ({overdue ? `${Math.abs(days)}d overdue` : dueToday ? 'Today' : `${days}d`})
                  </span>
                )}
                {rule.last_executed_date && (
                  <span className="ml-auto">Last: {new Date(rule.last_executed_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                )}
              </div>
              {(rule.source_account_name || rule.destination_account_name) && (
                <div className="text-xs text-text-muted mt-2">
                  {rule.source_account_name && <span>From: {rule.source_account_name}</span>}
                  {rule.source_account_name && rule.destination_account_name && <span> · </span>}
                  {rule.destination_account_name && <span>To: {rule.destination_account_name}</span>}
                </div>
              )}
            </div>
          );
        })}
      </main>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={editingId ? 'Edit Rule' : 'Add Recurring Rule'}>
        <label className="block text-xs text-text-muted mb-1">Name</label>
        <input className="input mb-3" type="text" placeholder="e.g. Netflix Subscription" value={formData.name} onChange={(e) => set('name', e.target.value)} />

        <label className="block text-xs text-text-muted mb-1">Rule Type</label>
        <select className="input mb-3" value={formData.rule_type} onChange={(e) => set('rule_type', e.target.value)}>
          {RULE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        <label className="block text-xs text-text-muted mb-1">Amount (BDT)</label>
        <input className="input mb-3" type="text" inputMode="numeric" placeholder="e.g. 500" value={formData.amount} onChange={(e) => set('amount', e.target.value.replace(/[^\d.]/g, ''))} />

        <label className="block text-xs text-text-muted mb-1">Description (optional)</label>
        <input className="input mb-3" type="text" placeholder="e.g. Monthly subscription" value={formData.description} onChange={(e) => set('description', e.target.value)} />

        <label className="block text-xs text-text-muted mb-1">Frequency</label>
        <select className="input mb-3" value={formData.frequency} onChange={(e) => set('frequency', e.target.value)}>
          {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>

        {['monthly', 'quarterly', 'yearly'].includes(formData.frequency) && (
          <>
            <label className="block text-xs text-text-muted mb-1">Day of month (optional)</label>
            <input className="input mb-3" type="number" min="1" max="28" placeholder="e.g. 1" value={formData.day_of_month} onChange={(e) => set('day_of_month', e.target.value)} />
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Start date</label>
            <input className="input mb-3" type="date" value={formData.start_date} onChange={(e) => set('start_date', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">End date (optional)</label>
            <input className="input mb-3" type="date" value={formData.end_date} onChange={(e) => set('end_date', e.target.value)} />
          </div>
        </div>

        <label className="block text-xs text-text-muted mb-1">Source Account (optional)</label>
        <select className="input mb-3" value={formData.source_account_id} onChange={(e) => set('source_account_id', e.target.value)}>
          <option value="">None</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {formatBDT(a.current_balance)}</option>)}
        </select>

        {formData.rule_type === 'transfer' && (
          <>
            <label className="block text-xs text-text-muted mb-1">Destination Account</label>
            <select className="input mb-3" value={formData.destination_account_id} onChange={(e) => set('destination_account_id', e.target.value)}>
              <option value="">None</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {formatBDT(a.current_balance)}</option>)}
            </select>
          </>
        )}

        <label className="flex items-center gap-2 text-xs text-text-muted mb-4 cursor-pointer">
          <input type="checkbox" checked={formData.auto_create_transaction} onChange={(e) => set('auto_create_transaction', e.target.checked)} className="w-4 h-4" />
          Auto-create transaction on process
        </label>

        <ActionButton variant="primary" className="w-full" loading={addLoading} onClick={handleSubmit}>
          {editingId ? 'Update' : 'Add Rule'}
        </ActionButton>
      </BottomSheet>

      <BottomSheet open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete Rule">
        <p className="text-sm text-text-muted mb-4">Are you sure you want to delete this recurring rule?</p>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</ActionButton>
        </div>
      </BottomSheet>
    </>
  );
}
