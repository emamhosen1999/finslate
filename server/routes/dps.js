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

module.exports = router;
