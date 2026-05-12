const express = require('express');
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');
const { buildSummary } = require('./dashboard');

const router = express.Router();

router.post('/debt-repayment', requireAuth, async (req, res, next) => {
  const userId = req.user.id;
  const { loanId, accountId, amount } = req.body || {};
  const amt = Number(amount);

  if (!loanId || !accountId || !Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ error: 'loanId, accountId and positive amount are required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[account]] = await conn.query(
      'SELECT id, name, current_balance FROM accounts WHERE id = ? AND user_id = ? FOR UPDATE',
      [accountId, userId],
    );
    if (!account) {
      await conn.rollback();
      return res.status(404).json({ error: 'Account not found' });
    }

    const [[loan]] = await conn.query(
      'SELECT id, lender_name, outstanding_balance FROM loans WHERE id = ? AND user_id = ? FOR UPDATE',
      [loanId, userId],
    );
    if (!loan) {
      await conn.rollback();
      return res.status(404).json({ error: 'Loan not found' });
    }

    if (Number(account.current_balance) < amt) {
      await conn.rollback();
      return res.status(400).json({ error: 'Insufficient account balance' });
    }
    if (Number(loan.outstanding_balance) < amt) {
      await conn.rollback();
      return res.status(400).json({ error: 'Amount exceeds outstanding loan balance' });
    }

    await conn.query(
      'UPDATE accounts SET current_balance = current_balance - ? WHERE id = ? AND user_id = ?',
      [amt, account.id, userId],
    );
    await conn.query(
      'UPDATE loans SET outstanding_balance = outstanding_balance - ? WHERE id = ? AND user_id = ?',
      [amt, loan.id, userId],
    );
    await conn.query(
      `INSERT INTO transactions (user_id, account_id, type, amount, currency, transaction_date, category_id, source_type, source_id, payee, notes)
       VALUES (?, ?, 'expense', ?, 'BDT', CURDATE(), 'Loan', 'account', ?, ?, ?)`,
      [userId, account.id, amt, loan.id, loan.lender_name, `Loan repayment - ${loan.lender_name}`],
    );

    await conn.commit();
    const payload = await buildSummary(userId);
    res.json({ ok: true, ...payload });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// Export data to CSV
router.get('/export/:entity', requireAuth, async (req, res, next) => {
  try {
    const { entity } = req.params;
    const { format = 'csv', start_date, end_date } = req.query;
    const userId = req.user.id;

    let query = '';
    let filename = '';
    let headers = [];

    switch (entity) {
      case 'transactions':
        query = `
          SELECT t.*, a.name as account_name 
          FROM transactions t
          LEFT JOIN accounts a ON t.account_id = a.id
          WHERE t.user_id = ? AND t.deleted_at IS NULL
        `;
        filename = 'transactions.csv';
        headers = ['ID', 'Date', 'Type', 'Amount', 'Category', 'Description', 'Account'];
        if (start_date) {
          query += ' AND t.transaction_date >= ?';
        }
        if (end_date) {
          query += ' AND t.transaction_date <= ?';
        }
        query += ' ORDER BY t.transaction_date DESC';
        break;
      case 'accounts':
        query = 'SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at DESC';
        filename = 'accounts.csv';
        headers = ['ID', 'Name', 'Type', 'Balance', 'Created At'];
        break;
      case 'credit_cards':
        query = 'SELECT * FROM credit_cards WHERE user_id = ? ORDER BY created_at DESC';
        filename = 'credit_cards.csv';
        headers = ['ID', 'Name', 'Limit', 'Due Amount', 'Due Date', 'Created At'];
        break;
      case 'loans':
        query = 'SELECT * FROM loans WHERE user_id = ? ORDER BY created_at DESC';
        filename = 'loans.csv';
        headers = ['ID', 'Name', 'Principal', 'Remaining', 'Monthly EMI', 'Interest Rate', 'Created At'];
        break;
      default:
        return res.status(400).json({ error: 'Invalid entity type' });
    }

    const params = [userId];
    if (start_date) params.push(start_date);
    if (end_date) params.push(end_date);

    const [rows] = await pool.query(query, params);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      const csvRows = [];
      csvRows.push(headers.join(','));

      for (const row of rows) {
        const values = Object.values(row).map(v => {
          if (v === null || v === undefined) return '';
          if (typeof v === 'string') return `"${v.replace(/"/g, '""')}"`;
          return String(v);
        });
        csvRows.push(values.join(','));
      }

      return res.send(csvRows.join('\n'));
    } else if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${entity}.json"`);
      return res.json(rows);
    } else {
      return res.status(400).json({ error: 'Invalid format. Use csv or json.' });
    }
  } catch (err) {
    next(err);
  }
});

// Export all user data (for backup)
router.get('/export-all', requireAuth, async (req, res, next) => {
  try {
    const { format = 'json' } = req.query;
    const userId = req.user.id;

    const data = {
      user: {},
      accounts: [],
      transactions: [],
      credit_cards: [],
      loans: [],
      dps: [],
      fixed_deposits: [],
      investments: [],
      bills: [],
      subscriptions: [],
      goals: [],
      budgets: [],
    };

    // Export user profile
    const [users] = await pool.query(
      'SELECT id, name, email, timezone, date_format, financial_year_start, tin_number, nid_number FROM users WHERE id = ?',
      [userId]
    );
    if (users.length) {
      data.user = users[0];
    }

    // Export all entities
    const [accounts] = await pool.query('SELECT * FROM accounts WHERE user_id = ?', [userId]);
    data.accounts = accounts;

    const [transactions] = await pool.query('SELECT * FROM transactions WHERE user_id = ? AND deleted_at IS NULL', [userId]);
    data.transactions = transactions;

    const [creditCards] = await pool.query('SELECT * FROM credit_cards WHERE user_id = ?', [userId]);
    data.credit_cards = creditCards;

    const [loans] = await pool.query('SELECT * FROM loans WHERE user_id = ?', [userId]);
    data.loans = loans;

    const [dps] = await pool.query('SELECT * FROM dps WHERE user_id = ?', [userId]);
    data.dps = dps;

    const [fixedDeposits] = await pool.query('SELECT * FROM fixed_deposits WHERE user_id = ?', [userId]);
    data.fixed_deposits = fixedDeposits;

    const [investments] = await pool.query('SELECT * FROM investments WHERE user_id = ?', [userId]);
    data.investments = investments;

    const [bills] = await pool.query('SELECT * FROM bills WHERE user_id = ?', [userId]);
    data.bills = bills;

    const [subscriptions] = await pool.query('SELECT * FROM subscriptions WHERE user_id = ?', [userId]);
    data.subscriptions = subscriptions;

    const [goals] = await pool.query('SELECT * FROM goals WHERE user_id = ?', [userId]);
    data.goals = goals;

    const [budgets] = await pool.query('SELECT * FROM budgets WHERE user_id = ?', [userId]);
    data.budgets = budgets;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="finslate-backup-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
