const express = require('express');
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, limit_amt, due_amount, due_date, created_at FROM credit_cards WHERE user_id = ? ORDER BY id',
      [req.user.id],
    );
    res.json({ creditCards: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, limit_amt, due_date } = req.body;
    if (!name || !limit_amt) {
      return res.status(400).json({ error: 'Name and limit are required.' });
    }
    const [result] = await pool.query(
      'INSERT INTO credit_cards (user_id, name, limit_amt, due_amount, due_date) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, name.trim(), Number(limit_amt), 0, due_date || null],
    );
    res.status(201).json({
      id: result.insertId,
      name: name.trim(),
      limit_amt: Number(limit_amt),
      due_amount: 0,
      due_date: due_date || null,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, limit_amt, due_amount, due_date } = req.body;
    const cardId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM credit_cards WHERE id = ? AND user_id = ?', [cardId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Credit card not found.' });
    }
    const updates = [];
    const values = [];
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (limit_amt !== undefined) {
      updates.push('limit_amt = ?');
      values.push(Number(limit_amt));
    }
    if (due_amount !== undefined) {
      updates.push('due_amount = ?');
      values.push(Number(due_amount));
    }
    if (due_date !== undefined) {
      updates.push('due_date = ?');
      values.push(due_date || null);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }
    values.push(cardId, req.user.id);
    await pool.query(`UPDATE credit_cards SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ message: 'Credit card updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const cardId = Number(req.params.id);
    const [result] = await pool.query('DELETE FROM credit_cards WHERE id = ? AND user_id = ?', [cardId, req.user.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Credit card not found.' });
    }
    res.json({ message: 'Credit card deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
