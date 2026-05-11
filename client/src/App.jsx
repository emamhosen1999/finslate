import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import BottomNav from './components/BottomNav.jsx';
import { useFinance } from './context/FinanceContext.jsx';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Accounts from './pages/Accounts.jsx';
import CreditCards from './pages/CreditCards.jsx';
import Loan from './pages/Loan.jsx';
import DPS from './pages/DPS.jsx';
import Transactions from './pages/Transactions.jsx';
import Budgets from './pages/Budgets.jsx';
import RecurringTransactions from './pages/RecurringTransactions.jsx';
import FixedDeposits from './pages/FixedDeposits.jsx';
import RecurringDeposits from './pages/RecurringDeposits.jsx';
import IncomeSources from './pages/IncomeSources.jsx';
import Investments from './pages/Investments.jsx';

function AuthGate({ children }) {
  const { user, loading } = useFinance();
  const location = useLocation();
  if (user) return children;
  // While initial /me request is in flight, render an empty splash to avoid flicker.
  if (loading && location.pathname !== '/login') {
    return (
      <div className="app-frame flex items-center justify-center">
        <div className="skeleton h-6 w-40" />
      </div>
    );
  }
  return <Navigate to="/login" replace state={{ from: location }} />;
}

export default function App() {
  const { user } = useFinance();

  return (
    <div className="app-frame">
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route
          path="/"
          element={
            <AuthGate>
              <Dashboard />
            </AuthGate>
          }
        />
        <Route
          path="/accounts"
          element={
            <AuthGate>
              <Accounts />
            </AuthGate>
          }
        />
        <Route
          path="/cards"
          element={
            <AuthGate>
              <CreditCards />
            </AuthGate>
          }
        />
        <Route
          path="/loan"
          element={
            <AuthGate>
              <Loan />
            </AuthGate>
          }
        />
        <Route
          path="/dps"
          element={
            <AuthGate>
              <DPS />
            </AuthGate>
          }
        />
        <Route
          path="/transactions"
          element={
            <AuthGate>
              <Transactions />
            </AuthGate>
          }
        />
        <Route
          path="/budgets"
          element={
            <AuthGate>
              <Budgets />
            </AuthGate>
          }
        />
        <Route
          path="/recurring"
          element={
            <AuthGate>
              <RecurringTransactions />
            </AuthGate>
          }
        />
        <Route
          path="/fixed-deposits"
          element={
            <AuthGate>
              <FixedDeposits />
            </AuthGate>
          }
        />
        <Route
          path="/recurring-deposits"
          element={
            <AuthGate>
              <RecurringDeposits />
            </AuthGate>
          }
        />
        <Route
          path="/income"
          element={
            <AuthGate>
              <IncomeSources />
            </AuthGate>
          }
        />
        <Route
          path="/investments"
          element={
            <AuthGate>
              <Investments />
            </AuthGate>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {user ? <BottomNav /> : null}
    </div>
  );
}
