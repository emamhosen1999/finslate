const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { type } = req.query;
    let query = 'SELECT * FROM categories WHERE (user_id IS NULL OR user_id = ?) AND is_active = TRUE';
    const params = [req.user.id];
    if (type && ['income', 'expense'].includes(type)) {
      query += ' AND (type = ? OR type = \'both\')';
      params.push(type);
    }
    query += ' ORDER BY is_system DESC, sort_order ASC, name ASC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, type, parent_id, icon, color } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'Name and type are required.' });
    if (!['income', 'expense', 'both'].includes(type)) {
      return res.status(400).json({ error: 'Type must be income, expense, or both.' });
    }
    const [result] = await pool.query(
      'INSERT INTO categories (user_id, name, type, parent_id, icon, color, is_system) VALUES (?, ?, ?, ?, ?, ?, FALSE)',
      [req.user.id, name.trim(), type, parent_id || null, icon || null, color || null]
    );
    res.status(201).json({
      id: result.insertId,
      user_id: req.user.id,
      name: name.trim(),
      type,
      parent_id: parent_id || null,
      icon: icon || null,
      color: color || null,
      is_system: false,
      is_active: true,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const [existing] = await pool.query(
      'SELECT id, is_system FROM categories WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!existing.length) return res.status(404).json({ error: 'Category not found or not editable.' });
    if (existing[0].is_system) return res.status(403).json({ error: 'Cannot edit system categories.' });

    const { name, type, parent_id, icon, color, is_active } = req.body;
    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name.trim()); }
    if (type !== undefined) { updates.push('type = ?'); values.push(type); }
    if (parent_id !== undefined) { updates.push('parent_id = ?'); values.push(parent_id || null); }
    if (icon !== undefined) { updates.push('icon = ?'); values.push(icon || null); }
    if (color !== undefined) { updates.push('color = ?'); values.push(color || null); }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active); }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update.' });

    values.push(req.params.id);
    await pool.query(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const [existing] = await pool.query(
      'SELECT id, is_system FROM categories WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!existing.length) return res.status(404).json({ error: 'Category not found or not deletable.' });
    if (existing[0].is_system) return res.status(403).json({ error: 'Cannot delete system categories.' });
    await pool.query('DELETE FROM categories WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
