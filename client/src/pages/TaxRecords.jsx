import { useState, useEffect } from 'react';
import { FileText, Plus, Pencil, Trash2, CheckCircle, FileCheck } from 'lucide-react';

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

export default function TaxRecords() {
  const toast = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formData, setFormData] = useState({
    tax_year: new Date().getFullYear(),
    income_type: 'salary',
    gross_income: '',
    tax_deducted: '',
    tax_paid: '',
    tax_due: '',
    notes: '',
  });

  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = await api.get(apiPaths.taxRecords);
      setRecords(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setFormData({
      tax_year: new Date().getFullYear(),
      income_type: 'salary',
      gross_income: '',
      tax_deducted: '',
      tax_paid: '',
      tax_due: '',
      notes: '',
    });
    setAddOpen(true);
  };

  const openEdit = (record) => {
    setEditingId(record.id);
    setFormData({
      tax_year: record.tax_year,
      income_type: record.income_type,
      gross_income: record.gross_income,
      tax_deducted: record.tax_deducted,
      tax_paid: record.tax_paid,
      tax_due: record.tax_due,
      notes: record.notes,
    });
    setAddOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.tax_year || !formData.income_type || !formData.gross_income) {
      toast.push('Tax year, income type, and gross income are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      if (editingId) {
        await api.put(`${apiPaths.taxRecords}/${editingId}`, formData);
        toast.push('Tax record updated', 'success');
      } else {
        await api.post(apiPaths.taxRecords, formData);
        toast.push('Tax record added', 'success');
      }
      await loadRecords();
      setAddOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`${apiPaths.taxRecords}/${id}`);
      toast.push('Tax record deleted', 'success');
      await loadRecords();
      setDeleteConfirm(null);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to delete', 'error');
    }
  };

  const markAsFiled = async (id) => {
    try {
      await api.post(`${apiPaths.taxRecords}/${id}/file`, {
        filing_date: new Date().toISOString().split('T')[0],
      });
      toast.push('Tax marked as filed', 'success');
      await loadRecords();
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to mark as filed', 'error');
    }
  };

  const markAsPaid = async (id) => {
    try {
      await api.post(`${apiPaths.taxRecords}/${id}/pay`, {
        payment_date: new Date().toISOString().split('T')[0],
      });
      toast.push('Tax marked as paid', 'success');
      await loadRecords();
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
        title="Tax Records" 
        action={
          <button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3">
            <Plus size={14} /> Add
          </button>
        } 
      />
      <main className="px-4 pt-3 space-y-3">
        {records.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex items-start gap-3">
              <div
                className="rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  width: 40, height: 40,
                  background: r.status === 'paid' ? 'var(--positive-soft)' : r.status === 'filed' ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                  color: r.status === 'paid' ? 'var(--positive)' : r.status === 'filed' ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                {r.status === 'paid' ? <CheckCircle size={20} /> : r.status === 'filed' ? <FileCheck size={20} /> : <FileText size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="font-semibold">Tax Year {r.tax_year}</div>
                  <div className="flex items-center gap-1">
                    {r.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => markAsFiled(r.id)}
                        className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                        style={{ color: 'var(--accent)' }}
                      >
                        <FileCheck size={14} />
                      </button>
                    )}
                    {r.status === 'filed' && (
                      <button
                        type="button"
                        onClick={() => markAsPaid(r.id)}
                        className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                        style={{ color: 'var(--positive)' }}
                      >
                        <CheckCircle size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                      style={{ color: 'var(--accent)' }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(r.id)}
                      className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                      style={{ color: 'var(--negative)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-text-muted mb-2">
                  {r.income_type}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-text-muted">Gross Income</div>
                    <div className="font-mono">{formatBDT(r.gross_income)}</div>
                  </div>
                  <div>
                    <div className="text-text-muted">Tax Due</div>
                    <div className="font-mono font-semibold">{formatBDT(r.tax_due)}</div>
                  </div>
                  <div>
                    <div className="text-text-muted">Tax Deducted</div>
                    <div className="font-mono">{formatBDT(r.tax_deducted)}</div>
                  </div>
                  <div>
                    <div className="text-text-muted">Tax Paid</div>
                    <div className="font-mono">{formatBDT(r.tax_paid)}</div>
                  </div>
                </div>
                {r.filing_date && (
                  <div className="mt-2 text-[10px] text-text-muted">
                    Filed: {fmtDate(r.filing_date)}
                  </div>
                )}
                {r.payment_date && (
                  <div className="mt-2 text-[10px] text-text-muted">
                    Paid: {fmtDate(r.payment_date)}
                  </div>
                )}
                <div className="mt-2">
                  <span
                    className="text-[10px] uppercase rounded-full px-2 py-[2px]"
                    style={{
                      background: r.status === 'paid' ? 'var(--positive-soft)' : r.status === 'filed' ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                      color: r.status === 'paid' ? 'var(--positive)' : r.status === 'filed' ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    {r.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {records.length === 0 && (
          <div className="text-center py-8 text-text-muted">
            <FileText size={48} className="mx-auto mb-3 opacity-30" />
            <p>No tax records added yet</p>
          </div>
        )}
      </main>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={editingId ? 'Edit Tax Record' : 'Add Tax Record'}>
        <label className="block text-xs text-text-muted mb-1">Tax Year</label>
        <input
          className="input mb-3"
          type="number"
          placeholder="e.g. 2024"
          value={formData.tax_year}
          onChange={(e) => setFormData({ ...formData, tax_year: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-1">Income Type</label>
        <select className="input mb-3" value={formData.income_type} onChange={(e) => setFormData({ ...formData, income_type: e.target.value })}>
          <option value="salary">Salary</option>
          <option value="business">Business</option>
          <option value="investment">Investment</option>
          <option value="rental">Rental</option>
          <option value="other">Other</option>
        </select>

        <label className="block text-xs text-text-muted mb-1">Gross Income (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 1000000"
          value={formData.gross_income}
          onChange={(e) => setFormData({ ...formData, gross_income: e.target.value.replace(/[^\d]/g, '') })}
        />

        <label className="block text-xs text-text-muted mb-1">Tax Deducted at Source (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 100000"
          value={formData.tax_deducted}
          onChange={(e) => setFormData({ ...formData, tax_deducted: e.target.value.replace(/[^\d]/g, '') })}
        />

        <label className="block text-xs text-text-muted mb-1">Tax Paid (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 50000"
          value={formData.tax_paid}
          onChange={(e) => setFormData({ ...formData, tax_paid: e.target.value.replace(/[^\d]/g, '') })}
        />

        <label className="block text-xs text-text-muted mb-1">Tax Due (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 0"
          value={formData.tax_due}
          onChange={(e) => setFormData({ ...formData, tax_due: e.target.value.replace(/[^\d]/g, '') })}
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

      <BottomSheet open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete Tax Record">
        <p className="text-sm text-text-muted mb-4">Are you sure you want to delete this tax record?</p>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</ActionButton>
        </div>
      </BottomSheet>
    </>
  );
}
