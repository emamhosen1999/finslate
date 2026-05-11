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
  logout: '/api/auth/logout',
  summary: '/api/dashboard/summary',
  postSalary: '/api/actions/post-salary',
  debtRepayment: '/api/actions/debt-repayment',
  transactions: (params = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    });
    const q = search.toString();
    return `/api/transactions${q ? `?${q}` : ''}`;
  },
};

export default api;
