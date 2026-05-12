import { useState, useEffect } from 'react';
import { LayoutGrid, Plus, Pencil, Trash2, Check } from 'lucide-react';

import AppHeader from '../components/AppHeader.jsx';
import ActionButton from '../components/ActionButton.jsx';
import BottomSheet from '../components/BottomSheet.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { apiPaths } from '../api/client';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#64748b', '#14b8a6',
];

const TYPE_LABELS = { income: 'Income', expense: 'Expense', both: 'Both' };
const TYPE_COLORS = {
  income: { bg: 'var(--positive-soft)', text: 'var(--positive)' },
  expense: { bg: 'var(--negative-soft)', text: 'var(--negative)' },
  both: { bg: 'var(--accent-soft)', text: 'var(--accent)' },
};

export default function Categories() {
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [form, setForm] = useState({
    name: '',
    type: 'expense',
    parent_id: '',
    icon: '',
    color: PRESET_COLORS[0],
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(apiPaths.categories);
      setCategories(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: '', type: 'expense', parent_id: '', icon: '', color: PRESET_COLORS[0] });
    setSheetOpen(true);
  };

  const openEdit = (cat) => {
    setEditingId(cat.id);
    setForm({
      name: cat.name,
      type: cat.type,
      parent_id: cat.parent_id || '',
      icon: cat.icon || '',
      color: cat.color || PRESET_COLORS[0],
    });
    setSheetOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.push('Category name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        parent_id: form.parent_id || null,
        icon: form.icon || null,
        color: form.color || null,
      };
      if (editingId) {
        await api.put(`${apiPaths.categories}/${editingId}`, payload);
        toast.push('Category updated', 'success');
      } else {
        await api.post(apiPaths.categories, payload);
        toast.push('Category created', 'success');
      }
      await load();
      setSheetOpen(false);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`${apiPaths.categories}/${id}`);
      toast.push('Category deleted', 'success');
      await load();
      setDeleteConfirm(null);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to delete', 'error');
    }
  };

  const userCategories = categories.filter((c) => !c.is_system);
  const systemCategories = categories.filter((c) => c.is_system);

  const filtered = (list) =>
    filterType === 'all' ? list : list.filter((c) => c.type === filterType || c.type === 'both');

  const parentName = (parentId) => {
    const p = categories.find((c) => c.id === parentId);
    return p ? p.name : null;
  };

  const parentOptions = categories.filter((c) => !editingId || c.id !== editingId);

  return (
    <>
      <AppHeader
        title="Categories"
        action={
          <button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3">
            <Plus size={14} /> Add
          </button>
        }
      />
      <main className="px-4 pt-3 pb-6">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {['all', 'income', 'expense', 'both'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterType(t)}
              className="text-xs px-3 py-1.5 rounded-full border transition-colors"
              style={{
                background: filterType === t ? 'var(--accent)' : 'var(--bg-card)',
                color: filterType === t ? '#fff' : 'var(--text-muted)',
                borderColor: filterType === t ? 'var(--accent)' : 'var(--border)',
              }}
            >
              {t === 'all' ? 'All' : TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
          </div>
        ) : (
          <>
            {/* User-defined categories */}
            {filtered(userCategories).length > 0 && (
              <div className="mb-5">
                <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Your Categories</div>
                <div className="space-y-2">
                  {filtered(userCategories).map((cat) => (
                    <CategoryRow
                      key={cat.id}
                      cat={cat}
                      parentName={parentName(cat.parent_id)}
                      onEdit={openEdit}
                      onDelete={setDeleteConfirm}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* System categories (read-only) */}
            {filtered(systemCategories).length > 0 && (
              <div>
                <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">System Categories</div>
                <div className="space-y-2">
                  {filtered(systemCategories).map((cat) => (
                    <CategoryRow key={cat.id} cat={cat} parentName={parentName(cat.parent_id)} readOnly />
                  ))}
                </div>
              </div>
            )}

            {filtered(userCategories).length === 0 && filtered(systemCategories).length === 0 && (
              <div className="text-center py-10 text-text-muted">
                <LayoutGrid size={48} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No categories found for this filter.</p>
              </div>
            )}
          </>
        )}
      </main>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={editingId ? 'Edit Category' : 'New Category'}>
        <label className="block text-xs text-text-muted mb-1">Name</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. Groceries"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-1">Type</label>
        <select className="input mb-3" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
          <option value="both">Both</option>
        </select>

        <label className="block text-xs text-text-muted mb-1">Parent Category (optional)</label>
        <select className="input mb-3" value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}>
          <option value="">— None —</option>
          {parentOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <label className="block text-xs text-text-muted mb-1">Icon (emoji, optional)</label>
        <input
          className="input mb-3"
          type="text"
          placeholder="e.g. 🛒"
          value={form.icon}
          onChange={(e) => setForm({ ...form, icon: e.target.value })}
          maxLength={4}
        />

        <label className="block text-xs text-text-muted mb-2">Color</label>
        <div className="flex flex-wrap gap-2 mb-5">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setForm({ ...form, color: c })}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
              style={{ background: c, outline: form.color === c ? `3px solid ${c}` : 'none', outlineOffset: '2px' }}
            >
              {form.color === c && <Check size={13} color="#fff" />}
            </button>
          ))}
        </div>

        <ActionButton variant="primary" className="w-full" loading={saving} onClick={handleSubmit}>
          {editingId ? 'Update' : 'Create'}
        </ActionButton>
      </BottomSheet>

      <BottomSheet open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete Category">
        <p className="text-sm text-text-muted mb-4">
          Delete this category? Transactions using it will keep their existing category label.
        </p>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</ActionButton>
        </div>
      </BottomSheet>
    </>
  );
}

function CategoryRow({ cat, parentName, onEdit, onDelete, readOnly = false }) {
  const tc = TYPE_COLORS[cat.type] || TYPE_COLORS.both;
  return (
    <div className="card px-4 py-3 flex items-center gap-3">
      {cat.icon ? (
        <span className="text-lg w-8 text-center">{cat.icon}</span>
      ) : (
        <span
          className="w-4 h-4 rounded-full flex-shrink-0"
          style={{ background: cat.color || 'var(--accent)' }}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{cat.name}</span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: tc.bg, color: tc.text }}
          >
            {TYPE_LABELS[cat.type]}
          </span>
          {readOnly && (
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
              system
            </span>
          )}
        </div>
        {parentName && (
          <div className="text-[11px] text-text-muted">under {parentName}</div>
        )}
      </div>
      {!readOnly && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(cat)}
            className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
            style={{ color: 'var(--accent)' }}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(cat.id)}
            className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
            style={{ color: 'var(--negative)' }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
