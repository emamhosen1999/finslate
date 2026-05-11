import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';

import AppHeader from '../components/AppHeader.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
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
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function DPS() {
  const { dps, loadAll } = useFinance();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMonthly, setNewMonthly] = useState('');
  const [newMaturity, setNewMaturity] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newMaturityDate, setNewMaturityDate] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const openAdd = () => {
    setEditingId(null);
    setNewName('');
    setNewMonthly('');
    setNewMaturity('');
    setNewStartDate('');
    setNewMaturityDate('');
    setAddOpen(true);
  };

  const openEdit = (d) => {
    setEditingId(d.id);
    setNewName(d.name);
    setNewMonthly(String(d.monthly_amount));
    setNewMaturity(d.maturity_amount ? String(d.maturity_amount) : '');
    setNewStartDate(d.start_date || '');
    setNewMaturityDate(d.maturity_date || '');
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!newName || !newMonthly) {
      toast.push('Name and monthly amount are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      if (editingId) {
        await api.put(`${apiPaths.dps}/${editingId}`, {
          name: newName.trim(),
          monthly_amount: Number(newMonthly),
          maturity_amount: newMaturity || null,
          start_date: newStartDate || null,
          maturity_date: newMaturityDate || null,
        });
        toast.push('DPS updated', 'success');
      } else {
        await api.post(apiPaths.dps, {
          name: newName.trim(),
          monthly_amount: Number(newMonthly),
          maturity_amount: newMaturity || null,
          start_date: newStartDate || null,
          maturity_date: newMaturityDate || null,
        });
        toast.push('DPS added', 'success');
      }
      await loadAll();
      setAddOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to save DPS', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (dpsId) => {
    try {
      await api.delete(`${apiPaths.dps}/${dpsId}`);
      toast.push('DPS deleted', 'success');
      await loadAll();
      setDeleteConfirm(null);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to delete DPS', 'error');
    }
  };

  return (
    <>
      <AppHeader title="DPS" action={<button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3"><Plus size={14} /> Add</button>} />
      <main className="px-4 pt-3 space-y-4">
        {dps.length === 0 ? (
          <div className="card p-6 text-center text-sm text-text-muted">No DPS accounts yet.</div>
        ) : null}
        {dps.map((d) => {
          const deposited = Number(d.total_deposited) || 0;
          const maturity = Number(d.maturity_amount) || 0;
          const monthly = Number(d.monthly_amount) || 0;
          const days = daysUntil(d.maturity_date);
          return (
            <div key={d.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">{d.name}</div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-text-muted">
                    {monthly ? `${formatBDT(monthly)} / month` : ''}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(d)}
                      className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                      style={{ color: 'var(--accent)' }}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(d.id)}
                      className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                      style={{ color: 'var(--negative)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-text-muted">Deposited</div>
                  <div className="font-mono" style={{ color: 'var(--positive)' }}>
                    {formatBDT(deposited)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-text-muted">Maturity</div>
                  <div className="font-mono">{formatBDT(maturity)}</div>
                </div>
              </div>
              <div className="mt-3">
                <ProgressBar value={deposited} max={maturity} color="var(--warning)" />
                <div className="text-[11px] text-text-muted mt-1 flex justify-between">
                  <span>
                    {maturity > 0 ? `${((deposited / maturity) * 100).toFixed(1)}%` : '—'} of maturity
                  </span>
                  <span>
                    {d.maturity_date
                      ? `Matures ${d.maturity_date}${days !== null ? ` (${days}d)` : ''}`
                      : ''}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </main>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={editingId ? 'Edit DPS' : 'Add DPS'}>
        <label className="block text-xs text-text-muted mb-1">DPS name</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Sonali DPS"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Monthly deposit (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 5000"
          value={newMonthly}
          onChange={(e) => setNewMonthly(e.target.value.replace(/[^\d]/g, ''))}
        />

        <label className="block text-xs text-text-muted mb-1">Maturity amount (BDT, optional)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 600000"
          value={newMaturity}
          onChange={(e) => setNewMaturity(e.target.value.replace(/[^\d]/g, ''))}
        />

        <label className="block text-xs text-text-muted mb-1">Start date (optional)</label>
        <input
          className="input mb-3"
          type="date"
          value={newStartDate}
          onChange={(e) => setNewStartDate(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Maturity date (optional)</label>
        <input
          className="input mb-4"
          type="date"
          value={newMaturityDate}
          onChange={(e) => setNewMaturityDate(e.target.value)}
        />

        <ActionButton variant="primary" className="w-full" loading={addLoading} onClick={handleAdd}>
          {editingId ? 'Update DPS' : 'Add DPS'}
        </ActionButton>
      </BottomSheet>

      <BottomSheet open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete DPS">
        <p className="text-sm text-text-muted mb-4">Are you sure you want to delete this DPS account?</p>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</ActionButton>
        </div>
      </BottomSheet>
    </>
  );
}
