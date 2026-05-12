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

// Configure auto-scheduled net worth snapshots
router.post('/schedule', requireAuth, async (req, res, next) => {
  try {
    const { enabled, frequency, next_snapshot_date } = req.body;

    // Check if user settings exist
    const [existing] = await pool.query(
      'SELECT id FROM user_settings WHERE user_id = ?',
      [req.user.id]
    );

    if (existing.length) {
      await pool.query(
        `UPDATE user_settings SET auto_net_worth_enabled = ?, auto_net_worth_frequency = ?, next_net_worth_snapshot = ? WHERE user_id = ?`,
        [enabled || false, frequency || 'monthly', next_snapshot_date || null, req.user.id]
      );
    } else {
      await pool.query(
        `INSERT INTO user_settings (user_id, auto_net_worth_enabled, auto_net_worth_frequency, next_net_worth_snapshot)
         VALUES (?, ?, ?, ?)`,
        [req.user.id, enabled || false, frequency || 'monthly', next_snapshot_date || null]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Get schedule configuration
router.get('/schedule', requireAuth, async (req, res, next) => {
  try {
    const [settings] = await pool.query(
      'SELECT auto_net_worth_enabled, auto_net_worth_frequency, next_net_worth_snapshot FROM user_settings WHERE user_id = ?',
      [req.user.id]
    );

    if (!settings.length) {
      return res.json({
        enabled: false,
        frequency: 'monthly',
        next_snapshot_date: null
      });
    }

    res.json({
      enabled: settings[0].auto_net_worth_enabled,
      frequency: settings[0].auto_net_worth_frequency,
      next_snapshot_date: settings[0].next_net_worth_snapshot
    });
  } catch (err) {
    next(err);
  }
});

// Trigger snapshot manually (for testing or immediate snapshot)
router.post('/trigger-snapshot', requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const date = new Date().toISOString().split('T')[0];

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

    // Update next snapshot date if auto-schedule is enabled
    const [settings] = await conn.query(
      'SELECT auto_net_worth_enabled, auto_net_worth_frequency FROM user_settings WHERE user_id = ?',
      [req.user.id]
    );

    if (settings.length && settings[0].auto_net_worth_enabled) {
      let nextDate = new Date();
      const frequency = settings[0].auto_net_worth_frequency || 'monthly';
      
      if (frequency === 'daily') {
        nextDate.setDate(nextDate.getDate() + 1);
      } else if (frequency === 'weekly') {
        nextDate.setDate(nextDate.getDate() + 7);
      } else if (frequency === 'monthly') {
        nextDate.setMonth(nextDate.getMonth() + 1);
      } else if (frequency === 'yearly') {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      }

      await conn.query(
        'UPDATE user_settings SET next_net_worth_snapshot = ? WHERE user_id = ?',
        [nextDate.toISOString().split('T')[0], req.user.id]
      );
    }

    res.json({ net_worth: netWorth, snapshot_date: date, auto_triggered: false });
  } catch (err) {
    next(err);
  } finally {
    conn.release();
  }
});

module.exports = router;
