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

module.exports = router;
