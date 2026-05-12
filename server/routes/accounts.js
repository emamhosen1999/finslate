const express = require('express');
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, type, institution_name, account_number, current_balance, opening_balance, currency, color, icon, is_default, is_active, note, created_at, updated_at FROM accounts WHERE user_id = ? AND deleted_at IS NULL ORDER BY id',
      [req.user.id],
    );
    res.json({ accounts: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/transactions', requireAuth, async (req, res, next) => {
  try {
    const accountId = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT t.id, t.account_id, a.name AS account_name, t.type, t.amount, t.category,
              t.description, t.ref_type, t.ref_id, t.created_at
         FROM transactions t
         LEFT JOIN accounts a ON a.id = t.account_id
        WHERE t.user_id = ? AND t.account_id = ?
        ORDER BY t.created_at DESC, t.id DESC`,
      [req.user.id, accountId],
    );
    res.json({ transactions: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, type, current_balance, institution_name, account_number, opening_balance, currency, color, icon, is_default, is_active, note } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required.' });
    }
    if (!['bank', 'mobile_banking', 'mutual_fund', 'cash'].includes(type)) {
      return res.status(400).json({ error: 'Invalid account type.' });
    }

    // Handle is_default logic
    let shouldSetDefault = is_default;
    if (shouldSetDefault) {
      // Check if user has any existing accounts
      const [existingAccounts] = await pool.query('SELECT id FROM accounts WHERE user_id = ? AND deleted_at IS NULL', [req.user.id]);
      if (existingAccounts.length === 0) {
        // First account, set as default automatically
        shouldSetDefault = true;
      }
    }

    // If setting as default, unset other accounts
    if (shouldSetDefault) {
      await pool.query('UPDATE accounts SET is_default = FALSE WHERE user_id = ? AND deleted_at IS NULL', [req.user.id]);
    }

    const [result] = await pool.query(
      'INSERT INTO accounts (user_id, name, type, institution_name, account_number, current_balance, opening_balance, currency, color, icon, is_default, is_active, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, name.trim(), type, institution_name || null, account_number || null, Number(current_balance) || 0, Number(opening_balance) || 0, currency || 'BDT', color || null, icon || null, shouldSetDefault || false, is_active !== undefined ? is_active : true, note || null],
    );
    res.status(201).json({ id: result.insertId, name: name.trim(), type, current_balance: Number(current_balance) || 0 });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, type, current_balance, institution_name, account_number, opening_balance, currency, color, icon, is_default, is_active, note } = req.body;
    const accountId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM accounts WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [accountId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Account not found.' });
    }
    const updates = [];
    const values = [];
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (type !== undefined) {
      if (!['bank', 'mobile_banking', 'mutual_fund', 'cash'].includes(type)) {
        return res.status(400).json({ error: 'Invalid account type.' });
      }
      updates.push('type = ?');
      values.push(type);
    }
    if (current_balance !== undefined) {
      updates.push('current_balance = ?');
      values.push(Number(current_balance));
    }
    if (institution_name !== undefined) {
      updates.push('institution_name = ?');
      values.push(institution_name);
    }
    if (account_number !== undefined) {
      updates.push('account_number = ?');
      values.push(account_number);
    }
    if (opening_balance !== undefined) {
      updates.push('opening_balance = ?');
      values.push(Number(opening_balance));
    }
    if (currency !== undefined) {
      updates.push('currency = ?');
      values.push(currency);
    }
    if (color !== undefined) {
      updates.push('color = ?');
      values.push(color);
    }
    if (icon !== undefined) {
      updates.push('icon = ?');
      values.push(icon);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active);
    }
    if (note !== undefined) {
      updates.push('note = ?');
      values.push(note);
    }
    if (is_default !== undefined && is_default === true) {
      // Unset other accounts' default status
      await pool.query('UPDATE accounts SET is_default = FALSE WHERE user_id = ? AND id != ? AND deleted_at IS NULL', [req.user.id, accountId]);
      updates.push('is_default = ?');
      values.push(true);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }
    values.push(accountId, req.user.id);
    await pool.query(`UPDATE accounts SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ message: 'Account updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const accountId = Number(req.params.id);
    // Check for dependent transactions before allowing soft delete
    const [txCheck] = await pool.query('SELECT COUNT(*) as count FROM transactions WHERE account_id = ? AND deleted_at IS NULL', [accountId]);
    if (txCheck[0].count > 0) {
      return res.status(400).json({ error: 'Cannot delete account with existing transactions. Please delete or reassign transactions first.' });
    }
    // Implement soft delete
    const [result] = await pool.query('UPDATE accounts SET deleted_at = NOW() WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [accountId, req.user.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Account not found.' });
    }
    res.json({ message: 'Account deleted.' });
  } catch (err) {
    next(err);
  }
});

router.post('/transfer', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { from_account_id, to_account_id, amount, description } = req.body;
    if (!from_account_id || !to_account_id || !amount) {
      return res.status(400).json({ error: 'From account, to account, and amount are required.' });
    }
    if (from_account_id === to_account_id) {
      return res.status(400).json({ error: 'Cannot transfer to the same account.' });
    }
    const transferAmount = Number(amount);
    const [fromAccount] = await connection.query('SELECT * FROM accounts WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [Number(from_account_id), req.user.id]);
    if (!fromAccount.length) {
      return res.status(404).json({ error: 'Source account not found.' });
    }
    const [toAccount] = await connection.query('SELECT * FROM accounts WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [Number(to_account_id), req.user.id]);
    if (!toAccount.length) {
      return res.status(404).json({ error: 'Destination account not found.' });
    }
    if (Number(fromAccount[0].current_balance) < transferAmount) {
      return res.status(400).json({ error: 'Insufficient balance in source account.' });
    }
    await connection.query(
      'UPDATE accounts SET current_balance = current_balance - ? WHERE id = ? AND user_id = ?',
      [transferAmount, Number(from_account_id), req.user.id],
    );
    await connection.query(
      'UPDATE accounts SET current_balance = current_balance + ? WHERE id = ? AND user_id = ?',
      [transferAmount, Number(to_account_id), req.user.id],
    );
    await connection.query(
      'INSERT INTO transactions (user_id, account_id, type, amount, category, description) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, Number(from_account_id), 'debit', transferAmount, 'Transfer', description || `Transfer to ${toAccount[0].name}`],
    );
    await connection.query(
      'INSERT INTO transactions (user_id, account_id, type, amount, category, description) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, Number(to_account_id), 'credit', transferAmount, 'Transfer', description || `Transfer from ${fromAccount[0].name}`],
    );
    await connection.commit();
    res.json({ message: 'Transfer successful.' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

module.exports = router;
