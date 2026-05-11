import { formatBDT } from '../utils/formatBDT';
import CategoryIcon from './CategoryIcon.jsx';

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function TransactionFeed({ transactions, emptyMessage = 'No transactions yet.' }) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="card p-6 text-center text-sm text-text-muted">
        {emptyMessage}
      </div>
    );
  }
  return (
    <ul className="card divide-y" style={{ borderColor: 'var(--border)' }}>
      {transactions.map((t) => {
        const positive = t.type === 'credit';
        return (
          <li key={t.id} className="flex items-center gap-3 p-3" style={{ borderColor: 'var(--border)' }}>
            <CategoryIcon category={t.category} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{t.description || t.category}</div>
              <div className="text-[11px] text-text-muted truncate">
                {t.account_name || '—'} · {fmtDate(t.created_at)}
              </div>
            </div>
            <div
              className="font-mono text-sm"
              style={{ color: positive ? 'var(--positive)' : 'var(--negative)' }}
            >
              {positive ? '+' : '-'}{formatBDT(t.amount, { withSymbol: true })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
