const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// Get all reports for a user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM reports WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Generate a report
router.post('/generate', requireAuth, async (req, res, next) => {
  try {
    const { type, parameters } = req.body;
    
    let data;
    switch (type) {
      case 'income_expense':
        const [incomeExpenseResult] = await pool.query(
          `SELECT 
            DATE_FORMAT(transaction_date, '%Y-%m') as month,
            SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
           FROM transactions 
           WHERE user_id = ? AND deleted_at IS NULL
           GROUP BY DATE_FORMAT(transaction_date, '%Y-%m') 
           ORDER BY month DESC 
           LIMIT 12`,
          [req.user.id]
        );
        data = incomeExpenseResult;
        break;
        
      case 'category_breakdown':
        const [categoryResult] = await pool.query(
          `SELECT category_id, SUM(amount) as total, COUNT(*) as count
           FROM transactions 
           WHERE user_id = ? AND type = 'expense' AND deleted_at IS NULL
           GROUP BY category_id 
           ORDER BY total DESC`,
          [req.user.id]
        );
        data = categoryResult;
        break;
        
      case 'net_worth_summary':
        const [netWorthResult] = await pool.query(
          `SELECT 
            snapshot_date as date,
            total_assets,
            total_liabilities,
            net_worth
           FROM net_worth_snapshots 
           WHERE user_id = ? 
           ORDER BY snapshot_date ASC 
           LIMIT 12`,
          [req.user.id]
        );
        data = netWorthResult;
        break;
        
      case 'investment_summary':
        const [investmentResult] = await pool.query(
          `SELECT 
            symbol,
            type,
            quantity_held,
            average_buy_price,
            current_price,
            total_invested,
            (quantity_held * current_price) as current_value,
            (quantity_held * current_price - total_invested) as gain_loss
           FROM investments 
           WHERE user_id = ? AND status = 'active'
           ORDER BY current_value DESC`,
          [req.user.id]
        );
        data = investmentResult;
        break;
        
      case 'debt_summary':
        const [debtResult] = await pool.query(
          `SELECT 
            'Credit Cards' as type,
            COALESCE(SUM(current_outstanding), 0) as amount
           FROM credit_cards WHERE user_id = ? AND is_active = 1
           UNION ALL
           SELECT 
            'Loans' as type,
            COALESCE(SUM(outstanding_balance), 0) as amount
           FROM loans WHERE user_id = ?`,
          [req.user.id, req.user.id]
        );
        data = debtResult;
        break;
        
      default:
        return res.status(400).json({ error: 'Unknown report type' });
    }
    
    res.json({ type, data, generated_at: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// Save a report
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, type, parameters } = req.body;
    
    const [result] = await pool.query(
      `INSERT INTO reports (user_id, name, type, parameters)
       VALUES (?, ?, ?, ?)`,
      [req.user.id, name, type, JSON.stringify(parameters)]
    );
    
    res.json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

// Delete a report
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM reports WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
