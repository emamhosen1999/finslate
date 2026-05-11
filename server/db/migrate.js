require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const mysql = require('mysql2/promise');

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    google_id     VARCHAR(100) UNIQUE NULL,
    name          VARCHAR(100),
    email         VARCHAR(150) UNIQUE NOT NULL,
    avatar_url    VARCHAR(500),
    password_hash VARCHAR(255) NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS accounts (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    name        VARCHAR(100) NOT NULL,
    type        ENUM('bank','mobile_banking','cash') NOT NULL,
    balance     DECIMAL(12,2) DEFAULT 0.00,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_accounts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS credit_cards (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    name        VARCHAR(100) NOT NULL,
    limit_amt   DECIMAL(12,2) NOT NULL,
    due_amount  DECIMAL(12,2) DEFAULT 0.00,
    due_date    DATE,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cards_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS loans (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NOT NULL,
    name          VARCHAR(100) NOT NULL,
    principal     DECIMAL(12,2) NOT NULL,
    remaining     DECIMAL(12,2) NOT NULL,
    monthly_emi   DECIMAL(12,2) NOT NULL,
    interest_rate DECIMAL(5,2),
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_loans_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS dps (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    name            VARCHAR(100) NOT NULL,
    monthly_amount  DECIMAL(12,2) NOT NULL,
    total_deposited DECIMAL(12,2) DEFAULT 0.00,
    maturity_amount DECIMAL(12,2),
    start_date      DATE,
    maturity_date   DATE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dps_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS transactions (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    account_id  INT,
    type        ENUM('credit','debit') NOT NULL,
    amount      DECIMAL(12,2) NOT NULL,
    category    VARCHAR(80) NOT NULL,
    description VARCHAR(255),
    ref_type    VARCHAR(50),
    ref_id      INT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_created (user_id, created_at),
    CONSTRAINT fk_tx_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_tx_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
  )`,
];

async function migrate() {
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'finslate';

  // Bootstrap the database (so a fresh MySQL instance is enough).
  const bootstrap = await mysql.createConnection({ host, port, user, password, multipleStatements: false });
  await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await bootstrap.end();

  const conn = await mysql.createConnection({ host, port, user, password, database });
  // eslint-disable-next-line no-console
  console.log(`[migrate] connected to ${host}:${port}/${database}`);
  for (const sql of statements) {
    await conn.query(sql);
  }

  // Idempotent schema upgrades for existing deployments.
  const alterations = [
    // Allow google_id to be NULL so email/password users can register.
    `ALTER TABLE users MODIFY COLUMN google_id VARCHAR(100) NULL`,
    // Add password_hash column for email/password auth.
    `ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL AFTER avatar_url`,
  ];
  for (const sql of alterations) {
    try {
      await conn.query(sql);
    } catch (e) {
      // ER_DUP_FIELDNAME (1060) = column already exists — safe to ignore.
      if (e.errno !== 1060) throw e;
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[migrate] ${statements.length} tables ensured`);
  await conn.end();
}

if (require.main === module) {
  migrate().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[migrate] failed', err);
    process.exit(1);
  });
}

module.exports = { migrate };
