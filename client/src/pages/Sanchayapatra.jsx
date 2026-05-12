import { useState, useEffect } from 'react';
import { Landmark, Plus, Pencil, Trash2, TrendingUp } from 'lucide-react';

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

export default function Sanchayapatra() {
  const toast = useToast();
  const [sanchayapatra, setSanchayapatra] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    scheme_type: '3_month_profit',
    certificate_number: '',
    principal_amount: '',
    interest_rate: '',
    purchase_date: '',
    maturity_date: '',
  });

  const loadSanchayapatra = async () => {
    setLoading(true);
    try {
      const res = await api.get(apiPaths.sanchayapatra);
      setSanchayapatra(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSanchayapatra();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setFormData({
      name: '',
      scheme_type: '3_month_profit',
      certificate_number: '',
      principal_amount: '',
      interest_rate: '',
      purchase_date: new Date().toISOString().split('T')[0],
      maturity_date: '',
    });
    setAddOpen(true);
  };

  const openEdit = (s) => {
    setEditingId(s.id);
    setFormData({
      name: s.name,
      scheme_type: s.scheme_type,
      certificate_number: s.certificate_number,
      principal_amount: s.principal_amount,
      interest_rate: s.interest_rate,
      purchase_date: s.purchase_date,
      maturity_date: s.maturity_date,
    });
    setAddOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.scheme_type || !formData.certificate_number || !formData.principal_amount || !formData.interest_rate || !formData.purchase_date || !formData.maturity_date) {
      toast.push('All fields are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      if (editingId) {
        await api.put(`${apiPaths.sanchayapatra}/${editingId}`, formData);
        toast.push('Sanchayapatra updated', 'success');
      } else {
        await api.post(apiPaths.sanchayapatra, formData);
        toast.push('Sanchayapatra added', 'success');
      }
      await loadSanchayapatra();
      setAddOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`${apiPaths.sanchayapatra}/${id}`);
      toast.push('Sanchayapatra deleted', 'success');
      await loadSanchayapatra();
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
        title="Sanchayapatra" 
        action={
          <button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3">
            <Plus size={14} /> Add
          </button>
        } 
      />
      <main className="px-4 pt-3 space-y-3">
        {sanchayapatra.map((s) => (
          <div key={s.id} className="card p-4">
            <div className="flex items-start gap-3">
              <div
                className="rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  width: 40, height: 40,
                  background: 'var(--accent-soft)', color: 'var(--accent)',
                }}
              >
                <Landmark size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="font-semibold truncate">{s.name}</div>
                  <div className="flex items-center gap-1">
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
                  {s.scheme_type.replace('_', ' ')} · Cert: {s.certificate_number}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-text-muted">Principal</div>
                    <div className="font-mono">{formatBDT(s.principal_amount)}</div>
                  </div>
                  <div>
                    <div className="text-text-muted">Rate</div>
                    <div className="font-mono">{s.interest_rate}%</div>
                  </div>
                  <div>
                    <div className="text-text-muted">Purchase</div>
                    <div>{fmtDate(s.purchase_date)}</div>
                  </div>
                  <div>
                    <div className="text-text-muted">Maturity</div>
                    <div>{fmtDate(s.maturity_date)}</div>
                  </div>
                </div>
                {s.maturity_value && (
                  <div className="mt-2 pt-2 border-t flex items-center justify-between">
                    <span className="text-xs text-text-muted">Maturity Value</span>
                    <span className="font-mono text-sm font-semibold flex items-center gap-1">
                      <TrendingUp size={14} /> {formatBDT(s.maturity_value)}
                    </span>
                  </div>
                )}
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
        {sanchayapatra.length === 0 && (
          <div className="text-center py-8 text-text-muted">
            <Landmark size={48} className="mx-auto mb-3 opacity-30" />
            <p>No Sanchayapatra added yet</p>
          </div>
        )}
      </main>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={editingId ? 'Edit Sanchayapatra' : 'Add Sanchayapatra'}>
        <label className="block text-xs text-text-muted mb-1">Name</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. 5-Year Bangladesh Sanchayapatra"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-1">Scheme Type</label>
        <select className="input mb-3" value={formData.scheme_type} onChange={(e) => setFormData({ ...formData, scheme_type: e.target.value })}>
          <option value="3_month_profit">3-Month Profit Scheme</option>
          <option value="5_year_bangladesh">5-Year Bangladesh</option>
          <option value="family_savings">Family Savings</option>
          <option value="pensioner">Pensioner</option>
          <option value="wage_earner">Wage Earner</option>
        </select>

        <label className="block text-xs text-text-muted mb-1">Certificate Number</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. 123456789"
          value={formData.certificate_number}
          onChange={(e) => setFormData({ ...formData, certificate_number: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-1">Principal Amount (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 100000"
          value={formData.principal_amount}
          onChange={(e) => setFormData({ ...formData, principal_amount: e.target.value.replace(/[^\d]/g, '') })}
        />

        <label className="block text-xs text-text-muted mb-1">Interest Rate (%)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 11.5"
          value={formData.interest_rate}
          onChange={(e) => setFormData({ ...formData, interest_rate: e.target.value.replace(/[^\d.]/g, '') })}
        />

        <label className="block text-xs text-text-muted mb-1">Purchase Date</label>
        <input
          className="input mb-3"
          type="date"
          value={formData.purchase_date}
          onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-1">Maturity Date</label>
        <input
          className="input mb-4"
          type="date"
          value={formData.maturity_date}
          onChange={(e) => setFormData({ ...formData, maturity_date: e.target.value })}
        />

        <ActionButton variant="primary" className="w-full" loading={addLoading} onClick={handleSubmit}>
          {editingId ? 'Update' : 'Add'}
        </ActionButton>
      </BottomSheet>

      <BottomSheet open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete Sanchayapatra">
        <p className="text-sm text-text-muted mb-4">Are you sure you want to delete this Sanchayapatra?</p>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</ActionButton>
        </div>
      </BottomSheet>
    </>
  );
}
