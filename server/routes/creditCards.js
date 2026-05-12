const express = require('express');
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

// ── Helpers ──────────────────────────────────────────────────────────────────
function calcUtilization(cc) {
  const limit = Number(cc.credit_limit) || 0;
  const outstanding = Number(cc.current_outstanding) || 0;
  const pct = limit > 0 ? (outstanding / limit) * 100 : 0;
  return {
    utilization_pct: Math.round(pct * 100) / 100,
    available_credit: Math.round((limit - outstanding) * 100) / 100,
    utilization_level: pct < 30 ? 'low' : pct < 70 ? 'medium' : 'high',
    minimum_due: Math.max(
      Number(cc.minimum_payment_fixed) || 500,
      Math.round(outstanding * ((Number(cc.minimum_payment_pct) || 5) / 100) * 100) / 100,
    ),
  };
}

// ── GET all cards ─────────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, issuer, card_name, card_number_last4, card_type,
              credit_limit, current_outstanding, billing_cycle_day, payment_due_day,
              annual_interest_rate, minimum_payment_pct, minimum_payment_fixed,
              cash_advance_limit, cash_advance_rate, reward_points,
              is_active, linked_bank_account_id, color, created_at
       FROM credit_cards WHERE user_id = ? ORDER BY id`,
      [req.user.id],
    );
    const cards = rows.map(cc => ({ ...cc, ...calcUtilization(cc) }));
    res.json({ creditCards: cards });
  } catch (err) {
    next(err);
  }
});

// ── POST create card ──────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const {
      issuer, card_name, card_number_last4, card_type,
      credit_limit, current_outstanding = 0,
      billing_cycle_day, payment_due_day,
      annual_interest_rate, minimum_payment_pct = 5, minimum_payment_fixed = 500,
      cash_advance_limit, cash_advance_rate, linked_bank_account_id, color,
    } = req.body;
    if (!card_name || !credit_limit) {
      return res.status(400).json({ error: 'card_name and credit_limit are required.' });
    }
    const [result] = await pool.query(
      `INSERT INTO credit_cards
        (user_id, issuer, card_name, card_number_last4, card_type, credit_limit, current_outstanding,
         billing_cycle_day, payment_due_day, annual_interest_rate, minimum_payment_pct, minimum_payment_fixed,
         cash_advance_limit, cash_advance_rate, linked_bank_account_id, color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, issuer || 'Unknown', card_name.trim(), card_number_last4 || null, card_type || null,
       Number(credit_limit), Number(current_outstanding), billing_cycle_day || null, payment_due_day || null,
       annual_interest_rate || null, Number(minimum_payment_pct), Number(minimum_payment_fixed),
       cash_advance_limit || null, cash_advance_rate || null, linked_bank_account_id || null, color || null],
    );
    const [newCard] = await pool.query('SELECT * FROM credit_cards WHERE id = ?', [result.insertId]);
    res.status(201).json({ ...newCard[0], ...calcUtilization(newCard[0]) });
  } catch (err) {
    next(err);
  }
});

// ── PUT update card ───────────────────────────────────────────────────────────
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const cardId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM credit_cards WHERE id = ? AND user_id = ?', [cardId, req.user.id]);
    if (!existing.length) return res.status(404).json({ error: 'Credit card not found.' });

    const fields = ['issuer','card_name','card_number_last4','card_type','credit_limit',
      'current_outstanding','billing_cycle_day','payment_due_day','annual_interest_rate',
      'minimum_payment_pct','minimum_payment_fixed','cash_advance_limit','cash_advance_rate',
      'reward_points','is_active','linked_bank_account_id','color'];
    const updates = []; const values = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); }
    }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update.' });
    values.push(cardId, req.user.id);
    await pool.query(`UPDATE credit_cards SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── DELETE card ───────────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const cardId = Number(req.params.id);
    const [result] = await pool.query('DELETE FROM credit_cards WHERE id = ? AND user_id = ?', [cardId, req.user.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Credit card not found.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── POST pay outstanding ──────────────────────────────────────────────────────
router.post('/:id/pay', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { amount, account_id, payment_type = 'partial', reference_no, note } = req.body;
    const cardId = Number(req.params.id);
    if (!amount) return res.status(400).json({ error: 'Payment amount is required.' });

    const paymentAmount = Number(amount);
    const [existing] = await connection.query('SELECT * FROM credit_cards WHERE id = ? AND user_id = ?', [cardId, req.user.id]);
    if (!existing.length) return res.status(404).json({ error: 'Credit card not found.' });

    const card = existing[0];
    const currentOutstanding = Number(card.current_outstanding) || 0;
    if (paymentAmount > currentOutstanding) {
      return res.status(400).json({ error: 'Payment amount exceeds outstanding balance.' });
    }
    const newOutstanding = Math.max(0, currentOutstanding - paymentAmount);
    await connection.query(
      'UPDATE credit_cards SET current_outstanding = ? WHERE id = ? AND user_id = ?',
      [newOutstanding, cardId, req.user.id],
    );

    if (account_id) {
      const [account] = await connection.query('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [Number(account_id), req.user.id]);
      if (!account.length) return res.status(404).json({ error: 'Account not found.' });

      await connection.query(
        `INSERT INTO transactions (user_id, account_id, type, amount, currency, transaction_date, category_id, source_type, payee, notes)
         VALUES (?, ?, 'expense', ?, 'BDT', CURDATE(), 'Credit Card Payment', 'account', ?, ?)`,
        [req.user.id, Number(account_id), paymentAmount, card.card_name, note || `CC payment: ${card.card_name}`],
      );
      await connection.query(
        'UPDATE accounts SET current_balance = current_balance - ? WHERE id = ? AND user_id = ?',
        [paymentAmount, Number(account_id), req.user.id],
      );

      await connection.query(
        `INSERT INTO credit_card_payments (credit_card_id, paid_from_account_id, amount, payment_type, payment_date, reference_no, note)
         VALUES (?, ?, ?, ?, CURDATE(), ?, ?)`,
        [cardId, Number(account_id), paymentAmount, payment_type, reference_no || null, note || null],
      );
    }
    await connection.commit();
    res.json({ ok: true, new_outstanding: newOutstanding });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// ── GET utilization (all) ─────────────────────────────────────────────────────
router.get('/utilization/all', requireAuth, async (req, res, next) => {
  try {
    const [cards] = await pool.query(
      'SELECT * FROM credit_cards WHERE user_id = ? AND is_active = TRUE', [req.user.id],
    );
    const data = cards.map(cc => ({ card_id: cc.id, card_name: cc.card_name, credit_limit: Number(cc.credit_limit), current_outstanding: Number(cc.current_outstanding), ...calcUtilization(cc) }));
    const totalLimit = data.reduce((s, c) => s + c.credit_limit, 0);
    const totalOutstanding = data.reduce((s, c) => s + c.current_outstanding, 0);
    const overallPct = totalLimit > 0 ? (totalOutstanding / totalLimit) * 100 : 0;
    res.json({ cards: data, summary: { total_limit: totalLimit, total_outstanding: totalOutstanding, overall_utilization_pct: Math.round(overallPct * 100) / 100, overall_utilization_level: overallPct < 30 ? 'low' : overallPct < 70 ? 'medium' : 'high' } });
  } catch (err) {
    next(err);
  }
});

// ── GET utilization (single) ──────────────────────────────────────────────────
router.get('/:id/utilization', requireAuth, async (req, res, next) => {
  try {
    const [card] = await pool.query('SELECT * FROM credit_cards WHERE id = ? AND user_id = ?', [Number(req.params.id), req.user.id]);
    if (!card.length) return res.status(404).json({ error: 'Credit card not found.' });
    const cc = card[0];
    res.json({ card_id: cc.id, card_name: cc.card_name, credit_limit: Number(cc.credit_limit), current_outstanding: Number(cc.current_outstanding), ...calcUtilization(cc) });
  } catch (err) {
    next(err);
  }
});

// ── GET interest calculation ──────────────────────────────────────────────────
router.get('/:id/calculate-interest', requireAuth, async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const periodDays = Math.max(1, Math.min(365, parseInt(days)));
    const [card] = await pool.query('SELECT * FROM credit_cards WHERE id = ? AND user_id = ?', [Number(req.params.id), req.user.id]);
    if (!card.length) return res.status(404).json({ error: 'Credit card not found.' });
    const cc = card[0];
    const annualRate = Number(cc.annual_interest_rate) || 0;
    const outstanding = Number(cc.current_outstanding) || 0;
    // Interest = outstanding × (annualRate/365/100) × days
    const dailyRate = annualRate / 100 / 365;
    const interest = outstanding * dailyRate * periodDays;
    res.json({ card_id: cc.id, card_name: cc.card_name, current_outstanding: outstanding, annual_rate: annualRate, daily_rate: Math.round(dailyRate * 10000) / 10000, period_days: periodDays, interest: Math.round(interest * 100) / 100 });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
