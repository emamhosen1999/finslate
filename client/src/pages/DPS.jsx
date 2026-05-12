import { useState } from 'react';
import { Plus, Pencil, Trash2, Wallet } from 'lucide-react';

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
  const { dps, accounts, loadAll } = useFinance();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newInstitutionName, setNewInstitutionName] = useState('');
  const [newDpsAccountNumber, setNewDpsAccountNumber] = useState('');
  const [newLinkedAccountId, setNewLinkedAccountId] = useState('');
  const [newInstallmentAmount, setNewInstallmentAmount] = useState('');
  const [newAnnualInterestRate, setNewAnnualInterestRate] = useState('');
  const [newTenureMonths, setNewTenureMonths] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newMaturityDate, setNewMaturityDate] = useState('');
  const [newWithholdingTaxRate, setNewWithholdingTaxRate] = useState('10');
  const [newNote, setNewNote] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositDpsId, setDepositDpsId] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositAccountId, setDepositAccountId] = useState('');
  const [breakOpen, setBreakOpen] = useState(false);
  const [breakDpsId, setBreakDpsId] = useState(null);
  const [breakValue, setBreakValue] = useState('');
  const [matureOpen, setMatureOpen] = useState(false);
  const [matureDpsId, setMatureDpsId] = useState(null);
  const [matureValue, setMatureValue] = useState('');
  const [matureAccountId, setMatureAccountId] = useState('');

  const openAdd = () => {
    setEditingId(null);
    setNewInstitutionName('');
    setNewDpsAccountNumber('');
    setNewLinkedAccountId('');
    setNewInstallmentAmount('');
    setNewAnnualInterestRate('12');
    setNewTenureMonths('60');
    setNewStartDate(new Date().toISOString().split('T')[0]);
    setNewMaturityDate('');
    setNewWithholdingTaxRate('10');
    setNewNote('');
    setAddOpen(true);
  };

  const openEdit = (d) => {
    setEditingId(d.id);
    setNewInstitutionName(d.institution_name || '');
    setNewDpsAccountNumber(d.dps_account_number || '');
    setNewLinkedAccountId(d.linked_account_id ? String(d.linked_account_id) : '');
    setNewInstallmentAmount(String(d.installment_amount));
    setNewAnnualInterestRate(String(d.annual_interest_rate));
    setNewTenureMonths(String(d.tenure_months));
    setNewStartDate(d.start_date || '');
    setNewMaturityDate(d.maturity_date || '');
    setNewWithholdingTaxRate(String(d.withholding_tax_rate || '10'));
    setNewNote(d.note || '');
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!newInstitutionName || !newDpsAccountNumber || !newInstallmentAmount || !newAnnualInterestRate || !newTenureMonths || !newStartDate) {
      toast.push('Institution name, DPS account number, installment amount, annual interest rate, tenure months, and start date are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      if (editingId) {
        await api.put(`${apiPaths.dps}/${editingId}`, {
          institution_name: newInstitutionName.trim(),
          dps_account_number: newDpsAccountNumber.trim(),
          linked_account_id: newLinkedAccountId ? Number(newLinkedAccountId) : null,
          installment_amount: Number(newInstallmentAmount),
          annual_interest_rate: Number(newAnnualInterestRate),
          tenure_months: Number(newTenureMonths),
          start_date: newStartDate || null,
          maturity_date: newMaturityDate || null,
          withholding_tax_rate: Number(newWithholdingTaxRate),
          note: newNote || null,
        });
        toast.push('DPS updated', 'success');
      } else {
        await api.post(apiPaths.dps, {
          institution_name: newInstitutionName.trim(),
          dps_account_number: newDpsAccountNumber.trim(),
          linked_account_id: newLinkedAccountId ? Number(newLinkedAccountId) : null,
          installment_amount: Number(newInstallmentAmount),
          annual_interest_rate: Number(newAnnualInterestRate),
          tenure_months: Number(newTenureMonths),
          start_date: newStartDate || null,
          maturity_date: newMaturityDate || null,
          withholding_tax_rate: Number(newWithholdingTaxRate),
          note: newNote || null,
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

  const openDeposit = (d) => {
    setDepositDpsId(d.id);
    setDepositAmount(String(d.installment_amount));
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
      await api.post(`${apiPaths.dps}/${depositDpsId}/deposit`, {
        amount: Number(depositAmount),
        account_id: depositAccountId ? Number(depositAccountId) : null,
      });
      toast.push('Deposit successful', 'success');
      await loadAll();
      setDepositOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to process deposit', 'error');
    } finally {
      setDepositLoading(false);
    }
  };

  const handleBreak = async () => {
    if (!breakValue) {
      toast.push('Break value is required', 'error');
      return;
    }
    setDepositLoading(true);
    try {
      await api.post(`${apiPaths.dps}/${breakDpsId}/break`, {
        break_value: Number(breakValue),
      });
      toast.push('DPS broken successfully', 'success');
      await loadAll();
      setBreakOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to break DPS', 'error');
    } finally {
      setDepositLoading(false);
    }
  };

  const handleMature = async () => {
    if (!matureValue) {
      toast.push('Maturity value is required', 'error');
      return;
    }
    setDepositLoading(true);
    try {
      await api.post(`${apiPaths.dps}/${matureDpsId}/mature`, {
        actual_maturity_value: Number(matureValue),
        maturity_credited_to_id: matureAccountId ? Number(matureAccountId) : null,
      });
      toast.push('DPS matured successfully', 'success');
      await loadAll();
      setMatureOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to mature DPS', 'error');
    } finally {
      setDepositLoading(false);
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
          const projected = Number(d.projected_maturity_value) || 0;
          const installment = Number(d.installment_amount) || 0;
          const paid = Number(d.paid_installments) || 0;
          const total = Number(d.total_installments) || Number(d.tenure_months) || 0;
          const days = daysUntil(d.maturity_date);
          return (
            <div key={d.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">{d.institution_name} - {d.dps_account_number}</div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    d.status === 'active' ? 'bg-green-100 text-green-700' :
                    d.status === 'matured' ? 'bg-blue-100 text-blue-700' :
                    d.status === 'broken' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {d.status}
                  </span>
                  <div className="text-xs text-text-muted">
                    {installment ? `${formatBDT(installment)} / month` : ''}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openDeposit(d)}
                      className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                      style={{ color: 'var(--positive)' }}
                    >
                      <Wallet size={16} />
                    </button>
                    {d.status === 'active' && (
                      <>
                        <button
                          type="button"
                          onClick={() => { setBreakDpsId(d.id); setBreakValue(String(d.total_deposited)); setBreakOpen(true); }}
                          className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                          style={{ color: 'var(--warning)' }}
                        >
                          <Trash2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setMatureDpsId(d.id); setMatureValue(String(d.projected_maturity_value || d.total_deposited)); setMatureAccountId(''); setMatureOpen(true); }}
                          className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                          style={{ color: 'var(--accent)' }}
                        >
                          <Pencil size={16} />
                        </button>
                      </>
                    )}
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
                  <div className="text-text-muted">Projected</div>
                  <div className="font-mono">{formatBDT(projected)}</div>
                </div>
                <div>
                  <div className="text-text-muted">Progress</div>
                  <div className="font-mono">{paid} / {total} installments</div>
                </div>
                <div className="text-right">
                  <div className="text-text-muted">Interest Rate</div>
                  <div className="font-mono">{d.annual_interest_rate}%</div>
                </div>
              </div>
              <div className="mt-3">
                <ProgressBar value={paid} max={total} color="var(--warning)" />
                <div className="text-[11px] text-text-muted mt-1 flex justify-between">
                  <span>
                    {total > 0 ? `${((paid / total) * 100).toFixed(1)}%` : '—'} completed
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
        <label className="block text-xs text-text-muted mb-1">Institution name</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Sonali Bank"
          value={newInstitutionName}
          onChange={(e) => setNewInstitutionName(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">DPS account number</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. DPS-12345"
          value={newDpsAccountNumber}
          onChange={(e) => setNewDpsAccountNumber(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Linked account (optional)</label>
        <select
          className="input mb-3"
          value={newLinkedAccountId}
          onChange={(e) => setNewLinkedAccountId(e.target.value)}
        >
          <option value="">No linked account</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {formatBDT(a.current_balance)}
            </option>
          ))}
        </select>

        <label className="block text-xs text-text-muted mb-1">Monthly installment (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 5000"
          value={newInstallmentAmount}
          onChange={(e) => setNewInstallmentAmount(e.target.value.replace(/[^\d]/g, ''))}
        />

        <label className="block text-xs text-text-muted mb-1">Annual interest rate (%)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 12"
          value={newAnnualInterestRate}
          onChange={(e) => setNewAnnualInterestRate(e.target.value.replace(/[^\d.]/g, ''))}
        />

        <label className="block text-xs text-text-muted mb-1">Tenure (months)</label>
        <select
          className="input mb-3"
          value={newTenureMonths}
          onChange={(e) => setNewTenureMonths(e.target.value)}
        >
          <option value="12">12 months (1 year)</option>
          <option value="24">24 months (2 years)</option>
          <option value="36">36 months (3 years)</option>
          <option value="60">60 months (5 years)</option>
          <option value="120">120 months (10 years)</option>
        </select>

        <label className="block text-xs text-text-muted mb-1">Start date</label>
        <input
          className="input mb-3"
          type="date"
          value={newStartDate}
          onChange={(e) => setNewStartDate(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Maturity date (optional)</label>
        <input
          className="input mb-3"
          type="date"
          value={newMaturityDate}
          onChange={(e) => setNewMaturityDate(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Withholding tax rate (%)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 10"
          value={newWithholdingTaxRate}
          onChange={(e) => setNewWithholdingTaxRate(e.target.value.replace(/[^\d.]/g, ''))}
        />

        <label className="block text-xs text-text-muted mb-1">Note (optional)</label>
        <textarea
          className="input mb-4"
          rows="2"
          placeholder="Any additional notes..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
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

      <BottomSheet open={depositOpen} onClose={() => setDepositOpen(false)} title="Deposit to DPS">
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
          <option value="">No account (just add to DPS)</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {formatBDT(a.current_balance)}
            </option>
          ))}
        </select>

        <ActionButton variant="primary" className="w-full" loading={depositLoading} onClick={handleDeposit}>
          Deposit
        </ActionButton>
      </BottomSheet>

      <BottomSheet open={breakOpen} onClose={() => setBreakOpen(false)} title="Break DPS">
        <p className="text-sm text-text-muted mb-4">Are you sure you want to break this DPS before maturity? The break value will be credited to your account.</p>
        <label className="block text-xs text-text-muted mb-1">Break value (BDT)</label>
        <input
          className="input mb-4"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 50000"
          value={breakValue}
          onChange={(e) => setBreakValue(e.target.value.replace(/[^\d]/g, ''))}
        />
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setBreakOpen(false)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" loading={depositLoading} onClick={handleBreak}>Break DPS</ActionButton>
        </div>
      </BottomSheet>

      <BottomSheet open={matureOpen} onClose={() => setMatureOpen(false)} title="Mature DPS">
        <p className="text-sm text-text-muted mb-4">Mark this DPS as matured and credit the maturity amount to an account.</p>
        <label className="block text-xs text-text-muted mb-1">Maturity value (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 600000"
          value={matureValue}
          onChange={(e) => setMatureValue(e.target.value.replace(/[^\d]/g, ''))}
        />
        <label className="block text-xs text-text-muted mb-1">Credit to account (optional)</label>
        <select
          className="input mb-4"
          value={matureAccountId}
          onChange={(e) => setMatureAccountId(e.target.value)}
        >
          <option value="">No account (just mark as matured)</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {formatBDT(a.current_balance)}
            </option>
          ))}
        </select>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setMatureOpen(false)}>Cancel</ActionButton>
          <ActionButton variant="primary" className="flex-1" loading={depositLoading} onClick={handleMature}>Mature DPS</ActionButton>
        </div>
      </BottomSheet>
    </>
  );
}
