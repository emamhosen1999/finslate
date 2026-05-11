const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/auth');

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

module.exports = router;
