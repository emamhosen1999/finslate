const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// Get all subscriptions for a user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY next_billing ASC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Create a new subscription
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, service_name, amount, billing_cycle, start_date, account_id } = req.body;

    // Calculate next billing date
    const startDate = new Date(start_date);
    let nextBilling = new Date(startDate);
    
    switch (billing_cycle) {
      case 'monthly':
        nextBilling.setMonth(nextBilling.getMonth() + 1);
        break;
      case 'quarterly':
        nextBilling.setMonth(nextBilling.getMonth() + 3);
        break;
      case 'yearly':
        nextBilling.setFullYear(nextBilling.getFullYear() + 1);
        break;
      default:
        nextBilling.setMonth(nextBilling.getMonth() + 1);
    }

    const [result] = await pool.query(
      `INSERT INTO subscriptions (user_id, name, service_name, amount, billing_cycle, start_date, next_billing, account_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [req.user.id, name, service_name, amount, billing_cycle, start_date, nextBilling.toISOString().split('T')[0], account_id]
    );

    res.json({ id: result.insertId, next_billing: nextBilling.toISOString().split('T')[0] });
  } catch (err) {
    next(err);
  }
});

// Update subscription
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, service_name, amount, billing_cycle, start_date, account_id, status } = req.body;

    await pool.query(
      `UPDATE subscriptions SET name = ?, service_name = ?, amount = ?, billing_cycle = ?, start_date = ?, account_id = ?, status = ?
       WHERE id = ? AND user_id = ?`,
      [name, service_name, amount, billing_cycle, start_date, account_id, status, req.params.id, req.user.id]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Delete subscription
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM subscriptions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Process subscription payment
router.post('/:id/process', requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { account_id, payment_date } = req.body;

    // Get subscription details
    const [subscriptions] = await conn.query(
      'SELECT * FROM subscriptions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (!subscriptions.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const sub = subscriptions[0];

    if (sub.status !== 'active') {
      await conn.rollback();
      return res.status(400).json({ error: 'Subscription is not active' });
    }

    // Create transaction
    await conn.query(
      `INSERT INTO transactions (user_id, account_id, type, amount, category, description, ref_type, ref_id, created_at)
       VALUES (?, ?, 'debit', ?, 'Subscription', ?, 'subscription', ?, ?)`,
      [req.user.id, account_id || sub.account_id, sub.amount, sub.name, req.params.id, payment_date]
    );

    // Update account balance
    if (account_id || sub.account_id) {
      await conn.query(
        'UPDATE accounts SET balance = balance - ? WHERE id = ?',
        [sub.amount, account_id || sub.account_id]
      );
    }

    // Calculate next billing date
    const currentNextBilling = new Date(sub.next_billing);
    let nextBilling = new Date(currentNextBilling);
    
    switch (sub.billing_cycle) {
      case 'monthly':
        nextBilling.setMonth(nextBilling.getMonth() + 1);
        break;
      case 'quarterly':
        nextBilling.setMonth(nextBilling.getMonth() + 3);
        break;
      case 'yearly':
        nextBilling.setFullYear(nextBilling.getFullYear() + 1);
        break;
      default:
        nextBilling.setMonth(nextBilling.getMonth() + 1);
    }

    // Update next billing date
    await conn.query(
      'UPDATE subscriptions SET next_billing = ? WHERE id = ?',
      [nextBilling.toISOString().split('T')[0], req.params.id]
    );

    await conn.commit();
    res.json({ ok: true, next_billing: nextBilling.toISOString().split('T')[0] });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

module.exports = router;
