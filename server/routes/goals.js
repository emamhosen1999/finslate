const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// Get all goals for a user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM goals WHERE user_id = ? ORDER BY target_date ASC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Get contributions for a specific goal
router.get('/:id/contributions', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM goal_contributions WHERE goal_id = ? ORDER BY contribution_date DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Create a new goal
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, category, target_amount, target_date, notes } = req.body;

    const [result] = await pool.query(
      `INSERT INTO goals (user_id, name, category, target_amount, current_amount, target_date, status, notes)
       VALUES (?, ?, ?, ?, 0, ?, 'active', ?)`,
      [req.user.id, name, category, target_amount, target_date, notes]
    );

    res.json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

// Update goal
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, category, target_amount, current_amount, target_date, status, notes } = req.body;

    await pool.query(
      `UPDATE goals SET name = ?, category = ?, target_amount = ?, current_amount = ?, target_date = ?, status = ?, notes = ?
       WHERE id = ? AND user_id = ?`,
      [name, category, target_amount, current_amount, target_date, status, notes, req.params.id, req.user.id]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Delete goal
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM goals WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Add contribution to goal
router.post('/:id/contribution', requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { amount, contribution_date, notes } = req.body;

    // Get goal details
    const [goals] = await conn.query(
      'SELECT * FROM goals WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (!goals.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Goal not found' });
    }

    const goal = goals[0];
    const newAmount = parseFloat(goal.current_amount) + parseFloat(amount);

    // Record contribution
    await conn.query(
      `INSERT INTO goal_contributions (goal_id, amount, contribution_date, notes)
       VALUES (?, ?, ?, ?)`,
      [req.params.id, amount, contribution_date, notes]
    );

    // Update goal current amount
    await conn.query(
      'UPDATE goals SET current_amount = ? WHERE id = ?',
      [newAmount, req.params.id]
    );

    // Check if goal is completed
    if (newAmount >= parseFloat(goal.target_amount)) {
      await conn.query(
        'UPDATE goals SET status = ? WHERE id = ?',
        ['completed', req.params.id]
      );
    }

    await conn.commit();
    res.json({ current_amount: newAmount, status: newAmount >= parseFloat(goal.target_amount) ? 'completed' : goal.status });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

module.exports = router;
