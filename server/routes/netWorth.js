const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// Get all net worth snapshots for a user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM net_worth_snapshots WHERE user_id = ? ORDER BY snapshot_date DESC LIMIT 60',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Calculate current net worth (without saving)
router.get('/current', requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    // Get account balances (assets)
    const [accounts] = await conn.query(
      'SELECT COALESCE(SUM(balance), 0) as total FROM accounts WHERE user_id = ?',
      [req.user.id]
    );

    // Get DPS values (assets)
    const [dps] = await conn.query(
      'SELECT COALESCE(SUM(total_deposited), 0) as total FROM dps WHERE user_id = ?',
      [req.user.id]
    );

    // Get fixed deposit values (assets)
    const [fds] = await conn.query(
      'SELECT COALESCE(SUM(principal), 0) as total FROM fixed_deposits WHERE user_id = ?',
      [req.user.id]
    );

    // Get Sanchayapatra values (assets)
    const [sanchayapatra] = await conn.query(
      'SELECT COALESCE(SUM(principal_amount), 0) as total FROM sanchayapatra WHERE user_id = ? AND status = "active"',
      [req.user.id]
    );

    // Get investment values (assets)
    const [investments] = await conn.query(
      'SELECT COALESCE(SUM(quantity * COALESCE(current_price, buy_price)), 0) as total FROM investments WHERE user_id = ?',
      [req.user.id]
    );

    // Get credit card debt (liabilities)
    const [creditCards] = await conn.query(
      'SELECT COALESCE(SUM(due_amount), 0) as total FROM credit_cards WHERE user_id = ?',
      [req.user.id]
    );

    // Get loan balances (liabilities)
    const [loans] = await conn.query(
      'SELECT COALESCE(SUM(remaining), 0) as total FROM loans WHERE user_id = ?',
      [req.user.id]
    );

    // Get personal lending (borrowed = liability, lent = asset)
    const [personalLending] = await conn.query(
      'SELECT COALESCE(SUM(CASE WHEN direction = "borrowed" THEN outstanding_balance ELSE 0 END), 0) as borrowed, COALESCE(SUM(CASE WHEN direction = "lent" THEN outstanding_balance ELSE 0 END), 0) as lent FROM personal_lendings WHERE user_id = ? AND status = "active"',
      [req.user.id]
    );

    const totalAssets = parseFloat(accounts[0].total) + parseFloat(dps[0].total) + parseFloat(fds[0].total) + parseFloat(sanchayapatra[0].total) + parseFloat(investments[0].total) + parseFloat(personalLending[0].lent);
    const totalLiabilities = parseFloat(creditCards[0].total) + parseFloat(loans[0].total) + parseFloat(personalLending[0].borrowed);
    const netWorth = totalAssets - totalLiabilities;

    res.json({
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      net_worth: netWorth,
      breakdown: {
        account_balance: parseFloat(accounts[0].total),
        dps_value: parseFloat(dps[0].total),
        fixed_deposit_value: parseFloat(fds[0].total),
        sanchayapatra_value: parseFloat(sanchayapatra[0].total),
        investment_value: parseFloat(investments[0].total),
        lending_value: parseFloat(personalLending[0].lent),
        credit_card_debt: parseFloat(creditCards[0].total),
        loan_balance: parseFloat(loans[0].total),
        personal_lending_balance: parseFloat(personalLending[0].borrowed),
      }
    });
  } catch (err) {
    next(err);
  } finally {
    conn.release();
  }
});

// Create a net worth snapshot
router.post('/', requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { snapshot_date } = req.body;
    const date = snapshot_date || new Date().toISOString().split('T')[0];

    // Check if snapshot already exists for this date
    const [existing] = await conn.query(
      'SELECT id FROM net_worth_snapshots WHERE user_id = ? AND snapshot_date = ?',
      [req.user.id, date]
    );

    if (existing.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'Snapshot already exists for this date' });
    }

    // Get account balances (assets)
    const [accounts] = await conn.query(
      'SELECT COALESCE(SUM(balance), 0) as total FROM accounts WHERE user_id = ?',
      [req.user.id]
    );

    // Get DPS values (assets)
    const [dps] = await conn.query(
      'SELECT COALESCE(SUM(total_deposited), 0) as total FROM dps WHERE user_id = ?',
      [req.user.id]
    );

    // Get fixed deposit values (assets)
    const [fds] = await conn.query(
      'SELECT COALESCE(SUM(principal), 0) as total FROM fixed_deposits WHERE user_id = ?',
      [req.user.id]
    );

    // Get Sanchayapatra values (assets)
    const [sanchayapatra] = await conn.query(
      'SELECT COALESCE(SUM(principal_amount), 0) as total FROM sanchayapatra WHERE user_id = ? AND status = "active"',
      [req.user.id]
    );

    // Get investment values (assets)
    const [investments] = await conn.query(
      'SELECT COALESCE(SUM(quantity * COALESCE(current_price, buy_price)), 0) as total FROM investments WHERE user_id = ?',
      [req.user.id]
    );

    // Get credit card debt (liabilities)
    const [creditCards] = await conn.query(
      'SELECT COALESCE(SUM(due_amount), 0) as total FROM credit_cards WHERE user_id = ?',
      [req.user.id]
    );

    // Get loan balances (liabilities)
    const [loans] = await conn.query(
      'SELECT COALESCE(SUM(remaining), 0) as total FROM loans WHERE user_id = ?',
      [req.user.id]
    );

    // Get personal lending (borrowed = liability, lent = asset)
    const [personalLending] = await conn.query(
      'SELECT COALESCE(SUM(CASE WHEN direction = "borrowed" THEN outstanding_balance ELSE 0 END), 0) as borrowed, COALESCE(SUM(CASE WHEN direction = "lent" THEN outstanding_balance ELSE 0 END), 0) as lent FROM personal_lendings WHERE user_id = ? AND status = "active"',
      [req.user.id]
    );

    const totalAssets = parseFloat(accounts[0].total) + parseFloat(dps[0].total) + parseFloat(fds[0].total) + parseFloat(sanchayapatra[0].total) + parseFloat(investments[0].total) + parseFloat(personalLending[0].lent);
    const totalLiabilities = parseFloat(creditCards[0].total) + parseFloat(loans[0].total) + parseFloat(personalLending[0].borrowed);
    const netWorth = totalAssets - totalLiabilities;

    await conn.query(
      `INSERT INTO net_worth_snapshots (user_id, snapshot_date, total_assets, total_liabilities, net_worth, account_balance, dps_value, fixed_deposit_value, sanchayapatra_value, investment_value, lending_value, credit_card_debt, loan_balance, personal_lending_balance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, date, totalAssets, totalLiabilities, netWorth, accounts[0].total, dps[0].total, fds[0].total, sanchayapatra[0].total, investments[0].total, personalLending[0].lent, creditCards[0].total, loans[0].total, personalLending[0].borrowed]
    );

    res.json({ net_worth: netWorth, snapshot_date: date });
  } catch (err) {
    next(err);
  } finally {
    conn.release();
  }
});

// Delete a snapshot
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM net_worth_snapshots WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
