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
  const [newTx, setNewTx] = useState({ account_id: '', type: 'debit', amount: '', category: '', description: '' });

  const [category, setCategory] = useState('');
  const [type, setType] = useState('');
  const [accountId, setAccountId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');

  const openAdd = () => {
    setNewTx({ account_id: accounts[0]?.id ? String(accounts[0].id) : '', type: 'debit', amount: '', category: '', description: '' });
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!newTx.account_id || !newTx.type || !newTx.amount || !newTx.category) {
      toast.push('Account, type, amount, and category are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      await api.post(apiPaths.transactions, {
        account_id: Number(newTx.account_id),
        type: newTx.type,
        amount: Number(newTx.amount),
        category: newTx.category,
        description: newTx.description || null,
      });
      await loadAll();
      toast.push('Transaction added', 'success');
      setAddOpen(false);
      setItems([]);
      setPage(1);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to add transaction', 'error');
    } finally {
      setAddLoading(false);
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
      <AppHeader title="Transactions" action={<button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3"><Plus size={14} /> Add</button>} />
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
              <option value="credit">Credit</option>
              <option value="debit">Debit</option>
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
          <TransactionFeed transactions={filtered} />
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

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title="Add Transaction">
        <label className="block text-xs text-text-muted mb-1">Account</label>
        <select
          className="input mb-3"
          value={newTx.account_id}
          onChange={(e) => setNewTx({ ...newTx, account_id: e.target.value })}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {formatBDT(a.balance)}
            </option>
          ))}
        </select>

        <label className="block text-xs text-text-muted mb-1">Type</label>
        <select
          className="input mb-3"
          value={newTx.type}
          onChange={(e) => setNewTx({ ...newTx, type: e.target.value })}
        >
          <option value="debit">Debit (expense)</option>
          <option value="credit">Credit (income)</option>
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

        <label className="block text-xs text-text-muted mb-1">Category</label>
        <select
          className="input mb-3"
          value={newTx.category}
          onChange={(e) => setNewTx({ ...newTx, category: e.target.value })}
        >
          {CATEGORIES.filter(c => c).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <label className="block text-xs text-text-muted mb-1">Description (optional)</label>
        <input
          className="input mb-4"
          type="text"
          placeholder="e.g. Grocery shopping"
          value={newTx.description}
          onChange={(e) => setNewTx({ ...newTx, description: e.target.value })}
        />

        <ActionButton variant="primary" className="w-full" loading={addLoading} onClick={handleAdd}>
          Add Transaction
        </ActionButton>
      </BottomSheet>
    </>
  );
}
