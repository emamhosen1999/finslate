const express = require('express');
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, principal, remaining, monthly_emi, interest_rate, created_at FROM loans WHERE user_id = ? ORDER BY id',
      [req.user.id],
    );
    res.json({ loans: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
