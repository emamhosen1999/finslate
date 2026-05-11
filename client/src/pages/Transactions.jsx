import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import AppHeader from '../components/AppHeader.jsx';
import TransactionFeed from '../components/TransactionFeed.jsx';
import ExportCSV from '../components/ExportCSV.jsx';
import api, { apiPaths } from '../api/client';
import { useFinance } from '../context/FinanceContext.jsx';

const CATEGORIES = ['', 'Salary', 'Food', 'Transport', 'Shopping', 'Utilities', 'Health', 'Loan', 'Savings', 'Others'];
const PAGE_SIZE = 20;

export default function Transactions() {
  const { accounts } = useFinance();
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [category, setCategory] = useState('');
  const [type, setType] = useState('');
  const [accountId, setAccountId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get(apiPaths.transactions({
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
      <AppHeader title="Transactions" action={<ExportCSV transactions={filtered} label="CSV" />} />
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
    </>
  );
}
