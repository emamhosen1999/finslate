require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const path = require('path');
const fs = require('fs');
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const passport = require('passport');

const { migrate } = require('./db/migrate');
const { configureGoogleStrategy } = require('./auth/google');

const PORT = Number(process.env.PORT) || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

async function start() {
  await migrate();
  configureGoogleStrategy();

  const app = express();
  app.set('trust proxy', 1);

  app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use(
    cors({
      origin: CLIENT_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json());

  const sessionStore = new MySQLStore({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'finslate',
    createDatabaseTable: true,
    clearExpired: true,
    expiration: 30 * 24 * 60 * 60 * 1000,
  });

  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'change-me-in-production',
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        httpOnly: true,
        sameSite: NODE_ENV === 'production' ? 'none' : 'lax',
        secure: NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/dashboard', require('./routes/dashboard'));
  app.use('/api/accounts', require('./routes/accounts'));
  app.use('/api/transfers', require('./routes/transfers'));
  app.use('/api/transactions', require('./routes/transactions'));
  app.use('/api/credit-cards', require('./routes/creditCards'));
  app.use('/api/loans', require('./routes/loan'));
  app.use('/api/dps', require('./routes/dps'));
  app.use('/api/budgets', require('./routes/budgets'));
  app.use('/api/recurring-transactions', require('./routes/recurringTransactions'));
  app.use('/api/recurring-rules', require('./routes/recurringRules'));
  app.use('/api/fixed-deposits', require('./routes/fixedDeposits'));
  app.use('/api/income-sources', require('./routes/incomeSources'));
  app.use('/api/incomes', require('./routes/incomes'));
  app.use('/api/investments', require('./routes/investments'));
  app.use('/api/insurance', require('./routes/insurance'));
  app.use('/api/sanchayapatra', require('./routes/sanchayapatra'));
  app.use('/api/personal-lending', require('./routes/personalLending'));
  app.use('/api/net-worth', require('./routes/netWorth'));
  app.use('/api/notifications', require('./routes/notifications'));
  app.use('/api/bills', require('./routes/bills'));
  app.use('/api/subscriptions', require('./routes/subscriptions'));
  app.use('/api/provident-fund', require('./routes/providentFund'));
  app.use('/api/tax-records', require('./routes/taxRecords'));
  app.use('/api/goals', require('./routes/goals'));
  app.use('/api/currencies', require('./routes/currencies'));
  app.use('/api/reports', require('./routes/reports'));
  app.use('/api/analytics', require('./routes/analytics'));
  app.use('/api/actions', require('./routes/actions'));
  app.use('/api/audit-logs', require('./routes/auditLogs'));
  app.use('/api/bill-payments', require('./routes/billPayments'));
  app.use('/api/credit-card-statements', require('./routes/creditCardStatements'));
  app.use('/api/credit-card-payments', require('./routes/creditCardPayments'));
  app.use('/api/dps-payments', require('./routes/dpsPayments'));
  app.use('/api/pf-contributions', require('./routes/pfContributions'));
  app.use('/api/tags', require('./routes/tags'));
  app.use('/api/categories', require('./routes/categories'));
  app.use('/api/attachments', require('./routes/attachments'));

  // Serve uploaded files
  const uploadsDir = path.resolve(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir));

  // Serve the built client when present (single-process deploy, e.g. Replit/Fly).
  const clientDist = path.resolve(__dirname, '../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    // eslint-disable-next-line no-console
    console.error('[api] error', err);
    res.status(err.status || 500).json({ error: err.message || 'internal_error' });
  });

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[finslate] api listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[finslate] failed to start', err);
  process.exit(1);
});
