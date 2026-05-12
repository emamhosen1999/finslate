import { useState, useEffect } from 'react';
import { FileText, Plus, Download, Trash2, Calendar, Filter } from 'lucide-react';

import AppHeader from '../components/AppHeader.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { apiPaths } from '../api/client';
import { formatBDT } from '../utils/formatBDT';

export default function Reports() {
  const toast = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewReport, setShowNewReport] = useState(false);
  const [newReport, setNewReport] = useState({
    name: '',
    type: 'expense_summary',
    parameters: {}
  });

  const loadReports = async () => {
    setLoading(true);
    try {
      const res = await api.get(`${apiPaths.reports}`);
      setReports(res.data);
    } catch (err) {
      console.error('Failed to load reports:', err);
      toast.push('Failed to load reports', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleCreateReport = async (e) => {
    e.preventDefault();
    try {
      await api.post(`${apiPaths.reports}`, newReport);
      toast.push('Report saved successfully', 'success');
      setShowNewReport(false);
      setNewReport({ name: '', type: 'expense_summary', parameters: {} });
      loadReports();
    } catch (err) {
      console.error('Failed to create report:', err);
      toast.push('Failed to save report', 'error');
    }
  };

  const handleDeleteReport = async (id) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    
    try {
      await api.delete(`${apiPaths.reports}/${id}`);
      toast.push('Report deleted successfully', 'success');
      loadReports();
    } catch (err) {
      console.error('Failed to delete report:', err);
      toast.push('Failed to delete report', 'error');
    }
  };

  const reportTypes = [
    { value: 'expense_summary', label: 'Expense Summary' },
    { value: 'income_summary', label: 'Income Summary' },
    { value: 'cash_flow', label: 'Cash Flow' },
    { value: 'category_breakdown', label: 'Category Breakdown' },
    { value: 'monthly_comparison', label: 'Monthly Comparison' },
    { value: 'net_worth', label: 'Net Worth' },
    { value: 'debt_summary', label: 'Debt Summary' },
    { value: 'savings_analysis', label: 'Savings Analysis' },
  ];

  if (loading) {
    return (
      <>
        <AppHeader title="Reports" />
        <main className="px-4 pt-3 space-y-4">
          <div className="card p-6 text-center text-sm text-text-muted">Loading reports...</div>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader title="Reports" />
      <main className="px-4 pt-3 space-y-4">
        <button
          onClick={() => setShowNewReport(true)}
          className="w-full card p-4 flex items-center justify-center gap-2 text-sm font-semibold hover:bg-[var(--card-hover)] transition-colors"
        >
          <Plus size={16} />
          Create New Report
        </button>

        {showNewReport && (
          <div className="card p-4 space-y-4">
            <h3 className="text-sm font-semibold">Create New Report</h3>
            <form onSubmit={handleCreateReport} className="space-y-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Report Name</label>
                <input
                  type="text"
                  value={newReport.name}
                  onChange={(e) => setNewReport({ ...newReport, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  placeholder="e.g., Monthly Expense Report"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Report Type</label>
                <select
                  value={newReport.type}
                  onChange={(e) => setNewReport({ ...newReport, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  required
                >
                  {reportTypes.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Save Report
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewReport(false);
                    setNewReport({ name: '', type: 'expense_summary', parameters: {} });
                  }}
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border)] text-sm font-semibold hover:bg-[var(--card-hover)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Saved Reports</h3>
          {reports.length === 0 ? (
            <div className="card p-6 text-center text-sm text-text-muted">
              No saved reports yet. Create your first report to get started.
            </div>
          ) : (
            reports.map((report) => (
              <div key={report.id} className="card p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-[var(--primary)]" />
                      <span className="font-semibold text-sm">{report.name}</span>
                    </div>
                    <div className="text-xs text-text-muted mt-1">
                      {reportTypes.find(t => t.value === report.type)?.label || report.type}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toast.push('Report generation coming soon', 'info')}
                      className="p-2 rounded-lg hover:bg-[var(--card-hover)] transition-colors"
                      title="Generate Report"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteReport(report.id)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
                      title="Delete Report"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-text-muted">
                  Created: {new Date(report.created_at).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </>
  );
}
