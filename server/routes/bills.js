const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// Get all bills for a user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM bills WHERE user_id = ? ORDER BY due_date ASC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Create a new bill
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, type, provider, amount, due_date, frequency, account_id } = req.body;

    const [result] = await pool.query(
      `INSERT INTO bills (user_id, name, type, provider, amount, due_date, frequency, account_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [req.user.id, name, type, provider, amount, due_date, frequency, account_id]
    );

    res.json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

// Update bill
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, type, provider, amount, due_date, frequency, account_id, status } = req.body;

    await pool.query(
      `UPDATE bills SET name = ?, type = ?, provider = ?, amount = ?, due_date = ?, frequency = ?, account_id = ?, status = ?
       WHERE id = ? AND user_id = ?`,
      [name, type, provider, amount, due_date, frequency, account_id, status, req.params.id, req.user.id]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Delete bill
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM bills WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Mark bill as paid
router.post('/:id/pay', requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { account_id, payment_date } = req.body;

    // Get bill details
    const [bills] = await conn.query(
      'SELECT * FROM bills WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (!bills.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Bill not found' });
    }

    const bill = bills[0];

    if (bill.status === 'paid') {
      await conn.rollback();
      return res.status(400).json({ error: 'Bill already paid' });
    }

    // Create transaction
    await conn.query(
      `INSERT INTO transactions (user_id, account_id, type, amount, category, description, ref_type, ref_id, created_at)
       VALUES (?, ?, 'debit', ?, 'Bill', ?, 'bill', ?, ?)`,
      [req.user.id, account_id || bill.account_id, bill.amount, bill.name, req.params.id, payment_date]
    );

    // Update account balance
    if (account_id || bill.account_id) {
      await conn.query(
        'UPDATE accounts SET balance = balance - ? WHERE id = ?',
        [bill.amount, account_id || bill.account_id]
      );
    }

    // Update bill status
    await conn.query(
      'UPDATE bills SET status = ? WHERE id = ?',
      ['paid', req.params.id]
    );

    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

module.exports = router;
