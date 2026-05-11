import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext({ push: () => {} });

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, variant = 'info') => {
    const id = ++idCounter;
    setToasts((t) => [...t, { id, message, variant }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3000);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast pointer-events-auto text-sm"
            style={{
              borderColor:
                t.variant === 'error'
                  ? 'rgba(240,92,92,0.5)'
                  : t.variant === 'success'
                  ? 'rgba(76,175,125,0.5)'
                  : undefined,
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
