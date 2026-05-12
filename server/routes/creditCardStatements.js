const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// Get all credit card statements for a user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { credit_card_id, status, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT ccs.*, cc.card_name, cc.credit_limit
      FROM credit_card_statements ccs
      JOIN credit_cards cc ON ccs.credit_card_id = cc.id
      WHERE cc.user_id = ?
    `;
    const params = [req.user.id];
    
    if (credit_card_id) {
      query += ' AND ccs.credit_card_id = ?';
      params.push(credit_card_id);
    }
    
    if (status) {
      query += ' AND ccs.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY ccs.statement_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Get credit card statement by ID
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT ccs.*, cc.card_name, cc.credit_limit
       FROM credit_card_statements ccs
       JOIN credit_cards cc ON ccs.credit_card_id = cc.id
       WHERE ccs.id = ? AND cc.user_id = ?`,
      [req.params.id, req.user.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Credit card statement not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Create credit card statement
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const {
      credit_card_id,
      statement_date,
      due_date,
      opening_balance,
      total_purchases,
      total_credits,
      total_payments,
      interest_charged,
      late_fee,
      other_charges,
      closing_balance,
      minimum_due,
      status,
      pdf_attachment_id
    } = req.body;
    
    // Verify credit card belongs to user
    const [cards] = await pool.query('SELECT id FROM credit_cards WHERE id = ? AND user_id = ?', [credit_card_id, req.user.id]);
    if (cards.length === 0) {
      return res.status(404).json({ error: 'Credit card not found' });
    }
    
    const [result] = await pool.query(
      `INSERT INTO credit_card_statements 
       (credit_card_id, statement_date, due_date, opening_balance, total_purchases, total_credits,
        total_payments, interest_charged, late_fee, other_charges, closing_balance, minimum_due,
        status, pdf_attachment_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [credit_card_id, statement_date, due_date, opening_balance, total_purchases, total_credits,
       total_payments, interest_charged, late_fee, other_charges, closing_balance, minimum_due,
       status || 'pending', pdf_attachment_id]
    );
    
    res.status(201).json({ id: result.insertId, ...req.body });
  } catch (err) {
    next(err);
  }
});

// Update credit card statement
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const {
      statement_date,
      due_date,
      opening_balance,
      total_purchases,
      total_credits,
      total_payments,
      interest_charged,
      late_fee,
      other_charges,
      closing_balance,
      minimum_due,
      status,
      pdf_attachment_id
    } = req.body;
    
    // Verify statement belongs to user
    const [statements] = await pool.query(
      `SELECT ccs.id FROM credit_card_statements ccs
       JOIN credit_cards cc ON ccs.credit_card_id = cc.id
       WHERE ccs.id = ? AND cc.user_id = ?`,
      [req.params.id, req.user.id]
    );
    
    if (statements.length === 0) {
      return res.status(404).json({ error: 'Credit card statement not found' });
    }
    
    await pool.query(
      `UPDATE credit_card_statements 
       SET statement_date = ?, due_date = ?, opening_balance = ?, total_purchases = ?,
           total_credits = ?, total_payments = ?, interest_charged = ?, late_fee = ?,
           other_charges = ?, closing_balance = ?, minimum_due = ?, status = ?, pdf_attachment_id = ?
       WHERE id = ?`,
      [statement_date, due_date, opening_balance, total_purchases, total_credits, total_payments,
       interest_charged, late_fee, other_charges, closing_balance, minimum_due, status, pdf_attachment_id, req.params.id]
    );
    
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Delete credit card statement
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const [result] = await pool.query(
      `DELETE ccs FROM credit_card_statements ccs
       JOIN credit_cards cc ON ccs.credit_card_id = cc.id
       WHERE ccs.id = ? AND cc.user_id = ?`,
      [req.params.id, req.user.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Credit card statement not found' });
    }
    
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
