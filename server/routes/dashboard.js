const express = require('express');
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

async function buildSummary(userId) {
  const [[accounts], [creditCards], [loans], [dps], [transactions]] = await Promise.all([
    pool.query(
      'SELECT id, name, type, current_balance, institution_name, currency, is_default, created_at FROM accounts WHERE user_id = ? AND deleted_at IS NULL ORDER BY id',
      [userId],
    ),
    pool.query(
      'SELECT id, card_name, issuer, credit_limit, current_outstanding, payment_due_day, annual_interest_rate, is_active, created_at FROM credit_cards WHERE user_id = ? AND is_active = 1 ORDER BY id',
      [userId],
    ),
    pool.query(
      'SELECT id, lender_name, loan_type, principal_amount, outstanding_balance, emi_amount, annual_interest_rate, status, created_at FROM loans WHERE user_id = ? AND status = "active" ORDER BY id',
      [userId],
    ),
    pool.query(
      'SELECT id, institution_name, dps_account_number, installment_amount, total_deposited, projected_maturity_value, start_date, maturity_date, status, created_at FROM dps WHERE user_id = ? AND deleted_at IS NULL ORDER BY id',
      [userId],
    ),
    pool.query(
      `SELECT t.id, t.account_id, a.name AS account_name, t.type, t.amount, t.currency,
              t.transaction_date, t.category_id, t.payee, t.notes, t.created_at
         FROM transactions t
         LEFT JOIN accounts a ON a.id = t.account_id
        WHERE t.user_id = ? AND t.deleted_at IS NULL
        ORDER BY t.transaction_date DESC, t.id DESC
        LIMIT 50`,
      [userId],
    ),
  ]);

  const num = (v) => parseFloat(v) || 0;
  const totalLiquid = accounts.reduce((s, a) => s + num(a.current_balance), 0);
  const totalDPS = dps.reduce((s, d) => s + num(d.total_deposited), 0);
  const totalLoans = loans.reduce((s, l) => s + num(l.outstanding_balance), 0);
  const totalCreditDues = creditCards.reduce((s, c) => s + num(c.current_outstanding), 0);
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
