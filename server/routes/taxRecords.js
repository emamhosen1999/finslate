const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// ── Helpers ──────────────────────────────────────────────────────────────────
function calcTaxSlabs(taxableIncome, residenceType = 'resident') {
  let tax = 0; const slabs = [];
  if (residenceType !== 'resident') {
    tax = taxableIncome * 0.30;
    slabs.push({ from: 0, to: null, rate: 30, taxable: taxableIncome, tax });
    return { tax, slabs };
  }
  const brackets = [
    { limit: 350000, rate: 0 },
    { limit: 1000000, rate: 5 },
    { limit: 3000000, rate: 10 },
    { limit: 4000000, rate: 15 },
    { limit: 5000000, rate: 20 },
    { limit: Infinity, rate: 25 },
  ];
  let prev = 0;
  for (const { limit, rate } of brackets) {
    if (taxableIncome <= prev) break;
    const taxable = Math.min(taxableIncome - prev, limit - prev);
    const slabTax = taxable * rate / 100;
    tax += slabTax;
    slabs.push({ from: prev, to: limit === Infinity ? null : limit, rate, taxable: Math.round(taxable), tax: Math.round(slabTax * 100) / 100 });
    prev = limit;
  }
  if (taxableIncome > 350000 && tax < 5000) tax = 5000;
  return { tax, slabs };
}

// ── GET all ───────────────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tax_records WHERE user_id = ? ORDER BY fiscal_year DESC', [req.user.id]);
    res.json(rows);
  } catch (err) { next(err); }
});

// ── POST create ───────────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const {
      fiscal_year, tax_year_start, tax_year_end,
      salary_income = 0, business_income = 0, rental_income = 0, investment_income = 0, other_income = 0,
      investment_in_dps = 0, investment_in_sanchayapatra = 0, investment_in_pf = 0, insurance_premium_paid = 0,
      investment_rebate_pct = 15,
      tds_deducted = 0, advance_tax_paid = 0,
      assessment_year, acknowledgement_number, note
    } = req.body;

    if (!fiscal_year || !tax_year_start || !tax_year_end) return res.status(400).json({ error: 'fiscal_year, tax_year_start and tax_year_end required.' });

    const gross_income = Number(salary_income) + Number(business_income) + Number(rental_income) + Number(investment_income) + Number(other_income);
    const total_allowable_investment = Math.min(Number(investment_in_dps) + Number(investment_in_sanchayapatra) + Number(investment_in_pf) + Number(insurance_premium_paid), 0.25 * gross_income, 1500000);
    const investment_rebate_amount = Math.round(total_allowable_investment * Number(investment_rebate_pct) / 100 * 100) / 100;
    const taxable_income = Math.max(0, gross_income);
    const { tax } = calcTaxSlabs(taxable_income);
    const tax_at_slab = Math.round(tax * 100) / 100;
    const tax_liability_after_rebate = Math.max(0, Math.round((tax_at_slab - investment_rebate_amount) * 100) / 100);
    const net_tax_payable = Math.max(0, Math.round((tax_liability_after_rebate - Number(tds_deducted) - Number(advance_tax_paid)) * 100) / 100);

    const [result] = await pool.query(
      `INSERT INTO tax_records (user_id, fiscal_year, tax_year_start, tax_year_end, gross_income, salary_income, business_income, rental_income, investment_income, other_income, investment_in_dps, investment_in_sanchayapatra, investment_in_pf, insurance_premium_paid, total_allowable_investment, investment_rebate_pct, investment_rebate_amount, taxable_income, tax_at_slab, tax_liability_before_rebate, tax_liability_after_rebate, tds_deducted, advance_tax_paid, net_tax_payable, assessment_year, acknowledgement_number, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, fiscal_year, tax_year_start, tax_year_end, gross_income, Number(salary_income), Number(business_income), Number(rental_income), Number(investment_income), Number(other_income), Number(investment_in_dps), Number(investment_in_sanchayapatra), Number(investment_in_pf), Number(insurance_premium_paid), total_allowable_investment, Number(investment_rebate_pct), investment_rebate_amount, taxable_income, tax_at_slab, tax_at_slab, tax_liability_after_rebate, Number(tds_deducted), Number(advance_tax_paid), net_tax_payable, assessment_year || null, acknowledgement_number || null, note || null]
    );
    res.json({ id: result.insertId, gross_income, taxable_income, tax_at_slab, investment_rebate_amount, tax_liability_after_rebate, net_tax_payable });
  } catch (err) { next(err); }
});

// ── PUT update ────────────────────────────────────────────────────────────────
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const editable = ['fiscal_year','tax_year_start','tax_year_end','salary_income','business_income','rental_income','investment_income','other_income','investment_in_dps','investment_in_sanchayapatra','investment_in_pf','insurance_premium_paid','investment_rebate_pct','tds_deducted','advance_tax_paid','return_filed_date','assessment_year','acknowledgement_number','note'];
    const updates = []; const values = [];
    for (const f of editable) { if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); } }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update.' });
    values.push(req.params.id, req.user.id);
    await pool.query(`UPDATE tax_records SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── DELETE ────────────────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM tax_records WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── POST mark return filed ────────────────────────────────────────────────────
router.post('/:id/file', requireAuth, async (req, res, next) => {
  try {
    const { return_filed_date, acknowledgement_number } = req.body;
    await pool.query('UPDATE tax_records SET return_filed_date = ?, acknowledgement_number = ? WHERE id = ? AND user_id = ?', [return_filed_date || new Date().toISOString().split('T')[0], acknowledgement_number || null, req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── POST calculate (estimate without persisting) ──────────────────────────────
router.post('/calculate', requireAuth, async (req, res, next) => {
  try {
    const { salary_income = 0, business_income = 0, rental_income = 0, investment_income = 0, other_income = 0, investment_in_dps = 0, investment_in_sanchayapatra = 0, investment_in_pf = 0, insurance_premium_paid = 0, investment_rebate_pct = 15, tds_deducted = 0, advance_tax_paid = 0, residence_type = 'resident' } = req.body;

    const gross_income = Number(salary_income) + Number(business_income) + Number(rental_income) + Number(investment_income) + Number(other_income);
    const total_allowable = Math.min(Number(investment_in_dps) + Number(investment_in_sanchayapatra) + Number(investment_in_pf) + Number(insurance_premium_paid), 0.25 * gross_income, 1500000);
    const rebate = Math.round(total_allowable * Number(investment_rebate_pct) / 100 * 100) / 100;
    const { tax, slabs } = calcTaxSlabs(gross_income, residence_type);
    const tax_slab = Math.round(tax * 100) / 100;
    const after_rebate = Math.max(0, Math.round((tax_slab - rebate) * 100) / 100);
    const net_payable = Math.max(0, Math.round((after_rebate - Number(tds_deducted) - Number(advance_tax_paid)) * 100) / 100);

    res.json({ gross_income, total_allowable_investment: Math.round(total_allowable * 100) / 100, investment_rebate_amount: rebate, tax_at_slab: tax_slab, tax_after_rebate: after_rebate, tds_deducted: Number(tds_deducted), advance_tax_paid: Number(advance_tax_paid), net_tax_payable: net_payable, slabs });
  } catch (err) { next(err); }
});

module.exports = router;
