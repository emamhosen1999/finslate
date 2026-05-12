const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// Get all provident funds for a user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM provident_fund WHERE user_id = ? ORDER BY start_date DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Create a new provident fund
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { employer_name, employee_id, monthly_contribution, employer_contribution, start_date, account_id } = req.body;

    const [result] = await pool.query(
      `INSERT INTO provident_fund (user_id, employer_name, employee_id, monthly_contribution, employer_contribution, start_date, account_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [req.user.id, employer_name, employee_id, monthly_contribution, employer_contribution, start_date, account_id]
    );

    res.json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

// Update provident fund
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { employer_name, employee_id, monthly_contribution, employer_contribution, start_date, account_id, status } = req.body;

    await pool.query(
      `UPDATE provident_fund SET employer_name = ?, employee_id = ?, monthly_contribution = ?, employer_contribution = ?, start_date = ?, account_id = ?, status = ?
       WHERE id = ? AND user_id = ?`,
      [employer_name, employee_id, monthly_contribution, employer_contribution, start_date, account_id, status, req.params.id, req.user.id]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Delete provident fund
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM provident_fund WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
