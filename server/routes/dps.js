const express = require('express');
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, user_id, institution_name, dps_account_number, linked_account_id, installment_amount, annual_interest_rate, tenure_months, 
              start_date, maturity_date, total_installments, paid_installments, missed_installments, total_deposited, 
              projected_maturity_value, actual_maturity_value, withholding_tax_rate, status, break_date, break_value, 
              maturity_credited_to_id, note, created_at, updated_at
         FROM dps WHERE user_id = ? AND deleted_at IS NULL ORDER BY id`,
      [req.user.id],
    );
    res.json({ dps: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { institution_name, dps_account_number, linked_account_id, installment_amount, annual_interest_rate, tenure_months, start_date, maturity_date, withholding_tax_rate, note } = req.body;
    
    if (!institution_name || !dps_account_number || !installment_amount || !annual_interest_rate || !tenure_months || !start_date) {
      return res.status(400).json({ error: 'Institution name, DPS account number, installment amount, annual interest rate, tenure months, and start date are required.' });
    }

    // Calculate maturity_date from start_date + tenure_months if not provided
    const maturityDate = maturity_date || new Date(new Date(start_date).setMonth(new Date(start_date).getMonth() + Number(tenure_months))).toISOString().split('T')[0];

    // Calculate projected_maturity_value using ERD formula: M = P × n + P × [n(n+1)/2] × (r/12)
    const P = Number(installment_amount);
    const n = Number(tenure_months);
    const r = Number(annual_interest_rate) / 100;
    const projectedMaturityValue = P * n + P * (n * (n + 1) / 2) * (r / 12);

    const [result] = await pool.query(
      'INSERT INTO dps (user_id, institution_name, dps_account_number, linked_account_id, installment_amount, annual_interest_rate, tenure_months, start_date, maturity_date, total_installments, paid_installments, missed_installments, total_deposited, projected_maturity_value, withholding_tax_rate, status, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, institution_name.trim(), dps_account_number.trim(), linked_account_id || null, Number(installment_amount), Number(annual_interest_rate), Number(tenure_months), start_date, maturityDate, Number(tenure_months), 0, 0, 0, projectedMaturityValue, Number(withholding_tax_rate) || 10.00, 'active', note || null],
    );
    res.status(201).json({
      id: result.insertId,
      user_id: req.user.id,
      institution_name: institution_name.trim(),
      dps_account_number: dps_account_number.trim(),
      linked_account_id: linked_account_id || null,
      installment_amount: Number(installment_amount),
      annual_interest_rate: Number(annual_interest_rate),
      tenure_months: Number(tenure_months),
      start_date,
      maturity_date: maturityDate,
      total_installments: Number(tenure_months),
      paid_installments: 0,
      missed_installments: 0,
      total_deposited: 0,
      projected_maturity_value: projectedMaturityValue,
      withholding_tax_rate: Number(withholding_tax_rate) || 10.00,
      status: 'active',
      note: note || null,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { institution_name, dps_account_number, linked_account_id, installment_amount, annual_interest_rate, tenure_months, start_date, maturity_date, total_installments, paid_installments, missed_installments, total_deposited, actual_maturity_value, withholding_tax_rate, status, break_date, break_value, maturity_credited_to_id, note } = req.body;
    const dpsId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM dps WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [dpsId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'DPS not found.' });
    }
    const updates = [];
    const values = [];
    if (institution_name !== undefined) {
      updates.push('institution_name = ?');
      values.push(institution_name.trim());
    }
    if (dps_account_number !== undefined) {
      updates.push('dps_account_number = ?');
      values.push(dps_account_number.trim());
    }
    if (linked_account_id !== undefined) {
      updates.push('linked_account_id = ?');
      values.push(linked_account_id || null);
    }
    if (installment_amount !== undefined) {
      updates.push('installment_amount = ?');
      values.push(Number(installment_amount));
    }
    if (annual_interest_rate !== undefined) {
      updates.push('annual_interest_rate = ?');
      values.push(Number(annual_interest_rate));
    }
    if (tenure_months !== undefined) {
      updates.push('tenure_months = ?');
      values.push(Number(tenure_months));
    }
    if (start_date !== undefined) {
      updates.push('start_date = ?');
      values.push(start_date);
    }
    if (maturity_date !== undefined) {
      updates.push('maturity_date = ?');
      values.push(maturity_date);
    }
    if (total_installments !== undefined) {
      updates.push('total_installments = ?');
      values.push(Number(total_installments));
    }
    if (paid_installments !== undefined) {
      updates.push('paid_installments = ?');
      values.push(Number(paid_installments));
    }
    if (missed_installments !== undefined) {
      updates.push('missed_installments = ?');
      values.push(Number(missed_installments));
    }
    if (total_deposited !== undefined) {
      updates.push('total_deposited = ?');
      values.push(Number(total_deposited));
    }
    if (actual_maturity_value !== undefined) {
      updates.push('actual_maturity_value = ?');
      values.push(actual_maturity_value || null);
    }
    if (withholding_tax_rate !== undefined) {
      updates.push('withholding_tax_rate = ?');
      values.push(Number(withholding_tax_rate));
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (break_date !== undefined) {
      updates.push('break_date = ?');
      values.push(break_date || null);
    }
    if (break_value !== undefined) {
      updates.push('break_value = ?');
      values.push(break_value || null);
    }
    if (maturity_credited_to_id !== undefined) {
      updates.push('maturity_credited_to_id = ?');
      values.push(maturity_credited_to_id || null);
    }
    if (note !== undefined) {
      updates.push('note = ?');
      values.push(note || null);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }
    values.push(dpsId, req.user.id);
    await pool.query(`UPDATE dps SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ message: 'DPS updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const dpsId = Number(req.params.id);
    const [result] = await pool.query('UPDATE dps SET deleted_at = NOW() WHERE id = ? AND user_id = ?', [dpsId, req.user.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'DPS not found.' });
    }
    res.json({ message: 'DPS deleted.' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/deposit', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { amount, account_id } = req.body;
    const dpsId = Number(req.params.id);
    if (!amount) {
      return res.status(400).json({ error: 'Deposit amount is required.' });
    }
    const depositAmount = Number(amount);
    const [existing] = await connection.query('SELECT * FROM dps WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [dpsId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'DPS not found.' });
    }
    const dps = existing[0];
    const currentDeposited = Number(dps.total_deposited) || 0;
    const newDeposited = currentDeposited + depositAmount;
    const paidInstallments = Number(dps.paid_installments) || 0;
    await connection.query(
      'UPDATE dps SET total_deposited = ?, paid_installments = ? WHERE id = ? AND user_id = ?',
      [newDeposited, paidInstallments + 1, dpsId, req.user.id],
    );
    if (account_id) {
      const [account] = await connection.query('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [Number(account_id), req.user.id]);
      if (!account.length) {
        return res.status(404).json({ error: 'Account not found.' });
      }
      await connection.query(
        'INSERT INTO transactions (user_id, account_id, type, amount, category_id, notes, transaction_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.user.id, Number(account_id), 'expense', depositAmount, 'DPS', `Deposit to ${dps.institution_name} - ${dps.dps_account_number}`, new Date().toISOString().split('T')[0]],
      );
      await connection.query(
        'UPDATE accounts SET current_balance = current_balance - ? WHERE id = ? AND user_id = ?',
        [depositAmount, Number(account_id), req.user.id],
      );
      // Create dps_payment record
      await connection.query(
        'INSERT INTO dps_payments (dps_id, installment_number, due_date, paid_date, amount, account_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [dpsId, paidInstallments + 1, new Date().toISOString().split('T')[0], new Date().toISOString().split('T')[0], depositAmount, Number(account_id), 'paid'],
      );
    }
    await connection.commit();
    res.json({ message: 'Deposit successful.', newDeposited });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// Get installment calendar for a DPS
router.get('/:id/installment-calendar', requireAuth, async (req, res, next) => {
  try {
    const dpsId = Number(req.params.id);
    const [dps] = await pool.query(
      'SELECT * FROM dps WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [dpsId, req.user.id]
    );

    if (!dps.length) {
      return res.status(404).json({ error: 'DPS not found.' });
    }

    const dpsData = dps[0];
    const installmentAmount = Number(dpsData.installment_amount) || 0;
    const startDate = dpsData.start_date ? new Date(dpsData.start_date) : new Date();
    const maturityDate = dpsData.maturity_date ? new Date(dpsData.maturity_date) : null;
    const totalInstallments = Number(dpsData.total_installments) || Number(dpsData.tenure_months) || 60;
    const paidInstallments = Number(dpsData.paid_installments) || 0;

    const calendar = [];
    let currentDate = new Date(startDate);
    currentDate.setDate(1); // Start from the 1st of the month
    
    for (let i = 1; i <= totalInstallments; i++) {
      const isPast = i <= paidInstallments;
      const isDue = i === paidInstallments + 1;

      calendar.push({
        installment_number: i,
        due_date: currentDate.toISOString().split('T')[0],
        amount: installmentAmount,
        status: isPast ? 'paid' : isDue ? 'upcoming' : 'upcoming'
      });

      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    res.json({
      dps_id: dpsId,
      dps_name: `${dpsData.institution_name} - ${dpsData.dps_account_number}`,
      installment_amount: installmentAmount,
      total_installments: totalInstallments,
      paid_installments: paidInstallments,
      calendar: calendar
    });
  } catch (err) {
    next(err);
  }
});

// Get maturity projection for a DPS
router.get('/:id/maturity-projection', requireAuth, async (req, res, next) => {
  try {
    const dpsId = Number(req.params.id);
    const [dps] = await pool.query(
      'SELECT * FROM dps WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [dpsId, req.user.id]
    );

    if (!dps.length) {
      return res.status(404).json({ error: 'DPS not found.' });
    }

    const dpsData = dps[0];
    const installmentAmount = Number(dpsData.installment_amount) || 0;
    const annualRate = Number(dpsData.annual_interest_rate) || 0;
    const startDate = dpsData.start_date ? new Date(dpsData.start_date) : new Date();
    const maturityDate = dpsData.maturity_date ? new Date(dpsData.maturity_date) : null;
    const totalDeposited = Number(dpsData.total_deposited) || 0;
    const actualMaturityValue = dpsData.actual_maturity_value ? Number(dpsData.actual_maturity_value) : null;

    // Calculate months until maturity
    let monthsUntilMaturity = 0;
    if (maturityDate) {
      const diffTime = Math.abs(maturityDate - startDate);
      monthsUntilMaturity = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
    } else {
      monthsUntilMaturity = Number(dpsData.tenure_months) || 60;
    }

    // Calculate projected maturity value using ERD formula: M = P × n + P × [n(n+1)/2] × (r/12)
    const P = installmentAmount;
    const n = monthsUntilMaturity;
    const r = annualRate / 100;
    const projectedMaturityValue = P * n + P * (n * (n + 1) / 2) * (r / 12);

    const projectedTotalDeposits = installmentAmount * monthsUntilMaturity;
    const profit = projectedMaturityValue - projectedTotalDeposits;

    res.json({
      dps_id: dpsId,
      dps_name: `${dpsData.institution_name} - ${dpsData.dps_account_number}`,
      installment_amount: installmentAmount,
      annual_interest_rate: annualRate,
      tenure_months: monthsUntilMaturity,
      start_date: dpsData.start_date,
      maturity_date: dpsData.maturity_date,
      total_deposited: totalDeposited,
      projected_total_deposits: projectedTotalDeposits,
      projected_maturity_value: projectedMaturityValue,
      actual_maturity_value: actualMaturityValue,
      projected_profit: profit > 0 ? profit : 0,
      roi: projectedTotalDeposits > 0 ? ((profit / projectedTotalDeposits) * 100).toFixed(2) : 0
    });
  } catch (err) {
    next(err);
  }
});

// Break a DPS before maturity
router.post('/:id/break', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { break_value, maturity_credited_to_id } = req.body;
    const dpsId = Number(req.params.id);

    const [existing] = await connection.query(
      'SELECT * FROM dps WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [dpsId, req.user.id]
    );

    if (!existing.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'DPS not found.' });
    }

    const dps = existing[0];
    if (dps.status !== 'active') {
      await connection.rollback();
      return res.status(400).json({ error: 'DPS must be active to break.' });
    }

    const breakValue = break_value || dps.total_deposited; // Default to total deposited if not provided
    const breakDate = new Date().toISOString().split('T')[0];

    // Update DPS status
    await connection.query(
      'UPDATE dps SET status = ?, break_date = ?, break_value = ? WHERE id = ?',
      ['broken', breakDate, breakValue, dpsId]
    );

    // If maturity_credited_to_id is provided, credit the break value to that account
    if (maturity_credited_to_id) {
      await connection.query(
        'UPDATE accounts SET current_balance = current_balance + ? WHERE id = ? AND user_id = ?',
        [breakValue, Number(maturity_credited_to_id), req.user.id]
      );
      
      await connection.query(
        'INSERT INTO transactions (user_id, account_id, type, amount, category_id, notes, transaction_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.user.id, Number(maturity_credited_to_id), 'income', breakValue, 'DPS', `DPS break - ${dps.institution_name} - ${dps.dps_account_number}`, breakDate]
      );
    }

    await connection.commit();
    res.json({ message: 'DPS broken successfully.', break_value: breakValue, break_date: breakDate });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// Mature a DPS
router.post('/:id/mature', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { actual_maturity_value, maturity_credited_to_id } = req.body;
    const dpsId = Number(req.params.id);

    const [existing] = await connection.query(
      'SELECT * FROM dps WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [dpsId, req.user.id]
    );

    if (!existing.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'DPS not found.' });
    }

    const dps = existing[0];
    if (dps.status !== 'active') {
      await connection.rollback();
      return res.status(400).json({ error: 'DPS must be active to mature.' });
    }

    const actualMaturityValue = actual_maturity_value || dps.projected_maturity_value || dps.total_deposited;

    // Update DPS status
    await connection.query(
      'UPDATE dps SET status = ?, actual_maturity_value = ?, maturity_credited_to_id = ? WHERE id = ?',
      ['matured', actualMaturityValue, maturity_credited_to_id || null, dpsId]
    );

    // If maturity_credited_to_id is provided, credit the maturity amount to that account
    if (maturity_credited_to_id) {
      await connection.query(
        'UPDATE accounts SET current_balance = current_balance + ? WHERE id = ? AND user_id = ?',
        [actualMaturityValue, Number(maturity_credited_to_id), req.user.id]
      );
      
      await connection.query(
        'INSERT INTO transactions (user_id, account_id, type, amount, category_id, notes, transaction_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.user.id, Number(maturity_credited_to_id), 'income', actualMaturityValue, 'DPS', `DPS maturity - ${dps.institution_name} - ${dps.dps_account_number}`, new Date().toISOString().split('T')[0]]
      );
    }

    await connection.commit();
    res.json({ message: 'DPS matured successfully.', actual_maturity_value: actualMaturityValue });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

module.exports = router;
