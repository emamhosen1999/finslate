const express = require('express');
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const filters = ['t.user_id = ?'];
    const args = [userId];

    if (req.query.category) {
      filters.push('t.category = ?');
      args.push(String(req.query.category));
    }
    if (req.query.type === 'credit' || req.query.type === 'debit') {
      filters.push('t.type = ?');
      args.push(req.query.type);
    }
    if (req.query.accountId) {
      filters.push('t.account_id = ?');
      args.push(Number(req.query.accountId));
    }
    if (req.query.from) {
      filters.push('t.created_at >= ?');
      args.push(String(req.query.from));
    }
    if (req.query.to) {
      // <input type="date"> sends YYYY-MM-DD; widen it to end-of-day so the
      // selected end date is inclusive of all transactions on that day.
      filters.push('t.created_at <= ?');
      args.push(`${String(req.query.to)} 23:59:59`);
    }

    const where = `WHERE ${filters.join(' AND ')}`;

    const [rows] = await pool.query(
      `SELECT t.id, t.account_id, a.name AS account_name, t.type, t.amount, t.category,
              t.description, t.ref_type, t.ref_id, t.created_at
         FROM transactions t
         LEFT JOIN accounts a ON a.id = t.account_id
         ${where}
         ORDER BY t.created_at DESC, t.id DESC
         LIMIT ? OFFSET ?`,
      [...args, pageSize, offset],
    );

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM transactions t ${where}`,
      args,
    );

    res.json({
      transactions: rows,
      page,
      pageSize,
      total: countRows[0].total,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { account_id, type, amount, category, description } = req.body;
    if (!account_id || !type || !amount || !category) {
      return res.status(400).json({ error: 'Account, type, amount, and category are required.' });
    }
    if (!['credit', 'debit'].includes(type)) {
      return res.status(400).json({ error: 'Type must be credit or debit.' });
    }
    const [result] = await pool.query(
      'INSERT INTO transactions (user_id, account_id, type, amount, category, description) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, Number(account_id), type, Number(amount), category.trim(), description?.trim() || null],
    );
    res.status(201).json({
      id: result.insertId,
      account_id: Number(account_id),
      type,
      amount: Number(amount),
      category: category.trim(),
      description: description?.trim() || null,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { account_id, type, amount, category, description } = req.body;
    const txId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM transactions WHERE id = ? AND user_id = ?', [txId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }
    const updates = [];
    const values = [];
    if (account_id !== undefined) {
      updates.push('account_id = ?');
      values.push(Number(account_id));
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
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }
    values.push(txId, req.user.id);
    await pool.query(`UPDATE transactions SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ message: 'Transaction updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const txId = Number(req.params.id);
    const [result] = await pool.query('DELETE FROM transactions WHERE id = ? AND user_id = ?', [txId, req.user.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }
    res.json({ message: 'Transaction deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
