const express = require('express');
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, monthly_amount, total_deposited, maturity_amount, start_date, maturity_date, created_at
         FROM dps WHERE user_id = ? ORDER BY id`,
      [req.user.id],
    );
    res.json({ dps: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, monthly_amount, maturity_amount, start_date, maturity_date } = req.body;
    if (!name || !monthly_amount) {
      return res.status(400).json({ error: 'Name and monthly amount are required.' });
    }
    const [result] = await pool.query(
      'INSERT INTO dps (user_id, name, monthly_amount, total_deposited, maturity_amount, start_date, maturity_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, name.trim(), Number(monthly_amount), 0, maturity_amount || null, start_date || null, maturity_date || null],
    );
    res.status(201).json({
      id: result.insertId,
      name: name.trim(),
      monthly_amount: Number(monthly_amount),
      total_deposited: 0,
      maturity_amount: maturity_amount || null,
      start_date: start_date || null,
      maturity_date: maturity_date || null,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, monthly_amount, total_deposited, maturity_amount, start_date, maturity_date } = req.body;
    const dpsId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM dps WHERE id = ? AND user_id = ?', [dpsId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'DPS not found.' });
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
    if (total_deposited !== undefined) {
      updates.push('total_deposited = ?');
      values.push(Number(total_deposited));
    }
    if (maturity_amount !== undefined) {
      updates.push('maturity_amount = ?');
      values.push(maturity_amount || null);
    }
    if (start_date !== undefined) {
      updates.push('start_date = ?');
      values.push(start_date || null);
    }
    if (maturity_date !== undefined) {
      updates.push('maturity_date = ?');
      values.push(maturity_date || null);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }
    values.push(dpsId, req.user.id);
    await pool.query(`UPDATE dps SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ message: 'DPS updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const dpsId = Number(req.params.id);
    const [result] = await pool.query('DELETE FROM dps WHERE id = ? AND user_id = ?', [dpsId, req.user.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'DPS not found.' });
    }
    res.json({ message: 'DPS deleted.' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/deposit', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { amount, account_id } = req.body;
    const dpsId = Number(req.params.id);
    if (!amount) {
      return res.status(400).json({ error: 'Deposit amount is required.' });
    }
    const depositAmount = Number(amount);
    const [existing] = await connection.query('SELECT * FROM dps WHERE id = ? AND user_id = ?', [dpsId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'DPS not found.' });
    }
    const dps = existing[0];
    const currentDeposited = Number(dps.total_deposited) || 0;
    const newDeposited = currentDeposited + depositAmount;
    await connection.query(
      'UPDATE dps SET total_deposited = ? WHERE id = ? AND user_id = ?',
      [newDeposited, dpsId, req.user.id],
    );
    if (account_id) {
      const [account] = await connection.query('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [Number(account_id), req.user.id]);
      if (!account.length) {
        return res.status(404).json({ error: 'Account not found.' });
      }
      await connection.query(
        'INSERT INTO transactions (user_id, account_id, type, amount, category, description) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.id, Number(account_id), 'debit', depositAmount, 'DPS Deposit', `Deposit to ${dps.name}`],
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
