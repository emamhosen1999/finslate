/* eslint-disable no-await-in-loop */
const express = require('express');
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

// ── Helpers ──────────────────────────────────────────────────────────────────
function calcEMI(principal, annualRate, tenureMonths, interestType = 'reducing_balance') {
  if (annualRate === 0) return principal / tenureMonths;
  if (interestType === 'flat') {
    const totalInterest = principal * (annualRate / 100) * (tenureMonths / 12);
    return (principal + totalInterest) / tenureMonths;
  }
  const r = annualRate / 100 / 12;
  return (principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1);
}

function buildSchedule(outstanding, emi, annualRate, interestType = 'reducing_balance', maxMonths = 600) {
  const schedule = [];
  let balance = outstanding;
  let totalInterest = 0;
  let totalPrincipal = 0;
  const r = annualRate / 100 / 12;
  const flatInterestPerMonth = interestType === 'flat' ? (outstanding * (annualRate / 100)) / 12 : 0;

  for (let month = 1; month <= maxMonths && balance > 0.01; month++) {
    const interestPart = interestType === 'flat' ? flatInterestPerMonth : balance * r;
    let principalPart = emi - interestPart;
    if (principalPart > balance) principalPart = balance;
    balance -= principalPart;
    totalInterest += interestPart;
    totalPrincipal += principalPart;
    schedule.push({ month, emi: Math.round(emi * 100) / 100, principal_portion: Math.round(principalPart * 100) / 100, interest_portion: Math.round(interestPart * 100) / 100, outstanding_after: Math.max(0, Math.round(balance * 100) / 100) });
  }
  return { schedule, totalInterest, totalPrincipal };
}

// ── GET all loans ─────────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, lender_name, loan_type, purpose, principal_amount, outstanding_balance,
              annual_interest_rate, interest_type, tenure_months, emi_amount,
              disbursement_date, first_emi_date, emi_day_of_month,
              repayment_account_id, loan_account_number, guarantor_name,
              late_fee_rate, prepayment_penalty_pct, status, closed_date, created_at
       FROM loans WHERE user_id = ? ORDER BY id`,
      [req.user.id],
    );
    res.json({ loans: rows });
  } catch (err) {
    next(err);
  }
});

// ── POST create loan ──────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const {
      lender_name, loan_type = 'personal', purpose,
      principal_amount, annual_interest_rate = 0, interest_type = 'reducing_balance',
      tenure_months = 12, emi_amount,
      disbursement_date, first_emi_date, emi_day_of_month,
      repayment_account_id, loan_account_number, guarantor_name, collateral_description,
      late_fee_rate = 0, prepayment_penalty_pct = 0,
    } = req.body;
    if (!lender_name || !principal_amount) {
      return res.status(400).json({ error: 'lender_name and principal_amount are required.' });
    }
    const p = Number(principal_amount);
    const emi = emi_amount ? Number(emi_amount) : Math.round(calcEMI(p, Number(annual_interest_rate), Number(tenure_months), interest_type) * 100) / 100;
    const [result] = await pool.query(
      `INSERT INTO loans (user_id, lender_name, loan_type, purpose, principal_amount, outstanding_balance,
         annual_interest_rate, interest_type, tenure_months, emi_amount,
         disbursement_date, first_emi_date, emi_day_of_month, repayment_account_id,
         loan_account_number, guarantor_name, collateral_description, late_fee_rate, prepayment_penalty_pct)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, lender_name.trim(), loan_type, purpose || null, p, p,
       Number(annual_interest_rate), interest_type, Number(tenure_months), emi,
       disbursement_date || null, first_emi_date || null, emi_day_of_month || null, repayment_account_id || null,
       loan_account_number || null, guarantor_name || null, collateral_description || null,
       Number(late_fee_rate), Number(prepayment_penalty_pct)],
    );
    const [newLoan] = await pool.query('SELECT * FROM loans WHERE id = ?', [result.insertId]);
    res.status(201).json(newLoan[0]);
  } catch (err) {
    next(err);
  }
});

// ── PUT update loan ───────────────────────────────────────────────────────────
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const loanId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM loans WHERE id = ? AND user_id = ?', [loanId, req.user.id]);
    if (!existing.length) return res.status(404).json({ error: 'Loan not found.' });

    const fields = ['lender_name','loan_type','purpose','principal_amount','outstanding_balance',
      'annual_interest_rate','interest_type','tenure_months','emi_amount','disbursement_date',
      'first_emi_date','emi_day_of_month','repayment_account_id','loan_account_number',
      'guarantor_name','collateral_description','late_fee_rate','prepayment_penalty_pct','status','closed_date'];
    const updates = []; const values = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); }
    }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update.' });
    values.push(loanId, req.user.id);
    await pool.query(`UPDATE loans SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── DELETE loan ───────────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const loanId = Number(req.params.id);
    const [result] = await pool.query('DELETE FROM loans WHERE id = ? AND user_id = ?', [loanId, req.user.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Loan not found.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── POST make payment ─────────────────────────────────────────────────────────
router.post('/:id/pay', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { amount, account_id, installment_no, note } = req.body;
    const loanId = Number(req.params.id);
    if (!amount) return res.status(400).json({ error: 'Payment amount is required.' });

    const paymentAmount = Number(amount);
    const [existing] = await connection.query('SELECT * FROM loans WHERE id = ? AND user_id = ?', [loanId, req.user.id]);
    if (!existing.length) return res.status(404).json({ error: 'Loan not found.' });

    const loan = existing[0];
    const currentBalance = Number(loan.outstanding_balance) || 0;
    if (paymentAmount > currentBalance) return res.status(400).json({ error: 'Payment exceeds outstanding balance.' });

    const newBalance = Math.max(0, currentBalance - paymentAmount);
    await connection.query('UPDATE loans SET outstanding_balance = ?, status = IF(? = 0, \'closed\', status) WHERE id = ? AND user_id = ?', [newBalance, newBalance, loanId, req.user.id]);

    if (account_id) {
      const [account] = await connection.query('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [Number(account_id), req.user.id]);
      if (!account.length) return res.status(404).json({ error: 'Account not found.' });

      await connection.query(
        `INSERT INTO transactions (user_id, account_id, type, amount, currency, transaction_date, category_id, source_type, payee, notes, ref_type, ref_id)
         VALUES (?, ?, 'expense', ?, 'BDT', CURDATE(), 'Loan', 'account', ?, ?, 'loan_repayment', ?)`,
        [req.user.id, Number(account_id), paymentAmount, loan.lender_name, note || `Loan EMI: ${loan.lender_name}`, loanId],
      );
      await connection.query('UPDATE accounts SET current_balance = current_balance - ? WHERE id = ? AND user_id = ?', [paymentAmount, Number(account_id), req.user.id]);
    }
    await connection.commit();
    res.json({ ok: true, new_outstanding_balance: newBalance });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// ── GET amortization schedule ─────────────────────────────────────────────────
router.get('/:id/amortization', requireAuth, async (req, res, next) => {
  try {
    const loanId = Number(req.params.id);
    const [loan] = await pool.query('SELECT * FROM loans WHERE id = ? AND user_id = ?', [loanId, req.user.id]);
    if (!loan.length) return res.status(404).json({ error: 'Loan not found.' });

    const d = loan[0];
    const outstanding = Number(d.outstanding_balance) || Number(d.principal_amount);
    const emi = Number(d.emi_amount);
    const annualRate = Number(d.annual_interest_rate);
    const interestType = d.interest_type || 'reducing_balance';

    if (!emi) return res.status(400).json({ error: 'EMI amount required for amortization.' });

    const { schedule, totalInterest, totalPrincipal } = buildSchedule(outstanding, emi, annualRate, interestType);

    res.json({
      loan_id: loanId, lender_name: d.lender_name, principal_amount: Number(d.principal_amount),
      outstanding_balance: outstanding, emi_amount: emi, annual_interest_rate: annualRate, interest_type: interestType,
      total_months: schedule.length, total_payment: Math.round((totalInterest + totalPrincipal) * 100) / 100,
      total_interest: Math.round(totalInterest * 100) / 100, total_principal: Math.round(totalPrincipal * 100) / 100,
      schedule,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST prepayment simulation ────────────────────────────────────────────────
router.post('/:id/prepayment-simulation', requireAuth, async (req, res, next) => {
  try {
    const loanId = Number(req.params.id);
    const { prepayment_amount } = req.body;
    if (!prepayment_amount) return res.status(400).json({ error: 'prepayment_amount is required.' });

    const [loan] = await pool.query('SELECT * FROM loans WHERE id = ? AND user_id = ?', [loanId, req.user.id]);
    if (!loan.length) return res.status(404).json({ error: 'Loan not found.' });

    const d = loan[0];
    const outstanding = Number(d.outstanding_balance);
    const emi = Number(d.emi_amount);
    const annualRate = Number(d.annual_interest_rate);
    const interestType = d.interest_type;
    const prepayment = Number(prepayment_amount);
    if (prepayment > outstanding) return res.status(400).json({ error: 'Prepayment exceeds outstanding balance.' });

    const orig = buildSchedule(outstanding, emi, annualRate, interestType);
    const after = buildSchedule(outstanding - prepayment, emi, annualRate, interestType);

    res.json({
      loan_id: loanId, lender_name: d.lender_name, prepayment_amount: prepayment,
      original_outstanding: outstanding, new_outstanding: outstanding - prepayment,
      original_months: orig.schedule.length, new_months: after.schedule.length,
      months_saved: orig.schedule.length - after.schedule.length,
      original_total_interest: Math.round(orig.totalInterest * 100) / 100,
      new_total_interest: Math.round(after.totalInterest * 100) / 100,
      interest_saved: Math.round((orig.totalInterest - after.totalInterest) * 100) / 100,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET calculate EMI ─────────────────────────────────────────────────────────
router.post('/calculate-emi', requireAuth, async (req, res, next) => {
  try {
    const { principal_amount, annual_interest_rate, tenure_months, interest_type = 'reducing_balance' } = req.body;
    if (!principal_amount || !tenure_months) return res.status(400).json({ error: 'principal_amount and tenure_months required.' });
    const emi = calcEMI(Number(principal_amount), Number(annual_interest_rate) || 0, Number(tenure_months), interest_type);
    const total = emi * Number(tenure_months);
    res.json({ emi: Math.round(emi * 100) / 100, total_payment: Math.round(total * 100) / 100, total_interest: Math.round((total - Number(principal_amount)) * 100) / 100 });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
