const express = require('express');
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, type, balance, created_at FROM accounts WHERE user_id = ? ORDER BY id',
      [req.user.id],
    );
    res.json({ accounts: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/transactions', requireAuth, async (req, res, next) => {
  try {
    const accountId = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT t.id, t.account_id, a.name AS account_name, t.type, t.amount, t.category,
              t.description, t.ref_type, t.ref_id, t.created_at
         FROM transactions t
         LEFT JOIN accounts a ON a.id = t.account_id
        WHERE t.user_id = ? AND t.account_id = ?
        ORDER BY t.created_at DESC, t.id DESC`,
      [req.user.id, accountId],
    );
    res.json({ transactions: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, type, balance } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required.' });
    }
    if (!['bank', 'mobile_banking', 'cash'].includes(type)) {
      return res.status(400).json({ error: 'Invalid account type.' });
    }
    const [result] = await pool.query(
      'INSERT INTO accounts (user_id, name, type, balance) VALUES (?, ?, ?, ?)',
      [req.user.id, name.trim(), type, Number(balance) || 0],
    );
    res.status(201).json({ id: result.insertId, name: name.trim(), type, balance: Number(balance) || 0 });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, type, balance } = req.body;
    const accountId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [accountId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Account not found.' });
    }
    const updates = [];
    const values = [];
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (type !== undefined) {
      if (!['bank', 'mobile_banking', 'cash'].includes(type)) {
        return res.status(400).json({ error: 'Invalid account type.' });
      }
      updates.push('type = ?');
      values.push(type);
    }
    if (balance !== undefined) {
      updates.push('balance = ?');
      values.push(Number(balance));
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }
    values.push(accountId, req.user.id);
    await pool.query(`UPDATE accounts SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ message: 'Account updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const accountId = Number(req.params.id);
    const [result] = await pool.query('DELETE FROM accounts WHERE id = ? AND user_id = ?', [accountId, req.user.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Account not found.' });
    }
    res.json({ message: 'Account deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
