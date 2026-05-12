const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// ── Helpers ──────────────────────────────────────────────────────────────────
const SCHEME_ENUM = ['three_month_profit','five_year_bangladesh','family_savings','pensioner_savings','wage_earner'];

function calcMaturityValue(faceValue, rate, issueDate, maturityDate, schemeType) {
  const principal = Number(faceValue); const r = Number(rate) / 100;
  const msPerDay = 86400000;
  const days = Math.max(0, (new Date(maturityDate) - new Date(issueDate)) / msPerDay);
  const months = days / 30.4375; const years = days / 365;
  if (schemeType === 'three_month_profit') {
    return principal * Math.pow(1 + r / 4, Math.floor(months / 3));
  } else if (schemeType === 'five_year_bangladesh') {
    return principal * Math.pow(1 + r, 5);
  } else if (schemeType === 'family_savings' || schemeType === 'pensioner_savings') {
    return principal + principal * r * (months / 12);
  } else if (schemeType === 'wage_earner') {
    return principal * Math.pow(1 + r, years);
  }
  return null;
}

// ── GET all ───────────────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM sanchayapatra WHERE user_id = ? ORDER BY issue_date DESC', [req.user.id]);
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET interest payments ─────────────────────────────────────────────────────
router.get('/:id/interest-payments', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM sanchayapatra_interest_payments WHERE sanchayapatra_id = ? ORDER BY due_date DESC', [req.params.id]);
    res.json(rows);
  } catch (err) { next(err); }
});

// ── POST create ───────────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { scheme_type, certificate_number, face_value, annual_interest_rate, issue_date, maturity_date, interest_payment_frequency = 'on_maturity', interest_payout_account_id, source_account_id, withholding_tax_rate = 10, tin_required = true, note } = req.body;
    if (!scheme_type || !certificate_number || !face_value || !annual_interest_rate || !issue_date || !maturity_date) {
      return res.status(400).json({ error: 'scheme_type, certificate_number, face_value, annual_interest_rate, issue_date and maturity_date are required.' });
    }
    if (!SCHEME_ENUM.includes(scheme_type)) return res.status(400).json({ error: `scheme_type must be one of: ${SCHEME_ENUM.join(', ')}` });

    const [result] = await pool.query(
      `INSERT INTO sanchayapatra (user_id, scheme_type, certificate_number, face_value, annual_interest_rate, issue_date, maturity_date, interest_payment_frequency, interest_payout_account_id, source_account_id, withholding_tax_rate, tin_required, status, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [req.user.id, scheme_type, certificate_number, Number(face_value), Number(annual_interest_rate), issue_date, maturity_date, interest_payment_frequency, interest_payout_account_id || null, source_account_id || null, Number(withholding_tax_rate), tin_required ? 1 : 0, note || null]
    );

    const mv = calcMaturityValue(face_value, annual_interest_rate, issue_date, maturity_date, scheme_type);
    res.json({ id: result.insertId, projected_maturity_value: mv ? Math.round(mv * 100) / 100 : null });
  } catch (err) { next(err); }
});

// ── PUT update ────────────────────────────────────────────────────────────────
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const [existing] = await pool.query('SELECT id FROM sanchayapatra WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!existing.length) return res.status(404).json({ error: 'Sanchayapatra not found.' });
    const fields = ['scheme_type','certificate_number','face_value','annual_interest_rate','issue_date','maturity_date','interest_payment_frequency','interest_payout_account_id','source_account_id','withholding_tax_rate','tin_required','encashment_date','encashment_value','encashment_credited_to_id','status','note'];
    const updates = []; const values = [];
    for (const f of fields) { if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); } }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update.' });
    values.push(req.params.id, req.user.id);
    await pool.query(`UPDATE sanchayapatra SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── DELETE (hard) ─────────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM sanchayapatra WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Sanchayapatra not found.' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── POST record interest payment ──────────────────────────────────────────────
router.post('/:id/interest-payment', requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { payment_no, due_date, paid_date, gross_amount, credited_to_account_id } = req.body;
    if (!payment_no || !due_date || !gross_amount) return res.status(400).json({ error: 'payment_no, due_date and gross_amount required.' });

    const [sp] = await conn.query('SELECT * FROM sanchayapatra WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!sp.length) { await conn.rollback(); return res.status(404).json({ error: 'Sanchayapatra not found' }); }

    const tdsRate = Number(sp[0].withholding_tax_rate) / 100;
    const tdsAmount = Math.round(Number(gross_amount) * tdsRate * 100) / 100;
    const netAmount = Math.round((Number(gross_amount) - tdsAmount) * 100) / 100;

    await conn.query(
      `INSERT INTO sanchayapatra_interest_payments (sanchayapatra_id, payment_no, due_date, paid_date, gross_amount, tds_amount, net_amount, credited_to_account_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, payment_no, due_date, paid_date || null, Number(gross_amount), tdsAmount, netAmount, credited_to_account_id || null, paid_date ? 'paid' : 'upcoming']
    );

    if (paid_date && credited_to_account_id) {
      await conn.query('UPDATE accounts SET current_balance = current_balance + ? WHERE id = ? AND user_id = ?', [netAmount, Number(credited_to_account_id), req.user.id]);
      await conn.query(`INSERT INTO transactions (user_id, account_id, type, amount, currency, transaction_date, category_id, source_type, payee, notes) VALUES (?, ?, 'income', ?, 'BDT', ?, 'Interest', 'account', 'Bangladesh Bank', ?)`, [req.user.id, Number(credited_to_account_id), netAmount, paid_date, `Sanchayapatra interest #${payment_no}`]);
    }
    await conn.commit();
    res.json({ ok: true, gross_amount: Number(gross_amount), tds_amount: tdsAmount, net_amount: netAmount });
  } catch (err) { await conn.rollback(); next(err); } finally { conn.release(); }
});

module.exports = router;
