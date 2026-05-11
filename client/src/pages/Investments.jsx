import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Calendar } from 'lucide-react';

import AppHeader from '../components/AppHeader.jsx';
import ActionButton from '../components/ActionButton.jsx';
import BottomSheet from '../components/BottomSheet.jsx';
import { useFinance } from '../context/FinanceContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { apiPaths } from '../api/client';
import { formatBDT } from '../utils/formatBDT';

export default function Investments() {
  const toast = useToast();
  const [investments, setInvestments] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('Stock');
  const [newSymbol, setNewSymbol] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newBuyPrice, setNewBuyPrice] = useState('');
  const [newCurrentPrice, setNewCurrentPrice] = useState('');
  const [newBuyDate, setNewBuyDate] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const loadInvestments = async () => {
    try {
      const res = await api.get(apiPaths.investments);
      setInvestments(res.data);
    } catch (err) {
      console.error('Failed to load investments:', err);
    }
  };

  useEffect(() => {
    loadInvestments();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setNewName('');
    setNewType('Stock');
    setNewSymbol('');
    setNewQuantity('');
    setNewBuyPrice('');
    setNewCurrentPrice('');
    setNewBuyDate('');
    setAddOpen(true);
  };

  const openEdit = (inv) => {
    setEditingId(inv.id);
    setNewName(inv.name);
    setNewType(inv.type);
    setNewSymbol(inv.symbol || '');
    setNewQuantity(String(inv.quantity));
    setNewBuyPrice(String(inv.buy_price));
    setNewCurrentPrice(inv.current_price ? String(inv.current_price) : '');
    setNewBuyDate(inv.buy_date || '');
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!newName || !newType || !newQuantity || !newBuyPrice) {
      toast.push('Name, type, quantity, and buy price are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      if (editingId) {
        await api.put(`${apiPaths.investments}/${editingId}`, {
          name: newName.trim(),
          type: newType.trim(),
          symbol: newSymbol.trim() || null,
          quantity: Number(newQuantity),
          buy_price: Number(newBuyPrice),
          current_price: newCurrentPrice ? Number(newCurrentPrice) : null,
          buy_date: newBuyDate || null,
        });
        toast.push('Investment updated', 'success');
      } else {
        await api.post(apiPaths.investments, {
          name: newName.trim(),
          type: newType.trim(),
          symbol: newSymbol.trim() || null,
          quantity: Number(newQuantity),
          buy_price: Number(newBuyPrice),
          current_price: newCurrentPrice ? Number(newCurrentPrice) : null,
          buy_date: newBuyDate || null,
        });
        toast.push('Investment added', 'success');
      }
      await loadInvestments();
      setAddOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to save investment', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (invId) => {
    try {
      await api.delete(`${apiPaths.investments}/${invId}`);
      toast.push('Investment deleted', 'success');
      await loadInvestments();
      setDeleteConfirm(null);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to delete investment', 'error');
    }
  };

  return (
    <>
      <AppHeader title="Investments" action={<button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3"><Plus size={14} /> Add</button>} />
      <main className="px-4 pt-3 space-y-4">
        {investments.length === 0 ? (
          <div className="card p-6 text-center text-sm text-text-muted">No investments yet.</div>
        ) : null}
        {investments.map((inv) => {
          const quantity = Number(inv.quantity);
          const buyPrice = Number(inv.buy_price);
          const currentPrice = inv.current_price ? Number(inv.current_price) : buyPrice;
          const totalValue = quantity * currentPrice;
          const totalCost = quantity * buyPrice;
          const profit = totalValue - totalCost;
          const profitPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;
          const isProfit = profit >= 0;
          return (
            <div key={inv.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">{inv.name}</div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(inv)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ color: 'var(--accent)' }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(inv.id)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ color: 'var(--negative)' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
                <span className="px-2 py-1 rounded" style={{ backgroundColor: 'var(--accent-alpha)', color: 'var(--accent)' }}>
                  {inv.type}
                </span>
                {inv.symbol && (
                  <>
                    <span>·</span>
                    <span className="font-mono">{inv.symbol}</span>
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                <div>
                  <div className="text-text-muted">Quantity</div>
                  <div className="font-mono">{quantity}</div>
                </div>
                <div className="text-right">
                  <div className="text-text-muted">Buy Price</div>
                  <div className="font-mono">{formatBDT(buyPrice)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                <div>
                  <div className="text-text-muted">Current Price</div>
                  <div className="font-mono">{formatBDT(currentPrice)}</div>
                </div>
                <div className="text-right">
                  <div className="text-text-muted">Total Value</div>
                  <div className="font-mono">{formatBDT(totalValue)}</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs mb-3 p-2 rounded" style={{ backgroundColor: isProfit ? 'var(--positive-alpha)' : 'var(--negative-alpha)' }}>
                <div className="flex items-center gap-1">
                  {isProfit ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  <span>P/L</span>
                </div>
                <div className="font-mono" style={{ color: isProfit ? 'var(--positive)' : 'var(--negative)' }}>
                  {formatBDT(profit)} ({profitPct.toFixed(2)}%)
                </div>
              </div>
              {inv.buy_date && (
                <div className="text-xs text-text-muted">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    Bought: {inv.buy_date}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </main>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={editingId ? 'Edit Investment' : 'Add Investment'}>
        <label className="block text-xs text-text-muted mb-1">Name</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Apple Stock"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Type</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Stock, Mutual Fund, ETF"
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
        />

        <label className="block text-xs text-text-muted mb-1">Symbol (optional)</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. AAPL"
          value={newSymbol}
          onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
        />

        <label className="block text-xs text-text-muted mb-1">Quantity</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="decimal"
          placeholder="e.g. 10.5"
          value={newQuantity}
          onChange={(e) => setNewQuantity(e.target.value.replace(/[^\d.]/g, ''))}
        />

        <label className="block text-xs text-text-muted mb-1">Buy price (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="decimal"
          placeholder="e.g. 150.50"
          value={newBuyPrice}
          onChange={(e) => setNewBuyPrice(e.target.value.replace(/[^\d.]/g, ''))}
        />

        <label className="block text-xs text-text-muted mb-1">Current price (BDT, optional)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="decimal"
          placeholder="e.g. 180.00"
          value={newCurrentPrice}
          onChange={(e) => setNewCurrentPrice(e.target.value.replace(/[^\d.]/g, ''))}
        />

        <label className="block text-xs text-text-muted mb-1">Buy date (optional)</label>
        <input
          className="input mb-4"
          type="date"
          value={newBuyDate}
          onChange={(e) => setNewBuyDate(e.target.value)}
        />

        <ActionButton variant="primary" className="w-full" loading={addLoading} onClick={handleAdd}>
          {editingId ? 'Update' : 'Add'}
        </ActionButton>
      </BottomSheet>

      <BottomSheet open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete Investment">
        <p className="text-sm text-text-muted mb-4">Are you sure you want to delete this investment?</p>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</ActionButton>
        </div>
      </BottomSheet>
    </>
  );
}
