import AppHeader from '../components/AppHeader.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import { useFinance } from '../context/FinanceContext.jsx';
import { formatBDT } from '../utils/formatBDT';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
}

function maskedNumber(id) {
  // Stable fake number for visual purposes only.
  const seed = String(1000 + (id * 7919) % 8999);
  return `•••• •••• •••• ${seed}`;
}

export default function CreditCards() {
  const { creditCards } = useFinance();

  return (
    <>
      <AppHeader title="Credit Cards" />
      <main className="px-4 pt-3 space-y-4">
        {creditCards.length === 0 ? (
          <div className="card p-6 text-center text-sm text-text-muted">No credit cards on file.</div>
        ) : null}
        {creditCards.map((c) => {
          const days = daysUntil(c.due_date);
          const overdueSoon = days !== null && days <= 7;
          const pct = c.limit_amt > 0 ? (Number(c.due_amount) / Number(c.limit_amt)) * 100 : 0;
          return (
            <div key={c.id} className="space-y-2">
              <div
                className="rounded-card p-4 text-white relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #2A3B7A 0%, #6C8EF5 100%)',
                  minHeight: 170,
                  border: '1px solid var(--border)',
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.2em] opacity-80">{c.name}</div>
                  <div className="text-[10px] uppercase tracking-widest opacity-80">Visa</div>
                </div>
                <div className="mt-8 font-mono text-lg tracking-widest">{maskedNumber(c.id)}</div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="text-[10px] uppercase opacity-70">Due amount</div>
                    <div className="font-mono text-base">{formatBDT(c.due_amount)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase opacity-70">Due date</div>
                    <div
                      className="font-mono text-sm"
                      style={{ color: overdueSoon ? 'var(--warning)' : '#fff' }}
                    >
                      {c.due_date || '—'} {days !== null ? `(${days}d)` : ''}
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-1">
                <div className="flex justify-between text-[11px] text-text-muted mb-1">
                  <span>Utilisation</span>
                  <span className="font-mono">
                    {formatBDT(c.due_amount)} / {formatBDT(c.limit_amt)}
                  </span>
                </div>
                <ProgressBar
                  value={Number(c.due_amount)}
                  max={Number(c.limit_amt)}
                  color={pct > 80 ? 'var(--negative)' : pct > 50 ? 'var(--warning)' : 'var(--accent)'}
                />
              </div>
            </div>
          );
        })}
      </main>
    </>
  );
}
