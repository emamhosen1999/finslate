const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// Get all personal lendings for a user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM personal_lendings WHERE user_id = ? ORDER BY start_date DESC',
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
      'SELECT * FROM lending_repayments WHERE lending_id = ? ORDER BY repayment_date DESC',
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
    const { direction, counterparty_name, counterparty_contact, principal_amount, interest_rate, start_date, due_date, notes } = req.body;

    const [result] = await pool.query(
      `INSERT INTO personal_lendings (user_id, direction, counterparty_name, counterparty_contact, principal_amount, outstanding_balance, interest_rate, start_date, due_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [req.user.id, direction, counterparty_name, counterparty_contact, principal_amount, principal_amount, interest_rate, start_date, due_date, notes]
    );

    res.json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

// Update personal lending
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { direction, counterparty_name, counterparty_contact, principal_amount, interest_rate, start_date, due_date, status, notes } = req.body;

    await pool.query(
      `UPDATE personal_lendings SET direction = ?, counterparty_name = ?, counterparty_contact = ?, principal_amount = ?, interest_rate = ?, start_date = ?, due_date = ?, status = ?, notes = ?
       WHERE id = ? AND user_id = ?`,
      [direction, counterparty_name, counterparty_contact, principal_amount, interest_rate, start_date, due_date, status, notes, req.params.id, req.user.id]
    );

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

    const { repayment_date, amount, notes } = req.body;

    // Get lending details
    const [lending] = await conn.query(
      'SELECT * FROM personal_lendings WHERE id = ? AND user_id = ?',
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

    const newBalance = currentBalance - repaymentAmount;
    const newStatus = newBalance === 0 ? 'settled' : 'partial';

    // Record repayment
    await conn.query(
      `INSERT INTO lending_repayments (lending_id, repayment_date, amount, notes)
       VALUES (?, ?, ?, ?)`,
      [req.params.id, repayment_date, amount, notes]
    );

    // Update outstanding balance and status
    await conn.query(
      'UPDATE personal_lendings SET outstanding_balance = ?, status = ? WHERE id = ?',
      [newBalance, newStatus, req.params.id]
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
