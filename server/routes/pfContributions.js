const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// Get all PF contributions for a user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { provident_fund_id, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT pfc.*, pf.employer_name, a.name as account_name
      FROM pf_contributions pfc
      JOIN provident_fund pf ON pfc.provident_fund_id = pf.id
      LEFT JOIN accounts a ON pf.account_id = a.id
      WHERE pf.user_id = ?
    `;
    const params = [req.user.id];
    
    if (provident_fund_id) {
      query += ' AND pfc.provident_fund_id = ?';
      params.push(provident_fund_id);
    }
    
    query += ' ORDER BY pfc.period DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Get PF contribution by ID
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT pfc.*, pf.employer_name, a.name as account_name
       FROM pf_contributions pfc
       JOIN provident_fund pf ON pfc.provident_fund_id = pf.id
       LEFT JOIN accounts a ON pf.account_id = a.id
       WHERE pfc.id = ? AND pf.user_id = ?`,
      [req.params.id, req.user.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'PF contribution not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Create PF contribution
router.post('/', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const {
      provident_fund_id,
      period,
      employee_amount,
      employer_amount,
      interest_credited,
      cumulative_corpus,
      note
    } = req.body;
    
    // Verify PF belongs to user
    const [pf] = await connection.query('SELECT id, current_corpus, employee_corpus, employer_corpus FROM provident_fund WHERE id = ? AND user_id = ?', [provident_fund_id, req.user.id]);
    if (pf.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Provident fund not found' });
    }
    
    // Insert contribution
    const [result] = await connection.query(
      `INSERT INTO pf_contributions 
       (provident_fund_id, period, employee_amount, employer_amount, interest_credited, cumulative_corpus, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [provident_fund_id, period, employee_amount, employer_amount, interest_credited, cumulative_corpus, note]
    );
    
    // Update PF corpus values
    await connection.query(
      `UPDATE provident_fund 
       SET current_corpus = ?, 
           employee_corpus = employee_corpus + ?, 
           employer_corpus = employer_corpus + ?
       WHERE id = ?`,
      [cumulative_corpus, employee_amount, employer_amount, provident_fund_id]
    );
    
    await connection.commit();
    res.status(201).json({ id: result.insertId, ...req.body });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// Update PF contribution
router.put('/:id', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const {
      period,
      employee_amount,
      employer_amount,
      interest_credited,
      cumulative_corpus,
      note
    } = req.body;
    
    // Get current contribution and PF data
    const [current] = await connection.query(
      `SELECT pfc.*, pf.current_corpus as pf_corpus, pf.employee_corpus as pf_employee, pf.employer_corpus as pf_employer
       FROM pf_contributions pfc
       JOIN provident_fund pf ON pfc.provident_fund_id = pf.id
       WHERE pfc.id = ? AND pf.user_id = ?`,
      [req.params.id, req.user.id]
    );
    
    if (current.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'PF contribution not found' });
    }
    
    // Calculate differences to update PF corpus
    const employeeDiff = employee_amount - current[0].employee_amount;
    const employerDiff = employer_amount - current[0].employer_amount;
    
    // Update contribution
    await connection.query(
      `UPDATE pf_contributions 
       SET period = ?, employee_amount = ?, employer_amount = ?, interest_credited = ?, cumulative_corpus = ?, note = ?
       WHERE id = ?`,
      [period, employee_amount, employer_amount, interest_credited, cumulative_corpus, note, req.params.id]
    );
    
    // Update PF corpus values with differences
    await connection.query(
      `UPDATE provident_fund 
       SET current_corpus = current_corpus + ?,
           employee_corpus = employee_corpus + ?,
           employer_corpus = employer_corpus + ?
       WHERE id = ?`,
      [cumulative_corpus - current[0].cumulative_corpus, employeeDiff, employerDiff, current[0].provident_fund_id]
    );
    
    await connection.commit();
    res.json({ ok: true });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// Delete PF contribution
router.delete('/:id', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Get contribution to reverse corpus update
    const [current] = await connection.query(
      `SELECT pfc.*, pf.current_corpus as pf_corpus, pf.employee_corpus as pf_employee, pf.employer_corpus as pf_employer
       FROM pf_contributions pfc
       JOIN provident_fund pf ON pfc.provident_fund_id = pf.id
       WHERE pfc.id = ? AND pf.user_id = ?`,
      [req.params.id, req.user.id]
    );
    
    if (current.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'PF contribution not found' });
    }
    
    // Delete contribution
    const [result] = await connection.query(
      `DELETE pfc FROM pf_contributions pfc
       JOIN provident_fund pf ON pfc.provident_fund_id = pf.id
       WHERE pfc.id = ? AND pf.user_id = ?`,
      [req.params.id, req.user.id]
    );
    
    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'PF contribution not found' });
    }
    
    // Reverse corpus update
    await connection.query(
      `UPDATE provident_fund 
       SET current_corpus = current_corpus - ?,
           employee_corpus = employee_corpus - ?,
           employer_corpus = employer_corpus - ?
       WHERE id = ?`,
      [current[0].cumulative_corpus, current[0].employee_amount, current[0].employer_amount, current[0].provident_fund_id]
    );
    
    await connection.commit();
    res.json({ ok: true });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

module.exports = router;
