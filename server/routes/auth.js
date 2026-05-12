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
    const { name, email, password } = req.body;
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
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name.trim(), email.toLowerCase(), hash],
    );
    const userId = result.insertId;
    await seedNewUser(userId);

    req.logIn({ id: userId }, (err) => {
      if (err) return next(err);
      return res.json({ user: { id: userId, name: name.trim(), email: email.toLowerCase() } });
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
      'SELECT id, name, email, avatar_url, password_hash FROM users WHERE email = ? LIMIT 1',
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

    req.logIn({ id: user.id }, (err) => {
      if (err) return next(err);
      return res.json({ user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatar_url } });
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    const { id, name, email, avatar_url: avatarUrl, timezone, date_format, financial_year_start, tin_number, nid_number } = req.user;
    return res.json({ user: { id, name, email, avatarUrl, timezone, date_format, financial_year_start, tin_number, nid_number } });
  }
  return res.json({ user: null });
});

router.put('/profile', async (req, res, next) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { timezone, date_format, financial_year_start, tin_number, nid_number } = req.body;
    const userId = req.user.id;

    await pool.query(
      `UPDATE users SET timezone = ?, date_format = ?, financial_year_start = ?, tin_number = ?, nid_number = ? WHERE id = ?`,
      [timezone || 'Asia/Dhaka', date_format || 'DD/MM/YYYY', financial_year_start || 7, tin_number || null, nid_number || null, userId]
    );

    // Update session user data
    const [rows] = await pool.query(
      'SELECT id, name, email, avatar_url, timezone, date_format, financial_year_start, tin_number, nid_number FROM users WHERE id = ?',
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

module.exports = router;
