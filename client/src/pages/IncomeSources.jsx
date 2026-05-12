import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Calendar, Briefcase } from 'lucide-react';

import AppHeader from '../components/AppHeader.jsx';
import ActionButton from '../components/ActionButton.jsx';
import BottomSheet from '../components/BottomSheet.jsx';
import { useFinance } from '../context/FinanceContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { apiPaths } from '../api/client';
import { formatBDT } from '../utils/formatBDT';

const SOURCE_TYPES = [
  { value: 'salary', label: 'Salary' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'rental', label: 'Rental' },
  { value: 'dividend', label: 'Dividend' },
  { value: 'business', label: 'Business' },
  { value: 'gift', label: 'Gift' },
  { value: 'remittance', label: 'Remittance' },
  { value: 'other', label: 'Other' },
];

const defaultForm = {
  source_type: 'salary',
  title: '',
  gross_amount: '',
  tds_amount: '',
  other_deductions: '',
  income_date: new Date().toISOString().split('T')[0],
  credited_to_account_id: '',
  description: '',
  is_recurring: false,
  // salary sub-detail
  employer_name: '',
  basic_salary: '',
  house_rent_allowance: '',
  medical_allowance: '',
  transport_allowance: '',
  bonus: '',
  provident_fund_deduction: '',
  pay_period: 'monthly',
  // freelance sub-detail
  client_name: '',
  project_name: '',
  invoice_number: '',
  platform: '',
  platform_fee: '',
  // rental sub-detail
  property_name: '',
  tenant_name: '',
  tenant_phone: '',
  // dividend sub-detail
  dividend_type: 'cash',
  units: '',
  rate_per_unit: '',
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function IncomeSources() {
  const { accounts, loadAll } = useFinance();
  const toast = useToast();
  const [incomes, setIncomes] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formData, setFormData] = useState({ ...defaultForm });

  const loadIncomes = async () => {
    try {
      const res = await api.get(apiPaths.incomes);
      setIncomes(res.data);
    } catch (err) {
      console.error('Failed to load incomes:', err);
    }
  };

  useEffect(() => {
    loadIncomes();
  }, []);

  const set = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));

  const openAdd = () => {
    setEditingId(null);
    setFormData({ ...defaultForm, credited_to_account_id: accounts[0]?.id ? String(accounts[0].id) : '' });
    setAddOpen(true);
  };

  const openEdit = (income) => {
    setEditingId(income.id);
    setFormData({
      ...defaultForm,
      source_type: income.source_type,
      title: income.title,
      gross_amount: String(income.gross_amount),
      tds_amount: String(income.tds_amount || ''),
      other_deductions: String(income.other_deductions || ''),
      income_date: income.income_date ? income.income_date.split('T')[0] : '',
      credited_to_account_id: income.credited_to_account_id ? String(income.credited_to_account_id) : '',
      description: income.description || '',
      is_recurring: !!income.is_recurring,
    });
    setAddOpen(true);
  };

  const buildPayload = () => {
    const payload = {
      source_type: formData.source_type,
      title: formData.title,
      gross_amount: Number(formData.gross_amount),
      tds_amount: Number(formData.tds_amount || 0),
      other_deductions: Number(formData.other_deductions || 0),
      income_date: formData.income_date,
      credited_to_account_id: formData.credited_to_account_id ? Number(formData.credited_to_account_id) : null,
      description: formData.description || null,
      is_recurring: formData.is_recurring,
    };
    if (formData.source_type === 'salary') {
      payload.salary_details = {
        employer_name: formData.employer_name || null,
        basic_salary: formData.basic_salary ? Number(formData.basic_salary) : null,
        house_rent_allowance: formData.house_rent_allowance ? Number(formData.house_rent_allowance) : null,
        medical_allowance: formData.medical_allowance ? Number(formData.medical_allowance) : null,
        transport_allowance: formData.transport_allowance ? Number(formData.transport_allowance) : null,
        bonus: formData.bonus ? Number(formData.bonus) : null,
        provident_fund_deduction: formData.provident_fund_deduction ? Number(formData.provident_fund_deduction) : null,
        pay_period: formData.pay_period,
      };
    } else if (formData.source_type === 'freelance') {
      payload.freelance_details = {
        client_name: formData.client_name || null,
        project_name: formData.project_name || null,
        invoice_number: formData.invoice_number || null,
        platform: formData.platform || null,
        platform_fee: formData.platform_fee ? Number(formData.platform_fee) : 0,
      };
    } else if (formData.source_type === 'rental') {
      payload.rental_details = {
        property_name: formData.property_name || null,
        tenant_name: formData.tenant_name || null,
        tenant_phone: formData.tenant_phone || null,
      };
    } else if (formData.source_type === 'dividend') {
      payload.dividend_details = {
        dividend_type: formData.dividend_type || null,
        units: formData.units ? Number(formData.units) : null,
        rate_per_unit: formData.rate_per_unit ? Number(formData.rate_per_unit) : null,
      };
    }
    return payload;
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.gross_amount || !formData.income_date) {
      toast.push('Title, gross amount, and income date are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      if (editingId) {
        await api.put(`${apiPaths.incomes}/${editingId}`, buildPayload());
        toast.push('Income updated', 'success');
      } else {
        await api.post(apiPaths.incomes, buildPayload());
        toast.push('Income added', 'success');
      }
      await loadIncomes();
      await loadAll();
      setAddOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to save income', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (incomeId) => {
    try {
      await api.delete(`${apiPaths.incomes}/${incomeId}`);
      toast.push('Income deleted', 'success');
      await loadIncomes();
      setDeleteConfirm(null);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to delete income', 'error');
    }
  };

  const totalGross = incomes.reduce((s, i) => s + parseFloat(i.gross_amount || 0), 0);
  const totalNet = incomes.reduce((s, i) => s + (parseFloat(i.gross_amount || 0) - parseFloat(i.tds_amount || 0) - parseFloat(i.other_deductions || 0)), 0);

  return (
    <>
      <AppHeader title="Income" action={<button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3"><Plus size={14} /> Add</button>} />
      <main className="px-4 pt-3 space-y-4">
        {incomes.length > 0 && (
          <div className="card p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-text-muted text-xs">Total Gross</div>
                <div className="font-mono font-semibold">{formatBDT(totalGross)}</div>
              </div>
              <div>
                <div className="text-text-muted text-xs">Total Net</div>
                <div className="font-mono font-semibold" style={{ color: 'var(--positive)' }}>{formatBDT(totalNet)}</div>
              </div>
            </div>
          </div>
        )}

        {incomes.length === 0 ? (
          <div className="card p-6 text-center text-sm text-text-muted">No income records yet.</div>
        ) : null}

        {incomes.map((income) => {
          const net = parseFloat(income.gross_amount) - parseFloat(income.tds_amount || 0) - parseFloat(income.other_deductions || 0);
          return (
            <div key={income.id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold truncate">{income.title}</div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => openEdit(income)} className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors" style={{ color: 'var(--accent)' }}>
                    <Pencil size={14} />
                  </button>
                  <button type="button" onClick={() => setDeleteConfirm(income.id)} className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors" style={{ color: 'var(--negative)' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
                <span className="px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--positive-alpha)', color: 'var(--positive)' }}>
                  {income.source_type}
                </span>
                <span>·</span>
                <Calendar size={12} />
                <span>{fmtDate(income.income_date)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-text-muted">Gross</div>
                  <div className="font-mono">{formatBDT(income.gross_amount)}</div>
                </div>
                <div>
                  <div className="text-text-muted">TDS</div>
                  <div className="font-mono">{formatBDT(income.tds_amount || 0)}</div>
                </div>
                <div>
                  <div className="text-text-muted">Net</div>
                  <div className="font-mono font-semibold" style={{ color: 'var(--positive)' }}>{formatBDT(net)}</div>
                </div>
              </div>
              {income.account_name && (
                <div className="text-xs text-text-muted mt-2 flex items-center gap-1">
                  <Briefcase size={12} />
                  {income.account_name}
                </div>
              )}
              {income.description && (
                <div className="text-xs text-text-muted mt-1">{income.description}</div>
              )}
            </div>
          );
        })}
      </main>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={editingId ? 'Edit Income' : 'Record Income'}>
        <label className="block text-xs text-text-muted mb-1">Source Type</label>
        <select className="input mb-3" value={formData.source_type} onChange={(e) => set('source_type', e.target.value)}>
          {SOURCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        <label className="block text-xs text-text-muted mb-1">Title</label>
        <input className="input mb-3" type="text" placeholder="e.g. January Salary" value={formData.title} onChange={(e) => set('title', e.target.value)} />

        <label className="block text-xs text-text-muted mb-1">Gross Amount (BDT)</label>
        <input className="input mb-3" type="text" inputMode="numeric" placeholder="e.g. 80000" value={formData.gross_amount} onChange={(e) => set('gross_amount', e.target.value.replace(/[^\d.]/g, ''))} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">TDS (optional)</label>
            <input className="input mb-3" type="text" inputMode="numeric" placeholder="0" value={formData.tds_amount} onChange={(e) => set('tds_amount', e.target.value.replace(/[^\d.]/g, ''))} />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Other Deductions</label>
            <input className="input mb-3" type="text" inputMode="numeric" placeholder="0" value={formData.other_deductions} onChange={(e) => set('other_deductions', e.target.value.replace(/[^\d.]/g, ''))} />
          </div>
        </div>

        <label className="block text-xs text-text-muted mb-1">Income Date</label>
        <input className="input mb-3" type="date" value={formData.income_date} onChange={(e) => set('income_date', e.target.value)} />

        <label className="block text-xs text-text-muted mb-1">Credit to Account (optional)</label>
        <select className="input mb-3" value={formData.credited_to_account_id} onChange={(e) => set('credited_to_account_id', e.target.value)}>
          <option value="">No account</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {formatBDT(a.current_balance)}</option>)}
        </select>

        <label className="block text-xs text-text-muted mb-1">Description (optional)</label>
        <textarea className="input mb-3" rows={2} placeholder="Notes..." value={formData.description} onChange={(e) => set('description', e.target.value)} />

        {formData.source_type === 'salary' && (
          <div className="p-3 rounded-lg mb-3" style={{ background: 'var(--bg-elevated)' }}>
            <div className="text-xs font-semibold mb-2">Salary Details</div>
            <input className="input mb-2" type="text" placeholder="Employer name" value={formData.employer_name} onChange={(e) => set('employer_name', e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input mb-2" type="text" inputMode="numeric" placeholder="Basic salary" value={formData.basic_salary} onChange={(e) => set('basic_salary', e.target.value.replace(/[^\d.]/g, ''))} />
              <input className="input mb-2" type="text" inputMode="numeric" placeholder="House rent" value={formData.house_rent_allowance} onChange={(e) => set('house_rent_allowance', e.target.value.replace(/[^\d.]/g, ''))} />
              <input className="input mb-2" type="text" inputMode="numeric" placeholder="Medical" value={formData.medical_allowance} onChange={(e) => set('medical_allowance', e.target.value.replace(/[^\d.]/g, ''))} />
              <input className="input mb-2" type="text" inputMode="numeric" placeholder="Transport" value={formData.transport_allowance} onChange={(e) => set('transport_allowance', e.target.value.replace(/[^\d.]/g, ''))} />
              <input className="input mb-2" type="text" inputMode="numeric" placeholder="Bonus" value={formData.bonus} onChange={(e) => set('bonus', e.target.value.replace(/[^\d.]/g, ''))} />
              <input className="input mb-2" type="text" inputMode="numeric" placeholder="PF deduction" value={formData.provident_fund_deduction} onChange={(e) => set('provident_fund_deduction', e.target.value.replace(/[^\d.]/g, ''))} />
            </div>
          </div>
        )}

        {formData.source_type === 'freelance' && (
          <div className="p-3 rounded-lg mb-3" style={{ background: 'var(--bg-elevated)' }}>
            <div className="text-xs font-semibold mb-2">Freelance Details</div>
            <input className="input mb-2" type="text" placeholder="Client name" value={formData.client_name} onChange={(e) => set('client_name', e.target.value)} />
            <input className="input mb-2" type="text" placeholder="Project name" value={formData.project_name} onChange={(e) => set('project_name', e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input mb-2" type="text" placeholder="Invoice #" value={formData.invoice_number} onChange={(e) => set('invoice_number', e.target.value)} />
              <input className="input mb-2" type="text" placeholder="Platform" value={formData.platform} onChange={(e) => set('platform', e.target.value)} />
            </div>
            <input className="input mb-2" type="text" inputMode="numeric" placeholder="Platform fee" value={formData.platform_fee} onChange={(e) => set('platform_fee', e.target.value.replace(/[^\d.]/g, ''))} />
          </div>
        )}

        {formData.source_type === 'rental' && (
          <div className="p-3 rounded-lg mb-3" style={{ background: 'var(--bg-elevated)' }}>
            <div className="text-xs font-semibold mb-2">Rental Details</div>
            <input className="input mb-2" type="text" placeholder="Property name" value={formData.property_name} onChange={(e) => set('property_name', e.target.value)} />
            <input className="input mb-2" type="text" placeholder="Tenant name" value={formData.tenant_name} onChange={(e) => set('tenant_name', e.target.value)} />
            <input className="input mb-2" type="text" placeholder="Tenant phone" value={formData.tenant_phone} onChange={(e) => set('tenant_phone', e.target.value)} />
          </div>
        )}

        {formData.source_type === 'dividend' && (
          <div className="p-3 rounded-lg mb-3" style={{ background: 'var(--bg-elevated)' }}>
            <div className="text-xs font-semibold mb-2">Dividend Details</div>
            <select className="input mb-2" value={formData.dividend_type} onChange={(e) => set('dividend_type', e.target.value)}>
              <option value="cash">Cash Dividend</option>
              <option value="stock">Stock Dividend</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input className="input mb-2" type="text" inputMode="numeric" placeholder="Units" value={formData.units} onChange={(e) => set('units', e.target.value.replace(/[^\d.]/g, ''))} />
              <input className="input mb-2" type="text" inputMode="numeric" placeholder="Rate per unit" value={formData.rate_per_unit} onChange={(e) => set('rate_per_unit', e.target.value.replace(/[^\d.]/g, ''))} />
            </div>
          </div>
        )}

        <ActionButton variant="primary" className="w-full" loading={addLoading} onClick={handleSubmit}>
          {editingId ? 'Update' : 'Add Income'}
        </ActionButton>
      </BottomSheet>

      <BottomSheet open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete Income">
        <p className="text-sm text-text-muted mb-4">Are you sure you want to delete this income record?</p>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</ActionButton>
        </div>
      </BottomSheet>
    </>
  );
}
