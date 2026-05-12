const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// Get all personal lendings for a user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT pl.*,
              pl.principal - COALESCE((SELECT SUM(lr.amount) FROM lending_repayments lr WHERE lr.personal_lending_id = pl.id), 0) AS outstanding_balance
       FROM personal_lendings pl
       WHERE pl.user_id = ? ORDER BY pl.given_date DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Get repayments for a specific lending
router.get('/:id/repayments', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM lending_repayments WHERE personal_lending_id = ? ORDER BY repayment_date DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Create a new personal lending
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { direction, counterparty_name, counterparty_phone, principal, annual_interest_rate = 0, given_date, expected_return_date, note, source_account_id } = req.body;
    if (!direction || !counterparty_name || !principal) return res.status(400).json({ error: 'direction, counterparty_name, and principal required.' });

    const [result] = await pool.query(
      `INSERT INTO personal_lendings (user_id, direction, counterparty_name, counterparty_phone, principal, annual_interest_rate, given_date, expected_return_date, status, note, source_account_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'outstanding', ?, ?)`,
      [req.user.id, direction, counterparty_name, counterparty_phone || null, Number(principal), Number(annual_interest_rate), given_date || null, expected_return_date || null, note || null, source_account_id || null]
    );

    res.json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

// Update personal lending
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const fields = ['direction','counterparty_name','counterparty_phone','principal','annual_interest_rate','given_date','expected_return_date','status','note','source_account_id'];
    const updates = []; const values = [];
    for (const f of fields) { if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); } }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update.' });
    values.push(req.params.id, req.user.id);
    await pool.query(`UPDATE personal_lendings SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Delete personal lending
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM personal_lendings WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Record repayment
router.post('/:id/repayment', requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { repayment_date, amount, note } = req.body;

    // Get lending details + computed outstanding balance
    const [lending] = await conn.query(
      `SELECT pl.*,
              pl.principal - COALESCE((SELECT SUM(lr.amount) FROM lending_repayments lr WHERE lr.personal_lending_id = pl.id), 0) AS outstanding_balance
       FROM personal_lendings pl
       WHERE pl.id = ? AND pl.user_id = ?`,
      [req.params.id, req.user.id]
    );

    if (!lending.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Lending not found' });
    }

    const currentBalance = parseFloat(lending[0].outstanding_balance);
    const repaymentAmount = parseFloat(amount);

    if (repaymentAmount > currentBalance) {
      await conn.rollback();
      return res.status(400).json({ error: 'Repayment amount exceeds outstanding balance' });
    }

    const newBalance = Math.round((currentBalance - repaymentAmount) * 100) / 100;
    const newStatus = newBalance === 0 ? 'settled' : 'partially_repaid';

    // Record repayment
    await conn.query(
      `INSERT INTO lending_repayments (personal_lending_id, repayment_date, amount, note)
       VALUES (?, ?, ?, ?)`,
      [req.params.id, repayment_date, amount, note || null]
    );

    // Update status only (outstanding is computed)
    await conn.query(
      'UPDATE personal_lendings SET status = ? WHERE id = ?',
      [newStatus, req.params.id]
    );

    await conn.commit();
    res.json({ outstanding_balance: newBalance, status: newStatus });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

module.exports = router;
