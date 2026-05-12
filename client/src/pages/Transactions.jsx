import { useEffect, useMemo, useState } from 'react';
import { Search, Plus } from 'lucide-react';

import AppHeader from '../components/AppHeader.jsx';
import TransactionFeed from '../components/TransactionFeed.jsx';
import ExportCSV from '../components/ExportCSV.jsx';
import ActionButton from '../components/ActionButton.jsx';
import BottomSheet from '../components/BottomSheet.jsx';
import api, { apiPaths } from '../api/client';
import { useFinance } from '../context/FinanceContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatBDT } from '../utils/formatBDT';

const CATEGORIES = ['', 'Salary', 'Food', 'Transport', 'Shopping', 'Utilities', 'Health', 'Loan', 'Savings', 'Others'];
const PAGE_SIZE = 20;

export default function Transactions() {
  const { accounts, loadAll } = useFinance();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newTx, setNewTx] = useState({
    account_id: '',
    type: 'expense',
    amount: '',
    category_id: '',
    subcategory_id: '',
    transaction_date: new Date().toISOString().split('T')[0],
    source_type: 'account',
    source_id: '',
    payee: '',
    notes: '',
    reference_no: '',
    is_recurring: false,
    recurring_rule_id: '',
    is_split: false,
  });
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [category, setCategory] = useState('');
  const [type, setType] = useState('');
  const [accountId, setAccountId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');

  const openAdd = () => {
    setEditingId(null);
    setNewTx({
      account_id: accounts[0]?.id ? String(accounts[0].id) : '',
      type: 'expense',
      amount: '',
      category_id: '',
      subcategory_id: '',
      transaction_date: new Date().toISOString().split('T')[0],
      source_type: 'account',
      source_id: '',
      payee: '',
      notes: '',
      reference_no: '',
      is_recurring: false,
      recurring_rule_id: '',
      is_split: false,
    });
    setAddOpen(true);
  };

  const openEdit = (tx) => {
    setEditingId(tx.id);
    setNewTx({
      account_id: String(tx.account_id),
      type: tx.type,
      amount: String(tx.amount),
      category_id: tx.category_id || '',
      subcategory_id: tx.subcategory_id || '',
      transaction_date: tx.transaction_date || new Date().toISOString().split('T')[0],
      source_type: tx.source_type || '',
      source_id: tx.source_id || '',
      payee: tx.payee || '',
      notes: tx.notes || '',
      reference_no: tx.reference_no || '',
      is_recurring: tx.is_recurring || false,
      recurring_rule_id: tx.recurring_rule_id || '',
      is_split: tx.is_split || false,
    });
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!newTx.account_id || !newTx.type || !newTx.amount) {
      toast.push('Account, type, and amount are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      if (editingId) {
        await api.put(`${apiPaths.transactions}/${editingId}`, {
          account_id: Number(newTx.account_id),
          type: newTx.type,
          amount: Number(newTx.amount),
          category_id: newTx.category_id || null,
          subcategory_id: newTx.subcategory_id || null,
          transaction_date: newTx.transaction_date,
          source_type: newTx.source_type || 'account',
          source_id: newTx.source_id || null,
          payee: newTx.payee || null,
          notes: newTx.notes || null,
          reference_no: newTx.reference_no || null,
          is_recurring: newTx.is_recurring || false,
          recurring_rule_id: newTx.recurring_rule_id || null,
          is_split: newTx.is_split || false,
        });
        toast.push('Transaction updated', 'success');
      } else {
        await api.post(apiPaths.transactions, {
          account_id: Number(newTx.account_id),
          type: newTx.type,
          amount: Number(newTx.amount),
          category_id: newTx.category_id || null,
          subcategory_id: newTx.subcategory_id || null,
          transaction_date: newTx.transaction_date,
          source_type: newTx.source_type || 'account',
          source_id: newTx.source_id || null,
          payee: newTx.payee || null,
          notes: newTx.notes || null,
          reference_no: newTx.reference_no || null,
          is_recurring: newTx.is_recurring || false,
          recurring_rule_id: newTx.recurring_rule_id || null,
          is_split: newTx.is_split || false,
        });
        toast.push('Transaction added', 'success');
      }
      await loadAll();
      setAddOpen(false);
      setItems([]);
      setPage(1);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to save transaction', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (txId) => {
    try {
      await api.delete(`${apiPaths.transactions}/${txId}`);
      toast.push('Transaction deleted', 'success');
      await loadAll();
      setItems([]);
      setPage(1);
      setDeleteConfirm(null);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to delete transaction', 'error');
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get(apiPaths.transactionsList({
        page,
        pageSize: PAGE_SIZE,
        category: category || undefined,
        type: type || undefined,
        accountId: accountId || undefined,
        from: from || undefined,
        to: to || undefined,
      }))
      .then(({ data }) => {
        if (!active) return;
        setItems((prev) => (page === 1 ? data.transactions : [...prev, ...data.transactions]));
        setTotal(data.total);
      })
      .catch(() => undefined)
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [page, category, type, accountId, from, to]);

  // Reset to page 1 on any filter change.
  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [category, type, accountId, from, to]);

  const filtered = useMemo(() => {
    if (!search) return items;
    const needle = search.toLowerCase();
    return items.filter(
      (t) =>
        (t.description || '').toLowerCase().includes(needle) ||
        (t.category || '').toLowerCase().includes(needle) ||
        (t.account_name || '').toLowerCase().includes(needle),
    );
  }, [items, search]);

  return (
    <>
      <AppHeader
        title="Transactions"
        action={
          <div className="flex gap-2">
            <ExportCSV transactions={filtered} label="Export" />
            <button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3"><Plus size={14} /> Add</button>
          </div>
        }
      />
      <main className="px-4 pt-3">
        <div className="card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Search size={16} className="text-text-muted" />
            <input
              className="bg-transparent w-full text-sm outline-none"
              placeholder="Search description, category, account..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c || 'All categories'}
                </option>
              ))}
            </select>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="transfer_debit">Transfer Debit</option>
              <option value="transfer_credit">Transfer Credit</option>
              <option value="adjustment">Adjustment</option>
            </select>
            <select
              className="input"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
              <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="mt-3">
          <TransactionFeed transactions={filtered} onEdit={openEdit} onDelete={(t) => setDeleteConfirm(t.id)} />
        </div>

        {items.length < total ? (
          <div className="flex justify-center mt-3">
            <button
              type="button"
              className="btn btn-ghost text-xs"
              onClick={() => setPage((p) => p + 1)}
              disabled={loading}
            >
              {loading ? 'Loading...' : `Load more (${total - items.length} more)`}
            </button>
          </div>
        ) : null}
      </main>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={editingId ? 'Edit Transaction' : 'Add Transaction'}>
        <label className="block text-xs text-text-muted mb-1">Account</label>
        <select
          className="input mb-3"
          value={newTx.account_id}
          onChange={(e) => setNewTx({ ...newTx, account_id: e.target.value })}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {formatBDT(a.current_balance)}
            </option>
          ))}
        </select>

        <label className="block text-xs text-text-muted mb-1">Type</label>
        <select
          className="input mb-3"
          value={newTx.type}
          onChange={(e) => setNewTx({ ...newTx, type: e.target.value })}
        >
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="transfer_debit">Transfer Debit</option>
          <option value="transfer_credit">Transfer Credit</option>
          <option value="adjustment">Adjustment</option>
        </select>

        <label className="block text-xs text-text-muted mb-1">Amount (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 5000"
          value={newTx.amount}
          onChange={(e) => setNewTx({ ...newTx, amount: e.target.value.replace(/[^\d]/g, '') })}
        />

        <label className="block text-xs text-text-muted mb-1">Category (Optional)</label>
        <select
          className="input mb-3"
          value={newTx.category_id}
          onChange={(e) => setNewTx({ ...newTx, category_id: e.target.value })}
        >
          <option value="">No category</option>
          {CATEGORIES.filter(c => c).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <label className="block text-xs text-text-muted mb-1">Transaction Date</label>
        <input
          className="input mb-3"
          type="date"
          value={newTx.transaction_date}
          onChange={(e) => setNewTx({ ...newTx, transaction_date: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-1">Payee (Optional)</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Grocery Store"
          value={newTx.payee}
          onChange={(e) => setNewTx({ ...newTx, payee: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-1">Notes (Optional)</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Grocery shopping"
          value={newTx.notes}
          onChange={(e) => setNewTx({ ...newTx, notes: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-1">Reference Number (Optional)</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. REF123456"
          value={newTx.reference_no}
          onChange={(e) => setNewTx({ ...newTx, reference_no: e.target.value })}
        />

        <div className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            id="is_recurring"
            checked={newTx.is_recurring}
            onChange={(e) => setNewTx({ ...newTx, is_recurring: e.target.checked })}
          />
          <label htmlFor="is_recurring" className="text-xs text-text-muted">Recurring Transaction</label>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            id="is_split"
            checked={newTx.is_split}
            onChange={(e) => setNewTx({ ...newTx, is_split: e.target.checked })}
          />
          <label htmlFor="is_split" className="text-xs text-text-muted">Split Transaction</label>
        </div>

        <ActionButton variant="primary" className="w-full" loading={addLoading} onClick={handleAdd}>
          {editingId ? 'Update Transaction' : 'Add Transaction'}
        </ActionButton>
      </BottomSheet>

      <BottomSheet open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete Transaction">
        <p className="text-sm text-text-muted mb-4">Are you sure you want to delete this transaction?</p>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</ActionButton>
        </div>
      </BottomSheet>
    </>
  );
}
