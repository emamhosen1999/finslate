import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Shield, Calendar, Wallet } from 'lucide-react';

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

export default function Insurance() {
  const { accounts, loadAll } = useFinance();
  const toast = useToast();
  const [insurance, setInsurance] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('Health');
  const [newProvider, setNewProvider] = useState('');
  const [newPremium, setNewPremium] = useState('');
  const [newFrequency, setNewFrequency] = useState('yearly');
  const [newNextDue, setNewNextDue] = useState('');
  const [newAccountId, setNewAccountId] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payInsId, setPayInsId] = useState(null);
  const [payAccountId, setPayAccountId] = useState('');

  const loadInsurance = async () => {
    try {
      const res = await api.get(apiPaths.insurance);
      setInsurance(res.data);
    } catch (err) {
      console.error('Failed to load insurance:', err);
    }
  };

  useEffect(() => {
    loadInsurance();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setNewName('');
    setNewType('Health');
    setNewProvider('');
    setNewPremium('');
    setNewFrequency('yearly');
    setNewNextDue('');
    setNewAccountId(accounts[0]?.id ? String(accounts[0].id) : '');
    setAddOpen(true);
  };

  const openEdit = (ins) => {
    setEditingId(ins.id);
    setNewName(ins.name);
    setNewType(ins.type);
    setNewProvider(ins.provider || '');
    setNewPremium(String(ins.premium_amount));
    setNewFrequency(ins.frequency);
    setNewNextDue(ins.next_due_date || '');
    setNewAccountId(ins.account_id ? String(ins.account_id) : '');
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!newName || !newType || !newPremium) {
      toast.push('Name, type, and premium amount are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      if (editingId) {
        await api.put(`${apiPaths.insurance}/${editingId}`, {
          name: newName.trim(),
          type: newType.trim(),
          provider: newProvider.trim() || null,
          premium_amount: Number(newPremium),
          frequency: newFrequency,
          next_due_date: newNextDue || null,
          account_id: newAccountId ? Number(newAccountId) : null,
        });
        toast.push('Insurance updated', 'success');
      } else {
        await api.post(apiPaths.insurance, {
          name: newName.trim(),
          type: newType.trim(),
          provider: newProvider.trim() || null,
          premium_amount: Number(newPremium),
          frequency: newFrequency,
          next_due_date: newNextDue || null,
          account_id: newAccountId ? Number(newAccountId) : null,
        });
        toast.push('Insurance added', 'success');
      }
      await loadInsurance();
      setAddOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to save insurance', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (insId) => {
    try {
      await api.delete(`${apiPaths.insurance}/${insId}`);
      toast.push('Insurance deleted', 'success');
      await loadInsurance();
      setDeleteConfirm(null);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to delete insurance', 'error');
    }
  };

  const openPay = (ins) => {
    setPayInsId(ins.id);
    setPayAccountId(ins.account_id ? String(ins.account_id) : accounts[0]?.id ? String(accounts[0].id) : '');
    setPayOpen(true);
  };

  const handlePay = async () => {
    setPayLoading(true);
    try {
      await api.post(`${apiPaths.insurance}/${payInsId}/pay`, {
        account_id: payAccountId ? Number(payAccountId) : null,
      });
      toast.push('Payment successful', 'success');
      await loadInsurance();
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
      <AppHeader title="Insurance" action={<button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3"><Plus size={14} /> Add</button>} />
      <main className="px-4 pt-3 space-y-4">
        {insurance.length === 0 ? (
          <div className="card p-6 text-center text-sm text-text-muted">No insurance policies yet.</div>
        ) : null}
        {insurance.map((ins) => {
          const days = daysUntil(ins.next_due_date);
          const overdue = days !== null && days < 0;
          const dueToday = days === 0;
          return (
            <div key={ins.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">{ins.name}</div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openPay(ins)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ color: 'var(--positive)' }}
                  >
                    <Wallet size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(ins)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ color: 'var(--accent)' }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(ins.id)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ color: 'var(--negative)' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
                <span className="px-2 py-1 rounded" style={{ backgroundColor: 'var(--accent-alpha)', color: 'var(--accent)' }}>
                  {ins.type}
                </span>
                {ins.provider && (
                  <>
                    <span>·</span>
                    <span>{ins.provider}</span>
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                <div>
                  <div className="text-text-muted">Premium</div>
                  <div className="font-mono">{formatBDT(ins.premium_amount)}</div>
                </div>
                <div className="text-right">
                  <div className="text-text-muted">Frequency</div>
                  <div>{ins.frequency}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Calendar size={14} />
                <span>Next due: {ins.next_due_date || 'Not set'}</span>
                {days !== null && (
                  <span style={{ color: overdue ? 'var(--negative)' : dueToday ? 'var(--warning)' : '' }}>
                    ({overdue ? `${Math.abs(days)}d overdue` : dueToday ? 'Today' : `${days}d`})
                  </span>
                )}
              </div>
              {ins.account_name && (
                <div className="text-xs text-text-muted mt-2">
                  <div className="flex items-center gap-1">
                    <Shield size={12} />
                    Account: {ins.account_name}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </main>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={editingId ? 'Edit Insurance' : 'Add Insurance'}>
        <label className="block text-xs text-text-muted mb-1">Name</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Health Insurance"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Type</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Health, Life, Vehicle"
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Provider (optional)</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. MetLife"
          value={newProvider}
          onChange={(e) => setNewProvider(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Premium amount (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 25000"
          value={newPremium}
          onChange={(e) => setNewPremium(e.target.value.replace(/[^\d]/g, ''))}
        />

        <label className="block text-xs text-text-muted mb-1">Frequency</label>
        <select
          className="input mb-3"
          value={newFrequency}
          onChange={(e) => setNewFrequency(e.target.value)}
        >
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>

        <label className="block text-xs text-text-muted mb-1">Next due date (optional)</label>
        <input
          className="input mb-3"
          type="date"
          value={newNextDue}
          onChange={(e) => setNewNextDue(e.target.value)}
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

      <BottomSheet open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete Insurance">
        <p className="text-sm text-text-muted mb-4">Are you sure you want to delete this insurance policy?</p>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</ActionButton>
        </div>
      </BottomSheet>

      <BottomSheet open={payOpen} onClose={() => setPayOpen(false)} title="Pay Insurance Premium">
        <label className="block text-xs text-text-muted mb-1">Pay from account</label>
        <select
          className="input mb-4"
          value={payAccountId}
          onChange={(e) => setPayAccountId(e.target.value)}
        >
          <option value="">Select account</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {formatBDT(a.balance)}
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
