import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Wallet, Calendar } from 'lucide-react';

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
  const diff = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
}

export default function RecurringDeposits() {
  const { accounts, loadAll } = useFinance();
  const toast = useToast();
  const [rds, setRds] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMonthly, setNewMonthly] = useState('');
  const [newInterestRate, setNewInterestRate] = useState('');
  const [newMaturityAmount, setNewMaturityAmount] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newMaturityDate, setNewMaturityDate] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositRdId, setDepositRdId] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositAccountId, setDepositAccountId] = useState('');

  const loadRds = async () => {
    try {
      const res = await api.get(apiPaths.recurringDeposits);
      setRds(res.data);
    } catch (err) {
      console.error('Failed to load recurring deposits:', err);
    }
  };

  useEffect(() => {
    loadRds();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setNewName('');
    setNewMonthly('');
    setNewInterestRate('');
    setNewMaturityAmount('');
    setNewStartDate('');
    setNewMaturityDate('');
    setAddOpen(true);
  };

  const openEdit = (rd) => {
    setEditingId(rd.id);
    setNewName(rd.name);
    setNewMonthly(String(rd.monthly_amount));
    setNewInterestRate(String(rd.interest_rate));
    setNewMaturityAmount(rd.maturity_amount ? String(rd.maturity_amount) : '');
    setNewStartDate(rd.start_date || '');
    setNewMaturityDate(rd.maturity_date || '');
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!newName || !newMonthly || !newInterestRate) {
      toast.push('Name, monthly amount, and interest rate are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      if (editingId) {
        await api.put(`${apiPaths.recurringDeposits}/${editingId}`, {
          name: newName.trim(),
          monthly_amount: Number(newMonthly),
          interest_rate: Number(newInterestRate),
          maturity_amount: newMaturityAmount || null,
          start_date: newStartDate || null,
          maturity_date: newMaturityDate || null,
        });
        toast.push('Recurring deposit updated', 'success');
      } else {
        await api.post(apiPaths.recurringDeposits, {
          name: newName.trim(),
          monthly_amount: Number(newMonthly),
          interest_rate: Number(newInterestRate),
          maturity_amount: newMaturityAmount || null,
          start_date: newStartDate || null,
          maturity_date: newMaturityDate || null,
        });
        toast.push('Recurring deposit added', 'success');
      }
      await loadRds();
      setAddOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to save recurring deposit', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (rdId) => {
    try {
      await api.delete(`${apiPaths.recurringDeposits}/${rdId}`);
      toast.push('Recurring deposit deleted', 'success');
      await loadRds();
      setDeleteConfirm(null);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to delete recurring deposit', 'error');
    }
  };

  const openDeposit = (rd) => {
    setDepositRdId(rd.id);
    setDepositAmount(String(rd.monthly_amount));
    setDepositAccountId(accounts[0]?.id ? String(accounts[0].id) : '');
    setDepositOpen(true);
  };

  const handleDeposit = async () => {
    if (!depositAmount) {
      toast.push('Deposit amount is required', 'error');
      return;
    }
    setDepositLoading(true);
    try {
      await api.post(`${apiPaths.recurringDeposits}/${depositRdId}/deposit`, {
        amount: Number(depositAmount),
        account_id: depositAccountId ? Number(depositAccountId) : null,
      });
      toast.push('Deposit successful', 'success');
      await loadRds();
      await loadAll();
      setDepositOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to process deposit', 'error');
    } finally {
      setDepositLoading(false);
    }
  };

  return (
    <>
      <AppHeader title="Recurring Deposits" action={<button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3"><Plus size={14} /> Add</button>} />
      <main className="px-4 pt-3 space-y-4">
        {rds.length === 0 ? (
          <div className="card p-6 text-center text-sm text-text-muted">No recurring deposits yet.</div>
        ) : null}
        {rds.map((rd) => {
          const deposited = Number(rd.total_deposited) || 0;
          const maturity = Number(rd.maturity_amount) || 0;
          const monthly = Number(rd.monthly_amount) || 0;
          const days = daysUntil(rd.maturity_date);
          const pct = maturity > 0 ? (deposited / maturity) * 100 : 0;
          return (
            <div key={rd.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">{rd.name}</div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openDeposit(rd)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ color: 'var(--positive)' }}
                  >
                    <Wallet size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(rd)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ color: 'var(--accent)' }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(rd.id)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ color: 'var(--negative)' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
                <span>{monthly ? `${formatBDT(monthly)} / month` : ''}</span>
                <span>·</span>
                <span>{rd.interest_rate}% interest</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-text-muted">Deposited</div>
                  <div className="font-mono" style={{ color: 'var(--positive)' }}>{formatBDT(deposited)}</div>
                </div>
                <div className="text-right">
                  <div className="text-text-muted">Target</div>
                  <div className="font-mono">{formatBDT(maturity)}</div>
                </div>
              </div>
              {rd.maturity_date && (
                <div className="text-xs text-text-muted mt-3">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    {days !== null
                      ? `Matures ${rd.maturity_date}${days !== null ? ` (${days}d)` : ''}`
                      : rd.maturity_date}
                  </div>
                </div>
              )}
              <div className="px-1 mt-3">
                <div className="flex justify-between text-[11px] text-text-muted mb-1">
                  <span>Progress</span>
                  <span className="font-mono">{pct.toFixed(1)}%</span>
                </div>
                <ProgressBar
                  value={deposited}
                  max={maturity || 1}
                  color={pct >= 100 ? 'var(--positive)' : pct > 80 ? 'var(--accent)' : 'var(--warning)'}
                />
              </div>
            </div>
          );
        })}
      </main>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={editingId ? 'Edit Recurring Deposit' : 'Add Recurring Deposit'}>
        <label className="block text-xs text-text-muted mb-1">Name</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Sonali Bank RD"
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

        <label className="block text-xs text-text-muted mb-1">Interest rate (%)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="decimal"
          placeholder="e.g. 8.5"
          value={newInterestRate}
          onChange={(e) => setNewInterestRate(e.target.value.replace(/[^\d.]/g, ''))}
        />

        <label className="block text-xs text-text-muted mb-1">Maturity amount (BDT, optional)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 500000"
          value={newMaturityAmount}
          onChange={(e) => setNewMaturityAmount(e.target.value.replace(/[^\d]/g, ''))}
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
          {editingId ? 'Update' : 'Add'}
        </ActionButton>
      </BottomSheet>

      <BottomSheet open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete Recurring Deposit">
        <p className="text-sm text-text-muted mb-4">Are you sure you want to delete this recurring deposit?</p>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</ActionButton>
        </div>
      </BottomSheet>

      <BottomSheet open={depositOpen} onClose={() => setDepositOpen(false)} title="Deposit to RD">
        <label className="block text-xs text-text-muted mb-1">Deposit amount (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 5000"
          value={depositAmount}
          onChange={(e) => setDepositAmount(e.target.value.replace(/[^\d]/g, ''))}
        />

        <label className="block text-xs text-text-muted mb-1">Deposit from account (optional)</label>
        <select
          className="input mb-4"
          value={depositAccountId}
          onChange={(e) => setDepositAccountId(e.target.value)}
        >
          <option value="">No account (just add to RD)</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {formatBDT(a.balance)}
            </option>
          ))}
        </select>

        <ActionButton variant="primary" className="w-full" loading={depositLoading} onClick={handleDeposit}>
          Deposit
        </ActionButton>
      </BottomSheet>
    </>
  );
}
