const express = require('express');
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, limit_amt, due_amount, due_date, created_at FROM credit_cards WHERE user_id = ? ORDER BY id',
      [req.user.id],
    );
    res.json({ creditCards: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, limit_amt, due_date } = req.body;
    if (!name || !limit_amt) {
      return res.status(400).json({ error: 'Name and limit are required.' });
    }
    const [result] = await pool.query(
      'INSERT INTO credit_cards (user_id, name, limit_amt, due_amount, due_date) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, name.trim(), Number(limit_amt), 0, due_date || null],
    );
    res.status(201).json({
      id: result.insertId,
      name: name.trim(),
      limit_amt: Number(limit_amt),
      due_amount: 0,
      due_date: due_date || null,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, limit_amt, due_amount, due_date } = req.body;
    const cardId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM credit_cards WHERE id = ? AND user_id = ?', [cardId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Credit card not found.' });
    }
    const updates = [];
    const values = [];
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (limit_amt !== undefined) {
      updates.push('limit_amt = ?');
      values.push(Number(limit_amt));
    }
    if (due_amount !== undefined) {
      updates.push('due_amount = ?');
      values.push(Number(due_amount));
    }
    if (due_date !== undefined) {
      updates.push('due_date = ?');
      values.push(due_date || null);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }
    values.push(cardId, req.user.id);
    await pool.query(`UPDATE credit_cards SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ message: 'Credit card updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const cardId = Number(req.params.id);
    const [result] = await pool.query('DELETE FROM credit_cards WHERE id = ? AND user_id = ?', [cardId, req.user.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Credit card not found.' });
    }
    res.json({ message: 'Credit card deleted.' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/pay', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { amount, account_id } = req.body;
    const cardId = Number(req.params.id);
    if (!amount) {
      return res.status(400).json({ error: 'Payment amount is required.' });
    }
    const paymentAmount = Number(amount);
    const [existing] = await connection.query('SELECT * FROM credit_cards WHERE id = ? AND user_id = ?', [cardId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Credit card not found.' });
    }
    const card = existing[0];
    const currentDue = Number(card.due_amount) || 0;
    if (paymentAmount > currentDue) {
      return res.status(400).json({ error: 'Payment amount exceeds due amount.' });
    }
    const newDue = Math.max(0, currentDue - paymentAmount);
    await connection.query(
      'UPDATE credit_cards SET due_amount = ? WHERE id = ? AND user_id = ?',
      [newDue, cardId, req.user.id],
    );
    if (account_id) {
      const [account] = await connection.query('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [Number(account_id), req.user.id]);
      if (!account.length) {
        return res.status(404).json({ error: 'Account not found.' });
      }
      await connection.query(
        'INSERT INTO transactions (user_id, account_id, type, amount, category, description) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.id, Number(account_id), 'debit', paymentAmount, 'Credit Card Payment', `Payment to ${card.name}`],
      );
      await connection.query(
        'UPDATE accounts SET balance = balance - ? WHERE id = ? AND user_id = ?',
        [paymentAmount, Number(account_id), req.user.id],
      );
    }
    await connection.commit();
    res.json({ message: 'Payment successful.', newDue });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// Calculate interest for a credit card
router.get('/:id/calculate-interest', requireAuth, async (req, res, next) => {
  try {
    const cardId = Number(req.params.id);
    const { days = 30 } = req.query;
    const periodDays = Math.max(1, Math.min(365, parseInt(days)));

    const [card] = await pool.query(
      'SELECT * FROM credit_cards WHERE id = ? AND user_id = ?',
      [cardId, req.user.id]
    );

    if (!card.length) {
      return res.status(404).json({ error: 'Credit card not found.' });
    }

    const cc = card[0];
    const annualRate = cc.annual_interest_rate || 0;
    const monthlyRate = cc.monthly_interest_rate || (annualRate / 12);
    const dueAmount = Number(cc.due_amount) || 0;

    if (dueAmount === 0 || monthlyRate === 0) {
      return res.json({
        card_id: cardId,
        due_amount: dueAmount,
        annual_rate: annualRate,
        monthly_rate: monthlyRate,
        period_days: periodDays,
        interest: 0,
        daily_rate: annualRate / 365
      });
    }

    // Calculate daily rate (annual rate / 365)
    const dailyRate = annualRate / 100 / 365;
    const interest = dueAmount * dailyRate * periodDays;

    res.json({
      card_id: cardId,
      card_name: cc.name,
      due_amount: dueAmount,
      annual_rate: annualRate,
      monthly_rate: monthlyRate,
      period_days: periodDays,
      interest: Math.round(interest * 100) / 100,
      daily_rate: Math.round(dailyRate * 10000) / 10000
    });
  } catch (err) {
    next(err);
  }
});

// Calculate utilization for a credit card
router.get('/:id/utilization', requireAuth, async (req, res, next) => {
  try {
    const cardId = Number(req.params.id);

    const [card] = await pool.query(
      'SELECT * FROM credit_cards WHERE id = ? AND user_id = ?',
      [cardId, req.user.id]
    );

    if (!card.length) {
      return res.status(404).json({ error: 'Credit card not found.' });
    }

    const cc = card[0];
    const limitAmt = Number(cc.limit_amt) || 0;
    const dueAmount = Number(cc.due_amount) || 0;

    if (limitAmt === 0) {
      return res.json({
        card_id: cardId,
        card_name: cc.name,
        limit_amt: limitAmt,
        due_amount: dueAmount,
        utilization_pct: 0,
        available_credit: 0
      });
    }

    const utilizationPct = (dueAmount / limitAmt) * 100;
    const availableCredit = limitAmt - dueAmount;

    res.json({
      card_id: cardId,
      card_name: cc.name,
      limit_amt: limitAmt,
      due_amount: dueAmount,
      utilization_pct: Math.round(utilizationPct * 100) / 100,
      available_credit: Math.round(availableCredit * 100) / 100,
      utilization_level: utilizationPct < 30 ? 'low' : utilizationPct < 70 ? 'medium' : 'high'
    });
  } catch (err) {
    next(err);
  }
});

// Get utilization for all credit cards
router.get('/utilization/all', requireAuth, async (req, res, next) => {
  try {
    const [cards] = await pool.query(
      'SELECT * FROM credit_cards WHERE user_id = ? AND is_active = TRUE',
      [req.user.id]
    );

    const utilizationData = cards.map(cc => {
      const limitAmt = Number(cc.limit_amt) || 0;
      const dueAmount = Number(cc.due_amount) || 0;
      const utilizationPct = limitAmt > 0 ? (dueAmount / limitAmt) * 100 : 0;

      return {
        card_id: cc.id,
        card_name: cc.name,
        limit_amt: limitAmt,
        due_amount: dueAmount,
        utilization_pct: Math.round(utilizationPct * 100) / 100,
        available_credit: limitAmt - dueAmount,
        utilization_level: utilizationPct < 30 ? 'low' : utilizationPct < 70 ? 'medium' : 'high'
      };
    });

    const totalLimit = utilizationData.reduce((sum, c) => sum + c.limit_amt, 0);
    const totalDue = utilizationData.reduce((sum, c) => sum + c.due_amount, 0);
    const overallUtilization = totalLimit > 0 ? (totalDue / totalLimit) * 100 : 0;

    res.json({
      cards: utilizationData,
      summary: {
        total_limit: totalLimit,
        total_due: totalDue,
        overall_utilization_pct: Math.round(overallUtilization * 100) / 100,
        overall_utilization_level: overallUtilization < 30 ? 'low' : overallUtilization < 70 ? 'medium' : 'high'
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
