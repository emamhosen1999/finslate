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
      'SELECT * FROM goal_contributions WHERE goal_id = ? ORDER BY date DESC',
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
    const { name, category, target_amount, target_date, description } = req.body;

    const [result] = await pool.query(
      `INSERT INTO goals (user_id, name, category, target_amount, current_amount, target_date, status, description)
       VALUES (?, ?, ?, ?, 0, ?, 'in_progress', ?)`,
      [req.user.id, name, category, target_amount, target_date, description || null]
    );

    res.json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

// Update goal
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, category, target_amount, current_amount, target_date, status, description } = req.body;

    const validStatus = ['in_progress','achieved','paused','abandoned'];
    const safeStatus = validStatus.includes(status) ? status : undefined;
    await pool.query(
      `UPDATE goals SET name = ?, category = ?, target_amount = ?, current_amount = ?, target_date = ?, ${safeStatus ? 'status = ?,' : ''} description = ?
       WHERE id = ? AND user_id = ?`,
      safeStatus
        ? [name, category, target_amount, current_amount, target_date, safeStatus, description || null, req.params.id, req.user.id]
        : [name, category, target_amount, current_amount, target_date, description || null, req.params.id, req.user.id]
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

    const { amount, date, source_account_id, note } = req.body;

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
    const newAmount = Math.round((parseFloat(goal.current_amount) + parseFloat(amount)) * 100) / 100;

    // Record contribution
    await conn.query(
      `INSERT INTO goal_contributions (goal_id, amount, date, source_account_id, note)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, amount, date || new Date().toISOString().slice(0, 10), source_account_id || null, note || null]
    );

    // Update goal current amount
    const achieved = newAmount >= parseFloat(goal.target_amount);
    await conn.query(
      'UPDATE goals SET current_amount = ?, status = IF(? = 1, \'achieved\', status) WHERE id = ?',
      [newAmount, achieved ? 1 : 0, req.params.id]
    );

    await conn.commit();
    res.json({ current_amount: newAmount, status: achieved ? 'achieved' : goal.status });
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
      'SELECT * FROM goal_contributions WHERE goal_id = ? ORDER BY date DESC LIMIT 10',
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
    const achievedGoals = goals.filter(g => g.status === 'achieved').length;

    res.json({
      total_goals: goals.length,
      achieved_goals: achievedGoals,
      active_goals: goals.length - achievedGoals,
      total_target_amount: totalTarget,
      total_current_amount: totalCurrent,
      overall_progress_pct: totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 10000) / 100 : 0,
      goals: summary
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
