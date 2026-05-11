const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM fixed_deposits WHERE user_id = ? ORDER BY maturity_date ASC',
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, principal, interest_rate, start_date, maturity_date } = req.body;
    if (!name || !principal || !interest_rate || !start_date || !maturity_date) {
      return res.status(400).json({ error: 'Name, principal, interest rate, start date, and maturity date are required.' });
    }
    const [result] = await pool.query(
      'INSERT INTO fixed_deposits (user_id, name, principal, interest_rate, start_date, maturity_date) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, name.trim(), Number(principal), Number(interest_rate), start_date, maturity_date],
    );
    res.status(201).json({
      id: result.insertId,
      name: name.trim(),
      principal: Number(principal),
      interest_rate: Number(interest_rate),
      start_date,
      maturity_date,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, principal, interest_rate, start_date, maturity_date, maturity_amount } = req.body;
    const fdId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM fixed_deposits WHERE id = ? AND user_id = ?', [fdId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Fixed deposit not found.' });
    }
    const updates = [];
    const values = [];
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (principal !== undefined) {
      updates.push('principal = ?');
      values.push(Number(principal));
    }
    if (interest_rate !== undefined) {
      updates.push('interest_rate = ?');
      values.push(Number(interest_rate));
    }
    if (start_date !== undefined) {
      updates.push('start_date = ?');
      values.push(start_date);
    }
    if (maturity_date !== undefined) {
      updates.push('maturity_date = ?');
      values.push(maturity_date);
    }
    if (maturity_amount !== undefined) {
      updates.push('maturity_amount = ?');
      values.push(maturity_amount || null);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }
    values.push(fdId, req.user.id);
    await pool.query(`UPDATE fixed_deposits SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ message: 'Fixed deposit updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const fdId = Number(req.params.id);
    const [result] = await pool.query('DELETE FROM fixed_deposits WHERE id = ? AND user_id = ?', [fdId, req.user.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Fixed deposit not found.' });
    }
    res.json({ message: 'Fixed deposit deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
