const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT is.*, a.name as account_name FROM income_sources is LEFT JOIN accounts a ON is.account_id = a.id WHERE is.user_id = ? ORDER BY next_pay_date ASC',
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, type, amount, frequency, account_id, next_pay_date } = req.body;
    if (!name || !type || !amount) {
      return res.status(400).json({ error: 'Name, type, and amount are required.' });
    }
    const [result] = await pool.query(
      'INSERT INTO income_sources (user_id, name, type, amount, frequency, account_id, next_pay_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, name.trim(), type.trim(), Number(amount), frequency || 'monthly', account_id ? Number(account_id) : null, next_pay_date || null],
    );
    res.status(201).json({
      id: result.insertId,
      name: name.trim(),
      type: type.trim(),
      amount: Number(amount),
      frequency: frequency || 'monthly',
      account_id: account_id ? Number(account_id) : null,
      next_pay_date: next_pay_date || null,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, type, amount, frequency, account_id, next_pay_date } = req.body;
    const incomeId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM income_sources WHERE id = ? AND user_id = ?', [incomeId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Income source not found.' });
    }
    const updates = [];
    const values = [];
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (type !== undefined) {
      updates.push('type = ?');
      values.push(type.trim());
    }
    if (amount !== undefined) {
      updates.push('amount = ?');
      values.push(Number(amount));
    }
    if (frequency !== undefined) {
      updates.push('frequency = ?');
      values.push(frequency);
    }
    if (account_id !== undefined) {
      updates.push('account_id = ?');
      values.push(account_id ? Number(account_id) : null);
    }
    if (next_pay_date !== undefined) {
      updates.push('next_pay_date = ?');
      values.push(next_pay_date || null);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }
    values.push(incomeId, req.user.id);
    await pool.query(`UPDATE income_sources SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ message: 'Income source updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const incomeId = Number(req.params.id);
    const [result] = await pool.query('DELETE FROM income_sources WHERE id = ? AND user_id = ?', [incomeId, req.user.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Income source not found.' });
    }
    res.json({ message: 'Income source deleted.' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/post', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const incomeId = Number(req.params.id);
    const [existing] = await connection.query('SELECT * FROM income_sources WHERE id = ? AND user_id = ?', [incomeId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Income source not found.' });
    }
    const income = existing[0];
    if (!income.account_id) {
      return res.status(400).json({ error: 'Income source must have an account to post income.' });
    }
    await connection.query(
      `INSERT INTO transactions (user_id, account_id, type, amount, currency, transaction_date, category_id, source_type, payee, notes)
       VALUES (?, ?, 'income', ?, 'BDT', CURDATE(), 'Income', 'account', ?, ?)`,
      [req.user.id, income.account_id, income.amount, income.name, income.name],
    );
    await connection.query(
      'UPDATE accounts SET current_balance = current_balance + ? WHERE id = ? AND user_id = ?',
      [income.amount, income.account_id, req.user.id],
    );
    const nextPay = new Date(income.next_pay_date || new Date());
    switch (income.frequency) {
      case 'daily':
        nextPay.setDate(nextPay.getDate() + 1);
        break;
      case 'weekly':
        nextPay.setDate(nextPay.getDate() + 7);
        break;
      case 'monthly':
        nextPay.setMonth(nextPay.getMonth() + 1);
        break;
      case 'yearly':
        nextPay.setFullYear(nextPay.getFullYear() + 1);
        break;
    }
    const nextPayStr = nextPay.toISOString().split('T')[0];
    await connection.query(
      'UPDATE income_sources SET next_pay_date = ? WHERE id = ?',
      [nextPayStr, incomeId],
    );
    await connection.commit();
    res.json({ message: 'Income posted successfully.', next_pay_date: nextPayStr });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

module.exports = router;
