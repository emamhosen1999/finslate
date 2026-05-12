const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM budgets WHERE user_id = ? ORDER BY category',
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { category, amount, period } = req.body;
    if (!category || !amount) {
      return res.status(400).json({ error: 'Category and amount are required.' });
    }
    const [result] = await pool.query(
      'INSERT INTO budgets (user_id, category, amount, period) VALUES (?, ?, ?, ?)',
      [req.user.id, category.trim(), Number(amount), period || 'monthly'],
    );
    res.status(201).json({
      id: result.insertId,
      category: category.trim(),
      amount: Number(amount),
      period: period || 'monthly',
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { category, amount, period } = req.body;
    const budgetId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM budgets WHERE id = ? AND user_id = ?', [budgetId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Budget not found.' });
    }
    const updates = [];
    const values = [];
    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category.trim());
    }
    if (amount !== undefined) {
      updates.push('amount = ?');
      values.push(Number(amount));
    }
    if (period !== undefined) {
      updates.push('period = ?');
      values.push(period);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }
    values.push(budgetId, req.user.id);
    await pool.query(`UPDATE budgets SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ message: 'Budget updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const budgetId = Number(req.params.id);
    const [result] = await pool.query('DELETE FROM budgets WHERE id = ? AND user_id = ?', [budgetId, req.user.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Budget not found.' });
    }
    res.json({ message: 'Budget deleted.' });
  } catch (err) {
    next(err);
  }
});

router.get('/spending', requireAuth, async (req, res, next) => {
  try {
    const { period } = req.query;
    let dateFilter = '';
    const params = [req.user.id];
    
    if (period === 'monthly') {
      dateFilter = 'AND DATE_FORMAT(created_at, "%Y-%m") = DATE_FORMAT(CURDATE(), "%Y-%m")';
    } else if (period === 'weekly') {
      dateFilter = 'AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    } else if (period === 'yearly') {
      dateFilter = 'AND YEAR(created_at) = YEAR(CURDATE())';
    }
    
    const [rows] = await pool.query(
      `SELECT category, SUM(amount) as spent 
       FROM transactions 
       WHERE user_id = ? AND type = 'debit' ${dateFilter}
       GROUP BY category`,
      params,
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Get budget alerts (budgets that are near or over limit)
router.get('/alerts', requireAuth, async (req, res, next) => {
  try {
    const { period = 'monthly', threshold = 80 } = req.query;
    const alertThreshold = Math.min(100, Math.max(0, parseInt(threshold)));
    let dateFilter = '';

    if (period === 'monthly') {
      dateFilter = 'AND DATE_FORMAT(created_at, "%Y-%m") = DATE_FORMAT(CURDATE(), "%Y-%m")';
    } else if (period === 'weekly') {
      dateFilter = 'AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    } else if (period === 'yearly') {
      dateFilter = 'AND YEAR(created_at) = YEAR(CURDATE())';
    }

    // Get spending by category
    const [spending] = await pool.query(
      `SELECT category, SUM(amount) as spent 
       FROM transactions 
       WHERE user_id = ? AND type = 'debit' ${dateFilter}
       GROUP BY category`,
      [req.user.id]
    );

    const spendingMap = {};
    spending.forEach(s => {
      spendingMap[s.category] = Number(s.spent);
    });

    // Get budgets
    const [budgets] = await pool.query(
      'SELECT * FROM budgets WHERE user_id = ? AND period = ?',
      [req.user.id, period]
    );

    const alerts = [];
    budgets.forEach(budget => {
      const spent = spendingMap[budget.category] || 0;
      const budgetAmount = Number(budget.amount) || 0;
      const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;

      if (percentage >= 100) {
        alerts.push({
          budget_id: budget.id,
          category: budget.category,
          budget_amount: budgetAmount,
          spent: spent,
          percentage: Math.round(percentage),
          status: 'exceeded',
          remaining: 0
        });
      } else if (percentage >= alertThreshold) {
        alerts.push({
          budget_id: budget.id,
          category: budget.category,
          budget_amount: budgetAmount,
          spent: spent,
          percentage: Math.round(percentage),
          status: 'warning',
          remaining: budgetAmount - spent
        });
      }
    });

    res.json({
      period: period,
      threshold: alertThreshold,
      alerts: alerts,
      total_alerts: alerts.length
    });
  } catch (err) {
    next(err);
  }
});

// Get budget summary with spending vs budget
router.get('/summary', requireAuth, async (req, res, next) => {
  try {
    const { period = 'monthly' } = req.query;
    let dateFilter = '';

    if (period === 'monthly') {
      dateFilter = 'AND DATE_FORMAT(created_at, "%Y-%m") = DATE_FORMAT(CURDATE(), "%Y-%m")';
    } else if (period === 'weekly') {
      dateFilter = 'AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    } else if (period === 'yearly') {
      dateFilter = 'AND YEAR(created_at) = YEAR(CURDATE())';
    }

    // Get spending by category
    const [spending] = await pool.query(
      `SELECT category, SUM(amount) as spent 
       FROM transactions 
       WHERE user_id = ? AND type = 'debit' ${dateFilter}
       GROUP BY category`,
      [req.user.id]
    );

    const spendingMap = {};
    spending.forEach(s => {
      spendingMap[s.category] = Number(s.spent);
    });

    // Get budgets
    const [budgets] = await pool.query(
      'SELECT * FROM budgets WHERE user_id = ? AND period = ?',
      [req.user.id, period]
    );

    const summary = budgets.map(budget => {
      const spent = spendingMap[budget.category] || 0;
      const budgetAmount = Number(budget.amount) || 0;
      const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
      const remaining = budgetAmount - spent;

      return {
        budget_id: budget.id,
        category: budget.category,
        budget_amount: budgetAmount,
        spent: spent,
        remaining: remaining,
        percentage: Math.round(percentage),
        status: percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'ok'
      };
    });

    const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
    const totalSpent = summary.reduce((sum, s) => sum + s.spent, 0);

    res.json({
      period: period,
      total_budget: totalBudget,
      total_spent: totalSpent,
      total_remaining: totalBudget - totalSpent,
      overall_percentage: totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(2) : 0,
      budgets: summary
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
