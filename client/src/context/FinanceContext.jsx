import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import api, { apiPaths } from '../api/client';

const initialState = {
  user: null,
  accounts: [],
  creditCards: [],
  loans: [],
  dps: [],
  transactions: [],
  summary: {
    totalLiquid: 0,
    totalDPS: 0,
    totalLoans: 0,
    totalCreditDues: 0,
    netWorth: 0,
  },
  loading: true,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, error: null };
    case 'LOAD_USER':
      return { ...state, user: action.payload };
    case 'LOAD_ALL':
      return {
        ...state,
        loading: false,
        accounts: action.payload.accounts || [],
        creditCards: action.payload.creditCards || [],
        loans: action.payload.loans || [],
        dps: action.payload.dps || [],
        transactions: action.payload.transactions || [],
        summary: action.payload.summary || initialState.summary,
      };
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'PATCH':
      return { ...state, ...action.payload };
    case 'RESET':
      return { ...initialState };
    default:
      return state;
  }
}

const FinanceContext = createContext(null);

export function FinanceProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const loadAll = useCallback(async () => {
    dispatch({ type: 'LOAD_START' });
    try {
      const { data } = await api.get(apiPaths.summary);
      dispatch({ type: 'LOAD_ALL', payload: data });
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) {
        dispatch({ type: 'PATCH', payload: { user: null, loading: false } });
      } else {
        dispatch({ type: 'LOAD_ERROR', payload: err?.message || 'Failed to load' });
      }
    }
  }, []);

  const loadMe = useCallback(async () => {
    try {
      const { data } = await api.get(apiPaths.me);
      dispatch({ type: 'LOAD_USER', payload: data.user });
      return data.user;
    } catch {
      dispatch({ type: 'LOAD_USER', payload: null });
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      const user = await loadMe();
      if (user) {
        await loadAll();
      } else {
        // No authenticated user — clear the initial splash so AuthGate can
        // route to /login instead of showing the skeleton forever.
        dispatch({ type: 'PATCH', payload: { loading: false } });
      }
    })();
  }, [loadMe, loadAll]);

  const debtRepayment = useCallback(async ({ loanId, accountId, amount }) => {
    const { data } = await api.post(apiPaths.debtRepayment, { loanId, accountId, amount });
    dispatch({ type: 'LOAD_ALL', payload: data });
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post(apiPaths.logout);
    } finally {
      dispatch({ type: 'RESET' });
    }
  }, []);

  const value = useMemo(
    () => ({ ...state, loadAll, loadMe, debtRepayment, logout, dispatch }),
    [state, loadAll, loadMe, debtRepayment, logout],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}
