const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// Get all incomes for a user (with sub-detail joined)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT i.*, a.name as account_name
       FROM incomes i
       LEFT JOIN accounts a ON i.credited_to_account_id = a.id
       WHERE i.user_id = ? ORDER BY i.income_date DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Get single income with sub-details
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const incomeId = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT i.*, a.name as account_name
       FROM incomes i
       LEFT JOIN accounts a ON i.credited_to_account_id = a.id
       WHERE i.id = ? AND i.user_id = ?`,
      [incomeId, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Income not found.' });

    const income = rows[0];

    // Fetch sub-detail based on source_type
    if (income.source_type === 'salary') {
      const [details] = await pool.query('SELECT * FROM income_salary_details WHERE income_id = ?', [incomeId]);
      income.salary_details = details[0] || null;
    } else if (income.source_type === 'freelance') {
      const [details] = await pool.query('SELECT * FROM income_freelance_details WHERE income_id = ?', [incomeId]);
      income.freelance_details = details[0] || null;
    } else if (income.source_type === 'rental') {
      const [details] = await pool.query('SELECT * FROM income_rental_details WHERE income_id = ?', [incomeId]);
      income.rental_details = details[0] || null;
    } else if (income.source_type === 'dividend') {
      const [details] = await pool.query('SELECT * FROM income_dividend_details WHERE income_id = ?', [incomeId]);
      income.dividend_details = details[0] || null;
    }

    res.json(income);
  } catch (err) {
    next(err);
  }
});

// Create a new income
router.post('/', requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { source_type, title, gross_amount, tds_amount, other_deductions, income_date, credited_to_account_id, description, is_recurring, salary_details, freelance_details, rental_details, dividend_details } = req.body;

    if (!source_type || !title || !gross_amount || !income_date) {
      return res.status(400).json({ error: 'source_type, title, gross_amount, and income_date are required.' });
    }

    const validTypes = ['salary', 'freelance', 'rental', 'dividend', 'business', 'gift', 'remittance', 'other'];
    if (!validTypes.includes(source_type)) {
      return res.status(400).json({ error: `Invalid source_type. Must be one of: ${validTypes.join(', ')}` });
    }

    const [result] = await conn.query(
      `INSERT INTO incomes (user_id, source_type, title, gross_amount, tds_amount, other_deductions, income_date, credited_to_account_id, description, is_recurring)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, source_type, title.trim(), Number(gross_amount), Number(tds_amount || 0), Number(other_deductions || 0), income_date, credited_to_account_id || null, description?.trim() || null, is_recurring ? 1 : 0]
    );

    const incomeId = result.insertId;

    // Insert sub-detail if provided
    if (source_type === 'salary' && salary_details) {
      const sd = salary_details;
      await conn.query(
        `INSERT INTO income_salary_details (income_id, employer_name, basic_salary, house_rent_allowance, medical_allowance, transport_allowance, bonus, provident_fund_deduction, pay_period, employer_tin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [incomeId, sd.employer_name || null, sd.basic_salary || null, sd.house_rent_allowance || null, sd.medical_allowance || null, sd.transport_allowance || null, sd.bonus || null, sd.provident_fund_deduction || null, sd.pay_period || 'monthly', sd.employer_tin || null]
      );
    } else if (source_type === 'freelance' && freelance_details) {
      const fd = freelance_details;
      await conn.query(
        `INSERT INTO income_freelance_details (income_id, client_name, project_name, invoice_number, platform, platform_fee)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [incomeId, fd.client_name || null, fd.project_name || null, fd.invoice_number || null, fd.platform || null, fd.platform_fee || 0]
      );
    } else if (source_type === 'rental' && rental_details) {
      const rd = rental_details;
      await conn.query(
        `INSERT INTO income_rental_details (income_id, property_name, tenant_name, tenant_phone, advance_deposit, lease_start, lease_end)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [incomeId, rd.property_name || null, rd.tenant_name || null, rd.tenant_phone || null, rd.advance_deposit || null, rd.lease_start || null, rd.lease_end || null]
      );
    } else if (source_type === 'dividend' && dividend_details) {
      const dd = dividend_details;
      await conn.query(
        `INSERT INTO income_dividend_details (income_id, investment_id, dividend_type, units, rate_per_unit)
         VALUES (?, ?, ?, ?, ?)`,
        [incomeId, dd.investment_id || null, dd.dividend_type || null, dd.units || null, dd.rate_per_unit || null]
      );
    }

    // If credited_to_account_id, credit the account
    if (credited_to_account_id) {
      const netAmount = Number(gross_amount) - Number(tds_amount || 0) - Number(other_deductions || 0);
      await conn.query(
        'UPDATE accounts SET current_balance = current_balance + ? WHERE id = ? AND user_id = ?',
        [netAmount, credited_to_account_id, req.user.id]
      );
      // Also create a transaction record
      await conn.query(
        `INSERT INTO transactions (user_id, account_id, type, amount, currency, transaction_date, category_id, source_type, payee, notes)
         VALUES (?, ?, 'income', ?, 'BDT', ?, 'Income', 'account', ?, ?)`,
        [req.user.id, credited_to_account_id, netAmount, income_date, title.trim(), description?.trim() || null]
      );
    }

    await conn.commit();
    res.status(201).json({ id: incomeId });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// Update income
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const incomeId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM incomes WHERE id = ? AND user_id = ?', [incomeId, req.user.id]);
    if (!existing.length) return res.status(404).json({ error: 'Income not found.' });

    const fields = ['source_type', 'title', 'gross_amount', 'tds_amount', 'other_deductions', 'income_date', 'credited_to_account_id', 'description', 'is_recurring'];
    const updates = [];
    const values = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update.' });
    values.push(incomeId, req.user.id);
    await pool.query(`UPDATE incomes SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Delete income
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const incomeId = Number(req.params.id);
    const [result] = await pool.query('DELETE FROM incomes WHERE id = ? AND user_id = ?', [incomeId, req.user.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Income not found.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
