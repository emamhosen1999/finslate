const express = require('express');
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');
const { buildSummary } = require('./dashboard');

const router = express.Router();

const SALARY_AMOUNT = 80000;
const DPS_INSTALLMENT = 5000;
const LOAN_EMI = 8500;

router.post('/post-salary', requireAuth, async (req, res, next) => {
  const userId = req.user.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Primary bank account: prefer "DBBL Savings", otherwise first bank, otherwise first account.
    const [accountRows] = await conn.query(
      `SELECT id, name, type FROM accounts WHERE user_id = ?
        ORDER BY (name = 'DBBL Savings') DESC, (type = 'bank') DESC, id ASC
        LIMIT 1`,
      [userId],
    );
    if (!accountRows.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'No account available to credit salary' });
    }
    const primaryAccount = accountRows[0];

    // Active DPS (lowest id wins).
    const [dpsRows] = await conn.query(
      'SELECT id, monthly_amount FROM dps WHERE user_id = ? ORDER BY id ASC LIMIT 1',
      [userId],
    );

    // Active loan (lowest id wins).
    const [loanRows] = await conn.query(
      'SELECT id, monthly_emi, remaining FROM loans WHERE user_id = ? AND remaining > 0 ORDER BY id ASC LIMIT 1',
      [userId],
    );

    const dpsInstallment = dpsRows.length ? Number(dpsRows[0].monthly_amount) || DPS_INSTALLMENT : 0;
    const loanInstallment = loanRows.length
      ? Math.min(Number(loanRows[0].monthly_emi) || LOAN_EMI, Number(loanRows[0].remaining))
      : 0;

    const netToAccount = SALARY_AMOUNT - dpsInstallment - loanInstallment;

    // 1) Salary credit to primary account.
    await conn.query(
      'UPDATE accounts SET balance = balance + ? WHERE id = ? AND user_id = ?',
      [SALARY_AMOUNT, primaryAccount.id, userId],
    );

    // Insert salary transaction first so it shows up at the top of the ledger.
    await conn.query(
      `INSERT INTO transactions (user_id, account_id, type, amount, category, description, ref_type)
       VALUES (?, ?, 'credit', ?, 'Salary', 'Monthly salary credit', 'salary')`,
      [userId, primaryAccount.id, SALARY_AMOUNT],
    );

    // 2) DPS deduction.
    if (dpsRows.length && dpsInstallment > 0) {
      await conn.query(
        'UPDATE dps SET total_deposited = total_deposited + ? WHERE id = ? AND user_id = ?',
        [dpsInstallment, dpsRows[0].id, userId],
      );
      await conn.query(
        'UPDATE accounts SET balance = balance - ? WHERE id = ? AND user_id = ?',
        [dpsInstallment, primaryAccount.id, userId],
      );
      await conn.query(
        `INSERT INTO transactions (user_id, account_id, type, amount, category, description, ref_type, ref_id)
         VALUES (?, ?, 'debit', ?, 'Savings', 'DPS monthly installment', 'dps', ?)`,
        [userId, primaryAccount.id, dpsInstallment, dpsRows[0].id],
      );
    }

    // 3) Loan EMI deduction.
    if (loanRows.length && loanInstallment > 0) {
      await conn.query(
        'UPDATE loans SET remaining = remaining - ? WHERE id = ? AND user_id = ?',
        [loanInstallment, loanRows[0].id, userId],
      );
      await conn.query(
        'UPDATE accounts SET balance = balance - ? WHERE id = ? AND user_id = ?',
        [loanInstallment, primaryAccount.id, userId],
      );
      await conn.query(
        `INSERT INTO transactions (user_id, account_id, type, amount, category, description, ref_type, ref_id)
         VALUES (?, ?, 'debit', ?, 'Loan', 'Home Loan EMI', 'loan_repayment', ?)`,
        [userId, primaryAccount.id, loanInstallment, loanRows[0].id],
      );
    }

    await conn.commit();
    const payload = await buildSummary(userId);
    res.json({
      ok: true,
      breakdown: {
        salaryCredited: SALARY_AMOUNT,
        dpsDebited: dpsInstallment,
        loanEmiDebited: loanInstallment,
        netToAccount,
        accountId: primaryAccount.id,
      },
      ...payload,
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

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
