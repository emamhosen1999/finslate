const express = require('express');
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, principal, remaining, monthly_emi, interest_rate, created_at FROM loans WHERE user_id = ? ORDER BY id',
      [req.user.id],
    );
    res.json({ loans: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, principal, monthly_emi, interest_rate } = req.body;
    if (!name || !principal || !monthly_emi) {
      return res.status(400).json({ error: 'Name, principal, and monthly EMI are required.' });
    }
    const principalNum = Number(principal);
    const [result] = await pool.query(
      'INSERT INTO loans (user_id, name, principal, remaining, monthly_emi, interest_rate) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, name.trim(), principalNum, principalNum, Number(monthly_emi), interest_rate || null],
    );
    res.status(201).json({
      id: result.insertId,
      name: name.trim(),
      principal: principalNum,
      remaining: principalNum,
      monthly_emi: Number(monthly_emi),
      interest_rate: interest_rate || null,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, principal, remaining, monthly_emi, interest_rate } = req.body;
    const loanId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM loans WHERE id = ? AND user_id = ?', [loanId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Loan not found.' });
    }
    const updates = [];
    const values = [];
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (principal !== undefined) {
      updates.push('principal = ?');
      values.push(Number(principal));
    }
    if (remaining !== undefined) {
      updates.push('remaining = ?');
      values.push(Number(remaining));
    }
    if (monthly_emi !== undefined) {
      updates.push('monthly_emi = ?');
      values.push(Number(monthly_emi));
    }
    if (interest_rate !== undefined) {
      updates.push('interest_rate = ?');
      values.push(interest_rate || null);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }
    values.push(loanId, req.user.id);
    await pool.query(`UPDATE loans SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ message: 'Loan updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const loanId = Number(req.params.id);
    const [result] = await pool.query('DELETE FROM loans WHERE id = ? AND user_id = ?', [loanId, req.user.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Loan not found.' });
    }
    res.json({ message: 'Loan deleted.' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/pay', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { amount, account_id } = req.body;
    const loanId = Number(req.params.id);
    if (!amount) {
      return res.status(400).json({ error: 'Payment amount is required.' });
    }
    const paymentAmount = Number(amount);
    const [existing] = await connection.query('SELECT * FROM loans WHERE id = ? AND user_id = ?', [loanId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Loan not found.' });
    }
    const loan = existing[0];
    const currentRemaining = Number(loan.remaining) || 0;
    if (paymentAmount > currentRemaining) {
      return res.status(400).json({ error: 'Payment amount exceeds remaining balance.' });
    }
    const newRemaining = Math.max(0, currentRemaining - paymentAmount);
    await connection.query(
      'UPDATE loans SET remaining = ? WHERE id = ? AND user_id = ?',
      [newRemaining, loanId, req.user.id],
    );
    if (account_id) {
      const [account] = await connection.query('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [Number(account_id), req.user.id]);
      if (!account.length) {
        return res.status(404).json({ error: 'Account not found.' });
      }
      await connection.query(
        'INSERT INTO transactions (user_id, account_id, type, amount, category, description) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.id, Number(account_id), 'debit', paymentAmount, 'Loan Payment', `Payment to ${loan.name}`],
      );
      await connection.query(
        'UPDATE accounts SET balance = balance - ? WHERE id = ? AND user_id = ?',
        [paymentAmount, Number(account_id), req.user.id],
      );
    }
    await connection.commit();
    res.json({ message: 'Payment successful.', newRemaining });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// Get amortization schedule for a loan
router.get('/:id/amortization', requireAuth, async (req, res, next) => {
  try {
    const loanId = Number(req.params.id);
    const [loan] = await pool.query(
      'SELECT * FROM loans WHERE id = ? AND user_id = ?',
      [loanId, req.user.id]
    );

    if (!loan.length) {
      return res.status(404).json({ error: 'Loan not found.' });
    }

    const loanData = loan[0];
    const principal = Number(loanData.principal) || 0;
    const remaining = Number(loanData.remaining) || principal;
    const monthlyEMI = Number(loanData.monthly_emi) || 0;
    const annualRate = Number(loanData.interest_rate) || 0;

    if (monthlyEMI === 0) {
      return res.status(400).json({ error: 'Monthly EMI is required for amortization schedule.' });
    }

    const monthlyRate = annualRate / 100 / 12;
    const schedule = [];
    let balance = remaining;
    let month = 1;
    let totalInterest = 0;
    let totalPrincipal = 0;

    while (balance > 0.01 && month <= 600) { // Max 50 years
      const interestPayment = balance * monthlyRate;
      let principalPayment = monthlyEMI - interestPayment;

      if (principalPayment > balance) {
        principalPayment = balance;
      }

      balance -= principalPayment;
      totalInterest += interestPayment;
      totalPrincipal += principalPayment;

      schedule.push({
        month: month,
        emi: monthlyEMI,
        principal_payment: Math.round(principalPayment * 100) / 100,
        interest_payment: Math.round(interestPayment * 100) / 100,
        balance: Math.round(balance * 100) / 100
      });

      month++;
    }

    res.json({
      loan_id: loanId,
      loan_name: loanData.name,
      principal: principal,
      remaining: remaining,
      monthly_emi: monthlyEMI,
      annual_interest_rate: annualRate,
      total_months: month - 1,
      total_payment: Math.round((totalInterest + totalPrincipal) * 100) / 100,
      total_interest: Math.round(totalInterest * 100) / 100,
      total_principal: Math.round(totalPrincipal * 100) / 100,
      schedule: schedule
    });
  } catch (err) {
    next(err);
  }
});

// Simulate loan prepayment
router.post('/:id/prepayment-simulation', requireAuth, async (req, res, next) => {
  try {
    const loanId = Number(req.params.id);
    const { prepayment_amount, prepayment_date } = req.body;

    if (!prepayment_amount) {
      return res.status(400).json({ error: 'Prepayment amount is required.' });
    }

    const [loan] = await pool.query(
      'SELECT * FROM loans WHERE id = ? AND user_id = ?',
      [loanId, req.user.id]
    );

    if (!loan.length) {
      return res.status(404).json({ error: 'Loan not found.' });
    }

    const loanData = loan[0];
    const remaining = Number(loanData.remaining) || 0;
    const monthlyEMI = Number(loanData.monthly_emi) || 0;
    const annualRate = Number(loanData.interest_rate) || 0;
    const prepaymentAmount = Number(prepayment_amount);

    if (prepaymentAmount > remaining) {
      return res.status(400).json({ error: 'Prepayment amount cannot exceed remaining balance.' });
    }

    const monthlyRate = annualRate / 100 / 12;
    const newRemaining = remaining - prepaymentAmount;

    // Calculate new schedule
    let balance = newRemaining;
    let month = 1;
    let totalInterest = 0;

    while (balance > 0.01 && month <= 600) {
      const interestPayment = balance * monthlyRate;
      let principalPayment = monthlyEMI - interestPayment;
      if (principalPayment > balance) principalPayment = balance;
      balance -= principalPayment;
      totalInterest += interestPayment;
      month++;
    }

    // Calculate original schedule for comparison
    let originalBalance = remaining;
    let originalMonth = 1;
    let originalTotalInterest = 0;

    while (originalBalance > 0.01 && originalMonth <= 600) {
      const interestPayment = originalBalance * monthlyRate;
      let principalPayment = monthlyEMI - interestPayment;
      if (principalPayment > originalBalance) principalPayment = originalBalance;
      originalBalance -= principalPayment;
      originalTotalInterest += interestPayment;
      originalMonth++;
    }

    const monthsSaved = originalMonth - month;
    const interestSaved = originalTotalInterest - totalInterest;

    res.json({
      loan_id: loanId,
      loan_name: loanData.name,
      prepayment_amount: prepaymentAmount,
      original_remaining: remaining,
      new_remaining: newRemaining,
      original_months: originalMonth - 1,
      new_months: month - 1,
      months_saved: monthsSaved,
      original_total_interest: Math.round(originalTotalInterest * 100) / 100,
      new_total_interest: Math.round(totalInterest * 100) / 100,
      interest_saved: Math.round(interestSaved * 100) / 100
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
