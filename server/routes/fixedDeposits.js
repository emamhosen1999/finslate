const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM fixed_deposits WHERE user_id = ? ORDER BY maturity_date ASC',
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, principal, interest_rate, start_date, maturity_date } = req.body;
    if (!name || !principal || !interest_rate || !start_date || !maturity_date) {
      return res.status(400).json({ error: 'Name, principal, interest rate, start date, and maturity date are required.' });
    }
    const [result] = await pool.query(
      'INSERT INTO fixed_deposits (user_id, name, principal, interest_rate, start_date, maturity_date) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, name.trim(), Number(principal), Number(interest_rate), start_date, maturity_date],
    );
    res.status(201).json({
      id: result.insertId,
      name: name.trim(),
      principal: Number(principal),
      interest_rate: Number(interest_rate),
      start_date,
      maturity_date,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, principal, interest_rate, start_date, maturity_date, maturity_amount } = req.body;
    const fdId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM fixed_deposits WHERE id = ? AND user_id = ?', [fdId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Fixed deposit not found.' });
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
    if (interest_rate !== undefined) {
      updates.push('interest_rate = ?');
      values.push(Number(interest_rate));
    }
    if (start_date !== undefined) {
      updates.push('start_date = ?');
      values.push(start_date);
    }
    if (maturity_date !== undefined) {
      updates.push('maturity_date = ?');
      values.push(maturity_date);
    }
    if (maturity_amount !== undefined) {
      updates.push('maturity_amount = ?');
      values.push(maturity_amount || null);
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
    const [result] = await pool.query('DELETE FROM fixed_deposits WHERE id = ? AND user_id = ?', [fdId, req.user.id]);
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
       WHERE user_id = ? 
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
    const { new_maturity_date, interest_rate } = req.body;

    const [existing] = await connection.query(
      'SELECT * FROM fixed_deposits WHERE id = ? AND user_id = ?',
      [fdId, req.user.id]
    );

    if (!existing.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Fixed deposit not found.' });
    }

    const fd = existing[0];
    const maturityAmount = fd.maturity_amount || fd.principal;
    const newInterestRate = interest_rate || fd.interest_rate;
    const newMaturityDate = new_maturity_date || fd.maturity_date;

    // Create new FDR with maturity amount as principal
    const [result] = await connection.query(
      `INSERT INTO fixed_deposits (user_id, name, principal, interest_rate, start_date, maturity_date, maturity_amount)
       VALUES (?, ?, ?, ?, CURDATE(), ?, ?)`,
      [req.user.id, `${fd.name} (Renewed)`, maturityAmount, newInterestRate, newMaturityDate, null]
    );

    // Mark old FDR as renewed
    await connection.query(
      'UPDATE fixed_deposits SET maturity_amount = ? WHERE id = ?',
      [maturityAmount, fdId]
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

// Calculate compound interest projection
router.get('/:id/projection', requireAuth, async (req, res, next) => {
  try {
    const fdId = Number(req.params.id);
    const { compound_frequency = 'annually' } = req.query;

    const [fd] = await pool.query(
      'SELECT * FROM fixed_deposits WHERE id = ? AND user_id = ?',
      [fdId, req.user.id]
    );

    if (!fd.length) {
      return res.status(404).json({ error: 'Fixed deposit not found.' });
    }

    const fdData = fd[0];
    const principal = Number(fdData.principal) || 0;
    const annualRate = Number(fdData.interest_rate) || 0;
    const startDate = new Date(fdData.start_date);
    const maturityDate = new Date(fdData.maturity_date);

    // Calculate duration in years
    const durationYears = (maturityDate - startDate) / (1000 * 60 * 60 * 24 * 365);
    const durationMonths = Math.round(durationYears * 12);

    // Determine compound frequency
    let n = 1; // annually by default
    if (compound_frequency === 'monthly') n = 12;
    else if (compound_frequency === 'quarterly') n = 4;
    else if (compound_frequency === 'half-yearly') n = 2;

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
      fd_name: fdData.name,
      principal: principal,
      annual_interest_rate: annualRate,
      compound_frequency: compound_frequency,
      start_date: fdData.start_date,
      maturity_date: fdData.maturity_date,
      duration_years: Math.round(durationYears * 100) / 100,
      duration_months: durationMonths,
      projected_maturity_amount: Math.round(maturityAmount * 100) / 100,
      projected_interest: Math.round(interestEarned * 100) / 100,
      yearly_projection: yearlyProjection
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
