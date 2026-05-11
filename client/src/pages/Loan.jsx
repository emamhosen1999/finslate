import AppHeader from '../components/AppHeader.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import { useFinance } from '../context/FinanceContext.jsx';
import { formatBDT } from '../utils/formatBDT';

export default function Loan() {
  const { loans } = useFinance();

  return (
    <>
      <AppHeader title="Loans" />
      <main className="px-4 pt-3 space-y-4">
        {loans.length === 0 ? (
          <div className="card p-6 text-center text-sm text-text-muted">No active loans.</div>
        ) : null}
        {loans.map((l) => {
          const principal = Number(l.principal) || 0;
          const remaining = Number(l.remaining) || 0;
          const repaid = Math.max(0, principal - remaining);
          const pct = principal > 0 ? (repaid / principal) * 100 : 0;
          const emi = Number(l.monthly_emi) || 0;
          const monthsToPayoff = emi > 0 ? Math.ceil(remaining / emi) : null;
          return (
            <div key={l.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{l.name}</div>
                <div className="text-xs text-text-muted">
                  {l.interest_rate ? `${Number(l.interest_rate).toFixed(2)}% p.a.` : ''}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-text-muted">Original</div>
                  <div className="font-mono">{formatBDT(principal)}</div>
                </div>
                <div className="text-right">
                  <div className="text-text-muted">Remaining</div>
                  <div className="font-mono" style={{ color: 'var(--negative)' }}>
                    {formatBDT(remaining)}
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <ProgressBar value={repaid} max={principal} color="var(--positive)" />
                <div className="text-[11px] text-text-muted mt-1 flex justify-between">
                  <span>{pct.toFixed(1)}% repaid</span>
                  <span>{formatBDT(repaid)} paid</span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-text-muted">Monthly EMI</div>
                  <div className="font-mono">{formatBDT(emi)}</div>
                </div>
                <div className="text-right">
                  <div className="text-text-muted">Months to payoff</div>
                  <div className="font-mono">{monthsToPayoff !== null ? monthsToPayoff : '—'}</div>
                </div>
              </div>
            </div>
          );
        })}
      </main>
    </>
  );
}
