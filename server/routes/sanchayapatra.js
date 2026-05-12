const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// Get all sanchayapatra for a user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM sanchayapatra WHERE user_id = ? ORDER BY purchase_date DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Get interest payments for a specific sanchayapatra
router.get('/:id/interest-payments', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM sanchayapatra_interest_payments WHERE sanchayapatra_id = ? ORDER BY payment_date DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Create a new sanchayapatra
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, scheme_type, certificate_number, principal_amount, interest_rate, purchase_date, maturity_date } = req.body;

    // Calculate maturity value based on scheme type
    let maturity_value = null;
    const principal = parseFloat(principal_amount);
    const rate = parseFloat(interest_rate);

    if (scheme_type === '3_month_profit') {
      // 3-month profit scheme: compound interest every 3 months
      const months = Math.floor((new Date(maturity_date) - new Date(purchase_date)) / (1000 * 60 * 60 * 24 * 30));
      const periods = Math.floor(months / 3);
      maturity_value = principal * Math.pow(1 + (rate / 100) / 4, periods);
    } else if (scheme_type === '5_year_bangladesh') {
      // 5-year Bangladesh: compound interest annually
      const years = 5;
      maturity_value = principal * Math.pow(1 + (rate / 100), years);
    } else if (scheme_type === 'family_savings') {
      // Family savings: simple interest
      const months = Math.floor((new Date(maturity_date) - new Date(purchase_date)) / (1000 * 60 * 60 * 24 * 30));
      maturity_value = principal + (principal * (rate / 100) * (months / 12));
    } else if (scheme_type === 'pensioner') {
      // Pensioner: simple interest
      const months = Math.floor((new Date(maturity_date) - new Date(purchase_date)) / (1000 * 60 * 60 * 24 * 30));
      maturity_value = principal + (principal * (rate / 100) * (months / 12));
    } else if (scheme_type === 'wage_earner') {
      // Wage earner: compound interest annually
      const months = Math.floor((new Date(maturity_date) - new Date(purchase_date)) / (1000 * 60 * 60 * 24 * 30));
      const years = months / 12;
      maturity_value = principal * Math.pow(1 + (rate / 100), years);
    }

    const [result] = await pool.query(
      `INSERT INTO sanchayapatra (user_id, name, scheme_type, certificate_number, principal_amount, interest_rate, purchase_date, maturity_date, maturity_value, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [req.user.id, name, scheme_type, certificate_number, principal_amount, interest_rate, purchase_date, maturity_date, maturity_value]
    );

    res.json({ id: result.insertId, maturity_value });
  } catch (err) {
    next(err);
  }
});

// Update sanchayapatra
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, scheme_type, certificate_number, principal_amount, interest_rate, purchase_date, maturity_date, status } = req.body;

    await pool.query(
      `UPDATE sanchayapatra SET name = ?, scheme_type = ?, certificate_number = ?, principal_amount = ?, interest_rate = ?, purchase_date = ?, maturity_date = ?, status = ?
       WHERE id = ? AND user_id = ?`,
      [name, scheme_type, certificate_number, principal_amount, interest_rate, purchase_date, maturity_date, status, req.params.id, req.user.id]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Delete sanchayapatra
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM sanchayapatra WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Record interest payment
router.post('/:id/interest-payment', requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { payment_date, amount } = req.body;

    // Get sanchayapatra details
    const [sanchayapatra] = await conn.query(
      'SELECT * FROM sanchayapatra WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (!sanchayapatra.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Sanchayapatra not found' });
    }

    // Calculate cumulative interest and value
    const [lastPayment] = await conn.query(
      'SELECT cumulative_interest, cumulative_value FROM sanchayapatra_interest_payments WHERE sanchayapatra_id = ? ORDER BY payment_date DESC LIMIT 1',
      [req.params.id]
    );

    const cumulativeInterest = lastPayment.length ? parseFloat(lastPayment[0].cumulative_interest) + parseFloat(amount) : parseFloat(amount);
    const cumulativeValue = lastPayment.length ? parseFloat(lastPayment[0].cumulative_value) + parseFloat(amount) : parseFloat(sanchayapatra[0].principal_amount) + parseFloat(amount);

    await conn.query(
      `INSERT INTO sanchayapatra_interest_payments (sanchayapatra_id, payment_date, amount, cumulative_interest, cumulative_value)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, payment_date, amount, cumulativeInterest, cumulativeValue]
    );

    await conn.commit();
    res.json({ cumulativeInterest, cumulativeValue });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

module.exports = router;
