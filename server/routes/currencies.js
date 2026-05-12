const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// Get all currencies
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM currencies ORDER BY is_default DESC, name ASC');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Get exchange rates
router.get('/exchange-rates', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM exchange_rates ORDER BY from_currency, to_currency');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Update exchange rate
router.put('/exchange-rates', requireAuth, async (req, res, next) => {
  try {
    const { from_currency, to_currency, rate } = req.body;
    
    await pool.query(
      `INSERT INTO exchange_rates (from_currency, to_currency, rate)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE rate = ?`,
      [from_currency, to_currency, rate, rate]
    );
    
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Convert currency
router.post('/convert', async (req, res, next) => {
  try {
    const { amount, from, to } = req.body;
    
    if (from === to) {
      return res.json({ result: amount });
    }
    
    const [rows] = await pool.query(
      'SELECT rate FROM exchange_rates WHERE from_currency = ? AND to_currency = ?',
      [from, to]
    );
    
    if (!rows.length) {
      return res.status(404).json({ error: 'Exchange rate not found' });
    }
    
    const result = parseFloat(amount) * parseFloat(rows[0].rate);
    res.json({ result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
