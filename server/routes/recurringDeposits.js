const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/auth');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM recurring_deposits WHERE user_id = ? ORDER BY maturity_date ASC',
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, monthly_amount, interest_rate, maturity_amount, start_date, maturity_date } = req.body;
    if (!name || !monthly_amount || !interest_rate) {
      return res.status(400).json({ error: 'Name, monthly amount, and interest rate are required.' });
    }
    const [result] = await pool.query(
      'INSERT INTO recurring_deposits (user_id, name, monthly_amount, interest_rate, maturity_amount, start_date, maturity_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, name.trim(), Number(monthly_amount), Number(interest_rate), maturity_amount || null, start_date || null, maturity_date || null],
    );
    res.status(201).json({
      id: result.insertId,
      name: name.trim(),
      monthly_amount: Number(monthly_amount),
      interest_rate: Number(interest_rate),
      maturity_amount: maturity_amount || null,
      start_date,
      maturity_date,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, monthly_amount, interest_rate, maturity_amount, start_date, maturity_date, total_deposited } = req.body;
    const rdId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM recurring_deposits WHERE id = ? AND user_id = ?', [rdId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Recurring deposit not found.' });
    }
    const updates = [];
    const values = [];
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (monthly_amount !== undefined) {
      updates.push('monthly_amount = ?');
      values.push(Number(monthly_amount));
    }
    if (interest_rate !== undefined) {
      updates.push('interest_rate = ?');
      values.push(Number(interest_rate));
    }
    if (maturity_amount !== undefined) {
      updates.push('maturity_amount = ?');
      values.push(maturity_amount || null);
    }
    if (start_date !== undefined) {
      updates.push('start_date = ?');
      values.push(start_date);
    }
    if (maturity_date !== undefined) {
      updates.push('maturity_date = ?');
      values.push(maturity_date);
    }
    if (total_deposited !== undefined) {
      updates.push('total_deposited = ?');
      values.push(Number(total_deposited));
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }
    values.push(rdId, req.user.id);
    await pool.query(`UPDATE recurring_deposits SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ message: 'Recurring deposit updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const rdId = Number(req.params.id);
    const [result] = await pool.query('DELETE FROM recurring_deposits WHERE id = ? AND user_id = ?', [rdId, req.user.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Recurring deposit not found.' });
    }
    res.json({ message: 'Recurring deposit deleted.' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/deposit', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { amount, account_id } = req.body;
    const rdId = Number(req.params.id);
    if (!amount) {
      return res.status(400).json({ error: 'Deposit amount is required.' });
    }
    const depositAmount = Number(amount);
    const [existing] = await connection.query('SELECT * FROM recurring_deposits WHERE id = ? AND user_id = ?', [rdId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Recurring deposit not found.' });
    }
    const rd = existing[0];
    const currentDeposited = Number(rd.total_deposited) || 0;
    const newDeposited = currentDeposited + depositAmount;
    await connection.query(
      'UPDATE recurring_deposits SET total_deposited = ? WHERE id = ? AND user_id = ?',
      [newDeposited, rdId, req.user.id],
    );
    if (account_id) {
      const [account] = await connection.query('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [Number(account_id), req.user.id]);
      if (!account.length) {
        return res.status(404).json({ error: 'Account not found.' });
      }
      await connection.query(
        'INSERT INTO transactions (user_id, account_id, type, amount, category, description) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.id, Number(account_id), 'debit', depositAmount, 'RD Deposit', `Deposit to ${rd.name}`],
      );
      await connection.query(
        'UPDATE accounts SET balance = balance - ? WHERE id = ? AND user_id = ?',
        [depositAmount, Number(account_id), req.user.id],
      );
    }
    await connection.commit();
    res.json({ message: 'Deposit successful.', newDeposited });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

module.exports = router;
