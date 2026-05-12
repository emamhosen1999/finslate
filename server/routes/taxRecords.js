const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// Get all tax records for a user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM tax_records WHERE user_id = ? ORDER BY tax_year DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Create a new tax record
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { tax_year, income_type, gross_income, tax_deducted, tax_paid, tax_due, notes } = req.body;

    const [result] = await pool.query(
      `INSERT INTO tax_records (user_id, tax_year, income_type, gross_income, tax_deducted, tax_paid, tax_due, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [req.user.id, tax_year, income_type, gross_income, tax_deducted || 0, tax_paid || 0, tax_due, notes]
    );

    res.json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

// Update tax record
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { tax_year, income_type, gross_income, tax_deducted, tax_paid, tax_due, status, filing_date, payment_date, notes } = req.body;

    await pool.query(
      `UPDATE tax_records SET tax_year = ?, income_type = ?, gross_income = ?, tax_deducted = ?, tax_paid = ?, tax_due = ?, status = ?, filing_date = ?, payment_date = ?, notes = ?
       WHERE id = ? AND user_id = ?`,
      [tax_year, income_type, gross_income, tax_deducted, tax_paid, tax_due, status, filing_date, payment_date, notes, req.params.id, req.user.id]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Delete tax record
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM tax_records WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Mark as filed
router.post('/:id/file', requireAuth, async (req, res, next) => {
  try {
    const { filing_date } = req.body;
    await pool.query(
      'UPDATE tax_records SET status = ?, filing_date = ? WHERE id = ? AND user_id = ?',
      ['filed', filing_date || new Date().toISOString().split('T')[0], req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Mark as paid
router.post('/:id/pay', requireAuth, async (req, res, next) => {
  try {
    const { payment_date } = req.body;
    await pool.query(
      'UPDATE tax_records SET status = ?, payment_date = ? WHERE id = ? AND user_id = ?',
      ['paid', payment_date || new Date().toISOString().split('T')[0], req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
