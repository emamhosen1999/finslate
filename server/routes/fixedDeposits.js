const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM fixed_deposits WHERE user_id = ? AND deleted_at IS NULL ORDER BY maturity_date ASC',
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { institution_name, fdr_account_number, source_account_id, principal_amount, annual_interest_rate, compounding_frequency, tenure_days, tenure_months, start_date, maturity_date, interest_payout_frequency, interest_payout_account_id, withholding_tax_rate, auto_renewal, note } = req.body;
    
    if (!institution_name || !principal_amount || !annual_interest_rate || !compounding_frequency || !start_date || !maturity_date) {
      return res.status(400).json({ error: 'Institution name, principal amount, annual interest rate, compounding frequency, start date, and maturity date are required.' });
    }

    // Calculate projected_maturity_value using ERD formula: M = P × (1 + r/n)^(n×t)
    const P = Number(principal_amount);
    const r = Number(annual_interest_rate) / 100;
    
    // Determine compounding frequency per year
    let n = 1; // yearly
    if (compounding_frequency === 'monthly') n = 12;
    else if (compounding_frequency === 'quarterly') n = 4;
    else if (compounding_frequency === 'half_yearly') n = 2;
    else if (compounding_frequency === 'on_maturity') n = 1;
    
    // Calculate time in years
    const startDate = new Date(start_date);
    const maturityDate = new Date(maturity_date);
    const durationYears = (maturityDate - startDate) / (1000 * 60 * 60 * 24 * 365);
    
    // Calculate compound interest: A = P(1 + r/n)^(nt)
    const projectedMaturityValue = P * Math.pow((1 + r / n), n * durationYears);

    const [result] = await pool.query(
      'INSERT INTO fixed_deposits (user_id, institution_name, fdr_account_number, source_account_id, principal_amount, annual_interest_rate, compounding_frequency, tenure_days, tenure_months, start_date, maturity_date, projected_maturity_value, interest_payout_frequency, interest_payout_account_id, withholding_tax_rate, auto_renewal, status, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, institution_name.trim(), fdr_account_number || null, source_account_id || null, Number(principal_amount), Number(annual_interest_rate), compounding_frequency, tenure_days || null, tenure_months || null, start_date, maturity_date, projectedMaturityValue, interest_payout_frequency || 'on_maturity', interest_payout_account_id || null, Number(withholding_tax_rate) || 10.00, auto_renewal || false, 'active', note || null],
    );
    res.status(201).json({
      id: result.insertId,
      user_id: req.user.id,
      institution_name: institution_name.trim(),
      fdr_account_number: fdr_account_number || null,
      source_account_id: source_account_id || null,
      principal_amount: Number(principal_amount),
      annual_interest_rate: Number(annual_interest_rate),
      compounding_frequency,
      tenure_days: tenure_days || null,
      tenure_months: tenure_months || null,
      start_date,
      maturity_date,
      projected_maturity_value: projectedMaturityValue,
      interest_payout_frequency: interest_payout_frequency || 'on_maturity',
      interest_payout_account_id: interest_payout_account_id || null,
      withholding_tax_rate: Number(withholding_tax_rate) || 10.00,
      auto_renewal: auto_renewal || false,
      renewal_count: 0,
      status: 'active',
      note: note || null,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { institution_name, fdr_account_number, source_account_id, principal_amount, annual_interest_rate, compounding_frequency, tenure_days, tenure_months, start_date, maturity_date, actual_maturity_value, interest_payout_frequency, interest_payout_account_id, withholding_tax_rate, auto_renewal, status, note } = req.body;
    const fdId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM fixed_deposits WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [fdId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Fixed deposit not found.' });
    }
    const updates = [];
    const values = [];
    if (institution_name !== undefined) {
      updates.push('institution_name = ?');
      values.push(institution_name.trim());
    }
    if (fdr_account_number !== undefined) {
      updates.push('fdr_account_number = ?');
      values.push(fdr_account_number || null);
    }
    if (source_account_id !== undefined) {
      updates.push('source_account_id = ?');
      values.push(source_account_id || null);
    }
    if (principal_amount !== undefined) {
      updates.push('principal_amount = ?');
      values.push(Number(principal_amount));
    }
    if (annual_interest_rate !== undefined) {
      updates.push('annual_interest_rate = ?');
      values.push(Number(annual_interest_rate));
    }
    if (compounding_frequency !== undefined) {
      updates.push('compounding_frequency = ?');
      values.push(compounding_frequency);
    }
    if (tenure_days !== undefined) {
      updates.push('tenure_days = ?');
      values.push(tenure_days || null);
    }
    if (tenure_months !== undefined) {
      updates.push('tenure_months = ?');
      values.push(tenure_months || null);
    }
    if (start_date !== undefined) {
      updates.push('start_date = ?');
      values.push(start_date);
    }
    if (maturity_date !== undefined) {
      updates.push('maturity_date = ?');
      values.push(maturity_date);
    }
    if (actual_maturity_value !== undefined) {
      updates.push('actual_maturity_value = ?');
      values.push(actual_maturity_value || null);
    }
    if (interest_payout_frequency !== undefined) {
      updates.push('interest_payout_frequency = ?');
      values.push(interest_payout_frequency);
    }
    if (interest_payout_account_id !== undefined) {
      updates.push('interest_payout_account_id = ?');
      values.push(interest_payout_account_id || null);
    }
    if (withholding_tax_rate !== undefined) {
      updates.push('withholding_tax_rate = ?');
      values.push(Number(withholding_tax_rate));
    }
    if (auto_renewal !== undefined) {
      updates.push('auto_renewal = ?');
      values.push(auto_renewal);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (note !== undefined) {
      updates.push('note = ?');
      values.push(note || null);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }
    values.push(fdId, req.user.id);
    await pool.query(`UPDATE fixed_deposits SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ message: 'Fixed deposit updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const fdId = Number(req.params.id);
    const [result] = await pool.query('UPDATE fixed_deposits SET deleted_at = NOW() WHERE id = ? AND user_id = ?', [fdId, req.user.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Fixed deposit not found.' });
    }
    res.json({ message: 'Fixed deposit deleted.' });
  } catch (err) {
    next(err);
  }
});

// Get FDRs nearing maturity for renewal tracking
router.get('/renewals', requireAuth, async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const daysThreshold = Math.max(1, Math.min(365, parseInt(days)));

    const [rows] = await pool.query(
      `SELECT *, DATEDIFF(maturity_date, CURDATE()) as days_to_maturity
       FROM fixed_deposits 
       WHERE user_id = ? AND deleted_at IS NULL
         AND maturity_date >= CURDATE()
         AND DATEDIFF(maturity_date, CURDATE()) <= ?
       ORDER BY maturity_date ASC`,
      [req.user.id, daysThreshold]
    );

    res.json({ renewals: rows });
  } catch (err) {
    next(err);
  }
});

// Renew a fixed deposit
router.post('/:id/renew', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const fdId = Number(req.params.id);
    const { new_maturity_date, annual_interest_rate } = req.body;

    const [existing] = await connection.query(
      'SELECT * FROM fixed_deposits WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [fdId, req.user.id]
    );

    if (!existing.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Fixed deposit not found.' });
    }

    const fd = existing[0];
    const maturityAmount = fd.actual_maturity_value || fd.projected_maturity_value || fd.principal_amount;
    const newInterestRate = annual_interest_rate || fd.annual_interest_rate;
    const newMaturityDate = new_maturity_date || fd.maturity_date;

    // Create new FDR with maturity amount as principal
    const [result] = await connection.query(
      `INSERT INTO fixed_deposits (user_id, institution_name, fdr_account_number, source_account_id, principal_amount, annual_interest_rate, compounding_frequency, start_date, maturity_date, projected_maturity_value, interest_payout_frequency, interest_payout_account_id, withholding_tax_rate, auto_renewal, status, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, `${fd.institution_name} (Renewed)`, null, fd.source_account_id, maturityAmount, newInterestRate, fd.compounding_frequency, newMaturityDate, null, fd.interest_payout_frequency, fd.interest_payout_account_id, fd.withholding_tax_rate, fd.auto_renewal, 'active', null]
    );

    // Mark old FDR as renewed
    const newRenewalCount = (fd.renewal_count || 0) + 1;
    await connection.query(
      'UPDATE fixed_deposits SET status = ?, renewal_count = renewal_count + 1, actual_maturity_value = ? WHERE id = ?',
      ['renewed', maturityAmount, fdId]
    );

    // Record renewal history
    await connection.query(
      'INSERT INTO fdr_renewals (fdr_id, renewal_date, new_principal, new_rate, new_maturity_date, renewal_no) VALUES (?, CURDATE(), ?, ?, ?, ?)',
      [fdId, maturityAmount, newInterestRate, newMaturityDate, newRenewalCount]
    );

    await connection.commit();
    res.status(201).json({
      id: result.insertId,
      message: 'Fixed deposit renewed successfully',
      new_fd_id: result.insertId
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// Get renewal history for a fixed deposit
router.get('/:id/renewal-history', requireAuth, async (req, res, next) => {
  try {
    const fdId = Number(req.params.id);
    const [fd] = await pool.query(
      'SELECT id FROM fixed_deposits WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [fdId, req.user.id]
    );
    if (!fd.length) return res.status(404).json({ error: 'Fixed deposit not found.' });

    const [rows] = await pool.query(
      'SELECT * FROM fdr_renewals WHERE fdr_id = ? ORDER BY renewal_no ASC',
      [fdId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Calculate compound interest projection
router.get('/:id/projection', requireAuth, async (req, res, next) => {
  try {
    const fdId = Number(req.params.id);

    const [fd] = await pool.query(
      'SELECT * FROM fixed_deposits WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [fdId, req.user.id]
    );

    if (!fd.length) {
      return res.status(404).json({ error: 'Fixed deposit not found.' });
    }

    const fdData = fd[0];
    const principal = Number(fdData.principal_amount) || 0;
    const annualRate = Number(fdData.annual_interest_rate) || 0;
    const compoundingFrequency = fdData.compounding_frequency || 'yearly';
    const startDate = new Date(fdData.start_date);
    const maturityDate = new Date(fdData.maturity_date);

    // Calculate duration in years
    const durationYears = (maturityDate - startDate) / (1000 * 60 * 60 * 24 * 365);
    const durationMonths = Math.round(durationYears * 12);

    // Determine compound frequency per year
    let n = 1; // yearly by default
    if (compoundingFrequency === 'monthly') n = 12;
    else if (compoundingFrequency === 'quarterly') n = 4;
    else if (compoundingFrequency === 'half_yearly') n = 2;
    else if (compoundingFrequency === 'on_maturity') n = 1;

    // Calculate compound interest: A = P(1 + r/n)^(nt)
    const r = annualRate / 100;
    const maturityAmount = principal * Math.pow((1 + r / n), n * durationYears);
    const interestEarned = maturityAmount - principal;

    // Generate yearly projection
    const yearlyProjection = [];
    for (let year = 1; year <= Math.ceil(durationYears); year++) {
      const projectedAmount = principal * Math.pow((1 + r / n), n * year);
      yearlyProjection.push({
        year: year,
        amount: Math.round(projectedAmount * 100) / 100,
        interest: Math.round((projectedAmount - principal) * 100) / 100
      });
    }

    res.json({
      fd_id: fdId,
      fd_name: `${fdData.institution_name} - ${fdData.fdr_account_number || 'N/A'}`,
      principal: principal,
      annual_interest_rate: annualRate,
      compounding_frequency: compoundingFrequency,
      start_date: fdData.start_date,
      maturity_date: fdData.maturity_date,
      duration_years: Math.round(durationYears * 100) / 100,
      duration_months: durationMonths,
      projected_maturity_value: Math.round(maturityAmount * 100) / 100,
      actual_maturity_value: fdData.actual_maturity_value ? Math.round(fdData.actual_maturity_value * 100) / 100 : null,
      projected_interest: Math.round(interestEarned * 100) / 100,
      yearly_projection: yearlyProjection
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
