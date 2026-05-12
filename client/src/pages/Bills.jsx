import { useState, useEffect } from 'react';
import { FileText, Plus, Pencil, Trash2, CheckCircle, AlertCircle } from 'lucide-react';

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

export default function Bills() {
  const toast = useToast();
  const { accounts } = useFinance();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'utility',
    provider: '',
    amount: '',
    due_date: new Date().toISOString().split('T')[0],
    frequency: 'monthly',
    account_id: '',
  });

  const loadBills = async () => {
    setLoading(true);
    try {
      const res = await api.get(apiPaths.bills);
      setBills(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBills();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setFormData({
      name: '',
      type: 'utility',
      provider: '',
      amount: '',
      due_date: new Date().toISOString().split('T')[0],
      frequency: 'monthly',
      account_id: '',
    });
    setAddOpen(true);
  };

  const openEdit = (bill) => {
    setEditingId(bill.id);
    setFormData({
      name: bill.name,
      type: bill.type,
      provider: bill.provider,
      amount: bill.amount,
      due_date: bill.due_date,
      frequency: bill.frequency,
      account_id: bill.account_id || '',
    });
    setAddOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.amount || !formData.due_date) {
      toast.push('Name, amount, and due date are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      if (editingId) {
        await api.put(`${apiPaths.bills}/${editingId}`, formData);
        toast.push('Bill updated', 'success');
      } else {
        await api.post(apiPaths.bills, formData);
        toast.push('Bill added', 'success');
      }
      await loadBills();
      setAddOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`${apiPaths.bills}/${id}`);
      toast.push('Bill deleted', 'success');
      await loadBills();
      setDeleteConfirm(null);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to delete', 'error');
    }
  };

  const markAsPaid = async (bill) => {
    try {
      await api.post(`${apiPaths.bills}/${bill.id}/pay`, {
        account_id: bill.account_id || accounts[0]?.id,
        payment_date: new Date().toISOString().split('T')[0],
      });
      toast.push('Bill marked as paid', 'success');
      await loadBills();
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to mark as paid', 'error');
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
        title="Bills" 
        action={
          <button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3">
            <Plus size={14} /> Add
          </button>
        } 
      />
      <main className="px-4 pt-3 space-y-3">
        {bills.map((b) => (
          <div key={b.id} className="card p-4">
            <div className="flex items-start gap-3">
              <div
                className="rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  width: 40, height: 40,
                  background: b.status === 'paid' ? 'var(--positive-soft)' : b.status === 'overdue' ? 'var(--negative-soft)' : 'var(--accent-soft)',
                  color: b.status === 'paid' ? 'var(--positive)' : b.status === 'overdue' ? 'var(--negative)' : 'var(--accent)',
                }}
              >
                {b.status === 'paid' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="font-semibold truncate">{b.name}</div>
                  <div className="flex items-center gap-1">
                    {b.status !== 'paid' && (
                      <button
                        type="button"
                        onClick={() => markAsPaid(b)}
                        className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                        style={{ color: 'var(--positive)' }}
                      >
                        <CheckCircle size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEdit(b)}
                      className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                      style={{ color: 'var(--accent)' }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(b.id)}
                      className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                      style={{ color: 'var(--negative)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-text-muted mb-2">
                  {b.type} · {b.provider || 'No provider'} · {b.frequency}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-text-muted">Amount</div>
                    <div className="font-mono">{formatBDT(b.amount)}</div>
                  </div>
                  <div>
                    <div className="text-text-muted">Due Date</div>
                    <div>{fmtDate(b.due_date)}</div>
                  </div>
                </div>
                <div className="mt-2">
                  <span
                    className="text-[10px] uppercase rounded-full px-2 py-[2px]"
                    style={{
                      background: b.status === 'paid' ? 'var(--positive-soft)' : b.status === 'overdue' ? 'var(--negative-soft)' : 'var(--accent-soft)',
                      color: b.status === 'paid' ? 'var(--positive)' : b.status === 'overdue' ? 'var(--negative)' : 'var(--accent)',
                    }}
                  >
                    {b.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {bills.length === 0 && (
          <div className="text-center py-8 text-text-muted">
            <FileText size={48} className="mx-auto mb-3 opacity-30" />
            <p>No bills added yet</p>
          </div>
        )}
      </main>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={editingId ? 'Edit Bill' : 'Add Bill'}>
        <label className="block text-xs text-text-muted mb-1">Name</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Electricity Bill"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-1">Type</label>
        <select className="input mb-3" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}>
          <option value="utility">Utility</option>
          <option value="internet">Internet</option>
          <option value="phone">Phone</option>
          <option value="rent">Rent</option>
          <option value="other">Other</option>
        </select>

        <label className="block text-xs text-text-muted mb-1">Provider (optional)</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. DESCO"
          value={formData.provider}
          onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-1">Amount (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 5000"
          value={formData.amount}
          onChange={(e) => setFormData({ ...formData, amount: e.target.value.replace(/[^\d]/g, '') })}
        />

        <label className="block text-xs text-text-muted mb-1">Due Date</label>
        <input
          className="input mb-3"
          type="date"
          value={formData.due_date}
          onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-1">Frequency</label>
        <select className="input mb-3" value={formData.frequency} onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
          <option value="one-time">One-time</option>
        </select>

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

      <BottomSheet open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete Bill">
        <p className="text-sm text-text-muted mb-4">Are you sure you want to delete this bill?</p>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</ActionButton>
        </div>
      </BottomSheet>
    </>
  );
}
