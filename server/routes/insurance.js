const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT ip.*, a.name as account_name FROM insurance_premiums ip LEFT JOIN accounts a ON ip.account_id = a.id WHERE ip.user_id = ? ORDER BY next_due_date ASC',
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, type, provider, premium_amount, frequency, next_due_date, account_id } = req.body;
    if (!name || !type || !premium_amount) {
      return res.status(400).json({ error: 'Name, type, and premium amount are required.' });
    }
    const [result] = await pool.query(
      'INSERT INTO insurance_premiums (user_id, name, type, provider, premium_amount, frequency, next_due_date, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, name.trim(), type.trim(), provider?.trim() || null, Number(premium_amount), frequency || 'yearly', next_due_date || null, account_id ? Number(account_id) : null],
    );
    res.status(201).json({
      id: result.insertId,
      name: name.trim(),
      type: type.trim(),
      provider: provider?.trim() || null,
      premium_amount: Number(premium_amount),
      frequency: frequency || 'yearly',
      next_due_date: next_due_date || null,
      account_id: account_id ? Number(account_id) : null,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, type, provider, premium_amount, frequency, next_due_date, account_id } = req.body;
    const insId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM insurance_premiums WHERE id = ? AND user_id = ?', [insId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Insurance premium not found.' });
    }
    const updates = [];
    const values = [];
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (type !== undefined) {
      updates.push('type = ?');
      values.push(type.trim());
    }
    if (provider !== undefined) {
      updates.push('provider = ?');
      values.push(provider?.trim() || null);
    }
    if (premium_amount !== undefined) {
      updates.push('premium_amount = ?');
      values.push(Number(premium_amount));
    }
    if (frequency !== undefined) {
      updates.push('frequency = ?');
      values.push(frequency);
    }
    if (next_due_date !== undefined) {
      updates.push('next_due_date = ?');
      values.push(next_due_date || null);
    }
    if (account_id !== undefined) {
      updates.push('account_id = ?');
      values.push(account_id ? Number(account_id) : null);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }
    values.push(insId, req.user.id);
    await pool.query(`UPDATE insurance_premiums SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ message: 'Insurance premium updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const insId = Number(req.params.id);
    const [result] = await pool.query('DELETE FROM insurance_premiums WHERE id = ? AND user_id = ?', [insId, req.user.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Insurance premium not found.' });
    }
    res.json({ message: 'Insurance premium deleted.' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/pay', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { account_id } = req.body;
    const insId = Number(req.params.id);
    const [existing] = await connection.query('SELECT * FROM insurance_premiums WHERE id = ? AND user_id = ?', [insId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Insurance premium not found.' });
    }
    const ins = existing[0];
    const accountId = account_id ? Number(account_id) : ins.account_id;
    if (accountId) {
      const [account] = await connection.query('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [accountId, req.user.id]);
      if (!account.length) {
        return res.status(404).json({ error: 'Account not found.' });
      }
      await connection.query(
        'INSERT INTO transactions (user_id, account_id, type, amount, category, description) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.id, accountId, 'debit', ins.premium_amount, 'Insurance', `Insurance: ${ins.name}`],
      );
      await connection.query(
        'UPDATE accounts SET balance = balance - ? WHERE id = ? AND user_id = ?',
        [ins.premium_amount, accountId, req.user.id],
      );
    }
    const nextDue = new Date(ins.next_due_date || new Date());
    switch (ins.frequency) {
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
    await connection.query(
      'UPDATE insurance_premiums SET next_due_date = ? WHERE id = ?',
      [nextDueStr, insId],
    );
    await connection.commit();
    res.json({ message: 'Payment successful.', next_due_date: nextDueStr });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

module.exports = router;
