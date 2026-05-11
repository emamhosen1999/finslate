import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '';

export const api = axios.create({
  baseURL: baseURL ? `${baseURL.replace(/\/$/, '')}` : '',
  withCredentials: true,
});

// Helper endpoints.
export const apiPaths = {
  me: '/api/auth/me',
  googleLogin: '/api/auth/google',
  register: '/api/auth/register',
  loginEmail: '/api/auth/login/email',
  logout: '/api/auth/logout',
  accounts: '/api/accounts',
  transactions: '/api/transactions',
  transactionsList: (params = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    });
    const q = search.toString();
    return `/api/transactions${q ? `?${q}` : ''}`;
  },
  creditCards: '/api/credit-cards',
  loans: '/api/loans',
  dps: '/api/dps',
  summary: '/api/dashboard/summary',
  postSalary: '/api/actions/post-salary',
  debtRepayment: '/api/actions/debt-repayment',
};

export default api;
