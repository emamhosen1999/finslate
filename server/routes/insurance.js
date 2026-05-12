const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// ── GET all insurances ────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT i.*, a.name AS linked_account_name
       FROM insurances i
       LEFT JOIN accounts a ON i.linked_account_id = a.id
       WHERE i.user_id = ? ORDER BY i.policy_start_date DESC`,
      [req.user.id],
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET premium payments for one policy ───────────────────────────────────────
router.get('/:id/payments', requireAuth, async (req, res, next) => {
  try {
    const insId = Number(req.params.id);
    const [own] = await pool.query('SELECT id FROM insurances WHERE id = ? AND user_id = ?', [insId, req.user.id]);
    if (!own.length) return res.status(404).json({ error: 'Insurance not found.' });
    const [rows] = await pool.query('SELECT * FROM insurance_premium_payments WHERE insurance_id = ? ORDER BY due_date DESC', [insId]);
    res.json(rows);
  } catch (err) { next(err); }
});

// ── POST create insurance ─────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { type, provider_name, policy_number, plan_name, sum_assured = 0, premium_amount, premium_frequency = 'yearly', premium_due_day, policy_start_date, policy_end_date, maturity_value, surrender_value, nominee_name, nominee_relation, agent_name, linked_account_id } = req.body;
    if (!type || !provider_name || !policy_number || !premium_amount || !policy_start_date) {
      return res.status(400).json({ error: 'type, provider_name, policy_number, premium_amount and policy_start_date are required.' });
    }
    const [result] = await pool.query(
      `INSERT INTO insurances (user_id, type, provider_name, policy_number, plan_name, sum_assured, premium_amount, premium_frequency, premium_due_day, policy_start_date, policy_end_date, maturity_value, surrender_value, nominee_name, nominee_relation, agent_name, linked_account_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [req.user.id, type, provider_name.trim(), policy_number.trim(), plan_name || null, Number(sum_assured), Number(premium_amount), premium_frequency, premium_due_day || null, policy_start_date, policy_end_date || null, maturity_value || null, surrender_value || null, nominee_name || null, nominee_relation || null, agent_name || null, linked_account_id ? Number(linked_account_id) : null],
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) { next(err); }
});

// ── PUT update insurance ──────────────────────────────────────────────────────
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const insId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM insurances WHERE id = ? AND user_id = ?', [insId, req.user.id]);
    if (!existing.length) return res.status(404).json({ error: 'Insurance not found.' });
    const fields = ['type','provider_name','policy_number','plan_name','sum_assured','premium_amount','premium_frequency','premium_due_day','policy_start_date','policy_end_date','maturity_value','surrender_value','nominee_name','nominee_relation','agent_name','linked_account_id','status'];
    const updates = []; const values = [];
    for (const f of fields) { if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); } }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update.' });
    values.push(insId, req.user.id);
    await pool.query(`UPDATE insurances SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── DELETE insurance ──────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM insurances WHERE id = ? AND user_id = ?', [Number(req.params.id), req.user.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Insurance not found.' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── POST pay premium ──────────────────────────────────────────────────────────
router.post('/:id/pay', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { due_date, paid_date, amount, late_fee = 0, source_account_id } = req.body;
    const insId = Number(req.params.id);

    const [existing] = await connection.query('SELECT * FROM insurances WHERE id = ? AND user_id = ?', [insId, req.user.id]);
    if (!existing.length) return res.status(404).json({ error: 'Insurance not found.' });
    const ins = existing[0];

    const payAmount = amount ? Number(amount) : Number(ins.premium_amount);
    const lateFeeAmt = Number(late_fee);
    const total = payAmount + lateFeeAmt;
    const accountId = source_account_id ? Number(source_account_id) : ins.linked_account_id;

    await connection.query(
      `INSERT INTO insurance_premium_payments (insurance_id, due_date, paid_date, amount, late_fee, source_account_id, status)
       VALUES (?, ?, ?, ?, ?, ?, 'paid')`,
      [insId, due_date || new Date().toISOString().slice(0, 10), paid_date || new Date().toISOString().slice(0, 10), payAmount, lateFeeAmt, accountId || null],
    );

    if (accountId) {
      await connection.query('UPDATE accounts SET current_balance = current_balance - ? WHERE id = ? AND user_id = ?', [total, accountId, req.user.id]);
      await connection.query(
        `INSERT INTO transactions (user_id, account_id, type, amount, currency, transaction_date, category_id, source_type, payee, notes)
         VALUES (?, ?, 'expense', ?, 'BDT', CURDATE(), 'Insurance', 'account', ?, ?)`,
        [req.user.id, accountId, total, ins.provider_name, `Premium: ${ins.policy_number}${lateFeeAmt > 0 ? ` + late fee ${lateFeeAmt}` : ''}`],
      );
    }

    await connection.commit();
    res.json({ ok: true, paid: payAmount, late_fee: lateFeeAmt, total });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

module.exports = router;
