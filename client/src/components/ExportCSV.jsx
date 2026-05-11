import Papa from 'papaparse';
import { Download } from 'lucide-react';

export default function ExportCSV({ transactions, label = 'Export CSV' }) {
  const handle = () => {
    if (!transactions || transactions.length === 0) return;
    const rows = transactions.map((t) => ({
      date: t.created_at,
      account: t.account_name || '',
      type: t.type,
      amount: Number(t.amount).toFixed(2),
      category: t.category,
      description: t.description || '',
      ref_type: t.ref_type || '',
      ref_id: t.ref_id || '',
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `finslate-export-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button type="button" onClick={handle} className="btn btn-ghost text-xs">
      <Download size={14} />
      {label}
    </button>
  );
}
