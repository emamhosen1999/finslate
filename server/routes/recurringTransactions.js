const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/auth');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT rt.*, a.name as account_name FROM recurring_transactions rt LEFT JOIN accounts a ON rt.account_id = a.id WHERE rt.user_id = ? ORDER BY next_due ASC',
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { account_id, name, type, amount, category, description, frequency, start_date, end_date } = req.body;
    if (!name || !type || !amount || !category || !frequency || !start_date) {
      return res.status(400).json({ error: 'Name, type, amount, category, frequency, and start date are required.' });
    }
    if (!['credit', 'debit'].includes(type)) {
      return res.status(400).json({ error: 'Type must be credit or debit.' });
    }
    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(frequency)) {
      return res.status(400).json({ error: 'Frequency must be daily, weekly, monthly, or yearly.' });
    }
    const [result] = await pool.query(
      'INSERT INTO recurring_transactions (user_id, account_id, name, type, amount, category, description, frequency, start_date, end_date, next_due) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, account_id ? Number(account_id) : null, name.trim(), type, Number(amount), category.trim(), description?.trim() || null, frequency, start_date, end_date || null, start_date],
    );
    res.status(201).json({
      id: result.insertId,
      name: name.trim(),
      type,
      amount: Number(amount),
      category: category.trim(),
      description: description?.trim() || null,
      frequency,
      start_date,
      end_date,
      next_due: start_date,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { account_id, name, type, amount, category, description, frequency, start_date, end_date } = req.body;
    const recurringId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM recurring_transactions WHERE id = ? AND user_id = ?', [recurringId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Recurring transaction not found.' });
    }
    const updates = [];
    const values = [];
    if (account_id !== undefined) {
      updates.push('account_id = ?');
      values.push(Number(account_id));
    }
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (type !== undefined) {
      if (!['credit', 'debit'].includes(type)) {
        return res.status(400).json({ error: 'Type must be credit or debit.' });
      }
      updates.push('type = ?');
      values.push(type);
    }
    if (amount !== undefined) {
      updates.push('amount = ?');
      values.push(Number(amount));
    }
    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description?.trim() || null);
    }
    if (frequency !== undefined) {
      if (!['daily', 'weekly', 'monthly', 'yearly'].includes(frequency)) {
        return res.status(400).json({ error: 'Frequency must be daily, weekly, monthly, or yearly.' });
      }
      updates.push('frequency = ?');
      values.push(frequency);
    }
    if (start_date !== undefined) {
      updates.push('start_date = ?');
      values.push(start_date);
    }
    if (end_date !== undefined) {
      updates.push('end_date = ?');
      values.push(end_date || null);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }
    values.push(recurringId, req.user.id);
    await pool.query(`UPDATE recurring_transactions SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ message: 'Recurring transaction updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const recurringId = Number(req.params.id);
    const [result] = await pool.query('DELETE FROM recurring_transactions WHERE id = ? AND user_id = ?', [recurringId, req.user.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Recurring transaction not found.' });
    }
    res.json({ message: 'Recurring transaction deleted.' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/process', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const recurringId = Number(req.params.id);
    const [existing] = await connection.query('SELECT * FROM recurring_transactions WHERE id = ? AND user_id = ?', [recurringId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Recurring transaction not found.' });
    }
    const rt = existing[0];
    if (rt.end_date && rt.next_due > rt.end_date) {
      return res.status(400).json({ error: 'Recurring transaction has ended.' });
    }
    const [result] = await connection.query(
      'INSERT INTO transactions (user_id, account_id, type, amount, category, description) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, rt.account_id, rt.type, rt.amount, rt.category, rt.description || rt.name],
    );
    if (rt.account_id) {
      const balanceChange = rt.type === 'credit' ? rt.amount : -rt.amount;
      await connection.query(
        'UPDATE accounts SET balance = balance + ? WHERE id = ? AND user_id = ?',
        [balanceChange, rt.account_id, req.user.id],
      );
    }
    const nextDue = new Date(rt.next_due);
    switch (rt.frequency) {
      case 'daily':
        nextDue.setDate(nextDue.getDate() + 1);
        break;
      case 'weekly':
        nextDue.setDate(nextDue.getDate() + 7);
        break;
      case 'monthly':
        nextDue.setMonth(nextDue.getMonth() + 1);
        break;
      case 'yearly':
        nextDue.setFullYear(nextDue.getFullYear() + 1);
        break;
    }
    const nextDueStr = nextDue.toISOString().split('T')[0];
    await connection.query(
      'UPDATE recurring_transactions SET last_processed = ?, next_due = ? WHERE id = ?',
      [rt.next_due, nextDueStr, recurringId],
    );
    await connection.commit();
    res.json({ message: 'Transaction processed successfully.', next_due: nextDueStr });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

module.exports = router;
