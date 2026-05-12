import { useState, useEffect } from 'react';
import { Briefcase, Plus, Pencil, Trash2 } from 'lucide-react';

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

export default function ProvidentFund() {
  const toast = useToast();
  const { accounts } = useFinance();
  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formData, setFormData] = useState({
    employer_name: '',
    employee_id: '',
    monthly_contribution: '',
    employer_contribution: '',
    start_date: new Date().toISOString().split('T')[0],
    account_id: '',
  });

  const loadFunds = async () => {
    setLoading(true);
    try {
      const res = await api.get(apiPaths.providentFund);
      setFunds(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFunds();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setFormData({
      employer_name: '',
      employee_id: '',
      monthly_contribution: '',
      employer_contribution: '',
      start_date: new Date().toISOString().split('T')[0],
      account_id: '',
    });
    setAddOpen(true);
  };

  const openEdit = (fund) => {
    setEditingId(fund.id);
    setFormData({
      employer_name: fund.employer_name,
      employee_id: fund.employee_id,
      monthly_contribution: fund.monthly_contribution,
      employer_contribution: fund.employer_contribution,
      start_date: fund.start_date,
      account_id: fund.account_id || '',
    });
    setAddOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.employer_name || !formData.monthly_contribution || !formData.employer_contribution || !formData.start_date) {
      toast.push('All fields except employee ID are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      if (editingId) {
        await api.put(`${apiPaths.providentFund}/${editingId}`, formData);
        toast.push('Provident Fund updated', 'success');
      } else {
        await api.post(apiPaths.providentFund, formData);
        toast.push('Provident Fund added', 'success');
      }
      await loadFunds();
      setAddOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`${apiPaths.providentFund}/${id}`);
      toast.push('Provident Fund deleted', 'success');
      await loadFunds();
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
        title="Provident Fund" 
        action={
          <button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3">
            <Plus size={14} /> Add
          </button>
        } 
      />
      <main className="px-4 pt-3 space-y-3">
        {funds.map((f) => {
          const totalMonthly = parseFloat(f.monthly_contribution) + parseFloat(f.employer_contribution);
          return (
            <div key={f.id} className="card p-4">
              <div className="flex items-start gap-3">
                <div
                  className="rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 40, height: 40,
                    background: 'var(--accent-soft)', color: 'var(--accent)',
                  }}
                >
                  <Briefcase size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="font-semibold truncate">{f.employer_name}</div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(f)}
                        className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                        style={{ color: 'var(--accent)' }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(f.id)}
                        className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                        style={{ color: 'var(--negative)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="text-[11px] text-text-muted mb-2">
                    Employee ID: {f.employee_id || 'N/A'} · Started: {fmtDate(f.start_date)}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-text-muted">Your Contribution</div>
                      <div className="font-mono">{formatBDT(f.monthly_contribution)}</div>
                    </div>
                    <div>
                      <div className="text-text-muted">Employer Contribution</div>
                      <div className="font-mono">{formatBDT(f.employer_contribution)}</div>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t flex items-center justify-between">
                    <span className="text-xs text-text-muted">Total Monthly</span>
                    <span className="font-mono text-sm font-semibold">{formatBDT(totalMonthly)}</span>
                  </div>
                  <div className="mt-2">
                    <span
                      className="text-[10px] uppercase rounded-full px-2 py-[2px]"
                      style={{
                        background: f.status === 'active' ? 'var(--positive-soft)' : 'var(--bg-elevated)',
                        color: f.status === 'active' ? 'var(--positive)' : 'var(--text-muted)',
                      }}
                    >
                      {f.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {funds.length === 0 && (
          <div className="text-center py-8 text-text-muted">
            <Briefcase size={48} className="mx-auto mb-3 opacity-30" />
            <p>No provident funds added yet</p>
          </div>
        )}
      </main>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={editingId ? 'Edit Provident Fund' : 'Add Provident Fund'}>
        <label className="block text-xs text-text-muted mb-1">Employer Name</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. ABC Company Ltd"
          value={formData.employer_name}
          onChange={(e) => setFormData({ ...formData, employer_name: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-1">Employee ID (optional)</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. EMP-1234"
          value={formData.employee_id}
          onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-1">Your Monthly Contribution (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 5000"
          value={formData.monthly_contribution}
          onChange={(e) => setFormData({ ...formData, monthly_contribution: e.target.value.replace(/[^\d]/g, '') })}
        />

        <label className="block text-xs text-text-muted mb-1">Employer Monthly Contribution (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 5000"
          value={formData.employer_contribution}
          onChange={(e) => setFormData({ ...formData, employer_contribution: e.target.value.replace(/[^\d]/g, '') })}
        />

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

      <BottomSheet open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete Provident Fund">
        <p className="text-sm text-text-muted mb-4">Are you sure you want to delete this provident fund?</p>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</ActionButton>
        </div>
      </BottomSheet>
    </>
  );
}
