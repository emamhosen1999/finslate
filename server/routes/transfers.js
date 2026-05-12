const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// Get all transfers for a user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, 
       fa.name as from_account_name, fa.type as from_account_type,
       ta.name as to_account_name, ta.type as to_account_type
       FROM transfers t
       LEFT JOIN accounts fa ON t.from_account_id = fa.id
       LEFT JOIN accounts ta ON t.to_account_id = ta.id
       WHERE t.user_id = ?
       ORDER BY t.transfer_date DESC, t.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Create a new transfer
router.post('/', requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { from_account_id, to_account_id, amount, converted_amount, exchange_rate, fee, fee_account_id, transfer_date, note, reference_no } = req.body;

    // Validate from_account_id belongs to user
    const [fromAccount] = await conn.query('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [from_account_id, req.user.id]);
    if (!fromAccount.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'Invalid source account' });
    }

    // Validate to_account_id belongs to user
    const [toAccount] = await conn.query('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [to_account_id, req.user.id]);
    if (!toAccount.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'Invalid destination account' });
    }

    // Validate fee_account_id if provided
    if (fee_account_id) {
      const [feeAccount] = await conn.query('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [fee_account_id, req.user.id]);
      if (!feeAccount.length) {
        await conn.rollback();
        return res.status(400).json({ error: 'Invalid fee account' });
      }
    }

    // Check sufficient balance
    const totalDebit = parseFloat(amount) + (fee && fee_account_id === from_account_id ? parseFloat(fee) : 0);
    if (fromAccount[0].balance < totalDebit) {
      await conn.rollback();
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Insert transfer record
    const [result] = await conn.query(
      `INSERT INTO transfers (user_id, from_account_id, to_account_id, amount, converted_amount, exchange_rate, fee, fee_account_id, transfer_date, note, reference_no, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
      [req.user.id, from_account_id, to_account_id, amount, converted_amount || amount, exchange_rate || 1.0, fee || 0, fee_account_id, transfer_date, note, reference_no]
    );
    const transferId = result.insertId;

    // Create debit transaction for from_account
    const debitAmount = parseFloat(amount) + (fee && fee_account_id === from_account_id ? parseFloat(fee) : 0);
    await conn.query(
      `INSERT INTO transactions (user_id, account_id, type, amount, category, description, ref_type, ref_id, created_at)
       VALUES (?, ?, 'debit', ?, 'Transfer', ?, 'transfer', ?, ?)`,
      [req.user.id, from_account_id, debitAmount, note || `Transfer to ${toAccount[0].name}`, transferId, transfer_date]
    );

    // Update from_account balance
    await conn.query(
      'UPDATE accounts SET balance = balance - ? WHERE id = ?',
      [debitAmount, from_account_id]
    );

    // Create credit transaction for to_account
    const creditAmount = converted_amount || amount;
    await conn.query(
      `INSERT INTO transactions (user_id, account_id, type, amount, category, description, ref_type, ref_id, created_at)
       VALUES (?, ?, 'credit', ?, 'Transfer', ?, 'transfer', ?, ?)`,
      [req.user.id, to_account_id, creditAmount, note || `Transfer from ${fromAccount[0].name}`, transferId, transfer_date]
    );

    // Update to_account balance
    await conn.query(
      'UPDATE accounts SET balance = balance + ? WHERE id = ?',
      [creditAmount, to_account_id]
    );

    // If fee is deducted from a different account
    if (fee && fee_account_id && fee_account_id !== from_account_id) {
      await conn.query(
        `INSERT INTO transactions (user_id, account_id, type, amount, category, description, ref_type, ref_id, created_at)
         VALUES (?, ?, 'debit', ?, 'Fee', ?, 'transfer', ?, ?)`,
        [req.user.id, fee_account_id, fee, note || `Transfer fee`, transferId, transfer_date]
      );
      await conn.query(
        'UPDATE accounts SET balance = balance - ? WHERE id = ?',
        [fee, fee_account_id]
      );
    }

    await conn.commit();
    res.json({ id: transferId, message: 'Transfer completed successfully' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// Reverse a transfer
router.post('/:id/reverse', requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const transferId = req.params.id;

    // Get transfer details
    const [transfers] = await conn.query(
      'SELECT * FROM transfers WHERE id = ? AND user_id = ?',
      [transferId, req.user.id]
    );

    if (!transfers.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Transfer not found' });
    }

    const transfer = transfers[0];

    if (transfer.status === 'reversed') {
      await conn.rollback();
      return res.status(400).json({ error: 'Transfer already reversed' });
    }

    // Reverse the transfer - credit back to from_account
    const debitAmount = parseFloat(transfer.amount) + (transfer.fee_account_id === transfer.from_account_id ? parseFloat(transfer.fee) : 0);
    await conn.query(
      `INSERT INTO transactions (user_id, account_id, type, amount, category, description, ref_type, ref_id, created_at)
       VALUES (?, ?, 'credit', ?, 'Transfer Reversal', ?, 'transfer', ?, NOW())`,
      [req.user.id, transfer.from_account_id, debitAmount, `Reverse transfer to account ID ${transfer.to_account_id}`, transferId]
    );
    await conn.query(
      'UPDATE accounts SET balance = balance + ? WHERE id = ?',
      [debitAmount, transfer.from_account_id]
    );

    // Debit back from to_account
    const creditAmount = transfer.converted_amount || transfer.amount;
    await conn.query(
      `INSERT INTO transactions (user_id, account_id, type, amount, category, description, ref_type, ref_id, created_at)
       VALUES (?, ?, 'debit', ?, 'Transfer Reversal', ?, 'transfer', ?, NOW())`,
      [req.user.id, transfer.to_account_id, creditAmount, `Reverse transfer from account ID ${transfer.from_account_id}`, transferId]
    );
    await conn.query(
      'UPDATE accounts SET balance = balance - ? WHERE id = ?',
      [creditAmount, transfer.to_account_id]
    );

    // If fee was deducted from a different account, refund it
    if (transfer.fee && transfer.fee_account_id && transfer.fee_account_id !== transfer.from_account_id) {
      await conn.query(
        `INSERT INTO transactions (user_id, account_id, type, amount, category, description, ref_type, ref_id, created_at)
         VALUES (?, ?, 'credit', ?, 'Fee Refund', ?, 'transfer', ?, NOW())`,
        [req.user.id, transfer.fee_account_id, transfer.fee, `Transfer fee refund`, transferId]
      );
      await conn.query(
        'UPDATE accounts SET balance = balance + ? WHERE id = ?',
        [transfer.fee, transfer.fee_account_id]
      );
    }

    // Update transfer status
    await conn.query(
      'UPDATE transfers SET status = ?, reversed_at = NOW() WHERE id = ?',
      ['reversed', transferId]
    );

    await conn.commit();
    res.json({ message: 'Transfer reversed successfully' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

module.exports = router;
