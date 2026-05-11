import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function BottomSheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div
        className="bottom-sheet w-full mx-auto p-4"
        style={{ maxWidth: 'var(--max-width)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">{title}</div>
          <button type="button" onClick={onClose} className="text-text-muted">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
