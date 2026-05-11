import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Calendar, Percent } from 'lucide-react';

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

export default function FixedDeposits() {
  const toast = useToast();
  const [fds, setFds] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrincipal, setNewPrincipal] = useState('');
  const [newInterestRate, setNewInterestRate] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newMaturityDate, setNewMaturityDate] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const loadFds = async () => {
    try {
      const res = await api.get(apiPaths.fixedDeposits);
      setFds(res.data);
    } catch (err) {
      console.error('Failed to load fixed deposits:', err);
    }
  };

  useEffect(() => {
    loadFds();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setNewName('');
    setNewPrincipal('');
    setNewInterestRate('');
    setNewStartDate('');
    setNewMaturityDate('');
    setAddOpen(true);
  };

  const openEdit = (fd) => {
    setEditingId(fd.id);
    setNewName(fd.name);
    setNewPrincipal(String(fd.principal));
    setNewInterestRate(String(fd.interest_rate));
    setNewStartDate(fd.start_date);
    setNewMaturityDate(fd.maturity_date);
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!newName || !newPrincipal || !newInterestRate || !newStartDate || !newMaturityDate) {
      toast.push('All fields are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      if (editingId) {
        await api.put(`${apiPaths.fixedDeposits}/${editingId}`, {
          name: newName.trim(),
          principal: Number(newPrincipal),
          interest_rate: Number(newInterestRate),
          start_date: newStartDate,
          maturity_date: newMaturityDate,
        });
        toast.push('Fixed deposit updated', 'success');
      } else {
        await api.post(apiPaths.fixedDeposits, {
          name: newName.trim(),
          principal: Number(newPrincipal),
          interest_rate: Number(newInterestRate),
          start_date: newStartDate,
          maturity_date: newMaturityDate,
        });
        toast.push('Fixed deposit added', 'success');
      }
      await loadFds();
      setAddOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to save fixed deposit', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (fdId) => {
    try {
      await api.delete(`${apiPaths.fixedDeposits}/${fdId}`);
      toast.push('Fixed deposit deleted', 'success');
      await loadFds();
      setDeleteConfirm(null);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to delete fixed deposit', 'error');
    }
  };

  return (
    <>
      <AppHeader title="Fixed Deposits" action={<button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3"><Plus size={14} /> Add</button>} />
      <main className="px-4 pt-3 space-y-4">
        {fds.length === 0 ? (
          <div className="card p-6 text-center text-sm text-text-muted">No fixed deposits yet.</div>
        ) : null}
        {fds.map((fd) => {
          const days = daysUntil(fd.maturity_date);
          const matured = days !== null && days < 0;
          const principal = Number(fd.principal);
          const rate = Number(fd.interest_rate);
          const maturityAmount = fd.maturity_amount ? Number(fd.maturity_amount) : principal * (1 + rate / 100);
          return (
            <div key={fd.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">{fd.name}</div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(fd)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ color: 'var(--accent)' }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(fd.id)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ color: 'var(--negative)' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                <div>
                  <div className="text-text-muted">Principal</div>
                  <div className="font-mono">{formatBDT(principal)}</div>
                </div>
                <div className="text-right">
                  <div className="text-text-muted">Interest Rate</div>
                  <div className="font-mono flex items-center justify-end gap-1">
                    <Percent size={12} />
                    {rate}%
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                <div>
                  <div className="text-text-muted">Maturity Amount</div>
                  <div className="font-mono" style={{ color: 'var(--positive)' }}>{formatBDT(maturityAmount)}</div>
                </div>
                <div className="text-right">
                  <div className="text-text-muted">Maturity Date</div>
                  <div className="font-mono flex items-center justify-end gap-1">
                    <Calendar size={12} />
                    {fd.maturity_date}
                  </div>
                </div>
              </div>
              <div className="text-xs text-text-muted">
                <div className="flex items-center gap-1">
                  <Calendar size={12} />
                  Start Date: {fd.start_date}
                </div>
                {days !== null && (
                  <div className="mt-1" style={{ color: matured ? 'var(--positive)' : days <= 30 ? 'var(--warning)' : '' }}>
                    {matured ? 'Matured' : days <= 30 ? `Matures in ${days} days` : `${days} days until maturity`}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </main>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={editingId ? 'Edit Fixed Deposit' : 'Add Fixed Deposit'}>
        <label className="block text-xs text-text-muted mb-1">Name</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Sonali Bank FD"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Principal amount (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 100000"
          value={newPrincipal}
          onChange={(e) => setNewPrincipal(e.target.value.replace(/[^\d]/g, ''))}
        />

        <label className="block text-xs text-text-muted mb-1">Interest rate (%)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="decimal"
          placeholder="e.g. 8.5"
          value={newInterestRate}
          onChange={(e) => setNewInterestRate(e.target.value.replace(/[^\d.]/g, ''))}
        />

        <label className="block text-xs text-text-muted mb-1">Start date</label>
        <input
          className="input mb-3"
          type="date"
          value={newStartDate}
          onChange={(e) => setNewStartDate(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Maturity date</label>
        <input
          className="input mb-4"
          type="date"
          value={newMaturityDate}
          onChange={(e) => setNewMaturityDate(e.target.value)}
        />

        <ActionButton variant="primary" className="w-full" loading={addLoading} onClick={handleAdd}>
          {editingId ? 'Update' : 'Add'}
        </ActionButton>
      </BottomSheet>

      <BottomSheet open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete Fixed Deposit">
        <p className="text-sm text-text-muted mb-4">Are you sure you want to delete this fixed deposit?</p>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</ActionButton>
        </div>
      </BottomSheet>
    </>
  );
}
