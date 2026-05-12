const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// Get all DPS payments for a user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { dps_id, status, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT dp.*, d.name as dps_name, d.monthly_amount, a.name as account_name
      FROM dps_payments dp
      JOIN dps d ON dp.dps_id = d.id
      LEFT JOIN accounts a ON dp.source_account_id = a.id
      WHERE d.user_id = ?
    `;
    const params = [req.user.id];
    
    if (dps_id) {
      query += ' AND dp.dps_id = ?';
      params.push(dps_id);
    }
    
    if (status) {
      query += ' AND dp.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY dp.due_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Get DPS payment by ID
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT dp.*, d.name as dps_name, d.monthly_amount, a.name as account_name
       FROM dps_payments dp
       JOIN dps d ON dp.dps_id = d.id
       LEFT JOIN accounts a ON dp.source_account_id = a.id
       WHERE dp.id = ? AND d.user_id = ?`,
      [req.params.id, req.user.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'DPS payment not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Create DPS payment
router.post('/', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const {
      dps_id,
      installment_no,
      due_date,
      paid_date,
      amount,
      penalty,
      source_account_id,
      receipt_attachment_id,
      status
    } = req.body;
    
    // Verify DPS belongs to user
    const [dps] = await connection.query('SELECT id, total_deposited FROM dps WHERE id = ? AND user_id = ?', [dps_id, req.user.id]);
    if (dps.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'DPS not found' });
    }
    
    // Verify account belongs to user if provided
    if (source_account_id) {
      const [accounts] = await connection.query('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [source_account_id, req.user.id]);
      if (accounts.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Account not found' });
      }
    }
    
    // Insert payment
    const [result] = await connection.query(
      `INSERT INTO dps_payments 
       (dps_id, installment_no, due_date, paid_date, amount, penalty, source_account_id, receipt_attachment_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [dps_id, installment_no, due_date, paid_date, amount, penalty, source_account_id, receipt_attachment_id, status || 'pending']
    );
    
    // If paid, update DPS total_deposited
    if (status === 'paid' && paid_date) {
      await connection.query(
        'UPDATE dps SET total_deposited = total_deposited + ? WHERE id = ?',
        [amount, dps_id]
      );
    }
    
    // Create transaction if account provided and paid
    if (source_account_id && status === 'paid') {
      await connection.query(
        `INSERT INTO transactions (user_id, account_id, type, amount, category, description, ref_type, ref_id)
         VALUES (?, ?, 'debit', ?, 'Savings', 'DPS installment', 'dps_payment', ?)`,
        [req.user.id, source_account_id, amount, result.insertId]
      );
      
      // Update account balance
      await connection.query(
        'UPDATE accounts SET balance = balance - ? WHERE id = ?',
        [amount, source_account_id]
      );
    }
    
    await connection.commit();
    res.status(201).json({ id: result.insertId, ...req.body });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// Update DPS payment
router.put('/:id', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const {
      installment_no,
      due_date,
      paid_date,
      amount,
      penalty,
      source_account_id,
      receipt_attachment_id,
      status
    } = req.body;
    
    // Get current payment to check status change
    const [current] = await connection.query(
      `SELECT dp.*, d.total_deposited as dps_total
       FROM dps_payments dp
       JOIN dps d ON dp.dps_id = d.id
       WHERE dp.id = ? AND d.user_id = ?`,
      [req.params.id, req.user.id]
    );
    
    if (current.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'DPS payment not found' });
    }
    
    // Update payment
    await connection.query(
      `UPDATE dps_payments 
       SET installment_no = ?, due_date = ?, paid_date = ?, amount = ?, penalty = ?,
           source_account_id = ?, receipt_attachment_id = ?, status = ?
       WHERE id = ?`,
      [installment_no, due_date, paid_date, amount, penalty, source_account_id, receipt_attachment_id, status, req.params.id]
    );
    
    // If status changed to paid, update DPS total_deposited
    if (current[0].status !== 'paid' && status === 'paid' && paid_date) {
      await connection.query(
        'UPDATE dps SET total_deposited = total_deposited + ? WHERE id = ?',
        [amount, current[0].dps_id]
      );
    }
    
    await connection.commit();
    res.json({ ok: true });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// Delete DPS payment
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const [result] = await pool.query(
      `DELETE dp FROM dps_payments dp
       JOIN dps d ON dp.dps_id = d.id
       WHERE dp.id = ? AND d.user_id = ?`,
      [req.params.id, req.user.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'DPS payment not found' });
    }
    
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
