import { useState, useEffect } from 'react';
import { CreditCard, Plus, Pencil, Trash2, Play, Pause, CheckCircle } from 'lucide-react';

import AppHeader from '../components/AppHeader.jsx';
import ActionButton from '../components/ActionButton.jsx';
import BottomSheet from '../components/BottomSheet.jsx';
import { useFinance } from '../context/FinanceContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { apiPaths } from '../api/client';
import { formatBDT } from '../utils/formatBDT';

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Subscriptions() {
  const toast = useToast();
  const { accounts } = useFinance();
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    service_name: '',
    amount: '',
    billing_cycle: 'monthly',
    start_date: new Date().toISOString().split('T')[0],
    account_id: '',
  });

  const loadSubscriptions = async () => {
    setLoading(true);
    try {
      const res = await api.get(apiPaths.subscriptions);
      setSubscriptions(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setFormData({
      name: '',
      service_name: '',
      amount: '',
      billing_cycle: 'monthly',
      start_date: new Date().toISOString().split('T')[0],
      account_id: '',
    });
    setAddOpen(true);
  };

  const openEdit = (sub) => {
    setEditingId(sub.id);
    setFormData({
      name: sub.name,
      service_name: sub.service_name,
      amount: sub.amount,
      billing_cycle: sub.billing_cycle,
      start_date: sub.start_date,
      account_id: sub.account_id || '',
    });
    setAddOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.amount || !formData.start_date) {
      toast.push('Name, amount, and start date are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      if (editingId) {
        await api.put(`${apiPaths.subscriptions}/${editingId}`, formData);
        toast.push('Subscription updated', 'success');
      } else {
        await api.post(apiPaths.subscriptions, formData);
        toast.push('Subscription added', 'success');
      }
      await loadSubscriptions();
      setAddOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`${apiPaths.subscriptions}/${id}`);
      toast.push('Subscription deleted', 'success');
      await loadSubscriptions();
      setDeleteConfirm(null);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to delete', 'error');
    }
  };

  const processPayment = async (sub) => {
    try {
      await api.post(`${apiPaths.subscriptions}/${sub.id}/process`, {
        account_id: sub.account_id || accounts[0]?.id,
        payment_date: new Date().toISOString().split('T')[0],
      });
      toast.push('Payment processed', 'success');
      await loadSubscriptions();
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to process payment', 'error');
    }
  };

  if (loading) {
    return (
      <div className="app-frame flex items-center justify-center">
        <div className="skeleton h-6 w-40" />
      </div>
    );
  }

  return (
    <>
      <AppHeader 
        title="Subscriptions" 
        action={
          <button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3">
            <Plus size={14} /> Add
          </button>
        } 
      />
      <main className="px-4 pt-3 space-y-3">
        {subscriptions.map((s) => (
          <div key={s.id} className="card p-4">
            <div className="flex items-start gap-3">
              <div
                className="rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  width: 40, height: 40,
                  background: s.status === 'active' ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                  color: s.status === 'active' ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                <CreditCard size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="font-semibold truncate">{s.name}</div>
                  <div className="flex items-center gap-1">
                    {s.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => processPayment(s)}
                        className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                        style={{ color: 'var(--positive)' }}
                      >
                        <CheckCircle size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEdit(s)}
                      className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                      style={{ color: 'var(--accent)' }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(s.id)}
                      className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                      style={{ color: 'var(--negative)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-text-muted mb-2">
                  {s.service_name || 'No service name'} · {s.billing_cycle}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-text-muted">Amount</div>
                    <div className="font-mono">{formatBDT(s.amount)}</div>
                  </div>
                  <div>
                    <div className="text-text-muted">Next Billing</div>
                    <div>{fmtDate(s.next_billing)}</div>
                  </div>
                </div>
                <div className="mt-2">
                  <span
                    className="text-[10px] uppercase rounded-full px-2 py-[2px]"
                    style={{
                      background: s.status === 'active' ? 'var(--positive-soft)' : 'var(--bg-elevated)',
                      color: s.status === 'active' ? 'var(--positive)' : 'var(--text-muted)',
                    }}
                  >
                    {s.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {subscriptions.length === 0 && (
          <div className="text-center py-8 text-text-muted">
            <CreditCard size={48} className="mx-auto mb-3 opacity-30" />
            <p>No subscriptions added yet</p>
          </div>
        )}
      </main>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={editingId ? 'Edit Subscription' : 'Add Subscription'}>
        <label className="block text-xs text-text-muted mb-1">Name</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Netflix"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-1">Service Name (optional)</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Netflix Inc."
          value={formData.service_name}
          onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-1">Amount (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 1200"
          value={formData.amount}
          onChange={(e) => setFormData({ ...formData, amount: e.target.value.replace(/[^\d]/g, '') })}
        />

        <label className="block text-xs text-text-muted mb-1">Billing Cycle</label>
        <select className="input mb-3" value={formData.billing_cycle} onChange={(e) => setFormData({ ...formData, billing_cycle: e.target.value })}>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>

        <label className="block text-xs text-text-muted mb-1">Start Date</label>
        <input
          className="input mb-3"
          type="date"
          value={formData.start_date}
          onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-1">Account (optional)</label>
        <select className="input mb-4" value={formData.account_id} onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}>
          <option value="">No account</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <ActionButton variant="primary" className="w-full" loading={addLoading} onClick={handleSubmit}>
          {editingId ? 'Update' : 'Add'}
        </ActionButton>
      </BottomSheet>

      <BottomSheet open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete Subscription">
        <p className="text-sm text-text-muted mb-4">Are you sure you want to delete this subscription?</p>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</ActionButton>
        </div>
      </BottomSheet>
    </>
  );
}
