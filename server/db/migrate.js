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
    is_verified BOOLEAN DEFAULT FALSE,
    is_excluded_from_reports BOOLEAN DEFAULT FALSE,
    parent_transaction_id INT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at  TIMESTAMP NULL,
    INDEX idx_user_created (user_id, created_at),
    CONSTRAINT fk_tx_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_tx_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    CONSTRAINT fk_tx_parent FOREIGN KEY (parent_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS transfers (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    user_id             INT NOT NULL,
    from_account_id     INT NOT NULL,
    to_account_id       INT NOT NULL,
    amount              DECIMAL(15,2) NOT NULL,
    converted_amount    DECIMAL(15,2) NULL,
    exchange_rate       DECIMAL(10,6) DEFAULT 1.000000,
    fee                 DECIMAL(15,2) DEFAULT 0.00,
    fee_account_id      INT NULL,
    transfer_date       DATE NOT NULL,
    note                TEXT NULL,
    reference_no        VARCHAR(100) NULL,
    status              ENUM('pending','completed','reversed') DEFAULT 'completed',
    reversed_at         TIMESTAMP NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transfers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_transfers_from_account FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    CONSTRAINT fk_transfers_to_account FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    CONSTRAINT fk_transfers_fee_account FOREIGN KEY (fee_account_id) REFERENCES accounts(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS budgets (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    category    VARCHAR(100) NOT NULL,
    amount      DECIMAL(15,2) NOT NULL,
    period      VARCHAR(20) DEFAULT 'monthly',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_budgets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS recurring_transactions (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    account_id      INT,
    name            VARCHAR(100) NOT NULL,
    type            ENUM('credit','debit') NOT NULL,
    amount          DECIMAL(12,2) NOT NULL,
    category        VARCHAR(80) NOT NULL,
    description     VARCHAR(255),
    frequency       ENUM('daily','weekly','bi_weekly','monthly','quarterly','yearly') NOT NULL,
    day_of_month    TINYINT NULL,
    day_of_week     TINYINT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE,
    last_processed  DATE,
    next_due        DATE,
    last_executed_date DATE NULL,
    entity_type     VARCHAR(50) NULL,
    entity_id       INT NULL,
    auto_create_transaction BOOLEAN DEFAULT TRUE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_recurring_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_recurring_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS fixed_deposits (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    name            VARCHAR(100) NOT NULL,
    principal       DECIMAL(12,2) NOT NULL,
    interest_rate   DECIMAL(5,2) NOT NULL,
    start_date      DATE NOT NULL,
    maturity_date   DATE NOT NULL,
    maturity_amount DECIMAL(12,2),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fd_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS income_sources (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    name            VARCHAR(100) NOT NULL,
    type            VARCHAR(50) NOT NULL,
    amount          DECIMAL(12,2) NOT NULL,
    frequency       VARCHAR(20) DEFAULT 'monthly',
    account_id      INT,
    next_pay_date   DATE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_income_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_income_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS investments (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    name            VARCHAR(100) NOT NULL,
    type            VARCHAR(50) NOT NULL,
    symbol          VARCHAR(20),
    quantity        DECIMAL(15,4) NOT NULL,
    buy_price       DECIMAL(12,2) NOT NULL,
    current_price   DECIMAL(12,2),
    buy_date        DATE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_investments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS insurance_premiums (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    name            VARCHAR(100) NOT NULL,
    type            VARCHAR(50) NOT NULL,
    provider        VARCHAR(100),
    premium_amount  DECIMAL(12,2) NOT NULL,
    frequency       VARCHAR(20) DEFAULT 'yearly',
    next_due_date   DATE,
    account_id      INT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_insurance_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_insurance_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS tags (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    name        VARCHAR(50) NOT NULL,
    color       VARCHAR(7) NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tags_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS attachments (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    file_type       VARCHAR(50) NOT NULL,
    file_size_bytes INT NOT NULL,
    storage_path    VARCHAR(500) NOT NULL,
    public_url      VARCHAR(500) NULL,
    entity_type     VARCHAR(50) NULL,
    entity_id       INT NULL,
    uploaded_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_attachments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS transaction_tags (
    transaction_id INT NOT NULL,
    tag_id         INT NOT NULL,
    PRIMARY KEY (transaction_id, tag_id),
    CONSTRAINT fk_tt_transaction FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    CONSTRAINT fk_tt_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS transaction_attachments (
    transaction_id INT NOT NULL,
    attachment_id INT NOT NULL,
    PRIMARY KEY (transaction_id, attachment_id),
    CONSTRAINT fk_ta_transaction FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    CONSTRAINT fk_ta_attachment FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS categories (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NULL,
    name        VARCHAR(100) NOT NULL,
    type        ENUM('income','expense','both') NOT NULL,
    parent_id   INT NULL,
    icon        VARCHAR(50) NULL,
    color       VARCHAR(7) NULL,
    is_system   BOOLEAN DEFAULT FALSE,
    sort_order  SMALLINT DEFAULT 0,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_categories_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS sanchayapatra (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    user_id             INT NOT NULL,
    name                VARCHAR(100) NOT NULL,
    scheme_type         ENUM('3_month_profit','5_year_bangladesh','family_savings','pensioner','wage_earner') NOT NULL,
    certificate_number VARCHAR(100) NOT NULL,
    principal_amount    DECIMAL(15,2) NOT NULL,
    interest_rate       DECIMAL(5,2) NOT NULL,
    purchase_date       DATE NOT NULL,
    maturity_date       DATE NOT NULL,
    maturity_value      DECIMAL(15,2) NULL,
    status              ENUM('active','matured','encashed') DEFAULT 'active',
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sanchayapatra_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS sanchayapatra_interest_payments (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    sanchayapatra_id    INT NOT NULL,
    payment_date        DATE NOT NULL,
    amount              DECIMAL(15,2) NOT NULL,
    cumulative_interest DECIMAL(15,2) NOT NULL,
    cumulative_value    DECIMAL(15,2) NOT NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sip_sanchayapatra FOREIGN KEY (sanchayapatra_id) REFERENCES sanchayapatra(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS personal_lendings (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    user_id             INT NOT NULL,
    direction           ENUM('lent','borrowed') NOT NULL,
    counterparty_name   VARCHAR(100) NOT NULL,
    counterparty_contact VARCHAR(50) NULL,
    principal_amount    DECIMAL(15,2) NOT NULL,
    outstanding_balance DECIMAL(15,2) NOT NULL,
    interest_rate       DECIMAL(5,2) NULL,
    start_date          DATE NOT NULL,
    due_date            DATE NULL,
    status              ENUM('active','settled','partial') DEFAULT 'active',
    notes               TEXT NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_personal_lendings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS lending_repayments (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    lending_id          INT NOT NULL,
    repayment_date      DATE NOT NULL,
    amount              DECIMAL(15,2) NOT NULL,
    notes               TEXT NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lr_lending FOREIGN KEY (lending_id) REFERENCES personal_lendings(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS net_worth_snapshots (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    user_id             INT NOT NULL,
    snapshot_date       DATE NOT NULL,
    total_assets        DECIMAL(15,2) NOT NULL,
    total_liabilities   DECIMAL(15,2) NOT NULL,
    net_worth          DECIMAL(15,2) NOT NULL,
    account_balance     DECIMAL(15,2) DEFAULT 0,
    dps_value           DECIMAL(15,2) DEFAULT 0,
    fixed_deposit_value DECIMAL(15,2) DEFAULT 0,
    sanchayapatra_value DECIMAL(15,2) DEFAULT 0,
    investment_value    DECIMAL(15,2) DEFAULT 0,
    lending_value       DECIMAL(15,2) DEFAULT 0,
    credit_card_debt    DECIMAL(15,2) DEFAULT 0,
    loan_balance        DECIMAL(15,2) DEFAULT 0,
    personal_lending_balance DECIMAL(15,2) DEFAULT 0,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_nws_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_date (user_id, snapshot_date)
  )`,

  `CREATE TABLE IF NOT EXISTS notifications (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    type            ENUM('info','warning','error','success') NOT NULL,
    title           VARCHAR(200) NOT NULL,
    message         TEXT NOT NULL,
    entity_type     VARCHAR(50) NULL,
    entity_id       INT NULL,
    is_read         BOOLEAN DEFAULT FALSE,
    action_url      VARCHAR(500) NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_read (user_id, is_read)
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
    // Add user profile fields
    `ALTER TABLE users ADD COLUMN timezone VARCHAR(50) DEFAULT 'Asia/Dhaka' AFTER password_hash`,
    `ALTER TABLE users ADD COLUMN date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY' AFTER timezone`,
    `ALTER TABLE users ADD COLUMN financial_year_start TINYINT DEFAULT 7 AFTER date_format`,
    `ALTER TABLE users ADD COLUMN tin_number VARCHAR(20) NULL AFTER financial_year_start`,
    `ALTER TABLE users ADD COLUMN nid_number VARCHAR(20) NULL AFTER tin_number`,
    `ALTER TABLE users ADD COLUMN profile_photo_url VARCHAR(500) NULL AFTER nid_number`,
    `ALTER TABLE users ADD COLUMN notification_preferences JSON NULL AFTER profile_photo_url`,
    // Add transaction enhancement columns
    `ALTER TABLE transactions ADD COLUMN is_verified BOOLEAN DEFAULT FALSE AFTER ref_id`,
    `ALTER TABLE transactions ADD COLUMN is_excluded_from_reports BOOLEAN DEFAULT FALSE AFTER is_verified`,
    `ALTER TABLE transactions ADD COLUMN parent_transaction_id INT NULL AFTER is_excluded_from_reports`,
    `ALTER TABLE transactions ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER parent_transaction_id`,
    `ALTER TABLE transactions ADD COLUMN deleted_at TIMESTAMP NULL AFTER updated_at`,
    `ALTER TABLE transactions ADD CONSTRAINT fk_tx_parent FOREIGN KEY (parent_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL`,
    // Add recurring_transactions enhancement columns
    `ALTER TABLE recurring_transactions MODIFY COLUMN frequency ENUM('daily','weekly','bi_weekly','monthly','quarterly','yearly')`,
    `ALTER TABLE recurring_transactions ADD COLUMN day_of_month TINYINT NULL AFTER frequency`,
    `ALTER TABLE recurring_transactions ADD COLUMN day_of_week TINYINT NULL AFTER day_of_month`,
    `ALTER TABLE recurring_transactions ADD COLUMN last_executed_date DATE NULL AFTER next_due`,
    `ALTER TABLE recurring_transactions ADD COLUMN entity_type VARCHAR(50) NULL AFTER last_executed_date`,
    `ALTER TABLE recurring_transactions ADD COLUMN entity_id INT NULL AFTER entity_type`,
    `ALTER TABLE recurring_transactions ADD COLUMN auto_create_transaction BOOLEAN DEFAULT TRUE AFTER entity_id`,
    `ALTER TABLE recurring_transactions ADD COLUMN is_active BOOLEAN DEFAULT TRUE AFTER auto_create_transaction`,
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
