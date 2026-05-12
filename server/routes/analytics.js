const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

router.get('/overview', requireAuth, async (req, res, next) => {
  try {
    const [incomeResult] = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "credit"',
      [req.user.id],
    );
    const [expenseResult] = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "debit"',
      [req.user.id],
    );
    const [accountResult] = await pool.query(
      'SELECT COALESCE(SUM(balance), 0) as total FROM accounts WHERE user_id = ?',
      [req.user.id],
    );
    const [investmentResult] = await pool.query(
      'SELECT COALESCE(SUM(quantity * current_price), 0) as total FROM investments WHERE user_id = ? AND current_price IS NOT NULL',
      [req.user.id],
    );
    const [fdResult] = await pool.query(
      'SELECT COALESCE(SUM(maturity_amount), 0) as total FROM fixed_deposits WHERE user_id = ? AND maturity_amount IS NOT NULL',
      [req.user.id],
    );
    const [rdResult] = await pool.query(
      'SELECT COALESCE(SUM(maturity_amount), 0) as total FROM recurring_deposits WHERE user_id = ? AND maturity_amount IS NOT NULL',
      [req.user.id],
    );
    const [cashbackResult] = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM cashback_rewards WHERE user_id = ?',
      [req.user.id],
    );
    res.json({
      totalIncome: Number(incomeResult[0].total),
      totalExpense: Number(expenseResult[0].total),
      totalAccounts: Number(accountResult[0].total),
      totalInvestments: Number(investmentResult[0].total),
      totalFD: Number(fdResult[0].total),
      totalRD: Number(rdResult[0].total),
      totalCashback: Number(cashbackResult[0].total),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/category-spending', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND type = "debit" GROUP BY category ORDER BY total DESC LIMIT 10',
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/monthly-trend', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT DATE_FORMAT(date, "%Y-%m") as month, SUM(CASE WHEN type = "credit" THEN amount ELSE 0 END) as income, SUM(CASE WHEN type = "debit" THEN amount ELSE 0 END) as expense FROM transactions WHERE user_id = ? GROUP BY DATE_FORMAT(date, "%Y-%m") ORDER BY month DESC LIMIT 12',
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Net worth trend over time
router.get('/net-worth-trend', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT snapshot_date as date, net_worth FROM net_worth_snapshots WHERE user_id = ? ORDER BY snapshot_date ASC',
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Debt summary
router.get('/debt-summary', requireAuth, async (req, res, next) => {
  try {
    const [creditCardResult] = await pool.query(
      'SELECT COALESCE(SUM(outstanding_balance), 0) as total FROM credit_cards WHERE user_id = ?',
      [req.user.id],
    );
    const [loanResult] = await pool.query(
      'SELECT COALESCE(SUM(outstanding_balance), 0) as total FROM loans WHERE user_id = ?',
      [req.user.id],
    );
    const [personalLendingResult] = await pool.query(
      'SELECT COALESCE(SUM(CASE WHEN direction = "borrowed" THEN amount - COALESCE((SELECT SUM(amount) FROM lending_repayments WHERE lending_repayments.lending_id = personal_lendings.id), 0) ELSE 0 END), 0) as total FROM personal_lendings WHERE user_id = ? AND direction = "borrowed"',
      [req.user.id],
    );
    res.json({
      creditCardDebt: Number(creditCardResult[0].total),
      loanDebt: Number(loanResult[0].total),
      personalLendingDebt: Number(personalLendingResult[0].total),
      totalDebt: Number(creditCardResult[0].total) + Number(loanResult[0].total) + Number(personalLendingResult[0].total),
    });
  } catch (err) {
    next(err);
  }
});

// Subscription spending summary
router.get('/subscription-summary', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT name, amount, billing_cycle, next_billing FROM subscriptions WHERE user_id = ? AND status = "active"',
      [req.user.id],
    );
    const [summaryResult] = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total_monthly FROM subscriptions WHERE user_id = ? AND status = "active" AND billing_cycle = "monthly"',
      [req.user.id],
    );
    res.json({
      subscriptions: rows,
      totalMonthly: Number(summaryResult[0].total_monthly),
    });
  } catch (err) {
    next(err);
  }
});

// Bill payment tracking
router.get('/bill-summary', requireAuth, async (req, res, next) => {
  try {
    const [pendingResult] = await pool.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM bills WHERE user_id = ? AND status = "pending"',
      [req.user.id],
    );
    const [overdueResult] = await pool.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM bills WHERE user_id = ? AND status = "overdue"',
      [req.user.id],
    );
    const [paidResult] = await pool.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM bills WHERE user_id = ? AND status = "paid"',
      [req.user.id],
    );
    res.json({
      pending: { count: pendingResult[0].count, total: Number(pendingResult[0].total) },
      overdue: { count: overdueResult[0].count, total: Number(overdueResult[0].total) },
      paid: { count: paidResult[0].count, total: Number(paidResult[0].total) },
    });
  } catch (err) {
    next(err);
  }
});

// Goal progress summary
router.get('/goal-summary', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT name, target_amount, current_amount, target_date, status FROM goals WHERE user_id = ? ORDER BY target_date ASC',
      [req.user.id],
    );
    const [summaryResult] = await pool.query(
      'SELECT COUNT(*) as total, SUM(CASE WHEN status = "completed" THEN 1 ELSE 0 END) as completed, COALESCE(SUM(target_amount), 0) as total_target, COALESCE(SUM(current_amount), 0) as total_saved FROM goals WHERE user_id = ?',
      [req.user.id],
    );
    res.json({
      goals: rows,
      summary: {
        total: summaryResult[0].total,
        completed: summaryResult[0].completed,
        totalTarget: Number(summaryResult[0].total_target),
        totalSaved: Number(summaryResult[0].total_saved),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Investment performance
router.get('/investment-performance', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT name, type, quantity, purchase_price, current_price, purchase_date FROM investments WHERE user_id = ?',
      [req.user.id],
    );
    const [summaryResult] = await pool.query(
      'SELECT COALESCE(SUM(quantity * purchase_price), 0) as total_invested, COALESCE(SUM(quantity * current_price), 0) as total_current FROM investments WHERE user_id = ? AND current_price IS NOT NULL',
      [req.user.id],
    );
    const totalInvested = Number(summaryResult[0].total_invested);
    const totalCurrent = Number(summaryResult[0].total_current);
    const gain = totalCurrent - totalInvested;
    const gainPercent = totalInvested > 0 ? (gain / totalInvested) * 100 : 0;
    res.json({
      investments: rows,
      summary: {
        totalInvested,
        totalCurrent,
        gain,
        gainPercent,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
