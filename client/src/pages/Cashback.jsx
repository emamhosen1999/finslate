import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Gift, Calendar, TrendingUp } from 'lucide-react';

import AppHeader from '../components/AppHeader.jsx';
import ActionButton from '../components/ActionButton.jsx';
import BottomSheet from '../components/BottomSheet.jsx';
import { useFinance } from '../context/FinanceContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { apiPaths } from '../api/client';
import { formatBDT } from '../utils/formatBDT';

export default function Cashback() {
  const { accounts } = useFinance();
  const toast = useToast();
  const [cashback, setCashback] = useState([]);
  const [summary, setSummary] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newSource, setNewSource] = useState('');
  const [newType, setNewType] = useState('Cashback');
  const [newAmount, setNewAmount] = useState('');
  const [newAccountId, setNewAccountId] = useState('');
  const [newDateReceived, setNewDateReceived] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const loadCashback = async () => {
    try {
      const res = await api.get(apiPaths.cashback);
      setCashback(res.data);
    } catch (err) {
      console.error('Failed to load cashback:', err);
    }
  };

  const loadSummary = async () => {
    try {
      const res = await api.get(`${apiPaths.cashback}/summary`);
      setSummary(res.data);
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  };

  useEffect(() => {
    loadCashback();
    loadSummary();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setNewSource('');
    setNewType('Cashback');
    setNewAmount('');
    setNewAccountId(accounts[0]?.id ? String(accounts[0].id) : '');
    setNewDateReceived('');
    setAddOpen(true);
  };

  const openEdit = (cb) => {
    setEditingId(cb.id);
    setNewSource(cb.source);
    setNewType(cb.type);
    setNewAmount(String(cb.amount));
    setNewAccountId(cb.account_id ? String(cb.account_id) : '');
    setNewDateReceived(cb.date_received || '');
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!newSource || !newType || !newAmount) {
      toast.push('Source, type, and amount are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      if (editingId) {
        await api.put(`${apiPaths.cashback}/${editingId}`, {
          source: newSource.trim(),
          type: newType.trim(),
          amount: Number(newAmount),
          account_id: newAccountId ? Number(newAccountId) : null,
          date_received: newDateReceived || null,
        });
        toast.push('Cashback/reward updated', 'success');
      } else {
        await api.post(apiPaths.cashback, {
          source: newSource.trim(),
          type: newType.trim(),
          amount: Number(newAmount),
          account_id: newAccountId ? Number(newAccountId) : null,
          date_received: newDateReceived || null,
        });
        toast.push('Cashback/reward added', 'success');
      }
      await loadCashback();
      await loadSummary();
      setAddOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to save cashback/reward', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (cbId) => {
    try {
      await api.delete(`${apiPaths.cashback}/${cbId}`);
      toast.push('Cashback/reward deleted', 'success');
      await loadCashback();
      await loadSummary();
      setDeleteConfirm(null);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to delete cashback/reward', 'error');
    }
  };

  const totalRewards = summary.reduce((sum, s) => sum + Number(s.total), 0);

  return (
    <>
      <AppHeader title="Cashback & Rewards" action={<button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3"><Plus size={14} /> Add</button>} />
      <main className="px-4 pt-3 space-y-4">
        {summary.length > 0 && (
          <div className="card p-4">
            <div className="text-xs text-text-muted mb-2">Total Rewards</div>
            <div className="text-2xl font-mono" style={{ color: 'var(--positive)' }}>{formatBDT(totalRewards)}</div>
            <div className="mt-3 space-y-2">
              {summary.slice(0, 5).map((s, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span>{s.source} · {s.type}</span>
                  <span className="font-mono">{formatBDT(s.total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {cashback.length === 0 ? (
          <div className="card p-6 text-center text-sm text-text-muted">No cashback or rewards recorded yet.</div>
        ) : null}
        {cashback.map((cb) => (
          <div key={cb.id} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">{cb.source}</div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(cb)}
                  className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                  style={{ color: 'var(--accent)' }}
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(cb.id)}
                  className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                  style={{ color: 'var(--negative)' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
              <span className="px-2 py-1 rounded" style={{ backgroundColor: 'var(--positive-alpha)', color: 'var(--positive)' }}>
                {cb.type}
              </span>
              <span>·</span>
              <span className="font-mono">{formatBDT(cb.amount)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Calendar size={14} />
              <span>Received: {cb.date_received || 'Not specified'}</span>
            </div>
            {cb.account_name && (
              <div className="text-xs text-text-muted mt-2">
                Account: {cb.account_name}
              </div>
            )}
          </div>
        ))}
      </main>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={editingId ? 'Edit Cashback/Reward' : 'Add Cashback/Reward'}>
        <label className="block text-xs text-text-muted mb-1">Source</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Amazon, Credit Card, Bkash"
          value={newSource}
          onChange={(e) => setNewSource(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Type</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Cashback, Reward, Points"
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Amount (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 500"
          value={newAmount}
          onChange={(e) => setNewAmount(e.target.value.replace(/[^\d]/g, ''))}
        />

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

        <label className="block text-xs text-text-muted mb-1">Date received (optional)</label>
        <input
          className="input mb-4"
          type="date"
          value={newDateReceived}
          onChange={(e) => setNewDateReceived(e.target.value)}
        />

        <ActionButton variant="primary" className="w-full" loading={addLoading} onClick={handleAdd}>
          {editingId ? 'Update' : 'Add'}
        </ActionButton>
      </BottomSheet>

      <BottomSheet open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete Cashback/Reward">
        <p className="text-sm text-text-muted mb-4">Are you sure you want to delete this cashback/reward?</p>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</ActionButton>
        </div>
      </BottomSheet>
    </>
  );
}
