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
      filters.push('t.created_at <= ?');
      args.push(String(req.query.to));
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

module.exports = router;
