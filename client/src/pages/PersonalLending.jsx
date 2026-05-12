import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownLeft, Plus, Pencil, Trash2, DollarSign } from 'lucide-react';

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

export default function PersonalLending() {
  const toast = useToast();
  const [lendings, setLendings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [repaymentOpen, setRepaymentOpen] = useState(false);
  const [repaymentLoading, setRepaymentLoading] = useState(false);
  const [selectedLending, setSelectedLending] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formData, setFormData] = useState({
    direction: 'lent',
    counterparty_name: '',
    counterparty_contact: '',
    principal_amount: '',
    interest_rate: '',
    start_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: '',
  });
  const [repaymentData, setRepaymentData] = useState({
    repayment_date: new Date().toISOString().split('T')[0],
    amount: '',
    notes: '',
  });

  const loadLendings = async () => {
    setLoading(true);
    try {
      const res = await api.get(apiPaths.personalLending);
      setLendings(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLendings();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setFormData({
      direction: 'lent',
      counterparty_name: '',
      counterparty_contact: '',
      principal_amount: '',
      interest_rate: '',
      start_date: new Date().toISOString().split('T')[0],
      due_date: '',
      notes: '',
    });
    setAddOpen(true);
  };

  const openEdit = (l) => {
    setEditingId(l.id);
    setFormData({
      direction: l.direction,
      counterparty_name: l.counterparty_name,
      counterparty_contact: l.counterparty_contact,
      principal_amount: l.principal_amount,
      interest_rate: l.interest_rate,
      start_date: l.start_date,
      due_date: l.due_date,
      notes: l.notes,
    });
    setAddOpen(true);
  };

  const openRepayment = (l) => {
    setSelectedLending(l);
    setRepaymentData({
      repayment_date: new Date().toISOString().split('T')[0],
      amount: '',
      notes: '',
    });
    setRepaymentOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.direction || !formData.counterparty_name || !formData.principal_amount || !formData.start_date) {
      toast.push('Required fields missing', 'error');
      return;
    }
    setAddLoading(true);
    try {
      if (editingId) {
        await api.put(`${apiPaths.personalLending}/${editingId}`, formData);
        toast.push('Lending updated', 'success');
      } else {
        await api.post(apiPaths.personalLending, formData);
        toast.push('Lending added', 'success');
      }
      await loadLendings();
      setAddOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRepayment = async () => {
    if (!repaymentData.repayment_date || !repaymentData.amount) {
      toast.push('Date and amount are required', 'error');
      return;
    }
    setRepaymentLoading(true);
    try {
      const res = await api.post(`${apiPaths.personalLending}/${selectedLending.id}/repayment`, repaymentData);
      toast.push('Repayment recorded', 'success');
      await loadLendings();
      setRepaymentOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to record repayment', 'error');
    } finally {
      setRepaymentLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`${apiPaths.personalLending}/${id}`);
      toast.push('Lending deleted', 'success');
      await loadLendings();
      setDeleteConfirm(null);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to delete', 'error');
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
        title="Personal Lending" 
        action={
          <button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3">
            <Plus size={14} /> Add
          </button>
        } 
      />
      <main className="px-4 pt-3 space-y-3">
        {lendings.map((l) => {
          const isLent = l.direction === 'lent';
          return (
            <div key={l.id} className="card p-4">
              <div className="flex items-start gap-3">
                <div
                  className="rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 40, height: 40,
                    background: isLent ? 'var(--positive-soft)' : 'var(--negative-soft)',
                    color: isLent ? 'var(--positive)' : 'var(--negative)',
                  }}
                >
                  {isLent ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="font-semibold truncate">{l.counterparty_name}</div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openRepayment(l)}
                        className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                        style={{ color: 'var(--accent)' }}
                        disabled={l.status === 'settled'}
                      >
                        <DollarSign size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(l)}
                        className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                        style={{ color: 'var(--accent)' }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(l.id)}
                        className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                        style={{ color: 'var(--negative)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="text-[11px] text-text-muted mb-2">
                    {isLent ? 'Lent to' : 'Borrowed from'} · {l.counterparty_contact || 'No contact'}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-text-muted">Principal</div>
                      <div className="font-mono">{formatBDT(l.principal_amount)}</div>
                    </div>
                    <div>
                      <div className="text-text-muted">Outstanding</div>
                      <div className="font-mono font-semibold">{formatBDT(l.outstanding_balance)}</div>
                    </div>
                    <div>
                      <div className="text-text-muted">Start Date</div>
                      <div>{fmtDate(l.start_date)}</div>
                    </div>
                    <div>
                      <div className="text-text-muted">Due Date</div>
                      <div>{fmtDate(l.due_date)}</div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span
                      className="text-[10px] uppercase rounded-full px-2 py-[2px]"
                      style={{
                        background: l.status === 'active' ? 'var(--accent-soft)' : l.status === 'settled' ? 'var(--positive-soft)' : 'var(--bg-elevated)',
                        color: l.status === 'active' ? 'var(--accent)' : l.status === 'settled' ? 'var(--positive)' : 'var(--text-muted)',
                      }}
                    >
                      {l.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {lendings.length === 0 && (
          <div className="text-center py-8 text-text-muted">
            <DollarSign size={48} className="mx-auto mb-3 opacity-30" />
            <p>No personal lendings recorded yet</p>
          </div>
        )}
      </main>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={editingId ? 'Edit Lending' : 'Add Lending'}>
        <label className="block text-xs text-text-muted mb-1">Direction</label>
        <select className="input mb-3" value={formData.direction} onChange={(e) => setFormData({ ...formData, direction: e.target.value })}>
          <option value="lent">Lent to someone</option>
          <option value="borrowed">Borrowed from someone</option>
        </select>

        <label className="block text-xs text-text-muted mb-1">Counterparty Name</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. John Doe"
          value={formData.counterparty_name}
          onChange={(e) => setFormData({ ...formData, counterparty_name: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-1">Contact (optional)</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. 01712345678"
          value={formData.counterparty_contact}
          onChange={(e) => setFormData({ ...formData, counterparty_contact: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-1">Principal Amount (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 50000"
          value={formData.principal_amount}
          onChange={(e) => setFormData({ ...formData, principal_amount: e.target.value.replace(/[^\d]/g, '') })}
        />

        <label className="block text-xs text-text-muted mb-1">Interest Rate % (optional)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 5"
          value={formData.interest_rate}
          onChange={(e) => setFormData({ ...formData, interest_rate: e.target.value.replace(/[^\d.]/g, '') })}
        />

        <label className="block text-xs text-text-muted mb-1">Start Date</label>
        <input
          className="input mb-3"
          type="date"
          value={formData.start_date}
          onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-1">Due Date (optional)</label>
        <input
          className="input mb-3"
          type="date"
          value={formData.due_date}
          onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-1">Notes (optional)</label>
        <textarea
          className="input mb-4"
          rows={2}
          placeholder="Any additional notes..."
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />

        <ActionButton variant="primary" className="w-full" loading={addLoading} onClick={handleSubmit}>
          {editingId ? 'Update' : 'Add'}
        </ActionButton>
      </BottomSheet>

      <BottomSheet open={repaymentOpen} onClose={() => setRepaymentOpen(false)} title="Record Repayment">
        <div className="mb-4 p-3 rounded-lg" style={{ background: 'var(--bg-elevated)' }}>
          <div className="text-xs text-text-muted">Outstanding Balance</div>
          <div className="text-lg font-mono font-semibold">{selectedLending ? formatBDT(selectedLending.outstanding_balance) : '-'}</div>
        </div>

        <label className="block text-xs text-text-muted mb-1">Repayment Date</label>
        <input
          className="input mb-3"
          type="date"
          value={repaymentData.repayment_date}
          onChange={(e) => setRepaymentData({ ...repaymentData, repayment_date: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-1">Amount (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 5000"
          value={repaymentData.amount}
          onChange={(e) => setRepaymentData({ ...repaymentData, amount: e.target.value.replace(/[^\d]/g, '') })}
        />

        <label className="block text-xs text-text-muted mb-1">Notes (optional)</label>
        <textarea
          className="input mb-4"
          rows={2}
          placeholder="Any notes..."
          value={repaymentData.notes}
          onChange={(e) => setRepaymentData({ ...repaymentData, notes: e.target.value })}
        />

        <ActionButton variant="primary" className="w-full" loading={repaymentLoading} onClick={handleRepayment}>
          Record Repayment
        </ActionButton>
      </BottomSheet>

      <BottomSheet open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete Lending">
        <p className="text-sm text-text-muted mb-4">Are you sure you want to delete this lending record?</p>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</ActionButton>
        </div>
      </BottomSheet>
    </>
  );
}
