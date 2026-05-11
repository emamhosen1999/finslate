const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/auth');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT cr.*, a.name as account_name FROM cashback_rewards cr LEFT JOIN accounts a ON cr.account_id = a.id WHERE cr.user_id = ? ORDER BY date_received DESC',
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/summary', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT source, type, SUM(amount) as total FROM cashback_rewards WHERE user_id = ? GROUP BY source, type ORDER BY total DESC',
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { source, type, amount, account_id, date_received } = req.body;
    if (!source || !type || !amount) {
      return res.status(400).json({ error: 'Source, type, and amount are required.' });
    }
    const [result] = await pool.query(
      'INSERT INTO cashback_rewards (user_id, source, type, amount, account_id, date_received) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, source.trim(), type.trim(), Number(amount), account_id ? Number(account_id) : null, date_received || null],
    );
    res.status(201).json({
      id: result.insertId,
      source: source.trim(),
      type: type.trim(),
      amount: Number(amount),
      account_id: account_id ? Number(account_id) : null,
      date_received: date_received || null,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { source, type, amount, account_id, date_received } = req.body;
    const cbId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM cashback_rewards WHERE id = ? AND user_id = ?', [cbId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Cashback/reward not found.' });
    }
    const updates = [];
    const values = [];
    if (source !== undefined) {
      updates.push('source = ?');
      values.push(source.trim());
    }
    if (type !== undefined) {
      updates.push('type = ?');
      values.push(type.trim());
    }
    if (amount !== undefined) {
      updates.push('amount = ?');
      values.push(Number(amount));
    }
    if (account_id !== undefined) {
      updates.push('account_id = ?');
      values.push(account_id ? Number(account_id) : null);
    }
    if (date_received !== undefined) {
      updates.push('date_received = ?');
      values.push(date_received || null);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }
    values.push(cbId, req.user.id);
    await pool.query(`UPDATE cashback_rewards SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ message: 'Cashback/reward updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const cbId = Number(req.params.id);
    const [result] = await pool.query('DELETE FROM cashback_rewards WHERE id = ? AND user_id = ?', [cbId, req.user.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Cashback/reward not found.' });
    }
    res.json({ message: 'Cashback/reward deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
