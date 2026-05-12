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
  const [newInstitutionName, setNewInstitutionName] = useState('');
  const [newFdrAccountNumber, setNewFdrAccountNumber] = useState('');
  const [newSourceAccountId, setNewSourceAccountId] = useState('');
  const [newPrincipalAmount, setNewPrincipalAmount] = useState('');
  const [newAnnualInterestRate, setNewAnnualInterestRate] = useState('');
  const [newCompoundingFrequency, setNewCompoundingFrequency] = useState('yearly');
  const [newTenureDays, setNewTenureDays] = useState('');
  const [newTenureMonths, setNewTenureMonths] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newMaturityDate, setNewMaturityDate] = useState('');
  const [newInterestPayoutFrequency, setNewInterestPayoutFrequency] = useState('on_maturity');
  const [newInterestPayoutAccountId, setNewInterestPayoutAccountId] = useState('');
  const [newWithholdingTaxRate, setNewWithholdingTaxRate] = useState('10');
  const [newAutoRenewal, setNewAutoRenewal] = useState(false);
  const [newNote, setNewNote] = useState('');
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
    setNewInstitutionName('');
    setNewFdrAccountNumber('');
    setNewSourceAccountId('');
    setNewPrincipalAmount('');
    setNewAnnualInterestRate('8');
    setNewCompoundingFrequency('yearly');
    setNewTenureDays('');
    setNewTenureMonths('');
    setNewStartDate(new Date().toISOString().split('T')[0]);
    setNewMaturityDate('');
    setNewInterestPayoutFrequency('on_maturity');
    setNewInterestPayoutAccountId('');
    setNewWithholdingTaxRate('10');
    setNewAutoRenewal(false);
    setNewNote('');
    setAddOpen(true);
  };

  const openEdit = (fd) => {
    setEditingId(fd.id);
    setNewInstitutionName(fd.institution_name || '');
    setNewFdrAccountNumber(fd.fdr_account_number || '');
    setNewSourceAccountId(fd.source_account_id ? String(fd.source_account_id) : '');
    setNewPrincipalAmount(String(fd.principal_amount));
    setNewAnnualInterestRate(String(fd.annual_interest_rate));
    setNewCompoundingFrequency(fd.compounding_frequency || 'yearly');
    setNewTenureDays(fd.tenure_days ? String(fd.tenure_days) : '');
    setNewTenureMonths(fd.tenure_months ? String(fd.tenure_months) : '');
    setNewStartDate(fd.start_date);
    setNewMaturityDate(fd.maturity_date);
    setNewInterestPayoutFrequency(fd.interest_payout_frequency || 'on_maturity');
    setNewInterestPayoutAccountId(fd.interest_payout_account_id ? String(fd.interest_payout_account_id) : '');
    setNewWithholdingTaxRate(String(fd.withholding_tax_rate || '10'));
    setNewAutoRenewal(fd.auto_renewal || false);
    setNewNote(fd.note || '');
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!newInstitutionName || !newPrincipalAmount || !newAnnualInterestRate || !newCompoundingFrequency || !newStartDate || !newMaturityDate) {
      toast.push('Institution name, principal amount, annual interest rate, compounding frequency, start date, and maturity date are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      if (editingId) {
        await api.put(`${apiPaths.fixedDeposits}/${editingId}`, {
          institution_name: newInstitutionName.trim(),
          fdr_account_number: newFdrAccountNumber || null,
          source_account_id: newSourceAccountId ? Number(newSourceAccountId) : null,
          principal_amount: Number(newPrincipalAmount),
          annual_interest_rate: Number(newAnnualInterestRate),
          compounding_frequency: newCompoundingFrequency,
          tenure_days: newTenureDays ? Number(newTenureDays) : null,
          tenure_months: newTenureMonths ? Number(newTenureMonths) : null,
          start_date: newStartDate,
          maturity_date: newMaturityDate,
          interest_payout_frequency: newInterestPayoutFrequency,
          interest_payout_account_id: newInterestPayoutAccountId ? Number(newInterestPayoutAccountId) : null,
          withholding_tax_rate: Number(newWithholdingTaxRate),
          auto_renewal: newAutoRenewal,
          note: newNote || null,
        });
        toast.push('Fixed deposit updated', 'success');
      } else {
        await api.post(apiPaths.fixedDeposits, {
          institution_name: newInstitutionName.trim(),
          fdr_account_number: newFdrAccountNumber || null,
          source_account_id: newSourceAccountId ? Number(newSourceAccountId) : null,
          principal_amount: Number(newPrincipalAmount),
          annual_interest_rate: Number(newAnnualInterestRate),
          compounding_frequency: newCompoundingFrequency,
          tenure_days: newTenureDays ? Number(newTenureDays) : null,
          tenure_months: newTenureMonths ? Number(newTenureMonths) : null,
          start_date: newStartDate,
          maturity_date: newMaturityDate,
          interest_payout_frequency: newInterestPayoutFrequency,
          interest_payout_account_id: newInterestPayoutAccountId ? Number(newInterestPayoutAccountId) : null,
          withholding_tax_rate: Number(newWithholdingTaxRate),
          auto_renewal: newAutoRenewal,
          note: newNote || null,
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
          const principal = Number(fd.principal_amount);
          const rate = Number(fd.annual_interest_rate);
          const projectedMaturityValue = fd.projected_maturity_value ? Number(fd.projected_maturity_value) : principal * (1 + rate / 100);
          const actualMaturityValue = fd.actual_maturity_value ? Number(fd.actual_maturity_value) : null;
          return (
            <div key={fd.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">{fd.institution_name} {fd.fdr_account_number ? `- ${fd.fdr_account_number}` : ''}</div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    fd.status === 'active' ? 'bg-green-100 text-green-700' :
                    fd.status === 'matured' ? 'bg-blue-100 text-blue-700' :
                    fd.status === 'broken' ? 'bg-red-100 text-red-700' :
                    fd.status === 'renewed' ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {fd.status}
                  </span>
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
                  <div className="text-text-muted">Projected Maturity</div>
                  <div className="font-mono" style={{ color: 'var(--positive)' }}>{formatBDT(projectedMaturityValue)}</div>
                </div>
                <div className="text-right">
                  <div className="text-text-muted">Compounding</div>
                  <div className="font-mono">{fd.compounding_frequency}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                <div>
                  <div className="text-text-muted">Actual Maturity</div>
                  <div className="font-mono">{actualMaturityValue ? formatBDT(actualMaturityValue) : '—'}</div>
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
                {fd.auto_renewal && (
                  <div className="mt-1" style={{ color: 'var(--accent)' }}>
                    Auto-renewal enabled
                  </div>
                )}
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
        <label className="block text-xs text-text-muted mb-1">Institution name</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Sonali Bank"
          value={newInstitutionName}
          onChange={(e) => setNewInstitutionName(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">FDR account number (optional)</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. FD-12345"
          value={newFdrAccountNumber}
          onChange={(e) => setNewFdrAccountNumber(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Source account (optional)</label>
        <select
          className="input mb-3"
          value={newSourceAccountId}
          onChange={(e) => setNewSourceAccountId(e.target.value)}
        >
          <option value="">No source account</option>
          {fds.map((fd) => fd.source_account_id).filter(Boolean).map((accountId) => {
            // This is a placeholder - ideally you'd have access to accounts
            return <option key={accountId} value={accountId}>{accountId}</option>;
          })}
        </select>

        <label className="block text-xs text-text-muted mb-1">Principal amount (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 100000"
          value={newPrincipalAmount}
          onChange={(e) => setNewPrincipalAmount(e.target.value.replace(/[^\d]/g, ''))}
        />

        <label className="block text-xs text-text-muted mb-1">Annual interest rate (%)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="decimal"
          placeholder="e.g. 8.5"
          value={newAnnualInterestRate}
          onChange={(e) => setNewAnnualInterestRate(e.target.value.replace(/[^\d.]/g, ''))}
        />

        <label className="block text-xs text-text-muted mb-1">Compounding frequency</label>
        <select
          className="input mb-3"
          value={newCompoundingFrequency}
          onChange={(e) => setNewCompoundingFrequency(e.target.value)}
        >
          <option value="yearly">Yearly</option>
          <option value="half_yearly">Half-yearly</option>
          <option value="quarterly">Quarterly</option>
          <option value="monthly">Monthly</option>
          <option value="on_maturity">On Maturity</option>
        </select>

        <label className="block text-xs text-text-muted mb-1">Tenure days (optional)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 90"
          value={newTenureDays}
          onChange={(e) => setNewTenureDays(e.target.value.replace(/[^\d]/g, ''))}
        />

        <label className="block text-xs text-text-muted mb-1">Tenure months (optional)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 12"
          value={newTenureMonths}
          onChange={(e) => setNewTenureMonths(e.target.value.replace(/[^\d]/g, ''))}
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
          className="input mb-3"
          type="date"
          value={newMaturityDate}
          onChange={(e) => setNewMaturityDate(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Interest payout frequency</label>
        <select
          className="input mb-3"
          value={newInterestPayoutFrequency}
          onChange={(e) => setNewInterestPayoutFrequency(e.target.value)}
        >
          <option value="on_maturity">On Maturity</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
        </select>

        <label className="block text-xs text-text-muted mb-1">Interest payout account (optional)</label>
        <select
          className="input mb-3"
          value={newInterestPayoutAccountId}
          onChange={(e) => setNewInterestPayoutAccountId(e.target.value)}
        >
          <option value="">No payout account</option>
          {fds.map((fd) => fd.interest_payout_account_id).filter(Boolean).map((accountId) => {
            return <option key={accountId} value={accountId}>{accountId}</option>;
          })}
        </select>

        <label className="block text-xs text-text-muted mb-1">Withholding tax rate (%)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="decimal"
          placeholder="e.g. 10"
          value={newWithholdingTaxRate}
          onChange={(e) => setNewWithholdingTaxRate(e.target.value.replace(/[^\d.]/g, ''))}
        />

        <label className="block text-xs text-text-muted mb-1">Auto-renewal</label>
        <select
          className="input mb-3"
          value={newAutoRenewal}
          onChange={(e) => setNewAutoRenewal(e.target.value === 'true')}
        >
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>

        <label className="block text-xs text-text-muted mb-1">Note (optional)</label>
        <textarea
          className="input mb-4"
          rows="2"
          placeholder="Any additional notes..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
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
