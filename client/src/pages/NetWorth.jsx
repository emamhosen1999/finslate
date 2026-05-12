import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, PieChart, BarChart3, Calendar, Plus } from 'lucide-react';

import AppHeader from '../components/AppHeader.jsx';
import ActionButton from '../components/ActionButton.jsx';
import BottomSheet from '../components/BottomSheet.jsx';
import { useFinance } from '../context/FinanceContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { apiPaths } from '../api/client';
import { formatBDT } from '../utils/formatBDT';

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function NetWorth() {
  const toast = useToast();
  const [snapshots, setSnapshots] = useState([]);
  const [currentNetWorth, setCurrentNetWorth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotDate, setSnapshotDate] = useState(new Date().toISOString().split('T')[0]);

  const loadSnapshots = async () => {
    setLoading(true);
    try {
      const res = await api.get(apiPaths.netWorth);
      setSnapshots(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentNetWorth = async () => {
    try {
      const res = await api.get(`${apiPaths.netWorth}/current`);
      setCurrentNetWorth(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadSnapshots();
    loadCurrentNetWorth();
  }, []);

  const createSnapshot = async () => {
    setSnapshotLoading(true);
    try {
      await api.post(apiPaths.netWorth, { snapshot_date: snapshotDate });
      toast.push('Snapshot created', 'success');
      await loadSnapshots();
      setSnapshotOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to create snapshot', 'error');
    } finally {
      setSnapshotLoading(false);
    }
  };

  const calculateMoMChange = () => {
    if (snapshots.length < 2) return null;
    const latest = snapshots[0].net_worth;
    const previous = snapshots[1].net_worth;
    const change = latest - previous;
    const percent = previous !== 0 ? (change / previous) * 100 : 0;
    return { change, percent };
  };

  const momChange = calculateMoMChange();

  if (loading) {
    return (
      <div className="app-frame flex items-center justify-center">
        <div className="skeleton h-6 w-40" />
      </div>
    );
  }

  return (
    <>
      <AppHeader 
        title="Net Worth" 
        action={
          <button type="button" onClick={() => setSnapshotOpen(true)} className="btn btn-primary text-xs py-2 px-3">
            <Plus size={14} /> Snapshot
          </button>
        } 
      />
      <main className="px-4 pt-3 space-y-4">
        {/* Current Net Worth Card */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-muted">Current Net Worth</span>
            {momChange && (
              <div className={`flex items-center gap-1 text-xs ${momChange.change >= 0 ? 'text-positive' : 'text-negative'}`}>
                {momChange.change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {momChange.percent.toFixed(1)}% MoM
              </div>
            )}
          </div>
          <div className="text-3xl font-mono font-bold">{currentNetWorth ? formatBDT(currentNetWorth.net_worth) : '-'}</div>
          <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
            <div>
              <span className="text-text-muted">Assets</span>
              <div className="font-mono font-semibold text-positive">{currentNetWorth ? formatBDT(currentNetWorth.total_assets) : '-'}</div>
            </div>
            <div>
              <span className="text-text-muted">Liabilities</span>
              <div className="font-mono font-semibold text-negative">{currentNetWorth ? formatBDT(currentNetWorth.total_liabilities) : '-'}</div>
            </div>
          </div>
        </div>

        {/* Asset Allocation */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <PieChart size={18} style={{ color: 'var(--accent)' }} />
            <span className="font-semibold text-sm">Asset Allocation</span>
          </div>
          {currentNetWorth && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Accounts</span>
                <span className="font-mono">{formatBDT(currentNetWorth.breakdown.account_balance)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">DPS</span>
                <span className="font-mono">{formatBDT(currentNetWorth.breakdown.dps_value)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Fixed Deposits</span>
                <span className="font-mono">{formatBDT(currentNetWorth.breakdown.fixed_deposit_value)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Sanchayapatra</span>
                <span className="font-mono">{formatBDT(currentNetWorth.breakdown.sanchayapatra_value)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Investments</span>
                <span className="font-mono">{formatBDT(currentNetWorth.breakdown.investment_value)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Personal Lending</span>
                <span className="font-mono">{formatBDT(currentNetWorth.breakdown.lending_value)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Liability Breakdown */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={18} style={{ color: 'var(--negative)' }} />
            <span className="font-semibold text-sm">Liability Breakdown</span>
          </div>
          {currentNetWorth && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Credit Cards</span>
                <span className="font-mono">{formatBDT(currentNetWorth.breakdown.credit_card_debt)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Loans</span>
                <span className="font-mono">{formatBDT(currentNetWorth.breakdown.loan_balance)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Personal Borrowing</span>
                <span className="font-mono">{formatBDT(currentNetWorth.breakdown.personal_lending_balance)}</span>
              </div>
            </div>
          )}
        </div>

        {/* History */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={18} style={{ color: 'var(--accent)' }} />
            <span className="font-semibold text-sm">Snapshot History</span>
          </div>
          <div className="space-y-2">
            {snapshots.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="text-text-muted">{fmtDate(s.snapshot_date)}</span>
                <span className="font-mono font-semibold">{formatBDT(s.net_worth)}</span>
              </div>
            ))}
            {snapshots.length === 0 && (
              <div className="text-center py-4 text-text-muted text-xs">
                No snapshots yet. Create your first snapshot to track net worth over time.
              </div>
            )}
          </div>
        </div>
      </main>

      <BottomSheet open={snapshotOpen} onClose={() => setSnapshotOpen(false)} title="Create Net Worth Snapshot">
        <label className="block text-xs text-text-muted mb-1">Snapshot Date</label>
        <input
          className="input mb-4"
          type="date"
          value={snapshotDate}
          onChange={(e) => setSnapshotDate(e.target.value)}
        />

        <ActionButton variant="primary" className="w-full" loading={snapshotLoading} onClick={createSnapshot}>
          Create Snapshot
        </ActionButton>
      </BottomSheet>
    </>
  );
}
