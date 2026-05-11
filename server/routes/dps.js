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

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, monthly_amount, maturity_amount, start_date, maturity_date } = req.body;
    if (!name || !monthly_amount) {
      return res.status(400).json({ error: 'Name and monthly amount are required.' });
    }
    const [result] = await pool.query(
      'INSERT INTO dps (user_id, name, monthly_amount, total_deposited, maturity_amount, start_date, maturity_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, name.trim(), Number(monthly_amount), 0, maturity_amount || null, start_date || null, maturity_date || null],
    );
    res.status(201).json({
      id: result.insertId,
      name: name.trim(),
      monthly_amount: Number(monthly_amount),
      total_deposited: 0,
      maturity_amount: maturity_amount || null,
      start_date: start_date || null,
      maturity_date: maturity_date || null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
