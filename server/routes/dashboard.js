const express = require('express');
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

async function buildSummary(userId) {
  const [[accounts], [creditCards], [loans], [dps], [transactions]] = await Promise.all([
    pool.query('SELECT id, name, type, balance, created_at FROM accounts WHERE user_id = ? ORDER BY id', [userId]),
    pool.query('SELECT id, name, limit_amt, due_amount, due_date, created_at FROM credit_cards WHERE user_id = ? ORDER BY id', [userId]),
    pool.query('SELECT id, name, principal, remaining, monthly_emi, interest_rate, created_at FROM loans WHERE user_id = ? ORDER BY id', [userId]),
    pool.query('SELECT id, name, monthly_amount, total_deposited, maturity_amount, start_date, maturity_date, created_at FROM dps WHERE user_id = ? ORDER BY id', [userId]),
    pool.query(
      `SELECT t.id, t.account_id, a.name AS account_name, t.type, t.amount, t.category,
              t.description, t.ref_type, t.ref_id, t.created_at
         FROM transactions t
         LEFT JOIN accounts a ON a.id = t.account_id
        WHERE t.user_id = ?
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT 200`,
      [userId],
    ),
  ]);

  const num = (v) => parseFloat(v) || 0;
  const totalLiquid = accounts.reduce((s, a) => s + num(a.balance), 0);
  const totalDPS = dps.reduce((s, d) => s + num(d.total_deposited), 0);
  const totalLoans = loans.reduce((s, l) => s + num(l.remaining), 0);
  const totalCreditDues = creditCards.reduce((s, c) => s + num(c.due_amount), 0);
  const netWorth = totalLiquid + totalDPS - totalLoans - totalCreditDues;

  return {
    accounts,
    creditCards,
    loans,
    dps,
    transactions,
    summary: { totalLiquid, totalDPS, totalLoans, totalCreditDues, netWorth },
  };
}

router.get('/summary', requireAuth, async (req, res, next) => {
  try {
    const payload = await buildSummary(req.user.id);
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.buildSummary = buildSummary;
