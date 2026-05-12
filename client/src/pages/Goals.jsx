import { useState, useEffect } from 'react';
import { Target, Plus, Pencil, Trash2, TrendingUp, Circle } from 'lucide-react';

import AppHeader from '../components/AppHeader.jsx';
import ActionButton from '../components/ActionButton.jsx';
import BottomSheet from '../components/BottomSheet.jsx';
import { useFinance } from '../context/FinanceContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { apiPaths } from '../api/client';
import { formatBDT } from '../utils/formatBDT';

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Goals() {
  const toast = useToast();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [contributionOpen, setContributionOpen] = useState(false);
  const [contributionLoading, setContributionLoading] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'emergency',
    target_amount: '',
    target_date: '',
    description: '',
  });
  const [contributionData, setContributionData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    note: '',
  });

  const loadGoals = async () => {
    setLoading(true);
    try {
      const res = await api.get(apiPaths.goals);
      setGoals(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGoals();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setFormData({
      name: '',
      category: 'emergency',
      target_amount: '',
      target_date: '',
      description: '',
    });
    setAddOpen(true);
  };

  const openEdit = (goal) => {
    setEditingId(goal.id);
    setFormData({
      name: goal.name,
      category: goal.category,
      target_amount: goal.target_amount,
      target_date: goal.target_date,
      description: goal.description,
    });
    setAddOpen(true);
  };

  const openContribution = (goal) => {
    setSelectedGoal(goal);
    setContributionData({
      amount: '',
      date: new Date().toISOString().split('T')[0],
      note: '',
    });
    setContributionOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.target_amount || !formData.target_date) {
      toast.push('Name, target amount, and target date are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      if (editingId) {
        await api.put(`${apiPaths.goals}/${editingId}`, formData);
        toast.push('Goal updated', 'success');
      } else {
        await api.post(apiPaths.goals, formData);
        toast.push('Goal added', 'success');
      }
      await loadGoals();
      setAddOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`${apiPaths.goals}/${id}`);
      toast.push('Goal deleted', 'success');
      await loadGoals();
      setDeleteConfirm(null);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to delete', 'error');
    }
  };

  const handleContribution = async () => {
    if (!contributionData.amount || !contributionData.date) {
      toast.push('Amount and date are required', 'error');
      return;
    }
    setContributionLoading(true);
    try {
      const res = await api.post(`${apiPaths.goals}/${selectedGoal.id}/contribution`, contributionData);
      toast.push('Contribution added', 'success');
      await loadGoals();
      setContributionOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to add contribution', 'error');
    } finally {
      setContributionLoading(false);
    }
  };

  const calculateProgress = (goal) => {
    const progress = (goal.current_amount / goal.target_amount) * 100;
    return Math.min(progress, 100);
  };

  if (loading) {
    return (
      <div className="app-frame flex items-center justify-center">
        <div className="skeleton h-6 w-40" />
      </div>
    );
  }

  return (
    <>
      <AppHeader 
        title="Goals" 
        action={
          <button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3">
            <Plus size={14} /> Add
          </button>
        } 
      />
      <main className="px-4 pt-3 space-y-3">
        {goals.map((g) => {
          const progress = calculateProgress(g);
          const remaining = parseFloat(g.target_amount) - parseFloat(g.current_amount);
          return (
            <div key={g.id} className="card p-4">
              <div className="flex items-start gap-3">
                <div
                  className="rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 40, height: 40,
                    background: g.status === 'achieved' ? 'var(--positive-soft)' : 'var(--accent-soft)',
                    color: g.status === 'achieved' ? 'var(--positive)' : 'var(--accent)',
                  }}
                >
                  {g.status === 'achieved' ? <Circle size={20} fill="currentColor" /> : <Target size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="font-semibold truncate">{g.name}</div>
                    <div className="flex items-center gap-1">
                      {g.status !== 'achieved' && (
                        <button
                          type="button"
                          onClick={() => openContribution(g)}
                          className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                          style={{ color: 'var(--accent)' }}
                        >
                          <TrendingUp size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEdit(g)}
                        className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                        style={{ color: 'var(--accent)' }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(g.id)}
                        className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                        style={{ color: 'var(--negative)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="text-[11px] text-text-muted mb-2">
                    {g.category} · Target: {fmtDate(g.target_date)}
                  </div>
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-text-muted">Progress</span>
                      <span className="font-semibold">{progress.toFixed(0)}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[var(--bg-elevated)]">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${progress}%`,
                          background: g.status === 'achieved' ? 'var(--positive)' : 'var(--accent)',
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-text-muted">Current</div>
                      <div className="font-mono">{formatBDT(g.current_amount)}</div>
                    </div>
                    <div>
                      <div className="text-text-muted">Target</div>
                      <div className="font-mono">{formatBDT(g.target_amount)}</div>
                    </div>
                  </div>
                  {remaining > 0 && (
                    <div className="mt-2 text-[10px] text-text-muted">
                      {formatBDT(remaining)} remaining
                    </div>
                  )}
                  <div className="mt-2">
                    <span
                      className="text-[10px] uppercase rounded-full px-2 py-[2px]"
                      style={{
                        background: g.status === 'achieved' ? 'var(--positive-soft)' : 'var(--accent-soft)',
                        color: g.status === 'achieved' ? 'var(--positive)' : 'var(--accent)',
                      }}
                    >
                      {g.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {goals.length === 0 && (
          <div className="text-center py-8 text-text-muted">
            <Target size={48} className="mx-auto mb-3 opacity-30" />
            <p>No goals added yet</p>
          </div>
        )}
      </main>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={editingId ? 'Edit Goal' : 'Add Goal'}>
        <label className="block text-xs text-text-muted mb-1">Name</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Emergency Fund"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-1">Category</label>
        <select className="input mb-3" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
          <option value="emergency">Emergency</option>
          <option value="travel">Travel</option>
          <option value="education">Education</option>
          <option value="property">Property</option>
          <option value="vehicle">Vehicle</option>
          <option value="other">Other</option>
        </select>

        <label className="block text-xs text-text-muted mb-1">Target Amount (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 100000"
          value={formData.target_amount}
          onChange={(e) => setFormData({ ...formData, target_amount: e.target.value.replace(/[^\d]/g, '') })}
        />

        <label className="block text-xs text-text-muted mb-1">Target Date</label>
        <input
          className="input mb-3"
          type="date"
          value={formData.target_date}
          onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-1">Notes (optional)</label>
        <textarea
          className="input mb-4"
          rows={2}
          placeholder="Any additional notes..."
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />

        <ActionButton variant="primary" className="w-full" loading={addLoading} onClick={handleSubmit}>
          {editingId ? 'Update' : 'Add'}
        </ActionButton>
      </BottomSheet>

      <BottomSheet open={contributionOpen} onClose={() => setContributionOpen(false)} title="Add Contribution">
        <div className="mb-4 p-3 rounded-lg" style={{ background: 'var(--bg-elevated)' }}>
          <div className="text-xs text-text-muted">Goal</div>
          <div className="font-semibold">{selectedGoal?.name}</div>
          <div className="text-xs text-text-muted mt-2">Current Progress</div>
          <div className="text-lg font-mono font-semibold">{selectedGoal ? formatBDT(selectedGoal.current_amount) : '-'}</div>
        </div>

        <label className="block text-xs text-text-muted mb-1">Amount (BDT)</label>
        <input
          className="input mb-3"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 5000"
          value={contributionData.amount}
          onChange={(e) => setContributionData({ ...contributionData, amount: e.target.value.replace(/[^\d]/g, '') })}
        />

        <label className="block text-xs text-text-muted mb-1">Date</label>
        <input
          className="input mb-3"
          type="date"
          value={contributionData.date}
          onChange={(e) => setContributionData({ ...contributionData, date: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-1">Notes (optional)</label>
        <textarea
          className="input mb-4"
          rows={2}
          placeholder="Any notes..."
          value={contributionData.note}
          onChange={(e) => setContributionData({ ...contributionData, note: e.target.value })}
        />

        <ActionButton variant="primary" className="w-full" loading={contributionLoading} onClick={handleContribution}>
          Add Contribution
        </ActionButton>
      </BottomSheet>

      <BottomSheet open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete Goal">
        <p className="text-sm text-text-muted mb-4">Are you sure you want to delete this goal?</p>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</ActionButton>
        </div>
      </BottomSheet>
    </>
  );
}
