import { useState, useEffect } from 'react';
import { BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, DollarSign, PieChart as PieIcon, Activity } from 'lucide-react';

import AppHeader from '../components/AppHeader.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { apiPaths } from '../api/client';
import { formatBDT } from '../utils/formatBDT';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function Analytics() {
  const toast = useToast();
  const [overview, setOverview] = useState(null);
  const [categorySpending, setCategorySpending] = useState([]);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const [overviewRes, categoryRes, trendRes] = await Promise.all([
        api.get(`${apiPaths.analytics}/overview`),
        api.get(`${apiPaths.analytics}/category-spending`),
        api.get(`${apiPaths.analytics}/monthly-trend`),
      ]);
      setOverview(overviewRes.data);
      setCategorySpending(categoryRes.data);
      setMonthlyTrend(trendRes.data.reverse());
    } catch (err) {
      console.error('Failed to load analytics:', err);
      toast.push('Failed to load analytics data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const netWorth = overview ? (
    overview.totalAccounts +
    overview.totalInvestments +
    overview.totalFD +
    overview.totalRD +
    overview.totalCashback
  ) : 0;

  if (loading) {
    return (
      <>
        <AppHeader title="Analytics" />
        <main className="px-4 pt-3 space-y-4">
          <div className="card p-6 text-center text-sm text-text-muted">Loading analytics...</div>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader title="Analytics" />
      <main className="px-4 pt-3 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
              <Wallet size={12} />
              Net Worth
            </div>
            <div className="text-lg font-mono" style={{ color: 'var(--positive)' }}>{formatBDT(netWorth)}</div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
              <Activity size={12} />
              Balance
            </div>
            <div className="text-lg font-mono">{formatBDT(overview.totalAccounts)}</div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
              <TrendingUp size={12} />
              Income
            </div>
            <div className="text-lg font-mono" style={{ color: 'var(--positive)' }}>{formatBDT(overview.totalIncome)}</div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
              <TrendingDown size={12} />
              Expense
            </div>
            <div className="text-lg font-mono" style={{ color: 'var(--negative)' }}>{formatBDT(overview.totalExpense)}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4">
            <div className="text-xs text-text-muted mb-1">Investments</div>
            <div className="text-sm font-mono">{formatBDT(overview.totalInvestments)}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-text-muted mb-1">Fixed Deposits</div>
            <div className="text-sm font-mono">{formatBDT(overview.totalFD)}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-text-muted mb-1">Recurring Deposits</div>
            <div className="text-sm font-mono">{formatBDT(overview.totalRD)}</div>
          </div>
        </div>

        {categorySpending.length > 0 && (
          <div className="card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold mb-4">
              <PieIcon size={16} />
              Category Spending
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={categorySpending}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.category}: ${formatBDT(entry.total)}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="total"
                >
                  {categorySpending.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatBDT(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {monthlyTrend.length > 0 && (
          <div className="card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold mb-4">
              <Activity size={16} />
              Monthly Trend
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => `৳${(value / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => formatBDT(value)} />
                <Legend />
                <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} name="Income" />
                <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} name="Expense" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {categorySpending.length > 0 && (
          <div className="card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold mb-4">
              <BarChart size={16} />
              Spending by Category
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categorySpending}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => `৳${(value / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => formatBDT(value)} />
                <Bar dataKey="total" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {categorySpending.length === 0 && monthlyTrend.length === 0 && (
          <div className="card p-6 text-center text-sm text-text-muted">
            Not enough data to show analytics. Add transactions to see insights.
          </div>
        )}
      </main>
    </>
  );
}
