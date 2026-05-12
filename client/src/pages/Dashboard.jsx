import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

import AppHeader from '../components/AppHeader.jsx';
import NetWorthCard from '../components/NetWorthCard.jsx';
import ActionButton from '../components/ActionButton.jsx';
import TransactionFeed from '../components/TransactionFeed.jsx';
import SpendingChart from '../components/SpendingChart.jsx';
import ExportCSV from '../components/ExportCSV.jsx';
import BottomSheet from '../components/BottomSheet.jsx';
import { useFinance } from '../context/FinanceContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatBDT } from '../utils/formatBDT';

export default function Dashboard() {
  const {
    summary,
    transactions,
    accounts,
    loans,
    loading,
    debtRepayment,
  } = useFinance();
  const toast = useToast();

  const [repayOpen, setRepayOpen] = useState(false);
  const [repayLoading, setRepayLoading] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(null);

  const filteredTx = (transactions || []).filter((t) =>
    categoryFilter ? t.category_id === categoryFilter : true,
  );

  const openRepay = () => {
    setSelectedLoan(loans[0]?.id ? String(loans[0].id) : '');
    setSelectedAccount(accounts[0]?.id ? String(accounts[0].id) : '');
    setAmount('');
    setRepayOpen(true);
  };

  const handleRepay = async () => {
    const amt = Number(amount);
    if (!selectedLoan || !selectedAccount || !Number.isFinite(amt) || amt <= 0) {
      toast.push('Pick a loan, account, and enter a positive amount', 'error');
      return;
    }
    setRepayLoading(true);
    try {
      await debtRepayment({
        loanId: Number(selectedLoan),
        accountId: Number(selectedAccount),
        amount: amt,
      });
      toast.push(`Repaid ${formatBDT(amt)} toward loan`, 'success');
      setRepayOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Repayment failed', 'error');
    } finally {
      setRepayLoading(false);
    }
  };

  return (
    <>
      <AppHeader />
      <main className="px-4">
        <NetWorthCard summary={summary} loading={loading && transactions.length === 0} />

        <div className="mt-4">
          <ActionButton
            variant="negative"
            icon={ArrowUpCircle}
            onClick={openRepay}
            disabled={!loans.length}
            className="w-full"
          >
            Debt Repayment
          </ActionButton>
        </div>

        <SpendingChart transactions={transactions} onCategoryClick={setCategoryFilter} />

        <div className="flex items-center justify-between mt-6 mb-2">
          <div className="text-sm font-semibold">
            Recent activity{' '}
            {categoryFilter ? (
              <span className="text-text-muted font-normal">· {categoryFilter}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {categoryFilter ? (
              <button
                type="button"
                onClick={() => setCategoryFilter(null)}
                className="text-[11px] text-text-muted"
              >
                Clear
              </button>
            ) : null}
            <Link to="/transactions" className="text-xs text-accent">
              View all
            </Link>
          </div>
        </div>

        <TransactionFeed transactions={filteredTx.slice(0, 10)} />

        <div className="flex justify-end mt-3">
          <ExportCSV transactions={filteredTx} />
        </div>
      </main>

      <BottomSheet open={repayOpen} onClose={() => setRepayOpen(false)} title="Debt Repayment">
        <label className="block text-xs text-text-muted mb-1">Loan</label>
        <select
          className="input mb-3"
          value={selectedLoan}
          onChange={(e) => setSelectedLoan(e.target.value)}
        >
          {loans.map((l) => (
            <option key={l.id} value={l.id}>
              {l.lender_name} · {formatBDT(l.outstanding_balance)} remaining
            </option>
          ))}
        </select>

        <label className="block text-xs text-text-muted mb-1">From account</label>
        <select
          className="input mb-3"
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {formatBDT(a.current_balance)}
            </option>
          ))}
        </select>

        <label className="block text-xs text-text-muted mb-1">Amount (BDT)</label>
        <input
          className="input mb-4"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 10000"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
        />

        <ActionButton
          variant="primary"
          className="w-full"
          loading={repayLoading}
          onClick={handleRepay}
        >
          Confirm repayment
        </ActionButton>
      </BottomSheet>
    </>
  );
}
