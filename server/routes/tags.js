const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required.' });
    const [result] = await pool.query(
      'INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)',
      [req.user.id, name.trim(), color || null]
    );
    res.status(201).json({ id: result.insertId, user_id: req.user.id, name: name.trim(), color: color || null });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, color } = req.body;
    const [existing] = await pool.query('SELECT id FROM tags WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!existing.length) return res.status(404).json({ error: 'Tag not found.' });
    await pool.query(
      'UPDATE tags SET name = ?, color = ? WHERE id = ? AND user_id = ?',
      [name.trim(), color || null, req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM tags WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Tag not found.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/transaction/:transactionId', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.* FROM tags t
       JOIN transaction_tags tt ON tt.tag_id = t.id
       JOIN transactions tx ON tx.id = tt.transaction_id
       WHERE tt.transaction_id = ? AND tx.user_id = ?`,
      [req.params.transactionId, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/transaction/:transactionId', requireAuth, async (req, res, next) => {
  try {
    const { tag_id } = req.body;
    const [txns] = await pool.query('SELECT id FROM transactions WHERE id = ? AND user_id = ?', [req.params.transactionId, req.user.id]);
    if (!txns.length) return res.status(404).json({ error: 'Transaction not found.' });
    const [tags] = await pool.query('SELECT id FROM tags WHERE id = ? AND user_id = ?', [tag_id, req.user.id]);
    if (!tags.length) return res.status(404).json({ error: 'Tag not found.' });
    await pool.query(
      'INSERT IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)',
      [req.params.transactionId, tag_id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/transaction/:transactionId/:tagId', requireAuth, async (req, res, next) => {
  try {
    const [txns] = await pool.query('SELECT id FROM transactions WHERE id = ? AND user_id = ?', [req.params.transactionId, req.user.id]);
    if (!txns.length) return res.status(404).json({ error: 'Transaction not found.' });
    await pool.query(
      'DELETE FROM transaction_tags WHERE transaction_id = ? AND tag_id = ?',
      [req.params.transactionId, req.params.tagId]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
