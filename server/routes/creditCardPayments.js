const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// Get all credit card payments for a user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { credit_card_id, statement_id, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT ccp.*, cc.card_name, a.name as account_name
      FROM credit_card_payments ccp
      JOIN credit_cards cc ON ccp.credit_card_id = cc.id
      LEFT JOIN accounts a ON ccp.paid_from_account_id = a.id
      WHERE cc.user_id = ?
    `;
    const params = [req.user.id];
    
    if (credit_card_id) {
      query += ' AND ccp.credit_card_id = ?';
      params.push(credit_card_id);
    }
    
    if (statement_id) {
      query += ' AND ccp.statement_id = ?';
      params.push(statement_id);
    }
    
    query += ' ORDER BY ccp.payment_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Get credit card payment by ID
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT ccp.*, cc.card_name, a.name as account_name
       FROM credit_card_payments ccp
       JOIN credit_cards cc ON ccp.credit_card_id = cc.id
       LEFT JOIN accounts a ON ccp.paid_from_account_id = a.id
       WHERE ccp.id = ? AND cc.user_id = ?`,
      [req.params.id, req.user.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Credit card payment not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Create credit card payment
router.post('/', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const {
      credit_card_id,
      statement_id,
      paid_from_account_id,
      amount,
      payment_type,
      payment_date,
      reference_no,
      note
    } = req.body;
    
    // Verify credit card belongs to user
    const [cards] = await connection.query('SELECT id, current_outstanding, card_name FROM credit_cards WHERE id = ? AND user_id = ?', [credit_card_id, req.user.id]);
    if (cards.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Credit card not found' });
    }
    
    // Verify account belongs to user if provided
    if (paid_from_account_id) {
      const [accounts] = await connection.query('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [paid_from_account_id, req.user.id]);
      if (accounts.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Account not found' });
      }
    }
    
    // Insert payment
    const [result] = await connection.query(
      `INSERT INTO credit_card_payments 
       (credit_card_id, statement_id, paid_from_account_id, amount, payment_type, payment_date, reference_no, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [credit_card_id, statement_id, paid_from_account_id, amount, payment_type, payment_date, reference_no, note]
    );
    
    // Update credit card outstanding
    await connection.query(
      'UPDATE credit_cards SET current_outstanding = GREATEST(0, current_outstanding - ?) WHERE id = ?',
      [amount, credit_card_id]
    );
    
    // Create transaction if account provided
    if (paid_from_account_id) {
      await connection.query(
        `INSERT INTO transactions (user_id, account_id, type, amount, currency, transaction_date, category_id, source_type, source_id, payee, notes)
         VALUES (?, ?, 'expense', ?, 'BDT', ?, 'Credit Card Payment', 'account', ?, ?, ?)`,
        [req.user.id, paid_from_account_id, amount, payment_date || new Date().toISOString().slice(0,10), result.insertId, cards[0].card_name, `CC payment - ${reference_no || 'Manual'}`]
      );
      
      // Update account balance
      await connection.query(
        'UPDATE accounts SET current_balance = current_balance - ? WHERE id = ? AND user_id = ?',
        [amount, paid_from_account_id, req.user.id]
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

// Update credit card payment
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const {
      statement_id,
      paid_from_account_id,
      amount,
      payment_type,
      payment_date,
      reference_no,
      note
    } = req.body;
    
    // Verify payment belongs to user
    const [payments] = await pool.query(
      `SELECT ccp.id FROM credit_card_payments ccp
       JOIN credit_cards cc ON ccp.credit_card_id = cc.id
       WHERE ccp.id = ? AND cc.user_id = ?`,
      [req.params.id, req.user.id]
    );
    
    if (payments.length === 0) {
      return res.status(404).json({ error: 'Credit card payment not found' });
    }
    
    await pool.query(
      `UPDATE credit_card_payments 
       SET statement_id = ?, paid_from_account_id = ?, amount = ?, payment_type = ?,
           payment_date = ?, reference_no = ?, note = ?
       WHERE id = ?`,
      [statement_id, paid_from_account_id, amount, payment_type, payment_date, reference_no, note, req.params.id]
    );
    
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Delete credit card payment
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const [result] = await pool.query(
      `DELETE ccp FROM credit_card_payments ccp
       JOIN credit_cards cc ON ccp.credit_card_id = cc.id
       WHERE ccp.id = ? AND cc.user_id = ?`,
      [req.params.id, req.user.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Credit card payment not found' });
    }
    
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
