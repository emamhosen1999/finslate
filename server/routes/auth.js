const express = require('express');
const passport = require('passport');

const router = express.Router();

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.CLIENT_ORIGIN || ''}/login?error=oauth` }),
  (req, res) => {
    res.redirect(`${process.env.CLIENT_ORIGIN || ''}/`);
  },
);

router.get('/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    const { id, name, email, avatar_url: avatarUrl } = req.user;
    return res.json({ user: { id, name, email, avatarUrl } });
  }
  return res.json({ user: null });
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
