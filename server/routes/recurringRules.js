const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// Get all recurring rules for a user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT rr.*, sa.name as source_account_name, da.name as destination_account_name
       FROM recurring_rules rr
       LEFT JOIN accounts sa ON rr.source_account_id = sa.id
       LEFT JOIN accounts da ON rr.destination_account_id = da.id
       WHERE rr.user_id = ? ORDER BY rr.next_due_date ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Create a new recurring rule
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, rule_type, amount, category_id, source_account_id, destination_account_id, frequency, day_of_month, day_of_week, start_date, end_date, auto_create_transaction, description } = req.body;

    if (!name || !amount || !frequency || !start_date) {
      return res.status(400).json({ error: 'name, amount, frequency, and start_date are required.' });
    }

    const validTypes = ['income', 'expense', 'transfer', 'dps_installment', 'loan_emi', 'cc_payment', 'bill_payment', 'subscription', 'insurance_premium', 'goal_contribution'];
    const safeRuleType = validTypes.includes(rule_type) ? rule_type : 'expense';

    const validFreqs = ['daily', 'weekly', 'bi_weekly', 'monthly', 'quarterly', 'yearly'];
    if (!validFreqs.includes(frequency)) {
      return res.status(400).json({ error: `Invalid frequency. Must be one of: ${validFreqs.join(', ')}` });
    }

    const [result] = await pool.query(
      `INSERT INTO recurring_rules (user_id, name, rule_type, amount, category_id, source_account_id, destination_account_id, frequency, day_of_month, day_of_week, start_date, end_date, next_due_date, auto_create_transaction, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, name.trim(), safeRuleType, Number(amount), category_id || null, source_account_id || null, destination_account_id || null, frequency, day_of_month || null, day_of_week || null, start_date, end_date || null, start_date, auto_create_transaction !== false ? 1 : 0, description?.trim() || null]
    );

    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

// Update recurring rule
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const ruleId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM recurring_rules WHERE id = ? AND user_id = ?', [ruleId, req.user.id]);
    if (!existing.length) return res.status(404).json({ error: 'Recurring rule not found.' });

    const fields = ['name', 'rule_type', 'amount', 'category_id', 'source_account_id', 'destination_account_id', 'frequency', 'day_of_month', 'day_of_week', 'start_date', 'end_date', 'next_due_date', 'auto_create_transaction', 'description', 'is_active'];
    const updates = [];
    const values = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update.' });
    values.push(ruleId, req.user.id);
    await pool.query(`UPDATE recurring_rules SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Delete recurring rule
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const ruleId = Number(req.params.id);
    const [result] = await pool.query('DELETE FROM recurring_rules WHERE id = ? AND user_id = ?', [ruleId, req.user.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Recurring rule not found.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Process a recurring rule — create transaction and advance next_due_date
router.post('/:id/process', requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const ruleId = Number(req.params.id);
    const [existing] = await conn.query('SELECT * FROM recurring_rules WHERE id = ? AND user_id = ?', [ruleId, req.user.id]);
    if (!existing.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Recurring rule not found.' });
    }

    const rule = existing[0];

    if (!rule.is_active) {
      await conn.rollback();
      return res.status(400).json({ error: 'Rule is inactive.' });
    }

    if (rule.end_date && new Date(rule.next_due_date) > new Date(rule.end_date)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Recurring rule has ended.' });
    }

    // Determine transaction type from rule_type
    let txType = 'expense';
    if (['income'].includes(rule.rule_type)) txType = 'income';
    else if (['transfer'].includes(rule.rule_type)) txType = 'transfer';

    const accountId = rule.source_account_id || rule.destination_account_id;

    if (rule.auto_create_transaction && accountId) {
      // Create transaction
      await conn.query(
        `INSERT INTO transactions (user_id, account_id, type, amount, currency, transaction_date, category_id, source_type, notes)
         VALUES (?, ?, ?, ?, 'BDT', CURDATE(), ?, 'recurring', ?)`,
        [req.user.id, accountId, txType, rule.amount, rule.category_id || null, rule.description || rule.name]
      );

      // Update account balance
      const balanceChange = txType === 'income' ? rule.amount : -rule.amount;
      await conn.query(
        'UPDATE accounts SET current_balance = current_balance + ? WHERE id = ? AND user_id = ?',
        [balanceChange, accountId, req.user.id]
      );
    }

    // Advance next_due_date
    const nextDue = new Date(rule.next_due_date);
    switch (rule.frequency) {
      case 'daily':
        nextDue.setDate(nextDue.getDate() + 1);
        break;
      case 'weekly':
        nextDue.setDate(nextDue.getDate() + 7);
        break;
      case 'bi_weekly':
        nextDue.setDate(nextDue.getDate() + 14);
        break;
      case 'monthly':
        nextDue.setMonth(nextDue.getMonth() + 1);
        break;
      case 'quarterly':
        nextDue.setMonth(nextDue.getMonth() + 3);
        break;
      case 'yearly':
        nextDue.setFullYear(nextDue.getFullYear() + 1);
        break;
    }
    const nextDueStr = nextDue.toISOString().split('T')[0];
    await conn.query(
      'UPDATE recurring_rules SET last_executed_date = CURDATE(), next_due_date = ? WHERE id = ?',
      [nextDueStr, ruleId]
    );

    await conn.commit();
    res.json({ ok: true, next_due_date: nextDueStr });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

module.exports = router;
