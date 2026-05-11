const express = require('express');
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');
const { buildSummary } = require('./dashboard');

const router = express.Router();

router.post('/debt-repayment', requireAuth, async (req, res, next) => {
  const userId = req.user.id;
  const { loanId, accountId, amount } = req.body || {};
  const amt = Number(amount);

  if (!loanId || !accountId || !Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ error: 'loanId, accountId and positive amount are required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[account]] = await conn.query(
      'SELECT id, name, balance FROM accounts WHERE id = ? AND user_id = ? FOR UPDATE',
      [accountId, userId],
    );
    if (!account) {
      await conn.rollback();
      return res.status(404).json({ error: 'Account not found' });
    }

    const [[loan]] = await conn.query(
      'SELECT id, name, remaining FROM loans WHERE id = ? AND user_id = ? FOR UPDATE',
      [loanId, userId],
    );
    if (!loan) {
      await conn.rollback();
      return res.status(404).json({ error: 'Loan not found' });
    }

    if (Number(account.balance) < amt) {
      await conn.rollback();
      return res.status(400).json({ error: 'Insufficient account balance' });
    }
    if (Number(loan.remaining) < amt) {
      await conn.rollback();
      return res.status(400).json({ error: 'Amount exceeds outstanding loan balance' });
    }

    await conn.query(
      'UPDATE accounts SET balance = balance - ? WHERE id = ? AND user_id = ?',
      [amt, account.id, userId],
    );
    await conn.query(
      'UPDATE loans SET remaining = remaining - ? WHERE id = ? AND user_id = ?',
      [amt, loan.id, userId],
    );
    await conn.query(
      `INSERT INTO transactions (user_id, account_id, type, amount, category, description, ref_type, ref_id)
       VALUES (?, ?, 'debit', ?, 'Loan', ?, 'loan_repayment', ?)`,
      [userId, account.id, amt, `Loan repayment - ${loan.name}`, loan.id],
    );

    await conn.commit();
    const payload = await buildSummary(userId);
    res.json({ ok: true, ...payload });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

module.exports = router;
