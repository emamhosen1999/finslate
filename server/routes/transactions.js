const express = require('express');
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');

const router = express.Router();

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const filters = ['t.user_id = ?'];
    const args = [userId];

    if (req.query.category) {
      filters.push('t.category = ?');
      args.push(String(req.query.category));
    }
    if (req.query.type === 'credit' || req.query.type === 'debit') {
      filters.push('t.type = ?');
      args.push(req.query.type);
    }
    if (req.query.accountId) {
      filters.push('t.account_id = ?');
      args.push(Number(req.query.accountId));
    }
    if (req.query.from) {
      filters.push('t.created_at >= ?');
      args.push(String(req.query.from));
    }
    if (req.query.to) {
      // <input type="date"> sends YYYY-MM-DD; widen it to end-of-day so the
      // selected end date is inclusive of all transactions on that day.
      filters.push('t.created_at <= ?');
      args.push(`${String(req.query.to)} 23:59:59`);
    }
    // Add filters for new ERD V2 fields
    if (req.query.transactionDateFrom) {
      filters.push('t.transaction_date >= ?');
      args.push(String(req.query.transactionDateFrom));
    }
    if (req.query.transactionDateTo) {
      filters.push('t.transaction_date <= ?');
      args.push(String(req.query.transactionDateTo));
    }
    if (req.query.subcategoryId) {
      filters.push('t.subcategory_id = ?');
      args.push(Number(req.query.subcategoryId));
    }
    if (req.query.sourceType) {
      filters.push('t.source_type = ?');
      args.push(String(req.query.sourceType));
    }
    if (req.query.payee) {
      filters.push('t.payee LIKE ?');
      args.push(`%${String(req.query.payee)}%`);
    }
    if (req.query.isRecurring === 'true') {
      filters.push('t.is_recurring = TRUE');
    }
    if (req.query.isRecurring === 'false') {
      filters.push('t.is_recurring = FALSE');
    }
    if (req.query.isSplit === 'true') {
      filters.push('t.is_split = TRUE');
    }
    if (req.query.isSplit === 'false') {
      filters.push('t.is_split = FALSE');
    }

    const where = `WHERE ${filters.join(' AND ')}`;

    const [rows] = await pool.query(
      `SELECT t.id, t.account_id, a.name AS account_name, t.type, t.amount, t.currency, t.transaction_date,
              t.category_id, t.subcategory_id, t.source_type, t.source_id, t.payee, t.notes, t.reference_no,
              t.is_recurring, t.recurring_rule_id, t.is_split, t.ref_type, t.ref_id, t.created_at
         FROM transactions t
         LEFT JOIN accounts a ON a.id = t.account_id
         ${where}
         ORDER BY t.created_at DESC, t.id DESC
         LIMIT ? OFFSET ?`,
      [...args, pageSize, offset],
    );

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM transactions t ${where}`,
      args,
    );

    res.json({
      transactions: rows,
      page,
      pageSize,
      total: countRows[0].total,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { account_id, type, amount, category_id, subcategory_id, source_type, source_id, payee, notes, reference_no, is_recurring, recurring_rule_id, is_split, transaction_date } = req.body;
    
    if (!account_id || !type || !amount) {
      return res.status(400).json({ error: 'Account, type, and amount are required.' });
    }
    if (!['income', 'expense', 'transfer_debit', 'transfer_credit', 'adjustment'].includes(type)) {
      return res.status(400).json({ error: 'Type must be income, expense, transfer_debit, transfer_credit, or adjustment.' });
    }
    const txDate = transaction_date || new Date().toISOString().split('T')[0];
    
    const [result] = await connection.query(
      'INSERT INTO transactions (user_id, account_id, type, amount, currency, transaction_date, category_id, subcategory_id, source_type, source_id, payee, notes, reference_no, is_recurring, recurring_rule_id, is_split) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, Number(account_id), type, Number(amount), 'BDT', txDate, category_id?.trim() || null, subcategory_id || null, source_type || 'account', source_id || null, payee || null, notes?.trim() || null, reference_no || null, is_recurring || false, recurring_rule_id || null, is_split || false],
    );
    const balanceChange = ['income', 'transfer_credit'].includes(type) ? Number(amount) : -Number(amount);
    await connection.query(
      'UPDATE accounts SET current_balance = current_balance + ? WHERE id = ? AND user_id = ?',
      [balanceChange, Number(account_id), req.user.id],
    );
    await connection.commit();
    res.status(201).json({
      id: result.insertId,
      account_id: Number(account_id),
      type,
      amount: Number(amount),
      currency: 'BDT',
      transaction_date: txDate,
      category_id: category_id?.trim() || null,
      subcategory_id,
      source_type,
      source_id,
      payee,
      notes: notes?.trim() || null,
      reference_no,
      is_recurring,
      recurring_rule_id,
      is_split,
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { account_id, type, amount, category_id, subcategory_id, source_type, source_id, payee, notes, reference_no, is_recurring, recurring_rule_id, is_split, transaction_date } = req.body;
    
    const txId = Number(req.params.id);
    const [existing] = await connection.query('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [txId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }
    const oldTx = existing[0];
    const updates = [];
    const values = [];
    let newAccountId = oldTx.account_id;
    let newType = oldTx.type;
    let newAmount = oldTx.amount;
    if (account_id !== undefined) {
      updates.push('account_id = ?');
      values.push(Number(account_id));
      newAccountId = Number(account_id);
    }
    if (type !== undefined) {
      if (!['income', 'expense', 'transfer_debit', 'transfer_credit', 'adjustment'].includes(type)) {
        return res.status(400).json({ error: 'Type must be income, expense, transfer_debit, transfer_credit, or adjustment.' });
      }
      updates.push('type = ?');
      values.push(type);
      newType = type;
    }
    if (amount !== undefined) {
      updates.push('amount = ?');
      values.push(Number(amount));
      newAmount = Number(amount);
    }
    if (category_id !== undefined) {
      updates.push('category_id = ?');
      values.push(category_id?.trim() || null);
    }
    if (subcategory_id !== undefined) {
      updates.push('subcategory_id = ?');
      values.push(subcategory_id);
    }
    if (source_type !== undefined) {
      updates.push('source_type = ?');
      values.push(source_type);
    }
    if (source_id !== undefined) {
      updates.push('source_id = ?');
      values.push(source_id);
    }
    if (payee !== undefined) {
      updates.push('payee = ?');
      values.push(payee);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes?.trim() || null);
    }
    if (reference_no !== undefined) {
      updates.push('reference_no = ?');
      values.push(reference_no);
    }
    if (is_recurring !== undefined) {
      updates.push('is_recurring = ?');
      values.push(is_recurring);
    }
    if (recurring_rule_id !== undefined) {
      updates.push('recurring_rule_id = ?');
      values.push(recurring_rule_id);
    }
    if (is_split !== undefined) {
      updates.push('is_split = ?');
      values.push(is_split);
    }
    if (transaction_date !== undefined) {
      updates.push('transaction_date = ?');
      values.push(transaction_date);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }
    values.push(txId, req.user.id);
    await connection.query(`UPDATE transactions SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    const oldBalanceChange = ['income', 'transfer_credit'].includes(oldTx.type) ? Number(oldTx.amount) : -Number(oldTx.amount);
    const newBalanceChange = ['income', 'transfer_credit'].includes(newType) ? Number(newAmount) : -Number(newAmount);
    const netChange = newBalanceChange - oldBalanceChange;
    if (netChange !== 0 || newAccountId !== oldTx.account_id) {
      if (newAccountId !== oldTx.account_id) {
        await connection.query(
          'UPDATE accounts SET current_balance = current_balance + ? WHERE id = ? AND user_id = ?',
          [-oldBalanceChange, oldTx.account_id, req.user.id],
        );
        await connection.query(
          'UPDATE accounts SET current_balance = current_balance + ? WHERE id = ? AND user_id = ?',
          [newBalanceChange, newAccountId, req.user.id],
        );
      } else {
        await connection.query(
          'UPDATE accounts SET current_balance = current_balance + ? WHERE id = ? AND user_id = ?',
          [netChange, newAccountId, req.user.id],
        );
      }
    }
    await connection.commit();
    res.json({ message: 'Transaction updated.' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const txId = Number(req.params.id);
    const [existing] = await connection.query('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [txId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }
    const tx = existing[0];
    const balanceChange = ['income', 'transfer_credit'].includes(tx.type) ? -Number(tx.amount) : Number(tx.amount);
    await connection.query('UPDATE accounts SET current_balance = current_balance + ? WHERE id = ? AND user_id = ?', [balanceChange, tx.account_id, req.user.id]);
    await connection.query('UPDATE transactions SET deleted_at = NOW() WHERE id = ? AND user_id = ?', [txId, req.user.id]);
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// Split transaction into multiple child transactions
router.post('/:id/split', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const parentTxId = Number(req.params.id);
    const { splits } = req.body; // Array of { category, amount, description }

    if (!splits || !Array.isArray(splits) || splits.length === 0) {
      return res.status(400).json({ error: 'Splits array is required with at least one split.' });
    }

    const [existing] = await connection.query(
      'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
      [parentTxId, req.user.id]
    );

    if (!existing.length) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    const parentTx = existing[0];

    // Calculate total of splits
    const totalSplitAmount = splits.reduce((sum, s) => sum + Number(s.amount), 0);

    if (Math.abs(totalSplitAmount - Number(parentTx.amount)) > 0.01) {
      return res.status(400).json({ 
        error: `Split amounts (${totalSplitAmount}) must equal parent transaction amount (${parentTx.amount})` 
      });
    }

    // Mark parent as soft-deleted (using deleted_at column) and set is_split flag
    await connection.query(
      'UPDATE transactions SET deleted_at = NOW(), is_split = TRUE WHERE id = ?',
      [parentTxId]
    );

    // Create child transactions
    const childTransactions = [];
    for (const split of splits) {
      const [result] = await connection.query(
        `INSERT INTO transactions (user_id, account_id, type, amount, currency, transaction_date, category_id, notes, parent_transaction_id, is_split)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          parentTx.account_id,
          parentTx.type,
          Number(split.amount),
          parentTx.currency || 'BDT',
          parentTx.transaction_date || new Date().toISOString().split('T')[0],
          split.category.trim(),
          split.description?.trim() || parentTx.notes,
          parentTxId,
          false
        ]
      );
      childTransactions.push({
        id: result.insertId,
        account_id: parentTx.account_id,
        type: parentTx.type,
        amount: Number(split.amount),
        currency: parentTx.currency || 'BDT',
        transaction_date: parentTx.transaction_date || new Date().toISOString().split('T')[0],
        category_id: split.category.trim(),
        notes: split.description?.trim() || parentTx.notes,
        parent_transaction_id: parentTxId,
        is_split: false
      });
    }

    await connection.commit();
    res.status(201).json({
      message: 'Transaction split successfully',
      parent_id: parentTxId,
      children: childTransactions
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// Get split children of a transaction
router.get('/:id/splits', requireAuth, async (req, res, next) => {
  try {
    const parentTxId = Number(req.params.id);
    
    const [rows] = await pool.query(
      `SELECT t.*, a.name as account_name 
       FROM transactions t
       LEFT JOIN accounts a ON t.account_id = a.id
       WHERE t.parent_transaction_id = ? AND t.user_id = ?
       ORDER BY t.created_at ASC`,
      [parentTxId, req.user.id]
    );

    res.json({ splits: rows });
  } catch (err) {
    next(err);
  }
});

// Merge split transactions back to parent
router.post('/:id/merge', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const parentTxId = Number(req.params.id);

    // Get parent transaction
    const [parentRows] = await connection.query(
      'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
      [parentTxId, req.user.id]
    );

    if (!parentRows.length) {
      return res.status(404).json({ error: 'Parent transaction not found.' });
    }

    const parentTx = parentRows[0];

    // Get child transactions
    const [childRows] = await connection.query(
      'SELECT * FROM transactions WHERE parent_transaction_id = ? AND user_id = ?',
      [parentTxId, req.user.id]
    );

    if (childRows.length === 0) {
      return res.status(400).json({ error: 'No split transactions found to merge.' });
    }

    // Restore parent transaction and reset is_split flag
    await connection.query(
      'UPDATE transactions SET deleted_at = NULL, is_split = FALSE WHERE id = ?',
      [parentTxId]
    );

    // Delete child transactions
    for (const child of childRows) {
      await connection.query(
        'DELETE FROM transactions WHERE id = ?',
        [child.id]
      );
    }

    await connection.commit();
    res.json({ message: 'Transactions merged successfully' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// Import transactions from CSV
router.post('/import', requireAuth, upload.single('file'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (!req.file) {
      await connection.rollback();
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get user's default account
    const [accounts] = await connection.query(
      'SELECT id FROM accounts WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );

    if (accounts.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'No account found. Please create an account first.' });
    }

    const defaultAccountId = accounts[0].id;

    // Parse CSV file
    const transactions = [];
    const readable = new Readable();
    readable.push(req.file.buffer.toString('utf-8'));
    readable.push(null);

    await new Promise((resolve, reject) => {
      readable
        .pipe(csv())
        .on('data', (row) => {
          // Expected CSV format: date, type, amount, category, description, account_name
          transactions.push({
            date: row.date || row.Date,
            type: row.type || row.Type,
            amount: row.amount || row.Amount,
            category: row.category || row.Category,
            description: row.description || row.Description || '',
            account_name: row.account_name || row.Account || ''
          });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (transactions.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'No transactions found in CSV file' });
    }

    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (const tx of transactions) {
      try {
        // Validate required fields
        if (!tx.date || !tx.type || !tx.amount || !tx.category) {
          skipped++;
          errors.push(`Missing required fields: ${JSON.stringify(tx)}`);
          continue;
        }

        if (!['credit', 'debit'].includes(tx.type.toLowerCase())) {
          skipped++;
          errors.push(`Invalid type '${tx.type}' for: ${JSON.stringify(tx)}`);
          continue;
        }

        // Parse date (try multiple formats)
        let txDate = new Date(tx.date);
        if (isNaN(txDate.getTime())) {
          // Try DD/MM/YYYY format
          const parts = tx.date.split('/');
          if (parts.length === 3) {
            txDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          }
        }

        if (isNaN(txDate.getTime())) {
          skipped++;
          errors.push(`Invalid date '${tx.date}' for: ${JSON.stringify(tx)}`);
          continue;
        }

        // Get account by name if provided
        let accountId = defaultAccountId;
        if (tx.account_name) {
          const [accRows] = await connection.query(
            'SELECT id FROM accounts WHERE user_id = ? AND name = ? LIMIT 1',
            [req.user.id, tx.account_name]
          );
          if (accRows.length > 0) {
            accountId = accRows[0].id;
          }
        }

        // Insert transaction
        await connection.query(
          `INSERT INTO transactions (user_id, account_id, type, amount, currency, transaction_date, category_id, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.id,
            accountId,
            tx.type.toLowerCase(),
            Number(tx.amount),
            'BDT',
            txDate,
            tx.category.trim(),
            tx.description?.trim() || null,
            txDate
          ]
        );

        // Update account balance
        const balanceChange = tx.type.toLowerCase() === 'credit' ? Number(tx.amount) : -Number(tx.amount);
        await connection.query(
          'UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?',
          [balanceChange, accountId]
        );

        imported++;
      } catch (err) {
        skipped++;
        errors.push(`Error importing: ${JSON.stringify(tx)} - ${err.message}`);
      }
    }

    await connection.commit();
    res.json({
      message: 'Import completed',
      imported,
      skipped,
      errors: errors.slice(0, 10) // Limit errors to first 10
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// Detect potential duplicate transactions
router.get('/duplicates', requireAuth, async (req, res, next) => {
  try {
    const { days = 30, amount_threshold = 0.01 } = req.query;
    const daysBack = Math.max(1, Math.min(365, parseInt(days)));
    const threshold = parseFloat(amount_threshold);

    const [rows] = await pool.query(
      `SELECT t1.id as id1, t2.id as id2, t1.amount, t1.created_at as date1, t2.created_at as date2, 
              t1.description, t1.category, t1.type
       FROM transactions t1
       JOIN transactions t2 ON t1.user_id = t2.user_id 
         AND t1.id < t2.id 
         AND t1.account_id = t2.account_id
         AND t1.type = t2.type
         AND ABS(t1.amount - t2.amount) <= ?
         AND DATEDIFF(t2.created_at, t1.created_at) <= ?
         AND DATEDIFF(t2.created_at, t1.created_at) >= 0
       WHERE t1.user_id = ? 
         AND t1.deleted_at IS NULL 
         AND t2.deleted_at IS NULL
       ORDER BY t1.created_at DESC
       LIMIT 100`,
      [threshold, daysBack, req.user.id]
    );

    // Group duplicates by similarity
    const duplicates = {};
    for (const row of rows) {
      const key = `${row.amount}-${row.category}-${row.type}`;
      if (!duplicates[key]) {
        duplicates[key] = {
          amount: row.amount,
          category: row.category,
          type: row.type,
          transactions: []
        };
      }
      duplicates[key].transactions.push({
        id: row.id1,
        date: row.date1,
        description: row.description
      });
      duplicates[key].transactions.push({
        id: row.id2,
        date: row.date2,
        description: row.description
      });
    }

    // Remove duplicate entries from the same group
    const result = Object.values(duplicates).map(group => ({
      ...group,
      transactions: [...new Map(group.transactions.map(t => [t.id, t])).values()]
    }));

    res.json({ duplicates: result });
  } catch (err) {
    next(err);
  }
});

// Mark transaction as verified (to prevent it from being flagged as duplicate)
router.put('/:id/verify', requireAuth, async (req, res, next) => {
  try {
    const txId = Number(req.params.id);
    const [existing] = await pool.query(
      'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
      [txId, req.user.id]
    );

    if (!existing.length) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    await pool.query(
      'UPDATE transactions SET is_verified = TRUE WHERE id = ? AND user_id = ?',
      [txId, req.user.id]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
