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

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, limit_amt, due_date } = req.body;
    if (!name || !limit_amt) {
      return res.status(400).json({ error: 'Name and limit are required.' });
    }
    const [result] = await pool.query(
      'INSERT INTO credit_cards (user_id, name, limit_amt, due_amount, due_date) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, name.trim(), Number(limit_amt), 0, due_date || null],
    );
    res.status(201).json({
      id: result.insertId,
      name: name.trim(),
      limit_amt: Number(limit_amt),
      due_amount: 0,
      due_date: due_date || null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
