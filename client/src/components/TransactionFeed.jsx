import { formatBDT } from '../utils/formatBDT';
import CategoryIcon from './CategoryIcon.jsx';
import { Pencil, Trash2 } from 'lucide-react';

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function TransactionFeed({ transactions, emptyMessage = 'No transactions yet.', onEdit, onDelete }) {
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
        const positive = t.type === 'income' || t.type === 'transfer_credit';
        return (
          <li key={t.id} className="flex items-center gap-3 p-3" style={{ borderColor: 'var(--border)' }}>
            <CategoryIcon category={t.category_id} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{t.payee || t.notes || t.category_id || '—'}</div>
              <div className="text-[11px] text-text-muted truncate">
                {t.account_name || '—'} · {fmtDate(t.transaction_date)}
              </div>
            </div>
            <div
              className="font-mono text-sm"
              style={{ color: positive ? 'var(--positive)' : 'var(--negative)' }}
            >
              {positive ? '+' : '-'}{formatBDT(t.amount, { withSymbol: true })}
            </div>
            {(onEdit || onDelete) && (
              <div className="flex items-center gap-1 ml-2">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(t)}
                    className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ color: 'var(--accent)' }}
                  >
                    <Pencil size={14} />
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(t)}
                    className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ color: 'var(--negative)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
