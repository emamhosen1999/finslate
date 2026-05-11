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

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, principal, monthly_emi, interest_rate } = req.body;
    if (!name || !principal || !monthly_emi) {
      return res.status(400).json({ error: 'Name, principal, and monthly EMI are required.' });
    }
    const principalNum = Number(principal);
    const [result] = await pool.query(
      'INSERT INTO loans (user_id, name, principal, remaining, monthly_emi, interest_rate) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, name.trim(), principalNum, principalNum, Number(monthly_emi), interest_rate || null],
    );
    res.status(201).json({
      id: result.insertId,
      name: name.trim(),
      principal: principalNum,
      remaining: principalNum,
      monthly_emi: Number(monthly_emi),
      interest_rate: interest_rate || null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
