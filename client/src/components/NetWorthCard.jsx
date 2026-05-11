import { formatBDT } from '../utils/formatBDT';

export default function NetWorthCard({ summary, loading }) {
  if (loading) {
    return (
      <div className="card shimmer p-5 mt-4">
        <div className="skeleton h-3 w-20 mb-3" />
        <div className="skeleton h-9 w-44 mb-3" />
        <div className="skeleton h-3 w-52" />
      </div>
    );
  }

  const net = summary.netWorth || 0;
  return (
    <div className="card p-5 mt-4">
      <div className="text-xs uppercase tracking-wider text-text-muted">Net Worth</div>
      <div
        className="font-mono mt-1"
        style={{
          fontSize: 34,
          fontWeight: 700,
          color: net >= 0 ? 'var(--accent)' : 'var(--negative)',
          letterSpacing: '-0.02em',
        }}
      >
        {formatBDT(net)}
      </div>
      <div className="mt-3 space-y-1 text-xs">
        <div className="flex justify-between">
          <span style={{ color: 'var(--positive)' }}>
            Liquid {formatBDT(summary.totalLiquid)} · DPS {formatBDT(summary.totalDPS)}
          </span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--negative)' }}>
            Loans {formatBDT(summary.totalLoans)} · Credit {formatBDT(summary.totalCreditDues)}
          </span>
        </div>
      </div>
    </div>
  );
}
