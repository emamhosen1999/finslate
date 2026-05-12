const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool = require('../db/connection');
const { seedNewUser } = require('../seed/seedUser');

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, google_id, name, email, profile_photo_url, created_at FROM users WHERE id = ?',
      [id],
    );
    done(null, rows[0] || null);
  } catch (err) {
    done(err);
  }
});

function configureGoogleStrategy() {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback';

  if (!clientID || !clientSecret) {
    // eslint-disable-next-line no-console
    console.warn('[auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — Google OAuth disabled');
    return;
  }

  passport.use(
    new GoogleStrategy(
      { clientID, clientSecret, callbackURL },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails && profile.emails[0] && profile.emails[0].value;
          const name = profile.displayName;
          const avatarUrl = profile.photos && profile.photos[0] && profile.photos[0].value;

          if (!email) return done(new Error('Google profile is missing an email'));

          const [existing] = await pool.query('SELECT id FROM users WHERE google_id = ? LIMIT 1', [googleId]);
          if (existing.length) {
            // Refresh denormalised fields cheaply.
            await pool.query(
              'UPDATE users SET name = ?, email = ?, profile_photo_url = ? WHERE id = ?',
              [name || null, email, avatarUrl || null, existing[0].id],
            );
            return done(null, { id: existing[0].id });
          }

          const [insert] = await pool.query(
            'INSERT INTO users (google_id, name, email, profile_photo_url) VALUES (?, ?, ?, ?)',
            [googleId, name || null, email, avatarUrl || null],
          );
          const newUserId = insert.insertId;
          await seedNewUser(newUserId);
          return done(null, { id: newUserId });
        } catch (err) {
          return done(err);
        }
      },
    ),
  );
}

module.exports = { configureGoogleStrategy };
