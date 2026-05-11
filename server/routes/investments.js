const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/auth');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM investments WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, type, symbol, quantity, buy_price, current_price, buy_date } = req.body;
    if (!name || !type || !quantity || !buy_price) {
      return res.status(400).json({ error: 'Name, type, quantity, and buy price are required.' });
    }
    const [result] = await pool.query(
      'INSERT INTO investments (user_id, name, type, symbol, quantity, buy_price, current_price, buy_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, name.trim(), type.trim(), symbol?.trim() || null, Number(quantity), Number(buy_price), current_price ? Number(current_price) : null, buy_date || null],
    );
    res.status(201).json({
      id: result.insertId,
      name: name.trim(),
      type: type.trim(),
      symbol: symbol?.trim() || null,
      quantity: Number(quantity),
      buy_price: Number(buy_price),
      current_price: current_price ? Number(current_price) : null,
      buy_date,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, type, symbol, quantity, buy_price, current_price, buy_date } = req.body;
    const invId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM investments WHERE id = ? AND user_id = ?', [invId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Investment not found.' });
    }
    const updates = [];
    const values = [];
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (type !== undefined) {
      updates.push('type = ?');
      values.push(type.trim());
    }
    if (symbol !== undefined) {
      updates.push('symbol = ?');
      values.push(symbol?.trim() || null);
    }
    if (quantity !== undefined) {
      updates.push('quantity = ?');
      values.push(Number(quantity));
    }
    if (buy_price !== undefined) {
      updates.push('buy_price = ?');
      values.push(Number(buy_price));
    }
    if (current_price !== undefined) {
      updates.push('current_price = ?');
      values.push(current_price ? Number(current_price) : null);
    }
    if (buy_date !== undefined) {
      updates.push('buy_date = ?');
      values.push(buy_date);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }
    values.push(invId, req.user.id);
    await pool.query(`UPDATE investments SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ message: 'Investment updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const invId = Number(req.params.id);
    const [result] = await pool.query('DELETE FROM investments WHERE id = ? AND user_id = ?', [invId, req.user.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Investment not found.' });
    }
    res.json({ message: 'Investment deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
