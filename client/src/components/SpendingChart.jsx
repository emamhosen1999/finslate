import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

import { formatBDT } from '../utils/formatBDT';
import { CATEGORY_COLORS } from './CategoryIcon.jsx';

const TRACKED = ['Food', 'Transport', 'Shopping', 'Utilities', 'Health', 'Others'];

export default function SpendingChart({ transactions, onCategoryClick }) {
  const [active, setActive] = useState(null);

  const data = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const totals = Object.fromEntries(TRACKED.map((c) => [c, 0]));
    for (const t of transactions || []) {
      if (t.type !== 'expense') continue;
      const d = new Date((t.transaction_date || '').replace(' ', 'T'));
      if (d.getMonth() !== month || d.getFullYear() !== year) continue;
      const key = TRACKED.includes(t.category_id) ? t.category_id : 'Others';
      totals[key] += Number(t.amount) || 0;
    }
    return TRACKED.map((name) => ({
      name,
      value: totals[name],
      color: CATEGORY_COLORS[name] || '#7B82A3',
    })).filter((d) => d.value > 0);
  }, [transactions]);

  const total = data.reduce((s, d) => s + d.value, 0);

  if (data.length === 0) {
    return (
      <div className="card p-5 mt-4">
        <div className="text-sm font-semibold mb-2">Spending this month</div>
        <div className="text-xs text-text-muted">No expenses recorded yet for this month.</div>
      </div>
    );
  }

  return (
    <div className="card p-5 mt-4">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-sm font-semibold">Spending this month</div>
        <div className="text-xs text-text-muted font-mono">{formatBDT(total)}</div>
      </div>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              onClick={(slice) => {
                const name = slice?.name;
                if (!name) return;
                setActive(active === name ? null : name);
                onCategoryClick?.(active === name ? null : name);
              }}
            >
              {data.map((d) => (
                <Cell
                  key={d.name}
                  fill={d.color}
                  opacity={!active || active === d.name ? 1 : 0.3}
                  stroke="var(--bg-surface)"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                fontSize: 12,
              }}
              formatter={(v, name) => [formatBDT(v), name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        {data.map((d) => (
          <button
            type="button"
            key={d.name}
            onClick={() => {
              setActive(active === d.name ? null : d.name);
              onCategoryClick?.(active === d.name ? null : d.name);
            }}
            className="flex items-center gap-2 text-xs px-2 py-1 rounded-md"
            style={{
              background: active === d.name ? 'var(--accent-soft)' : 'transparent',
              color: 'var(--text-primary)',
            }}
          >
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: d.color }} />
            <span className="flex-1 text-left">{d.name}</span>
            <span className="font-mono text-text-muted">{formatBDT(d.value)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
