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

export default function Loan() {
  const { loans, loadAll } = useFinance();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrincipal, setNewPrincipal] = useState('');
  const [newEmi, setNewEmi] = useState('');
  const [newRate, setNewRate] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const openAdd = () => {
    setEditingId(null);
    setNewName('');
    setNewPrincipal('');
    setNewEmi('');
    setNewRate('');
    setAddOpen(true);
  };

  const openEdit = (loan) => {
    setEditingId(loan.id);
    setNewName(loan.name);
    setNewPrincipal(String(loan.principal));
    setNewEmi(String(loan.monthly_emi));
    setNewRate(loan.interest_rate || '');
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!newName || !newPrincipal || !newEmi) {
      toast.push('Name, principal, and monthly EMI are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      if (editingId) {
        await api.put(`${apiPaths.loans}/${editingId}`, {
          name: newName.trim(),
          principal: Number(newPrincipal),
          monthly_emi: Number(newEmi),
          interest_rate: newRate || null,
        });
        toast.push('Loan updated', 'success');
      } else {
        await api.post(apiPaths.loans, {
          name: newName.trim(),
          principal: Number(newPrincipal),
          monthly_emi: Number(newEmi),
          interest_rate: newRate || null,
        });
        toast.push('Loan added', 'success');
      }
      await loadAll();
      setAddOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to save loan', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (loanId) => {
    try {
      await api.delete(`${apiPaths.loans}/${loanId}`);
      toast.push('Loan deleted', 'success');
      await loadAll();
      setDeleteConfirm(null);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to delete loan', 'error');
    }
  };

  return (
    <>
      <AppHeader title="Loans" action={<button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3"><Plus size={14} /> Add</button>} />
      <main className="px-4 pt-3 space-y-4">
        {loans.length === 0 ? (
          <div className="card p-6 text-center text-sm text-text-muted">No active loans.</div>
        ) : null}
        {loans.map((l) => {
          const principal = Number(l.principal) || 0;
          const remaining = Number(l.remaining) || 0;
          const repaid = Math.max(0, principal - remaining);
          const pct = principal > 0 ? (repaid / principal) * 100 : 0;
          const emi = Number(l.monthly_emi) || 0;
          const monthsToPayoff = emi > 0 ? Math.ceil(remaining / emi) : null;
          return (
            <div key={l.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">{l.name}</div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-text-muted">
                    {l.interest_rate ? `${Number(l.interest_rate).toFixed(2)}% p.a.` : ''}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(l)}
                      className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                      style={{ color: 'var(--accent)' }}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(l.id)}
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
                  <div className="text-text-muted">Original</div>
                  <div className="font-mono">{formatBDT(principal)}</div>
                </div>
                <div className="text-right">
                  <div className="text-text-muted">Remaining</div>
                  <div className="font-mono" style={{ color: 'var(--negative)' }}>
                    {formatBDT(remaining)}
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <ProgressBar value={repaid} max={principal} color="var(--positive)" />
                <div className="text-[11px] text-text-muted mt-1 flex justify-between">
                  <span>{pct.toFixed(1)}% repaid</span>
                  <span>{formatBDT(repaid)} paid</span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-text-muted">Monthly EMI</div>
                  <div className="font-mono">{formatBDT(emi)}</div>
                </div>
                <div className="text-right">
                  <div className="text-text-muted">Months to payoff</div>
                  <div className="font-mono">{monthsToPayoff !== null ? monthsToPayoff : '—'}</div>
                </div>
              </div>
            </div>
          );
        })}
      </main>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={editingId ? 'Edit Loan' : 'Add Loan'}>
        <label className="block text-xs text-text-muted mb-1">Loan name</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Home Loan"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Principal amount (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 1000000"
          value={newPrincipal}
          onChange={(e) => setNewPrincipal(e.target.value.replace(/[^\d]/g, ''))}
        />

        <label className="block text-xs text-text-muted mb-1">Monthly EMI (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 25000"
          value={newEmi}
          onChange={(e) => setNewEmi(e.target.value.replace(/[^\d]/g, ''))}
        />

        <label className="block text-xs text-text-muted mb-1">Interest rate % (optional)</label>
        <input
          className="input mb-4"
          type="text"
          inputMode="decimal"
          placeholder="e.g. 10.5"
          value={newRate}
          onChange={(e) => setNewRate(e.target.value.replace(/[^\d.]/g, ''))}
        />

        <ActionButton variant="primary" className="w-full" loading={addLoading} onClick={handleAdd}>
          {editingId ? 'Update Loan' : 'Add Loan'}
        </ActionButton>
      </BottomSheet>

      <BottomSheet open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete Loan">
        <p className="text-sm text-text-muted mb-4">Are you sure you want to delete this loan?</p>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</ActionButton>
        </div>
      </BottomSheet>
    </>
  );
}
