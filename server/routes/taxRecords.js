const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// Get all tax records for a user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM tax_records WHERE user_id = ? ORDER BY tax_year DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Create a new tax record
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { tax_year, income_type, gross_income, tax_deducted, tax_paid, tax_due, notes } = req.body;

    const [result] = await pool.query(
      `INSERT INTO tax_records (user_id, tax_year, income_type, gross_income, tax_deducted, tax_paid, tax_due, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [req.user.id, tax_year, income_type, gross_income, tax_deducted || 0, tax_paid || 0, tax_due, notes]
    );

    res.json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

// Update tax record
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { tax_year, income_type, gross_income, tax_deducted, tax_paid, tax_due, status, filing_date, payment_date, notes } = req.body;

    await pool.query(
      `UPDATE tax_records SET tax_year = ?, income_type = ?, gross_income = ?, tax_deducted = ?, tax_paid = ?, tax_due = ?, status = ?, filing_date = ?, payment_date = ?, notes = ?
       WHERE id = ? AND user_id = ?`,
      [tax_year, income_type, gross_income, tax_deducted, tax_paid, tax_due, status, filing_date, payment_date, notes, req.params.id, req.user.id]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Delete tax record
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM tax_records WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Mark as filed
router.post('/:id/file', requireAuth, async (req, res, next) => {
  try {
    const { filing_date } = req.body;
    await pool.query(
      'UPDATE tax_records SET status = ?, filing_date = ? WHERE id = ? AND user_id = ?',
      ['filed', filing_date || new Date().toISOString().split('T')[0], req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Mark as paid
router.post('/:id/pay', requireAuth, async (req, res, next) => {
  try {
    const { payment_date } = req.body;
    await pool.query(
      'UPDATE tax_records SET status = ?, payment_date = ? WHERE id = ? AND user_id = ?',
      ['paid', payment_date || new Date().toISOString().split('T')[0], req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Calculate tax using slab rates (Bangladesh tax slabs example)
router.post('/calculate', requireAuth, async (req, res, next) => {
  try {
    const { income, tax_year, residence_type = 'resident' } = req.body;

    if (!income) {
      return res.status(400).json({ error: 'Income is required.' });
    }

    const taxableIncome = Number(income);
    let tax = 0;
    let slabs = [];

    // Bangladesh tax slabs for individuals (example rates)
    if (residence_type === 'resident') {
      // Slab 1: 0 - 3,00,000: 0%
      if (taxableIncome > 0) {
        const slabLimit = 300000;
        const taxableInSlab = Math.min(taxableIncome, slabLimit);
        slabs.push({
          from: 0,
          to: slabLimit,
          rate: 0,
          taxable: taxableInSlab,
          tax: 0
        });
      }

      // Slab 2: 3,00,001 - 10,00,000: 5%
      if (taxableIncome > 300000) {
        const slabLimit = 1000000;
        const taxableInSlab = Math.min(taxableIncome - 300000, slabLimit - 300000);
        const slabTax = taxableInSlab * 0.05;
        tax += slabTax;
        slabs.push({
          from: 300001,
          to: slabLimit,
          rate: 5,
          taxable: taxableInSlab,
          tax: slabTax
        });
      }

      // Slab 3: 10,00,001 - 30,00,000: 10%
      if (taxableIncome > 1000000) {
        const slabLimit = 3000000;
        const taxableInSlab = Math.min(taxableIncome - 1000000, slabLimit - 1000000);
        const slabTax = taxableInSlab * 0.10;
        tax += slabTax;
        slabs.push({
          from: 1000001,
          to: slabLimit,
          rate: 10,
          taxable: taxableInSlab,
          tax: slabTax
        });
      }

      // Slab 4: 30,00,001 - 50,00,000: 15%
      if (taxableIncome > 3000000) {
        const slabLimit = 5000000;
        const taxableInSlab = Math.min(taxableIncome - 3000000, slabLimit - 3000000);
        const slabTax = taxableInSlab * 0.15;
        tax += slabTax;
        slabs.push({
          from: 3000001,
          to: slabLimit,
          rate: 15,
          taxable: taxableInSlab,
          tax: slabTax
        });
      }

      // Slab 5: Above 50,00,000: 20%
      if (taxableIncome > 5000000) {
        const taxableInSlab = taxableIncome - 5000000;
        const slabTax = taxableInSlab * 0.20;
        tax += slabTax;
        slabs.push({
          from: 5000001,
          to: null,
          rate: 20,
          taxable: taxableInSlab,
          tax: slabTax
        });
      }

      // Minimum tax for individuals with income above 3 lakh
      if (taxableIncome > 300000 && tax < 5000) {
        tax = 5000;
      }
    } else {
      // Non-resident: flat rate
      tax = taxableIncome * 0.30;
      slabs.push({
        from: 0,
        to: null,
        rate: 30,
        taxable: taxableIncome,
        tax: tax
      });
    }

    res.json({
      income: taxableIncome,
      tax_year: tax_year || new Date().getFullYear(),
      residence_type: residence_type,
      total_tax: Math.round(tax),
      effective_rate: taxableIncome > 0 ? ((tax / taxableIncome) * 100).toFixed(2) : 0,
      slabs: slabs
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
