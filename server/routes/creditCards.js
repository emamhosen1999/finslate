const express = require('express');
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, limit_amt, due_amount, due_date, created_at FROM credit_cards WHERE user_id = ? ORDER BY id',
      [req.user.id],
    );
    res.json({ creditCards: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
