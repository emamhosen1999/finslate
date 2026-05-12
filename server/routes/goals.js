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

// Get goal progress calculation
router.get('/:id/progress', requireAuth, async (req, res, next) => {
  try {
    const goalId = Number(req.params.id);
    const [goal] = await pool.query(
      'SELECT * FROM goals WHERE id = ? AND user_id = ?',
      [goalId, req.user.id]
    );

    if (!goal.length) {
      return res.status(404).json({ error: 'Goal not found.' });
    }

    const goalData = goal[0];
    const targetAmount = Number(goalData.target_amount) || 0;
    const currentAmount = Number(goalData.current_amount) || 0;
    const targetDate = goalData.target_date ? new Date(goalData.target_date) : null;

    const progressPct = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;
    const remaining = targetAmount - currentAmount;
    const isCompleted = currentAmount >= targetAmount;

    let daysRemaining = null;
    let monthsRemaining = null;
    let dailyRequired = null;
    let monthlyRequired = null;

    if (targetDate) {
      const now = new Date();
      const diffTime = targetDate - now;
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      monthsRemaining = Math.ceil(daysRemaining / 30);

      if (daysRemaining > 0 && remaining > 0) {
        dailyRequired = remaining / daysRemaining;
        monthlyRequired = remaining / monthsRemaining;
      }
    }

    // Get contribution history
    const [contributions] = await pool.query(
      'SELECT * FROM goal_contributions WHERE goal_id = ? ORDER BY contribution_date DESC LIMIT 10',
      [goalId]
    );

    res.json({
      goal_id: goalId,
      goal_name: goalData.name,
      category: goalData.category,
      target_amount: targetAmount,
      current_amount: currentAmount,
      remaining: remaining,
      progress_percentage: Math.round(progressPct * 100) / 100,
      status: goalData.status,
      is_completed: isCompleted,
      target_date: goalData.target_date,
      days_remaining: daysRemaining,
      months_remaining: monthsRemaining,
      daily_required: dailyRequired ? Math.round(dailyRequired * 100) / 100 : null,
      monthly_required: monthlyRequired ? Math.round(monthlyRequired * 100) / 100 : null,
      recent_contributions: contributions
    });
  } catch (err) {
    next(err);
  }
});

// Get all goals with progress summary
router.get('/summary/all', requireAuth, async (req, res, next) => {
  try {
    const [goals] = await pool.query(
      'SELECT * FROM goals WHERE user_id = ? ORDER BY target_date ASC',
      [req.user.id]
    );

    const summary = goals.map(goal => {
      const targetAmount = Number(goal.target_amount) || 0;
      const currentAmount = Number(goal.current_amount) || 0;
      const progressPct = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;
      const remaining = targetAmount - currentAmount;

      return {
        id: goal.id,
        name: goal.name,
        category: goal.category,
        target_amount: targetAmount,
        current_amount: currentAmount,
        remaining: remaining,
        progress_percentage: Math.round(progressPct * 100) / 100,
        status: goal.status,
        target_date: goal.target_date
      };
    });

    const totalTarget = goals.reduce((sum, g) => sum + Number(g.target_amount), 0);
    const totalCurrent = goals.reduce((sum, g) => sum + Number(g.current_amount), 0);
    const completedGoals = goals.filter(g => Number(g.current_amount) >= Number(g.target_amount)).length;

    res.json({
      total_goals: goals.length,
      completed_goals: completedGoals,
      active_goals: goals.length - completedGoals,
      total_target_amount: totalTarget,
      total_current_amount: totalCurrent,
      overall_progress: totalTarget > 0 ? ((totalCurrent / totalTarget) * 100).toFixed(2) : 0,
      goals: summary
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
