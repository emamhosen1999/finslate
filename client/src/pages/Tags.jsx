import { useState, useEffect } from 'react';
import { Tag, Plus, Pencil, Trash2, Check, X } from 'lucide-react';

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

export default function Tags() {
  const toast = useToast();
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [form, setForm] = useState({ name: '', color: PRESET_COLORS[5] });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(apiPaths.tags);
      setTags(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: '', color: PRESET_COLORS[5] });
    setSheetOpen(true);
  };

  const openEdit = (tag) => {
    setEditingId(tag.id);
    setForm({ name: tag.name, color: tag.color || PRESET_COLORS[5] });
    setSheetOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.push('Tag name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`${apiPaths.tags}/${editingId}`, form);
        toast.push('Tag updated', 'success');
      } else {
        await api.post(apiPaths.tags, form);
        toast.push('Tag created', 'success');
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
      await api.delete(`${apiPaths.tags}/${id}`);
      toast.push('Tag deleted', 'success');
      await load();
      setDeleteConfirm(null);
    } catch (err) {
      toast.push(err?.response?.data?.error || 'Failed to delete', 'error');
    }
  };

  return (
    <>
      <AppHeader
        title="Tags"
        action={
          <button type="button" onClick={openAdd} className="btn btn-primary text-xs py-2 px-3">
            <Plus size={14} /> Add
          </button>
        }
      />
      <main className="px-4 pt-3">
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
          </div>
        ) : tags.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            <Tag size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No tags yet. Create tags to organize your transactions.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tags.map((tag) => (
              <div key={tag.id} className="card px-4 py-3 flex items-center gap-3">
                <span
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ background: tag.color || 'var(--accent)' }}
                />
                <span className="flex-1 font-medium text-sm">{tag.name}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(tag)}
                    className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ color: 'var(--accent)' }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(tag.id)}
                    className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ color: 'var(--negative)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={editingId ? 'Edit Tag' : 'New Tag'}>
        <label className="block text-xs text-text-muted mb-1">Name</label>
        <input
          className="input mb-4"
          type="text"
          placeholder="e.g. Tax-deductible"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <label className="block text-xs text-text-muted mb-2">Color</label>
        <div className="flex flex-wrap gap-2 mb-4">
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

        <div className="flex items-center gap-2 mb-5 p-2 rounded-lg" style={{ background: 'var(--bg-elevated)' }}>
          <span className="w-4 h-4 rounded-full" style={{ background: form.color }} />
          <span className="text-sm font-medium">{form.name || 'Preview'}</span>
        </div>

        <ActionButton variant="primary" className="w-full" loading={saving} onClick={handleSubmit}>
          {editingId ? 'Update' : 'Create'}
        </ActionButton>
      </BottomSheet>

      <BottomSheet open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete Tag">
        <p className="text-sm text-text-muted mb-4">
          Deleting this tag will remove it from all transactions. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <ActionButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
          <ActionButton variant="negative" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</ActionButton>
        </div>
      </BottomSheet>
    </>
  );
}
