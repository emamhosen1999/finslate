const express = require('express');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const pool = require('../db/connection');
const { seedNewUser } = require('../seed/seedUser');

const router = express.Router();

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  (req, res, next) => {
    passport.authenticate('google', { failureRedirect: `${process.env.CLIENT_ORIGIN || ''}/login?error=oauth` }, (err, user) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.error('[auth] google callback error:', err);
        return res.redirect(`${process.env.CLIENT_ORIGIN || ''}/login?error=oauth`);
      }
      if (!user) {
        // eslint-disable-next-line no-console
        console.warn('[auth] google callback: no user returned');
        return res.redirect(`${process.env.CLIENT_ORIGIN || ''}/login?error=oauth`);
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          // eslint-disable-next-line no-console
          console.error('[auth] session login error:', loginErr);
          return res.redirect(`${process.env.CLIENT_ORIGIN || ''}/login?error=oauth`);
        }
        return res.redirect(`${process.env.CLIENT_ORIGIN || ''}/`);
      });
    })(req, res, next);
  },
);

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email.toLowerCase()]);
    if (existing.length) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, phone, password_hash, default_currency, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [name.trim(), email.toLowerCase(), phone || null, hash, 'BDT', true],
    );
    const userId = result.insertId;
    await seedNewUser(userId);

    req.logIn({ id: userId }, (err) => {
      if (err) return next(err);
      return res.json({ user: { id: userId, name: name.trim(), email: email.toLowerCase(), phone: phone || null } });
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login/email', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const [rows] = await pool.query(
      'SELECT id, name, email, profile_photo_url, password_hash FROM users WHERE email = ? LIMIT 1',
      [email.toLowerCase()],
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = rows[0];
    if (!user.password_hash) {
      return res.status(401).json({ error: 'This account uses Google sign-in. Please use the Google button.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Update last_login_at
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    req.logIn({ id: user.id }, (err) => {
      if (err) return next(err);
      return res.json({ user: { id: user.id, name: user.name, email: user.email, profile_photo_url: user.profile_photo_url } });
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    const { id, name, email, phone, default_currency, profile_photo_url, timezone, date_format, financial_year_start, tin_number, nid_number, is_active, last_login_at, updated_at } = req.user;
    return res.json({ user: { id, name, email, phone, default_currency, profile_photo_url, timezone, date_format, financial_year_start, tin_number, nid_number, is_active, last_login_at, updated_at } });
  }
  return res.json({ user: null });
});

router.put('/profile', async (req, res, next) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { timezone, date_format, financial_year_start, tin_number, nid_number, phone, default_currency, is_active } = req.body;
    const userId = req.user.id;

    await pool.query(
      `UPDATE users SET timezone = ?, date_format = ?, financial_year_start = ?, tin_number = ?, nid_number = ?, phone = ?, default_currency = ?, is_active = ? WHERE id = ?`,
      [timezone || 'Asia/Dhaka', date_format || 'DD/MM/YYYY', financial_year_start || 7, tin_number || null, nid_number || null, phone || null, default_currency || 'BDT', is_active !== undefined ? is_active : true, userId]
    );

    // Update session user data
    const [rows] = await pool.query(
      'SELECT id, name, email, phone, default_currency, profile_photo_url, timezone, date_format, financial_year_start, tin_number, nid_number, is_active, last_login_at, updated_at FROM users WHERE id = ?',
      [userId]
    );
    if (rows.length) {
      req.user = rows[0];
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ ok: true });
    });
  });
});

// Password reset request - generates a reset token
router.post('/reset-password/request', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const [rows] = await pool.query(
      'SELECT id, email FROM users WHERE email = ? LIMIT 1',
      [email.toLowerCase()]
    );
    
    if (!rows.length) {
      // Don't reveal if email exists for security
      return res.json({ ok: true, message: 'If an account exists with this email, a reset token will be generated.' });
    }

    const user = rows[0];
    // Generate a simple reset token (in production, use crypto.randomBytes and email it)
    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    await pool.query(
      'UPDATE users SET password_reset_token = ?, password_reset_token_expiry = ? WHERE id = ?',
      [resetToken, resetTokenExpiry, user.id]
    );

    // In production, send email with reset token
    // For now, return the token for testing (remove in production)
    res.json({ ok: true, message: 'Reset token generated', resetToken }); // TODO: Remove resetToken in production
  } catch (err) {
    next(err);
  }
});

// Password reset confirmation - validates token and updates password
router.post('/reset-password/confirm', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const [rows] = await pool.query(
      'SELECT id, password_reset_token_expiry FROM users WHERE password_reset_token = ? LIMIT 1',
      [token]
    );

    if (!rows.length) {
      return res.status(400).json({ error: 'Invalid or expired reset token.' });
    }

    const user = rows[0];
    if (new Date(user.password_reset_token_expiry) < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired.' });
    }

    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      'UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_token_expiry = NULL WHERE id = ?',
      [hash, user.id]
    );

    res.json({ ok: true, message: 'Password reset successful' });
  } catch (err) {
    next(err);
  }
});

// Change password for authenticated user
router.post('/change-password', async (req, res, next) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const [rows] = await pool.query(
      'SELECT password_hash FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );

    if (!rows.length || !rows[0].password_hash) {
      return res.status(400).json({ error: 'This account uses Google sign-in or has no password set.' });
    }

    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [hash, req.user.id]
    );

    res.json({ ok: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
});

// Add password reset token columns to users table (idempotent)
router.post('/ensure-reset-columns', async (req, res, next) => {
  try {
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255) NULL,
      ADD COLUMN IF NOT EXISTS password_reset_token_expiry DATETIME NULL
    `);
    res.json({ ok: true, message: 'Reset columns ensured' });
  } catch (err) {
    next(err);
  }
});

// Request account deletion - requires password confirmation
router.post('/delete-account/request', async (req, res, next) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password is required for confirmation.' });
    }

    const [rows] = await pool.query(
      'SELECT password_hash FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );

    if (!rows.length || !rows[0].password_hash) {
      return res.status(400).json({ error: 'This account uses Google sign-in or has no password set.' });
    }

    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Password is incorrect.' });
    }

    // Generate deletion token
    const deletionToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const deletionTokenExpiry = new Date(Date.now() + 86400000); // 24 hours from now

    await pool.query(
      'UPDATE users SET password_reset_token = ?, password_reset_token_expiry = ? WHERE id = ?',
      [deletionToken, deletionTokenExpiry, req.user.id]
    );

    res.json({ ok: true, message: 'Deletion token generated. Use it to confirm deletion.', deletionToken });
  } catch (err) {
    next(err);
  }
});

// Confirm and execute account deletion
router.post('/delete-account/confirm', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { token } = req.body;
    if (!token) {
      await connection.rollback();
      return res.status(400).json({ error: 'Deletion token is required.' });
    }

    const [rows] = await connection.query(
      'SELECT id, password_reset_token_expiry FROM users WHERE password_reset_token = ? LIMIT 1',
      [token]
    );

    if (!rows.length) {
      await connection.rollback();
      return res.status(400).json({ error: 'Invalid or expired deletion token.' });
    }

    const user = rows[0];
    if (new Date(user.password_reset_token_expiry) < new Date()) {
      await connection.rollback();
      return res.status(400).json({ error: 'Deletion token has expired.' });
    }

    const userId = user.id;

    // Delete user data in order respecting foreign keys (child tables first)
    // ── Audit & reports ──
    await connection.query('DELETE FROM audit_logs WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM reports WHERE user_id = ?', [userId]);

    // ── Bill payments (child of bills) ──
    await connection.query('DELETE bp FROM bill_payments bp JOIN bills b ON bp.bill_id = b.id WHERE b.user_id = ?', [userId]);

    // ── Credit card children ──
    await connection.query('DELETE ccp FROM credit_card_payments ccp JOIN credit_cards cc ON ccp.credit_card_id = cc.id WHERE cc.user_id = ?', [userId]);
    await connection.query('DELETE ccs FROM credit_card_statements ccs JOIN credit_cards cc ON ccs.credit_card_id = cc.id WHERE cc.user_id = ?', [userId]);

    // ── DPS payments (child of dps) ──
    await connection.query('DELETE dp FROM dps_payments dp JOIN dps d ON dp.dps_id = d.id WHERE d.user_id = ?', [userId]);

    // ── FDR renewals (child of fixed_deposits) ──
    await connection.query('DELETE fr FROM fdr_renewals fr JOIN fixed_deposits fd ON fr.fdr_id = fd.id WHERE fd.user_id = ?', [userId]);

    // ── Loan payments (child of loans) ──
    await connection.query('DELETE lp FROM loan_payments lp JOIN loans l ON lp.loan_id = l.id WHERE l.user_id = ?', [userId]);

    // ── PF contributions (child of provident_fund) ──
    await connection.query('DELETE pfc FROM pf_contributions pfc JOIN provident_fund pf ON pfc.provident_fund_id = pf.id WHERE pf.user_id = ?', [userId]);

    // ── Insurance premium payments (child of insurances) ──
    await connection.query('DELETE ipp FROM insurance_premium_payments ipp JOIN insurances ins ON ipp.insurance_id = ins.id WHERE ins.user_id = ?', [userId]);

    // ── Sanchayapatra interest payments ──
    await connection.query('DELETE sip FROM sanchayapatra_interest_payments sip JOIN sanchayapatra s ON sip.sanchayapatra_id = s.id WHERE s.user_id = ?', [userId]);

    // ── Lending repayments (child of personal_lendings) ──
    await connection.query('DELETE lr FROM lending_repayments lr JOIN personal_lendings pl ON lr.personal_lending_id = pl.id WHERE pl.user_id = ?', [userId]);

    // ── Goal contributions (child of goals) ──
    await connection.query('DELETE gc FROM goal_contributions gc JOIN goals g ON gc.goal_id = g.id WHERE g.user_id = ?', [userId]);

    // ── Investment children ──
    await connection.query('DELETE it FROM investment_transactions it JOIN investments inv ON it.investment_id = inv.id WHERE inv.user_id = ?', [userId]);
    await connection.query('DELETE isn FROM investment_snapshots isn JOIN investments inv ON isn.investment_id = inv.id WHERE inv.user_id = ?', [userId]);

    // ── Recurring rules & recurring transactions ──
    await connection.query('DELETE FROM recurring_rules WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM recurring_transactions WHERE user_id = ?', [userId]);

    // ── Tags & Attachments (children of transactions) ──
    await connection.query('DELETE tt FROM transaction_tags tt JOIN transactions t ON t.id = tt.transaction_id WHERE t.user_id = ?', [userId]);
    await connection.query('DELETE ta FROM transaction_attachments ta JOIN transactions t ON t.id = ta.transaction_id WHERE t.user_id = ?', [userId]);
    await connection.query('DELETE FROM attachments WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM tags WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM categories WHERE user_id = ?', [userId]);

    // ── Transactions ──
    await connection.query('DELETE FROM transactions WHERE user_id = ?', [userId]);

    // ── Parent tables ──
    await connection.query('DELETE FROM bills WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM subscriptions WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM credit_cards WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM loans WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM dps WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM fixed_deposits WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM investments WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM insurances WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM insurance_premiums WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM sanchayapatra WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM personal_lendings WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM provident_fund WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM tax_records WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM goals WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM budgets WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM net_worth_snapshots WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM notifications WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM income_sources WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM accounts WHERE user_id = ?', [userId]);

    // Finally delete the user
    await connection.query('DELETE FROM users WHERE id = ?', [userId]);

    await connection.commit();
    res.json({ ok: true, message: 'Account deleted successfully' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

module.exports = router;
