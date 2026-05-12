import { useState, useEffect } from 'react';
import { DollarSign, RefreshCw, Plus, Trash2, TrendingUp } from 'lucide-react';

import AppHeader from '../components/AppHeader.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { apiPaths } from '../api/client';

export default function CurrencyManagement() {
  const toast = useToast();
  const [currencies, setCurrencies] = useState([]);
  const [exchangeRates, setExchangeRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddCurrency, setShowAddCurrency] = useState(false);
  const [showAddRate, setShowAddRate] = useState(false);
  const [newCurrency, setNewCurrency] = useState({ code: '', name: '', symbol: '', is_default: false });
  const [newRate, setNewRate] = useState({ from_currency: '', to_currency: '', rate: '' });

  const loadCurrencies = async () => {
    setLoading(true);
    try {
      const [currenciesRes, ratesRes] = await Promise.all([
        api.get(`${apiPaths.currencies}`),
        api.get(`${apiPaths.currencies}/exchange-rates`),
      ]);
      setCurrencies(currenciesRes.data);
      setExchangeRates(ratesRes.data);
    } catch (err) {
      console.error('Failed to load currencies:', err);
      toast.push('Failed to load currency data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurrencies();
  }, []);

  const handleAddCurrency = async (e) => {
    e.preventDefault();
    try {
      await api.post(`${apiPaths.currencies}`, newCurrency);
      toast.push('Currency added successfully', 'success');
      setShowAddCurrency(false);
      setNewCurrency({ code: '', name: '', symbol: '', is_default: false });
      loadCurrencies();
    } catch (err) {
      console.error('Failed to add currency:', err);
      toast.push('Failed to add currency', 'error');
    }
  };

  const handleAddRate = async (e) => {
    e.preventDefault();
    try {
      await api.post(`${apiPaths.currencies}/exchange-rates`, newRate);
      toast.push('Exchange rate added successfully', 'success');
      setShowAddRate(false);
      setNewRate({ from_currency: '', to_currency: '', rate: '' });
      loadCurrencies();
    } catch (err) {
      console.error('Failed to add exchange rate:', err);
      toast.push('Failed to add exchange rate', 'error');
    }
  };

  const handleDeleteRate = async (id) => {
    if (!confirm('Are you sure you want to delete this exchange rate?')) return;
    
    try {
      await api.delete(`${apiPaths.currencies}/exchange-rates/${id}`);
      toast.push('Exchange rate deleted successfully', 'success');
      loadCurrencies();
    } catch (err) {
      console.error('Failed to delete exchange rate:', err);
      toast.push('Failed to delete exchange rate', 'error');
    }
  };

  if (loading) {
    return (
      <>
        <AppHeader title="Currency Management" />
        <main className="px-4 pt-3 space-y-4">
          <div className="card p-6 text-center text-sm text-text-muted">Loading currencies...</div>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader title="Currency Management" />
      <main className="px-4 pt-3 space-y-4">
        <div className="card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <DollarSign size={16} />
              Supported Currencies
            </div>
            <button
              onClick={() => setShowAddCurrency(true)}
              className="flex items-center gap-1 text-xs font-semibold text-[var(--primary)]"
            >
              <Plus size={14} />
              Add Currency
            </button>
          </div>
          
          <div className="space-y-2">
            {currencies.map((currency) => (
              <div key={currency.id} className="flex items-center justify-between p-2 rounded-lg bg-[var(--input-bg)]">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">{currency.symbol}</span>
                  <span className="text-sm">{currency.name}</span>
                  <span className="text-xs text-text-muted font-mono">{currency.code}</span>
                  {currency.is_default && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">Default</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp size={16} />
              Exchange Rates
            </div>
            <button
              onClick={() => setShowAddRate(true)}
              className="flex items-center gap-1 text-xs font-semibold text-[var(--primary)]"
            >
              <Plus size={14} />
              Add Rate
            </button>
          </div>
          
          <div className="space-y-2">
            {exchangeRates.map((rate) => (
              <div key={rate.id} className="flex items-center justify-between p-2 rounded-lg bg-[var(--input-bg)]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono">{rate.from_currency}</span>
                  <span className="text-xs text-text-muted">→</span>
                  <span className="text-xs font-mono">{rate.to_currency}</span>
                  <span className="text-sm font-semibold">{rate.rate}</span>
                </div>
                <button
                  onClick={() => handleDeleteRate(rate.id)}
                  className="p-1 rounded hover:bg-red-500/10 text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {exchangeRates.length === 0 && (
              <div className="text-xs text-text-muted text-center py-2">No exchange rates configured</div>
            )}
          </div>
        </div>

        {showAddCurrency && (
          <div className="card p-4 space-y-4">
            <h3 className="text-sm font-semibold">Add New Currency</h3>
            <form onSubmit={handleAddCurrency} className="space-y-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Currency Code</label>
                <input
                  type="text"
                  value={newCurrency.code}
                  onChange={(e) => setNewCurrency({ ...newCurrency, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  placeholder="e.g., USD"
                  maxLength={3}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Currency Name</label>
                <input
                  type="text"
                  value={newCurrency.name}
                  onChange={(e) => setNewCurrency({ ...newCurrency, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  placeholder="e.g., US Dollar"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Symbol</label>
                <input
                  type="text"
                  value={newCurrency.symbol}
                  onChange={(e) => setNewCurrency({ ...newCurrency, symbol: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  placeholder="e.g., $"
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={newCurrency.is_default}
                  onChange={(e) => setNewCurrency({ ...newCurrency, is_default: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="isDefault" className="text-xs text-text-muted">Set as default currency</label>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Add Currency
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCurrency(false);
                    setNewCurrency({ code: '', name: '', symbol: '', is_default: false });
                  }}
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border)] text-sm font-semibold hover:bg-[var(--card-hover)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {showAddRate && (
          <div className="card p-4 space-y-4">
            <h3 className="text-sm font-semibold">Add Exchange Rate</h3>
            <form onSubmit={handleAddRate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">From Currency</label>
                  <select
                    value={newRate.from_currency}
                    onChange={(e) => setNewRate({ ...newRate, from_currency: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    required
                  >
                    <option value="">Select</option>
                    {currencies.map((c) => (
                      <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">To Currency</label>
                  <select
                    value={newRate.to_currency}
                    onChange={(e) => setNewRate({ ...newRate, to_currency: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    required
                  >
                    <option value="">Select</option>
                    {currencies.map((c) => (
                      <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Exchange Rate</label>
                <input
                  type="number"
                  step="0.000001"
                  value={newRate.rate}
                  onChange={(e) => setNewRate({ ...newRate, rate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  placeholder="e.g., 0.0091"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Add Rate
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddRate(false);
                    setNewRate({ from_currency: '', to_currency: '', rate: '' });
                  }}
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border)] text-sm font-semibold hover:bg-[var(--card-hover)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </>
  );
}
