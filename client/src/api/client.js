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
  transfers: '/api/transfers',
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
  budgets: '/api/budgets',
  recurringTransactions: '/api/recurring-transactions',
  recurringRules: '/api/recurring-rules',
  fixedDeposits: '/api/fixed-deposits',
  incomeSources: '/api/income-sources',
  incomes: '/api/incomes',
  investments: '/api/investments',
  insurance: '/api/insurance',
  sanchayapatra: '/api/sanchayapatra',
  personalLending: '/api/personal-lending',
  netWorth: '/api/net-worth',
  notifications: '/api/notifications',
  bills: '/api/bills',
  subscriptions: '/api/subscriptions',
  providentFund: '/api/provident-fund',
  taxRecords: '/api/tax-records',
  goals: '/api/goals',
  currencies: '/api/currencies',
  reports: '/api/reports',
  analytics: '/api/analytics',
  summary: '/api/dashboard/summary',
  debtRepayment: '/api/actions/debt-repayment',
  tags: '/api/tags',
  categories: '/api/categories',
  attachments: '/api/attachments',
};

export default api;
