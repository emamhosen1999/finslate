import AppHeader from '../components/AppHeader.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import { useFinance } from '../context/FinanceContext.jsx';
import { formatBDT } from '../utils/formatBDT';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function DPS() {
  const { dps } = useFinance();

  return (
    <>
      <AppHeader title="DPS" />
      <main className="px-4 pt-3 space-y-4">
        {dps.length === 0 ? (
          <div className="card p-6 text-center text-sm text-text-muted">No DPS accounts yet.</div>
        ) : null}
        {dps.map((d) => {
          const deposited = Number(d.total_deposited) || 0;
          const maturity = Number(d.maturity_amount) || 0;
          const monthly = Number(d.monthly_amount) || 0;
          const days = daysUntil(d.maturity_date);
          return (
            <div key={d.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{d.name}</div>
                <div className="text-xs text-text-muted">
                  {monthly ? `${formatBDT(monthly)} / month` : ''}
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
                  <div className="text-text-muted">Maturity</div>
                  <div className="font-mono">{formatBDT(maturity)}</div>
                </div>
              </div>
              <div className="mt-3">
                <ProgressBar value={deposited} max={maturity} color="var(--warning)" />
                <div className="text-[11px] text-text-muted mt-1 flex justify-between">
                  <span>
                    {maturity > 0 ? `${((deposited / maturity) * 100).toFixed(1)}%` : '—'} of maturity
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
    </>
  );
}
