const express = require('express');
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, principal, remaining, monthly_emi, interest_rate, created_at FROM loans WHERE user_id = ? ORDER BY id',
      [req.user.id],
    );
    res.json({ loans: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, principal, monthly_emi, interest_rate } = req.body;
    if (!name || !principal || !monthly_emi) {
      return res.status(400).json({ error: 'Name, principal, and monthly EMI are required.' });
    }
    const principalNum = Number(principal);
    const [result] = await pool.query(
      'INSERT INTO loans (user_id, name, principal, remaining, monthly_emi, interest_rate) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, name.trim(), principalNum, principalNum, Number(monthly_emi), interest_rate || null],
    );
    res.status(201).json({
      id: result.insertId,
      name: name.trim(),
      principal: principalNum,
      remaining: principalNum,
      monthly_emi: Number(monthly_emi),
      interest_rate: interest_rate || null,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, principal, remaining, monthly_emi, interest_rate } = req.body;
    const loanId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM loans WHERE id = ? AND user_id = ?', [loanId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Loan not found.' });
    }
    const updates = [];
    const values = [];
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (principal !== undefined) {
      updates.push('principal = ?');
      values.push(Number(principal));
    }
    if (remaining !== undefined) {
      updates.push('remaining = ?');
      values.push(Number(remaining));
    }
    if (monthly_emi !== undefined) {
      updates.push('monthly_emi = ?');
      values.push(Number(monthly_emi));
    }
    if (interest_rate !== undefined) {
      updates.push('interest_rate = ?');
      values.push(interest_rate || null);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }
    values.push(loanId, req.user.id);
    await pool.query(`UPDATE loans SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ message: 'Loan updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const loanId = Number(req.params.id);
    const [result] = await pool.query('DELETE FROM loans WHERE id = ? AND user_id = ?', [loanId, req.user.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Loan not found.' });
    }
    res.json({ message: 'Loan deleted.' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/pay', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { amount, account_id } = req.body;
    const loanId = Number(req.params.id);
    if (!amount) {
      return res.status(400).json({ error: 'Payment amount is required.' });
    }
    const paymentAmount = Number(amount);
    const [existing] = await connection.query('SELECT * FROM loans WHERE id = ? AND user_id = ?', [loanId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Loan not found.' });
    }
    const loan = existing[0];
    const currentRemaining = Number(loan.remaining) || 0;
    if (paymentAmount > currentRemaining) {
      return res.status(400).json({ error: 'Payment amount exceeds remaining balance.' });
    }
    const newRemaining = Math.max(0, currentRemaining - paymentAmount);
    await connection.query(
      'UPDATE loans SET remaining = ? WHERE id = ? AND user_id = ?',
      [newRemaining, loanId, req.user.id],
    );
    if (account_id) {
      const [account] = await connection.query('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [Number(account_id), req.user.id]);
      if (!account.length) {
        return res.status(404).json({ error: 'Account not found.' });
      }
      await connection.query(
        'INSERT INTO transactions (user_id, account_id, type, amount, category, description) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.id, Number(account_id), 'debit', paymentAmount, 'Loan Payment', `Payment to ${loan.name}`],
      );
      await connection.query(
        'UPDATE accounts SET balance = balance - ? WHERE id = ? AND user_id = ?',
        [paymentAmount, Number(account_id), req.user.id],
      );
    }
    await connection.commit();
    res.json({ message: 'Payment successful.', newRemaining });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

module.exports = router;
