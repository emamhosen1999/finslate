const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// Get all bill payments for a user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { bill_id, status, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT bp.*, b.name as bill_name, b.type as bill_type, b.provider as bill_provider
      FROM bill_payments bp
      JOIN bills b ON bp.bill_id = b.id
      WHERE b.user_id = ?
    `;
    const params = [req.user.id];
    
    if (bill_id) {
      query += ' AND bp.bill_id = ?';
      params.push(bill_id);
    }
    
    if (status) {
      query += ' AND bp.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY bp.billing_month DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Get bill payment by ID
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT bp.*, b.name as bill_name, b.type as bill_type, b.provider as bill_provider
       FROM bill_payments bp
       JOIN bills b ON bp.bill_id = b.id
       WHERE bp.id = ? AND b.user_id = ?`,
      [req.params.id, req.user.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Bill payment not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Create bill payment
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const {
      bill_id,
      billing_month,
      amount,
      paid_date,
      meter_reading_previous,
      meter_reading_current,
      units_consumed,
      source_account_id,
      credit_card_id,
      receipt_attachment_id,
      status
    } = req.body;
    
    // Verify bill belongs to user
    const [bills] = await pool.query('SELECT id FROM bills WHERE id = ? AND user_id = ?', [bill_id, req.user.id]);
    if (bills.length === 0) {
      return res.status(404).json({ error: 'Bill not found' });
    }
    
    const [result] = await pool.query(
      `INSERT INTO bill_payments 
       (bill_id, billing_month, amount, paid_date, meter_reading_previous, meter_reading_current, 
        units_consumed, source_account_id, credit_card_id, receipt_attachment_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [bill_id, billing_month, amount, paid_date, meter_reading_previous, meter_reading_current,
       units_consumed, source_account_id, credit_card_id, receipt_attachment_id, status || 'upcoming']
    );
    
    res.status(201).json({ id: result.insertId, ...req.body });
  } catch (err) {
    next(err);
  }
});

// Update bill payment
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const {
      billing_month,
      amount,
      paid_date,
      meter_reading_previous,
      meter_reading_current,
      units_consumed,
      source_account_id,
      credit_card_id,
      receipt_attachment_id,
      status
    } = req.body;
    
    // Verify payment belongs to user
    const [payments] = await pool.query(
      `SELECT bp.id FROM bill_payments bp
       JOIN bills b ON bp.bill_id = b.id
       WHERE bp.id = ? AND b.user_id = ?`,
      [req.params.id, req.user.id]
    );
    
    if (payments.length === 0) {
      return res.status(404).json({ error: 'Bill payment not found' });
    }
    
    await pool.query(
      `UPDATE bill_payments 
       SET billing_month = ?, amount = ?, paid_date = ?, meter_reading_previous = ?, 
           meter_reading_current = ?, units_consumed = ?, source_account_id = ?, 
           credit_card_id = ?, receipt_attachment_id = ?, status = ?
       WHERE id = ?`,
      [billing_month, amount, paid_date, meter_reading_previous, meter_reading_current,
       units_consumed, source_account_id, credit_card_id, receipt_attachment_id, status, req.params.id]
    );
    
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Delete bill payment
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const [result] = await pool.query(
      `DELETE bp FROM bill_payments bp
       JOIN bills b ON bp.bill_id = b.id
       WHERE bp.id = ? AND b.user_id = ?`,
      [req.params.id, req.user.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Bill payment not found' });
    }
    
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
