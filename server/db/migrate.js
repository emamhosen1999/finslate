require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const mysql = require('mysql2/promise');

// ─── Errors safe to ignore in alterations ──────────────────────────────────
// 1060 ER_DUP_FIELDNAME        column already exists
// 1826 ER_FK_DUP_NAME          constraint already exists
// 1054 ER_BAD_FIELD_ERROR      unknown column (rename source col gone)
// 1091 ER_CANT_DROP_FIELD_OR_KEY  can't drop; doesn't exist
// 1005 ER_CANT_CREATE_TABLE    FK target issue on safe-ignore alters
const SAFE_ERRNO = new Set([1060, 1826, 1054, 1091, 1005]);

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    phone VARCHAR(20) NULL,
    default_currency CHAR(3) DEFAULT 'BDT',
    profile_photo_url VARCHAR(500) NULL,
    timezone VARCHAR(50) DEFAULT 'Asia/Dhaka',
    date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
    financial_year_start TINYINT DEFAULT 7,
    tin_number VARCHAR(20) NULL,
    nid_number VARCHAR(20) NULL,
    notification_preferences JSON NULL,
    password_reset_token VARCHAR(255) NULL,
    password_reset_token_expiry DATETIME NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  `CREATE TABLE IF NOT EXISTS accounts (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    name        VARCHAR(100) NOT NULL,
    type        ENUM('bank','mobile_banking','mutual_fund','cash') NOT NULL,
    institution_name VARCHAR(100) NULL,
    account_number VARCHAR(50) NULL,
    current_balance DECIMAL(15,2) DEFAULT 0.00,
    opening_balance DECIMAL(15,2) DEFAULT 0.00,
    currency    VARCHAR(3) DEFAULT 'BDT',
    color       VARCHAR(7) NULL,
    icon        VARCHAR(50) NULL,
    is_default  BOOLEAN DEFAULT FALSE,
    is_active   BOOLEAN DEFAULT TRUE,
    note        TEXT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at  TIMESTAMP NULL,
    CONSTRAINT fk_accounts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS credit_cards (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    user_id                 INT NOT NULL,
    issuer                  VARCHAR(100) NOT NULL DEFAULT 'Unknown',
    card_name               VARCHAR(100) NOT NULL,
    card_number_last4       CHAR(4) NULL,
    card_type               ENUM('visa','mastercard','amex','unionpay','discover','other') NULL,
    credit_limit            DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    current_outstanding     DECIMAL(15,2) DEFAULT 0.00,
    billing_cycle_day       TINYINT NULL,
    payment_due_day         TINYINT NULL,
    annual_interest_rate    DECIMAL(5,2) NULL,
    minimum_payment_pct     DECIMAL(5,2) DEFAULT 5.00,
    minimum_payment_fixed   DECIMAL(10,2) DEFAULT 500.00,
    cash_advance_limit      DECIMAL(15,2) NULL,
    cash_advance_rate       DECIMAL(5,2) NULL,
    reward_points           INT DEFAULT 0,
    is_active               BOOLEAN DEFAULT TRUE,
    linked_bank_account_id  INT NULL,
    color                   VARCHAR(7) NULL,
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cards_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS loans (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    user_id                 INT NOT NULL,
    lender_name             VARCHAR(100) NOT NULL,
    loan_type               ENUM('personal','home','auto','student','business','informal') NOT NULL DEFAULT 'personal',
    purpose                 VARCHAR(255) NULL,
    principal_amount        DECIMAL(15,2) NOT NULL,
    outstanding_balance     DECIMAL(15,2) NOT NULL,
    annual_interest_rate    DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    interest_type           ENUM('flat','reducing_balance') NOT NULL DEFAULT 'reducing_balance',
    tenure_months           SMALLINT NOT NULL DEFAULT 12,
    emi_amount              DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    disbursement_date       DATE NOT NULL DEFAULT (CURRENT_DATE),
    first_emi_date          DATE NOT NULL DEFAULT (CURRENT_DATE),
    emi_day_of_month        TINYINT NULL,
    repayment_account_id    INT NULL,
    loan_account_number     VARCHAR(50) NULL,
    guarantor_name          VARCHAR(100) NULL,
    collateral_description  TEXT NULL,
    late_fee_rate           DECIMAL(5,2) DEFAULT 0.00,
    prepayment_penalty_pct  DECIMAL(5,2) DEFAULT 0.00,
    status                  ENUM('active','closed','defaulted','restructured') DEFAULT 'active',
    closed_date             DATE NULL,
    document_attachment_id  INT NULL,
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_loans_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS dps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    institution_name VARCHAR(100) NOT NULL,
    dps_account_number VARCHAR(50) NOT NULL,
    linked_account_id INT NULL,
    installment_amount DECIMAL(15,2) NOT NULL,
    annual_interest_rate DECIMAL(5,2) NOT NULL,
    tenure_months SMALLINT NOT NULL,
    start_date DATE NOT NULL,
    maturity_date DATE,
    total_installments SMALLINT,
    paid_installments SMALLINT DEFAULT 0,
    missed_installments SMALLINT DEFAULT 0,
    total_deposited DECIMAL(15,2) DEFAULT 0.00,
    projected_maturity_value DECIMAL(15,2),
    actual_maturity_value DECIMAL(15,2) NULL,
    withholding_tax_rate DECIMAL(5,2) DEFAULT 10.00,
    status ENUM('active','matured','closed','broken') DEFAULT 'active',
    break_date DATE NULL,
    break_value DECIMAL(15,2) NULL,
    maturity_credited_to_id INT NULL,
    note TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    CONSTRAINT fk_dps_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_dps_account FOREIGN KEY (linked_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    CONSTRAINT fk_dps_maturity_account FOREIGN KEY (maturity_credited_to_id) REFERENCES accounts(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS transactions (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    account_id  INT NULL,
    type        ENUM('income','expense','transfer_debit','transfer_credit','adjustment') NOT NULL,
    amount      DECIMAL(15,2) NOT NULL,
    currency    VARCHAR(3) DEFAULT 'BDT',
    transaction_date DATE NOT NULL,
    category_id VARCHAR(80) NULL,
    subcategory_id INT NULL,
    source_type ENUM('account','credit_card','cash') NOT NULL DEFAULT 'account',
    source_id   INT NULL,
    payee       VARCHAR(100) NULL,
    notes       VARCHAR(255),
    reference_no VARCHAR(100) NULL,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_rule_id INT NULL,
    is_split    BOOLEAN DEFAULT FALSE,
    ref_type    VARCHAR(50),
    ref_id      INT,
    is_verified BOOLEAN DEFAULT FALSE,
    is_excluded_from_reports BOOLEAN DEFAULT FALSE,
    parent_transaction_id INT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    user_id             INT NOT NULL,
    name                VARCHAR(100) NULL,
    category_id         VARCHAR(80) NULL,
    period              ENUM('monthly','weekly','yearly','custom') NOT NULL DEFAULT 'monthly',
    amount              DECIMAL(15,2) NOT NULL,
    start_date          DATE NOT NULL DEFAULT (CURRENT_DATE),
    end_date            DATE NULL,
    alert_threshold_pct TINYINT DEFAULT 80,
    rollover_unspent    BOOLEAN DEFAULT FALSE,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_budgets_user     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS budget_alerts (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    budget_id       INT NOT NULL,
    triggered_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    utilization_pct DECIMAL(5,2) NOT NULL,
    alert_type      ENUM('threshold','exceeded','period_end') NOT NULL,
    is_read         BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_ba_budget FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE
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
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    institution_name VARCHAR(100) NOT NULL,
    fdr_account_number VARCHAR(50) NULL,
    source_account_id INT NULL,
    principal_amount DECIMAL(15,2) NOT NULL,
    annual_interest_rate DECIMAL(5,2) NOT NULL,
    compounding_frequency ENUM('monthly','quarterly','half_yearly','yearly','on_maturity') NOT NULL,
    tenure_days INT NULL,
    tenure_months SMALLINT NULL,
    start_date DATE NOT NULL,
    maturity_date DATE NOT NULL,
    projected_maturity_value DECIMAL(15,2),
    actual_maturity_value DECIMAL(15,2) NULL,
    interest_payout_frequency ENUM('monthly','quarterly','on_maturity') DEFAULT 'on_maturity',
    interest_payout_account_id INT NULL,
    withholding_tax_rate DECIMAL(5,2) DEFAULT 10.00,
    auto_renewal BOOLEAN DEFAULT FALSE,
    renewal_count TINYINT DEFAULT 0,
    maturity_credited_to_id INT NULL,
    status ENUM('active','matured','broken','renewed') DEFAULT 'active',
    note TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    CONSTRAINT fk_fd_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_fd_source_account FOREIGN KEY (source_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    CONSTRAINT fk_fd_payout_account FOREIGN KEY (interest_payout_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    CONSTRAINT fk_fd_maturity_account FOREIGN KEY (maturity_credited_to_id) REFERENCES accounts(id) ON DELETE SET NULL
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

  `CREATE TABLE IF NOT EXISTS incomes (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    user_id                 INT NOT NULL,
    source_type             ENUM('salary','freelance','rental','dividend','business','gift','remittance','other') NOT NULL,
    title                   VARCHAR(100) NOT NULL,
    gross_amount            DECIMAL(15,2) NOT NULL,
    tds_amount              DECIMAL(15,2) DEFAULT 0.00,
    other_deductions        DECIMAL(15,2) DEFAULT 0.00,
    currency                CHAR(3) DEFAULT 'BDT',
    income_date             DATE NOT NULL,
    credited_to_account_id  INT NULL,
    category_id             INT NULL,
    description             TEXT NULL,
    is_recurring            BOOLEAN DEFAULT FALSE,
    recurring_rule_id       INT NULL,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_incomes_user    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_incomes_account FOREIGN KEY (credited_to_account_id) REFERENCES accounts(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS income_salary_details (
    id                        INT AUTO_INCREMENT PRIMARY KEY,
    income_id                 INT NOT NULL UNIQUE,
    employer_name             VARCHAR(100) NULL,
    basic_salary              DECIMAL(15,2) NULL,
    house_rent_allowance      DECIMAL(15,2) NULL,
    medical_allowance         DECIMAL(15,2) NULL,
    transport_allowance       DECIMAL(15,2) NULL,
    bonus                     DECIMAL(15,2) NULL,
    provident_fund_deduction  DECIMAL(15,2) NULL,
    pay_period                ENUM('monthly','weekly','bi_weekly') DEFAULT 'monthly',
    employer_tin              VARCHAR(20) NULL,
    CONSTRAINT fk_isd_income FOREIGN KEY (income_id) REFERENCES incomes(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS income_freelance_details (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    income_id               INT NOT NULL UNIQUE,
    client_name             VARCHAR(100) NULL,
    project_name            VARCHAR(100) NULL,
    invoice_number          VARCHAR(50) NULL,
    platform                VARCHAR(50) NULL,
    platform_fee            DECIMAL(15,2) DEFAULT 0.00,
    CONSTRAINT fk_ifd_income FOREIGN KEY (income_id) REFERENCES incomes(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS income_rental_details (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    income_id           INT NOT NULL UNIQUE,
    property_name       VARCHAR(100) NULL,
    tenant_name         VARCHAR(100) NULL,
    tenant_phone        VARCHAR(20) NULL,
    advance_deposit     DECIMAL(15,2) NULL,
    lease_start         DATE NULL,
    lease_end           DATE NULL,
    CONSTRAINT fk_ird_income FOREIGN KEY (income_id) REFERENCES incomes(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS income_dividend_details (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    income_id           INT NOT NULL UNIQUE,
    investment_id       INT NULL,
    dividend_type       ENUM('cash','stock') NULL,
    units               DECIMAL(15,4) NULL,
    rate_per_unit       DECIMAL(10,4) NULL,
    CONSTRAINT fk_idd_income FOREIGN KEY (income_id) REFERENCES incomes(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS investments (
    id                        INT AUTO_INCREMENT PRIMARY KEY,
    user_id                   INT NOT NULL,
    type                      ENUM('stock','bond','mutual_fund','crypto','etf','commodity') NOT NULL DEFAULT 'stock',
    name                      VARCHAR(100) NOT NULL,
    symbol                    VARCHAR(20) NULL,
    exchange                  VARCHAR(20) NULL,
    currency                  CHAR(3) DEFAULT 'BDT',
    quantity_held             DECIMAL(15,4) DEFAULT 0.0000,
    average_buy_price         DECIMAL(15,4) DEFAULT 0.0000,
    current_price             DECIMAL(15,4) NULL,
    total_invested            DECIMAL(15,2) DEFAULT 0.00,
    realized_gain_loss        DECIMAL(15,2) DEFAULT 0.00,
    total_dividends_received  DECIMAL(15,2) DEFAULT 0.00,
    broker_name               VARCHAR(100) NULL,
    bo_account_number         VARCHAR(50) NULL,
    status                    ENUM('active','sold','delisted') DEFAULT 'active',
    created_at                DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_investments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS investment_transactions (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    investment_id     INT NOT NULL,
    type              ENUM('buy','sell','dividend','split','bonus') NOT NULL,
    date              DATE NOT NULL,
    quantity          DECIMAL(15,4) NOT NULL,
    price_per_unit    DECIMAL(15,4) NOT NULL,
    brokerage_fee     DECIMAL(10,2) DEFAULT 0.00,
    tax               DECIMAL(10,2) DEFAULT 0.00,
    source_account_id INT NULL,
    note              TEXT NULL,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_inv_tx_investment FOREIGN KEY (investment_id) REFERENCES investments(id) ON DELETE CASCADE,
    CONSTRAINT fk_inv_tx_account    FOREIGN KEY (source_account_id) REFERENCES accounts(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS investment_snapshots (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    investment_id   INT NOT NULL,
    snapshot_date   DATE NOT NULL,
    price           DECIMAL(15,4) NOT NULL,
    quantity        DECIMAL(15,4) NOT NULL,
    value           DECIMAL(15,2) NOT NULL,
    CONSTRAINT fk_inv_snap_user       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_inv_snap_investment FOREIGN KEY (investment_id) REFERENCES investments(id) ON DELETE CASCADE
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

  `CREATE TABLE IF NOT EXISTS insurances (
    id                    INT AUTO_INCREMENT PRIMARY KEY,
    user_id               INT NOT NULL,
    type                  ENUM('life','term','health','vehicle','home','fire','travel') NOT NULL,
    provider_name         VARCHAR(100) NOT NULL,
    policy_number         VARCHAR(100) NOT NULL,
    plan_name             VARCHAR(100) NULL,
    sum_assured           DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    premium_amount        DECIMAL(15,2) NOT NULL,
    premium_frequency     ENUM('monthly','quarterly','half_yearly','yearly') NOT NULL DEFAULT 'yearly',
    premium_due_day       TINYINT NULL,
    policy_start_date     DATE NOT NULL DEFAULT (CURRENT_DATE),
    policy_end_date       DATE NULL,
    maturity_value        DECIMAL(15,2) NULL,
    surrender_value       DECIMAL(15,2) NULL,
    nominee_name          VARCHAR(100) NULL,
    nominee_relation      VARCHAR(50) NULL,
    agent_name            VARCHAR(100) NULL,
    linked_account_id     INT NULL,
    policy_document_id    INT NULL,
    status                ENUM('active','lapsed','surrendered','matured','claimed') DEFAULT 'active',
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_insurances_user    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_insurances_account FOREIGN KEY (linked_account_id) REFERENCES accounts(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS insurance_premium_payments (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    insurance_id            INT NOT NULL,
    due_date                DATE NOT NULL,
    paid_date               DATE NULL,
    amount                  DECIMAL(15,2) NOT NULL,
    late_fee                DECIMAL(15,2) DEFAULT 0.00,
    source_account_id       INT NULL,
    receipt_attachment_id   INT NULL,
    status                  ENUM('upcoming','paid','missed') DEFAULT 'upcoming',
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ipp_insurance FOREIGN KEY (insurance_id) REFERENCES insurances(id) ON DELETE CASCADE,
    CONSTRAINT fk_ipp_account   FOREIGN KEY (source_account_id) REFERENCES accounts(id) ON DELETE SET NULL
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
    id                          INT AUTO_INCREMENT PRIMARY KEY,
    user_id                     INT NOT NULL,
    scheme_type                 ENUM('three_month_profit','five_year_bangladesh','family_savings','pensioner_savings','wage_earner') NOT NULL DEFAULT 'five_year_bangladesh',
    certificate_number          VARCHAR(50) NOT NULL,
    issue_date                  DATE NOT NULL DEFAULT (CURRENT_DATE),
    face_value                  DECIMAL(15,2) NOT NULL,
    annual_interest_rate        DECIMAL(5,2) NOT NULL,
    interest_payment_frequency  ENUM('monthly','quarterly','on_maturity') NOT NULL DEFAULT 'on_maturity',
    maturity_date               DATE NOT NULL DEFAULT (CURRENT_DATE),
    interest_payout_account_id  INT NULL,
    source_account_id           INT NULL,
    withholding_tax_rate        DECIMAL(5,2) DEFAULT 10.00,
    tin_required                BOOLEAN DEFAULT TRUE,
    encashment_date             DATE NULL,
    encashment_value            DECIMAL(15,2) NULL,
    encashment_credited_to_id   INT NULL,
    status                      ENUM('active','matured','encashed') DEFAULT 'active',
    note                        TEXT NULL,
    created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_sanchayapatra_user            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_sanchayapatra_payout_account  FOREIGN KEY (interest_payout_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    CONSTRAINT fk_sanchayapatra_source_account  FOREIGN KEY (source_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    CONSTRAINT fk_sanchayapatra_encash_account  FOREIGN KEY (encashment_credited_to_id) REFERENCES accounts(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS sanchayapatra_interest_payments (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    sanchayapatra_id        INT NOT NULL,
    payment_no              INT NOT NULL,
    due_date                DATE NOT NULL,
    paid_date               DATE NULL,
    gross_amount            DECIMAL(15,2) NOT NULL,
    tds_amount              DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    net_amount              DECIMAL(15,2) NOT NULL,
    credited_to_account_id  INT NULL,
    status                  ENUM('upcoming','paid','missed') DEFAULT 'upcoming',
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sip_sanchayapatra FOREIGN KEY (sanchayapatra_id) REFERENCES sanchayapatra(id) ON DELETE CASCADE,
    CONSTRAINT fk_sip_account       FOREIGN KEY (credited_to_account_id) REFERENCES accounts(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS personal_lendings (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    user_id                 INT NOT NULL,
    direction               ENUM('lent','borrowed') NOT NULL,
    counterparty_name       VARCHAR(100) NOT NULL,
    counterparty_phone      VARCHAR(20) NULL,
    counterparty_relation   VARCHAR(50) NULL,
    principal               DECIMAL(15,2) NOT NULL,
    annual_interest_rate    DECIMAL(5,2) DEFAULT 0.00,
    given_date              DATE NOT NULL DEFAULT (CURRENT_DATE),
    expected_return_date    DATE NULL,
    currency                CHAR(3) DEFAULT 'BDT',
    source_account_id       INT NULL,
    purpose                 VARCHAR(255) NULL,
    status                  ENUM('outstanding','partially_repaid','settled','written_off') DEFAULT 'outstanding',
    settlement_date         DATE NULL,
    note                    TEXT NULL,
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_personal_lendings_user    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_personal_lendings_account FOREIGN KEY (source_account_id) REFERENCES accounts(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS lending_repayments (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    personal_lending_id     INT NOT NULL,
    repayment_date          DATE NOT NULL,
    amount                  DECIMAL(15,2) NOT NULL,
    credited_to_account_id  INT NULL,
    note                    TEXT NULL,
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lr_lending FOREIGN KEY (personal_lending_id) REFERENCES personal_lendings(id) ON DELETE CASCADE,
    CONSTRAINT fk_lr_account FOREIGN KEY (credited_to_account_id) REFERENCES accounts(id) ON DELETE SET NULL
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

  `CREATE TABLE IF NOT EXISTS bills (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    name            VARCHAR(100) NOT NULL,
    type            VARCHAR(50) NOT NULL,
    provider        VARCHAR(100),
    amount          DECIMAL(12,2) NOT NULL,
    due_date        DATE NOT NULL,
    frequency       VARCHAR(20) DEFAULT 'monthly',
    account_id      INT,
    status          ENUM('pending','paid','overdue') DEFAULT 'pending',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bills_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_bills_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS subscriptions (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    name            VARCHAR(100) NOT NULL,
    service_name    VARCHAR(100),
    amount          DECIMAL(12,2) NOT NULL,
    billing_cycle   VARCHAR(20) DEFAULT 'monthly',
    start_date      DATE NOT NULL,
    next_billing    DATE NOT NULL,
    account_id      INT,
    status          ENUM('active','cancelled','paused') DEFAULT 'active',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_subscriptions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_subscriptions_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS provident_fund (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    employer_name   VARCHAR(100) NOT NULL,
    employee_id     VARCHAR(50),
    monthly_contribution DECIMAL(12,2) NOT NULL,
    employer_contribution DECIMAL(12,2) NOT NULL,
    start_date      DATE NOT NULL,
    account_id      INT,
    status          ENUM('active','inactive') DEFAULT 'active',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pf_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_pf_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS tax_records (
    id                            INT AUTO_INCREMENT PRIMARY KEY,
    user_id                       INT NOT NULL,
    fiscal_year                   VARCHAR(10) NOT NULL,
    tax_year_start                DATE NOT NULL DEFAULT (CURRENT_DATE),
    tax_year_end                  DATE NOT NULL DEFAULT (CURRENT_DATE),
    gross_income                  DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    salary_income                 DECIMAL(15,2) DEFAULT 0.00,
    business_income               DECIMAL(15,2) DEFAULT 0.00,
    rental_income                 DECIMAL(15,2) DEFAULT 0.00,
    investment_income             DECIMAL(15,2) DEFAULT 0.00,
    other_income                  DECIMAL(15,2) DEFAULT 0.00,
    investment_in_dps             DECIMAL(15,2) DEFAULT 0.00,
    investment_in_sanchayapatra   DECIMAL(15,2) DEFAULT 0.00,
    investment_in_pf              DECIMAL(15,2) DEFAULT 0.00,
    insurance_premium_paid        DECIMAL(15,2) DEFAULT 0.00,
    total_allowable_investment    DECIMAL(15,2) DEFAULT 0.00,
    investment_rebate_pct         DECIMAL(5,2) DEFAULT 15.00,
    investment_rebate_amount      DECIMAL(15,2) DEFAULT 0.00,
    taxable_income                DECIMAL(15,2) DEFAULT 0.00,
    tax_at_slab                   DECIMAL(15,2) DEFAULT 0.00,
    tax_liability_before_rebate   DECIMAL(15,2) DEFAULT 0.00,
    tax_liability_after_rebate    DECIMAL(15,2) DEFAULT 0.00,
    tds_deducted                  DECIMAL(15,2) DEFAULT 0.00,
    advance_tax_paid              DECIMAL(15,2) DEFAULT 0.00,
    net_tax_payable               DECIMAL(15,2) DEFAULT 0.00,
    return_filed_date             DATE NULL,
    assessment_year               VARCHAR(10) NULL,
    acknowledgement_number        VARCHAR(50) NULL,
    note                          TEXT NULL,
    created_at                    DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tax_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_fiscal (user_id, fiscal_year)
  )`,

  `CREATE TABLE IF NOT EXISTS goals (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    user_id           INT NOT NULL,
    name              VARCHAR(100) NOT NULL,
    description       TEXT NULL,
    target_amount     DECIMAL(15,2) NOT NULL,
    current_amount    DECIMAL(15,2) DEFAULT 0.00,
    target_date       DATE NULL,
    linked_account_id INT NULL,
    icon              VARCHAR(50) NULL,
    color             VARCHAR(7) NULL,
    priority          ENUM('high','medium','low') DEFAULT 'medium',
    category          ENUM('emergency','travel','education','property','vehicle','other') NULL,
    status            ENUM('in_progress','achieved','paused','abandoned') DEFAULT 'in_progress',
    achieved_date     DATE NULL,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_goals_user    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_goals_account FOREIGN KEY (linked_account_id) REFERENCES accounts(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS goal_contributions (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    goal_id             INT NOT NULL,
    date                DATE NOT NULL,
    amount              DECIMAL(15,2) NOT NULL,
    source_account_id   INT NULL,
    note                TEXT NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_gc_goal    FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
    CONSTRAINT fk_gc_account FOREIGN KEY (source_account_id) REFERENCES accounts(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS currencies (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    code            VARCHAR(3) NOT NULL UNIQUE,
    name            VARCHAR(50) NOT NULL,
    symbol          VARCHAR(5) NOT NULL,
    is_default      BOOLEAN DEFAULT FALSE
  )`,

  `CREATE TABLE IF NOT EXISTS exchange_rates (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    from_currency   VARCHAR(3) NOT NULL,
    to_currency     VARCHAR(3) NOT NULL,
    rate            DECIMAL(10,6) NOT NULL,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_currency_pair (from_currency, to_currency)
  )`,

  // Add currency column to accounts (MySQL doesn't support ADD COLUMN IF NOT EXISTS)
  // Check if column exists first, then add if needed
  `SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accounts' AND COLUMN_NAME = 'currency')`,
  `SET @sql = IF(@col_exists = 0, 'ALTER TABLE accounts ADD COLUMN currency VARCHAR(3) DEFAULT ''BDT'' AFTER balance', 'SELECT ''Column already exists'' AS message')`,
  `PREPARE stmt FROM @sql`,
  `EXECUTE stmt`,
  `DEALLOCATE PREPARE stmt`,

  // Add currency column to transactions
  `SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND COLUMN_NAME = 'currency')`,
  `SET @sql = IF(@col_exists = 0, 'ALTER TABLE transactions ADD COLUMN currency VARCHAR(3) DEFAULT ''BDT'' AFTER amount', 'SELECT ''Column already exists'' AS message')`,
  `PREPARE stmt FROM @sql`,
  `EXECUTE stmt`,
  `DEALLOCATE PREPARE stmt`,

  // Insert default currencies
  `INSERT IGNORE INTO currencies (code, name, symbol, is_default) VALUES ('BDT', 'Bangladeshi Taka', '৳', TRUE), ('USD', 'US Dollar', '$', FALSE), ('EUR', 'Euro', '€', FALSE), ('GBP', 'British Pound', '£', FALSE)`,

  // Insert default exchange rates (BDT as base)
  `INSERT IGNORE INTO exchange_rates (from_currency, to_currency, rate) VALUES ('BDT', 'USD', 0.0091), ('BDT', 'EUR', 0.0084), ('BDT', 'GBP', 0.0072), ('USD', 'BDT', 110.0), ('EUR', 'BDT', 119.0), ('GBP', 'BDT', 139.0)`,

  `CREATE TABLE IF NOT EXISTS reports (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    name            VARCHAR(100) NOT NULL,
    type            VARCHAR(50) NOT NULL,
    parameters      TEXT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reports_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS audit_logs (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    action          ENUM('create','update','delete','restore') NOT NULL,
    entity_type     VARCHAR(50) NOT NULL,
    entity_id       INT NOT NULL,
    old_values      JSON NULL,
    new_values      JSON NULL,
    ip_address      VARCHAR(45) NULL,
    user_agent      VARCHAR(255) NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_entity (user_id, entity_type, entity_id)
  )`,

  `CREATE TABLE IF NOT EXISTS bill_payments (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    bill_id                 INT NOT NULL,
    billing_month           DATE NOT NULL,
    amount                  DECIMAL(15,2) NOT NULL,
    paid_date               DATE NULL,
    meter_reading_previous  DECIMAL(10,2) NULL,
    meter_reading_current   DECIMAL(10,2) NULL,
    units_consumed          DECIMAL(10,2) NULL,
    source_account_id       INT NULL,
    credit_card_id          INT NULL,
    receipt_attachment_id   INT NULL,
    status                  ENUM('upcoming','paid','overdue') DEFAULT 'upcoming',
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bill_payments_bill FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
    CONSTRAINT fk_bill_payments_account FOREIGN KEY (source_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    CONSTRAINT fk_bill_payments_card FOREIGN KEY (credit_card_id) REFERENCES credit_cards(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS credit_card_statements (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    credit_card_id          INT NOT NULL,
    statement_date          DATE NOT NULL,
    due_date                DATE NOT NULL,
    opening_balance         DECIMAL(15,2) NOT NULL,
    total_purchases         DECIMAL(15,2) DEFAULT 0.00,
    total_credits           DECIMAL(15,2) DEFAULT 0.00,
    total_payments          DECIMAL(15,2) DEFAULT 0.00,
    interest_charged        DECIMAL(15,2) DEFAULT 0.00,
    late_fee                DECIMAL(15,2) DEFAULT 0.00,
    other_charges           DECIMAL(15,2) DEFAULT 0.00,
    closing_balance         DECIMAL(15,2) NOT NULL,
    minimum_due             DECIMAL(15,2) NOT NULL,
    status                  ENUM('pending','paid','overdue') DEFAULT 'pending',
    pdf_attachment_id       INT NULL,
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cc_statement_card FOREIGN KEY (credit_card_id) REFERENCES credit_cards(id) ON DELETE CASCADE,
    INDEX idx_card_date (credit_card_id, statement_date)
  )`,

  `CREATE TABLE IF NOT EXISTS credit_card_payments (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    credit_card_id          INT NOT NULL,
    statement_id            INT NULL,
    paid_from_account_id    INT NULL,
    amount                  DECIMAL(15,2) NOT NULL,
    payment_type            ENUM('full','partial','minimum') NOT NULL,
    payment_date            DATE NOT NULL,
    reference_no            VARCHAR(100) NULL,
    note                    TEXT NULL,
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cc_payment_card FOREIGN KEY (credit_card_id) REFERENCES credit_cards(id) ON DELETE CASCADE,
    CONSTRAINT fk_cc_payment_statement FOREIGN KEY (statement_id) REFERENCES credit_card_statements(id) ON DELETE SET NULL,
    CONSTRAINT fk_cc_payment_account FOREIGN KEY (paid_from_account_id) REFERENCES accounts(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS dps_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dps_id INT NOT NULL,
    installment_number INT NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE NULL,
    amount DECIMAL(15,2) NOT NULL,
    account_id INT NULL,
    status ENUM('upcoming','paid','missed') DEFAULT 'upcoming',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dps_payment_dps FOREIGN KEY (dps_id) REFERENCES dps(id) ON DELETE CASCADE,
    CONSTRAINT fk_dps_payment_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS pf_contributions (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    provident_fund_id       INT NOT NULL,
    period                  DATE NOT NULL,
    employee_amount         DECIMAL(15,2) NOT NULL,
    employer_amount         DECIMAL(15,2) NOT NULL,
    interest_credited       DECIMAL(15,2) DEFAULT 0.00,
    cumulative_corpus       DECIMAL(15,2) NOT NULL,
    note                    TEXT NULL,
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pf_contributions_pf FOREIGN KEY (provident_fund_id) REFERENCES provident_fund(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS loan_payments (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    loan_id             INT NOT NULL,
    installment_no      SMALLINT NOT NULL,
    due_date            DATE NOT NULL,
    paid_date           DATE NULL,
    emi_amount          DECIMAL(15,2) NOT NULL,
    principal_portion   DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    interest_portion    DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    late_fee            DECIMAL(15,2) DEFAULT 0.00,
    total_paid          DECIMAL(15,2) NULL,
    outstanding_after   DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    source_account_id   INT NULL,
    status              ENUM('upcoming','paid','missed','partial') DEFAULT 'upcoming',
    receipt_attachment_id INT NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lp_loan    FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
    CONSTRAINT fk_lp_account FOREIGN KEY (source_account_id) REFERENCES accounts(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS fdr_renewals (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    fdr_id          INT NOT NULL,
    renewal_date    DATE NOT NULL,
    new_principal   DECIMAL(15,2) NOT NULL,
    new_rate        DECIMAL(5,2) NOT NULL,
    new_maturity_date DATE NOT NULL,
    renewal_no      TINYINT NOT NULL,
    note            TEXT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fdr_renewal_fdr FOREIGN KEY (fdr_id) REFERENCES fixed_deposits(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS recurring_rules (
    id                        INT AUTO_INCREMENT PRIMARY KEY,
    user_id                   INT NOT NULL,
    name                      VARCHAR(100) NOT NULL,
    rule_type                 ENUM('income','expense','transfer','dps_installment','loan_emi','cc_payment','bill_payment','subscription','insurance_premium','goal_contribution') NOT NULL DEFAULT 'expense',
    entity_type               VARCHAR(50) NULL,
    entity_id                 INT NULL,
    amount                    DECIMAL(15,2) NOT NULL,
    category_id               INT NULL,
    source_account_id         INT NULL,
    destination_account_id    INT NULL,
    frequency                 ENUM('daily','weekly','bi_weekly','monthly','quarterly','yearly') NOT NULL DEFAULT 'monthly',
    day_of_month              TINYINT NULL,
    day_of_week               TINYINT NULL,
    start_date                DATE NOT NULL DEFAULT (CURRENT_DATE),
    end_date                  DATE NULL,
    next_due_date             DATE NOT NULL DEFAULT (CURRENT_DATE),
    last_executed_date        DATE NULL,
    auto_create_transaction   BOOLEAN DEFAULT TRUE,
    description               VARCHAR(255) NULL,
    is_active                 BOOLEAN DEFAULT TRUE,
    created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS user_settings (
    id                          INT AUTO_INCREMENT PRIMARY KEY,
    user_id                     INT NOT NULL UNIQUE,
    auto_net_worth_enabled      BOOLEAN DEFAULT FALSE,
    auto_net_worth_frequency    VARCHAR(20) DEFAULT 'monthly',
    next_net_worth_snapshot      DATE NULL,
    created_at                  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
    // Add password reset fields
    `ALTER TABLE users ADD COLUMN password_reset_token VARCHAR(255) NULL AFTER notification_preferences`,
    `ALTER TABLE users ADD COLUMN password_reset_token_expiry DATETIME NULL AFTER password_reset_token`,
    // ERD V2 Alignment: Add missing user columns
    `ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL AFTER email`,
    `ALTER TABLE users ADD COLUMN default_currency CHAR(3) DEFAULT 'BDT' AFTER phone`,
    `ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE AFTER default_currency`,
    `ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NULL AFTER is_active`,
    `ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER last_login_at`,
    // ERD V2 Alignment: Rename avatar_url to profile_photo_url
    `ALTER TABLE users CHANGE COLUMN avatar_url profile_photo_url VARCHAR(500) NULL`,
    // ERD V2 Alignment: Add missing accounts columns
    `ALTER TABLE accounts ADD COLUMN institution_name VARCHAR(100) NULL AFTER name`,
    `ALTER TABLE accounts ADD COLUMN account_number VARCHAR(50) NULL AFTER institution_name`,
    `ALTER TABLE accounts ADD COLUMN opening_balance DECIMAL(15,2) DEFAULT 0.00 AFTER account_number`,
    `ALTER TABLE accounts ADD COLUMN currency VARCHAR(3) DEFAULT 'BDT' AFTER opening_balance`,
    `ALTER TABLE accounts ADD COLUMN color VARCHAR(7) NULL AFTER currency`,
    `ALTER TABLE accounts ADD COLUMN icon VARCHAR(50) NULL AFTER color`,
    `ALTER TABLE accounts ADD COLUMN is_default BOOLEAN DEFAULT FALSE AFTER icon`,
    `ALTER TABLE accounts ADD COLUMN is_active BOOLEAN DEFAULT TRUE AFTER is_default`,
    `ALTER TABLE accounts ADD COLUMN note TEXT NULL AFTER is_active`,
    `ALTER TABLE accounts ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER note`,
    `ALTER TABLE accounts ADD COLUMN deleted_at TIMESTAMP NULL AFTER updated_at`,
    // ERD V2 Alignment: Rename balance to current_balance
    `ALTER TABLE accounts CHANGE COLUMN balance current_balance DECIMAL(15,2) DEFAULT 0.00`,
    // ERD V2 Alignment: Add 'mutual_fund' to accounts type enum
    `ALTER TABLE accounts MODIFY COLUMN type ENUM('bank','mobile_banking','mutual_fund','cash') NOT NULL`,
    // Add transaction enhancement columns
    `ALTER TABLE transactions ADD COLUMN is_verified BOOLEAN DEFAULT FALSE AFTER ref_id`,
    `ALTER TABLE transactions ADD COLUMN is_excluded_from_reports BOOLEAN DEFAULT FALSE AFTER is_verified`,
    `ALTER TABLE transactions ADD COLUMN parent_transaction_id INT NULL AFTER is_excluded_from_reports`,
    `ALTER TABLE transactions ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER parent_transaction_id`,
    `ALTER TABLE transactions ADD COLUMN deleted_at TIMESTAMP NULL AFTER updated_at`,
    // ERD V2 Alignment: Add missing transaction columns
    `ALTER TABLE transactions ADD COLUMN currency VARCHAR(3) DEFAULT 'BDT' AFTER amount`,
    `ALTER TABLE transactions ADD COLUMN transaction_date DATE NOT NULL AFTER currency`,
    `ALTER TABLE transactions ADD COLUMN subcategory_id INT NULL AFTER transaction_date`,
    `ALTER TABLE transactions ADD COLUMN source_type VARCHAR(50) NULL AFTER subcategory_id`,
    `ALTER TABLE transactions ADD COLUMN source_id INT NULL AFTER source_type`,
    `ALTER TABLE transactions ADD COLUMN payee VARCHAR(100) NULL AFTER source_id`,
    `ALTER TABLE transactions ADD COLUMN notes VARCHAR(255) NULL AFTER payee`,
    `ALTER TABLE transactions ADD COLUMN reference_no VARCHAR(100) NULL AFTER notes`,
    `ALTER TABLE transactions ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE AFTER reference_no`,
    `ALTER TABLE transactions ADD COLUMN recurring_rule_id INT NULL AFTER is_recurring`,
    `ALTER TABLE transactions ADD COLUMN is_split BOOLEAN DEFAULT FALSE AFTER recurring_rule_id`,
    // ERD V2 Alignment: Update transaction amount precision
    `ALTER TABLE transactions MODIFY COLUMN amount DECIMAL(15,2) NOT NULL`,
    // ERD V2 Alignment: Update transaction type enum to 5 types
    `ALTER TABLE transactions MODIFY COLUMN type ENUM('income','expense','transfer_debit','transfer_credit','adjustment') NOT NULL`,
    // ERD V2 Alignment: Update source_type to proper enum
    `ALTER TABLE transactions MODIFY COLUMN source_type ENUM('account','credit_card','cash') NOT NULL DEFAULT 'account'`,
    // ERD V2 Alignment: Make account_id nullable for polymorphic source tracking
    `ALTER TABLE transactions MODIFY COLUMN account_id INT NULL`,
    // ERD V2 Alignment: Migrate existing transaction types from credit/debit to new 5-type enum
    // credit → income (default) or transfer_credit (if it has a transfer reference)
    // debit → expense (default) or transfer_debit (if it has a transfer reference)
    `UPDATE transactions SET type = 'transfer_credit' WHERE type = 'credit' AND (ref_type = 'transfer' OR ref_id IS NOT NULL)`,
    `UPDATE transactions SET type = 'income' WHERE type = 'credit'`,
    `UPDATE transactions SET type = 'transfer_debit' WHERE type = 'debit' AND (ref_type = 'transfer' OR ref_id IS NOT NULL)`,
    `UPDATE transactions SET type = 'expense' WHERE type = 'debit'`,
    // ERD V2 Alignment: Rename category to category_id
    `ALTER TABLE transactions CHANGE COLUMN category category_id VARCHAR(80) NULL`,
    // ERD V2 Alignment: Make category_id nullable to match ERD
    `ALTER TABLE transactions MODIFY COLUMN category_id VARCHAR(80) NULL`,
    // ERD V2 Alignment: Drop old description column (now using notes)
    `ALTER TABLE transactions DROP COLUMN IF EXISTS description`,
    // Add fk_tx_parent constraint if it doesn't exist
    `SET @fk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND CONSTRAINT_NAME = 'fk_tx_parent')`,
    `SET @fk_sql = IF(@fk_exists = 0, 'ALTER TABLE transactions ADD CONSTRAINT fk_tx_parent FOREIGN KEY (parent_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL', 'SELECT ''Constraint already exists'' AS message')`,
    `PREPARE fk_stmt FROM @fk_sql`,
    `EXECUTE fk_stmt`,
    `DEALLOCATE PREPARE fk_stmt`,
    // Add recurring_transactions enhancement columns
    `ALTER TABLE recurring_transactions MODIFY COLUMN frequency ENUM('daily','weekly','bi_weekly','monthly','quarterly','yearly')`,
    `ALTER TABLE recurring_transactions ADD COLUMN day_of_month TINYINT NULL AFTER frequency`,
    `ALTER TABLE recurring_transactions ADD COLUMN day_of_week TINYINT NULL AFTER day_of_month`,
    `ALTER TABLE recurring_transactions ADD COLUMN last_executed_date DATE NULL AFTER next_due`,
    `ALTER TABLE recurring_transactions ADD COLUMN entity_type VARCHAR(50) NULL AFTER last_executed_date`,
    `ALTER TABLE recurring_transactions ADD COLUMN entity_id INT NULL AFTER entity_type`,
    `ALTER TABLE recurring_transactions ADD COLUMN auto_create_transaction BOOLEAN DEFAULT TRUE AFTER entity_id`,
    `ALTER TABLE recurring_transactions ADD COLUMN is_active BOOLEAN DEFAULT TRUE AFTER auto_create_transaction`,
    // Add credit_cards enhancement columns
    `ALTER TABLE credit_cards ADD COLUMN card_number_last4 VARCHAR(4) NULL AFTER name`,
    `ALTER TABLE credit_cards ADD COLUMN card_type ENUM('visa','mastercard','amex','discover','other') NULL AFTER card_number_last4`,
    `ALTER TABLE credit_cards ADD COLUMN billing_cycle_day TINYINT NULL AFTER card_type`,
    `ALTER TABLE credit_cards ADD COLUMN payment_due_day TINYINT NULL AFTER billing_cycle_day`,
    `ALTER TABLE credit_cards ADD COLUMN annual_interest_rate DECIMAL(5,2) NULL AFTER payment_due_day`,
    `ALTER TABLE credit_cards ADD COLUMN monthly_interest_rate DECIMAL(5,2) NULL AFTER annual_interest_rate`,
    `ALTER TABLE credit_cards ADD COLUMN minimum_payment_pct DECIMAL(5,2) NULL AFTER monthly_interest_rate`,
    `ALTER TABLE credit_cards ADD COLUMN minimum_payment_fixed DECIMAL(12,2) NULL AFTER minimum_payment_pct`,
    `ALTER TABLE credit_cards ADD COLUMN cash_advance_limit DECIMAL(12,2) NULL AFTER minimum_payment_fixed`,
    `ALTER TABLE credit_cards ADD COLUMN cash_advance_rate DECIMAL(5,2) NULL AFTER cash_advance_limit`,
    `ALTER TABLE credit_cards ADD COLUMN reward_points INT DEFAULT 0 AFTER cash_advance_rate`,
    `ALTER TABLE credit_cards ADD COLUMN is_active BOOLEAN DEFAULT TRUE AFTER reward_points`,
    `ALTER TABLE credit_cards ADD COLUMN linked_bank_account_id INT NULL AFTER is_active`,
    `ALTER TABLE credit_cards ADD COLUMN color VARCHAR(7) NULL AFTER linked_bank_account_id`,
    // ERD V2 Alignment: DPS - Rename monthly_amount to installment_amount
    `ALTER TABLE dps CHANGE COLUMN monthly_amount installment_amount DECIMAL(15,2) NOT NULL`,
    // ERD V2 Alignment: DPS - Add missing columns
    `ALTER TABLE dps ADD COLUMN institution_name VARCHAR(100) NOT NULL AFTER user_id`,
    `ALTER TABLE dps ADD COLUMN dps_account_number VARCHAR(50) NOT NULL AFTER institution_name`,
    `ALTER TABLE dps ADD COLUMN linked_account_id INT NULL AFTER dps_account_number`,
    `ALTER TABLE dps ADD COLUMN annual_interest_rate DECIMAL(5,2) NOT NULL AFTER installment_amount`,
    `ALTER TABLE dps ADD COLUMN tenure_months SMALLINT NOT NULL AFTER annual_interest_rate`,
    `ALTER TABLE dps ADD COLUMN total_installments SMALLINT AFTER tenure_months`,
    `ALTER TABLE dps ADD COLUMN paid_installments SMALLINT DEFAULT 0 AFTER total_installments`,
    `ALTER TABLE dps ADD COLUMN missed_installments SMALLINT DEFAULT 0 AFTER paid_installments`,
    `ALTER TABLE dps ADD COLUMN projected_maturity_value DECIMAL(15,2) AFTER total_deposited`,
    `ALTER TABLE dps ADD COLUMN actual_maturity_value DECIMAL(15,2) NULL AFTER projected_maturity_value`,
    `ALTER TABLE dps ADD COLUMN withholding_tax_rate DECIMAL(5,2) DEFAULT 10.00 AFTER actual_maturity_value`,
    `ALTER TABLE dps ADD COLUMN status ENUM('active','matured','closed','broken') DEFAULT 'active' AFTER withholding_tax_rate`,
    `ALTER TABLE dps ADD COLUMN break_date DATE NULL AFTER status`,
    `ALTER TABLE dps ADD COLUMN break_value DECIMAL(15,2) NULL AFTER break_date`,
    `ALTER TABLE dps ADD COLUMN maturity_credited_to_id INT NULL AFTER break_value`,
    `ALTER TABLE dps ADD COLUMN note TEXT NULL AFTER maturity_credited_to_id`,
    `ALTER TABLE dps ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER note`,
    `ALTER TABLE dps ADD COLUMN deleted_at TIMESTAMP NULL AFTER updated_at`,
    // ERD V2 Alignment: DPS - Add foreign key constraints
    `SET @fk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dps' AND CONSTRAINT_NAME = 'fk_dps_account')`,
    `SET @fk_sql = IF(@fk_exists = 0, 'ALTER TABLE dps ADD CONSTRAINT fk_dps_account FOREIGN KEY (linked_account_id) REFERENCES accounts(id) ON DELETE SET NULL', 'SELECT ''Constraint already exists'' AS message')`,
    `PREPARE fk_stmt FROM @fk_sql`,
    `EXECUTE fk_stmt`,
    `DEALLOCATE PREPARE fk_stmt`,
    `SET @fk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dps' AND CONSTRAINT_NAME = 'fk_dps_maturity_account')`,
    `SET @fk_sql = IF(@fk_exists = 0, 'ALTER TABLE dps ADD CONSTRAINT fk_dps_maturity_account FOREIGN KEY (maturity_credited_to_id) REFERENCES accounts(id) ON DELETE SET NULL', 'SELECT ''Constraint already exists'' AS message')`,
    `PREPARE fk_stmt FROM @fk_sql`,
    `EXECUTE fk_stmt`,
    `DEALLOCATE PREPARE fk_stmt`,
    // ERD V2 Alignment: DPS - Data migration
    `UPDATE dps SET tenure_months = TIMESTAMPDIFF(MONTH, start_date, maturity_date) WHERE start_date IS NOT NULL AND maturity_date IS NOT NULL AND (tenure_months IS NULL OR tenure_months = 0)`,
    `UPDATE dps SET institution_name = 'Unknown' WHERE institution_name IS NULL OR institution_name = ''`,
    `UPDATE dps SET dps_account_number = CONCAT('DPS-', id) WHERE dps_account_number IS NULL OR dps_account_number = ''`,
    `UPDATE dps SET annual_interest_rate = 12.00 WHERE annual_interest_rate IS NULL OR annual_interest_rate = 0`,
    `UPDATE dps SET tenure_months = 60 WHERE tenure_months IS NULL OR tenure_months = 0`,
    `UPDATE dps SET total_installments = tenure_months WHERE total_installments IS NULL`,
    `UPDATE dps SET status = 'active' WHERE status IS NULL`,
    // ERD V2 Alignment: DPS payments - Update existing table
    `ALTER TABLE dps_payments CHANGE COLUMN installment_no installment_number INT NOT NULL`,
    `ALTER TABLE dps_payments CHANGE COLUMN source_account_id account_id INT NULL`,
    `ALTER TABLE dps_payments MODIFY COLUMN status ENUM('upcoming','paid','missed') DEFAULT 'upcoming'`,
    `ALTER TABLE dps_payments DROP COLUMN IF EXISTS penalty`,
    `ALTER TABLE dps_payments DROP COLUMN IF EXISTS receipt_attachment_id`,
    `ALTER TABLE dps_payments ADD CONSTRAINT fk_dps_payment_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL`,
    // ERD V2 Alignment: FDR - Rename columns
    `ALTER TABLE fixed_deposits CHANGE COLUMN principal principal_amount DECIMAL(15,2) NOT NULL`,
    `ALTER TABLE fixed_deposits CHANGE COLUMN interest_rate annual_interest_rate DECIMAL(5,2) NOT NULL`,
    `ALTER TABLE fixed_deposits CHANGE COLUMN maturity_amount actual_maturity_value DECIMAL(15,2) NULL`,
    // ERD V2 Alignment: FDR - Add missing columns
    `ALTER TABLE fixed_deposits ADD COLUMN institution_name VARCHAR(100) NOT NULL AFTER user_id`,
    `ALTER TABLE fixed_deposits ADD COLUMN fdr_account_number VARCHAR(50) NULL AFTER institution_name`,
    `ALTER TABLE fixed_deposits ADD COLUMN source_account_id INT NULL AFTER fdr_account_number`,
    `ALTER TABLE fixed_deposits ADD COLUMN compounding_frequency ENUM('monthly','quarterly','half_yearly','yearly','on_maturity') NOT NULL DEFAULT 'yearly' AFTER annual_interest_rate`,
    `ALTER TABLE fixed_deposits ADD COLUMN tenure_days INT NULL AFTER compounding_frequency`,
    `ALTER TABLE fixed_deposits ADD COLUMN tenure_months SMALLINT NULL AFTER tenure_days`,
    `ALTER TABLE fixed_deposits ADD COLUMN projected_maturity_value DECIMAL(15,2) AFTER maturity_date`,
    `ALTER TABLE fixed_deposits ADD COLUMN interest_payout_frequency ENUM('monthly','quarterly','on_maturity') DEFAULT 'on_maturity' AFTER actual_maturity_value`,
    `ALTER TABLE fixed_deposits ADD COLUMN interest_payout_account_id INT NULL AFTER interest_payout_frequency`,
    `ALTER TABLE fixed_deposits ADD COLUMN withholding_tax_rate DECIMAL(5,2) DEFAULT 10.00 AFTER interest_payout_account_id`,
    `ALTER TABLE fixed_deposits ADD COLUMN auto_renewal BOOLEAN DEFAULT FALSE AFTER withholding_tax_rate`,
    `ALTER TABLE fixed_deposits ADD COLUMN renewal_count TINYINT DEFAULT 0 AFTER auto_renewal`,
    `ALTER TABLE fixed_deposits ADD COLUMN maturity_credited_to_id INT NULL AFTER renewal_count`,
    `ALTER TABLE fixed_deposits ADD COLUMN status ENUM('active','matured','broken','renewed') DEFAULT 'active' AFTER maturity_credited_to_id`,
    `ALTER TABLE fixed_deposits ADD COLUMN note TEXT NULL AFTER status`,
    `ALTER TABLE fixed_deposits ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER note`,
    `ALTER TABLE fixed_deposits ADD COLUMN deleted_at TIMESTAMP NULL AFTER updated_at`,
    // ERD V2 Alignment: FDR - Add foreign key constraints
    `SET @fk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fixed_deposits' AND CONSTRAINT_NAME = 'fk_fd_source_account')`,
    `SET @fk_sql = IF(@fk_exists = 0, 'ALTER TABLE fixed_deposits ADD CONSTRAINT fk_fd_source_account FOREIGN KEY (source_account_id) REFERENCES accounts(id) ON DELETE SET NULL', 'SELECT ''Constraint already exists'' AS message')`,
    `PREPARE fk_stmt FROM @fk_sql`,
    `EXECUTE fk_stmt`,
    `DEALLOCATE PREPARE fk_stmt`,
    `SET @fk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fixed_deposits' AND CONSTRAINT_NAME = 'fk_fd_payout_account')`,
    `SET @fk_sql = IF(@fk_exists = 0, 'ALTER TABLE fixed_deposits ADD CONSTRAINT fk_fd_payout_account FOREIGN KEY (interest_payout_account_id) REFERENCES accounts(id) ON DELETE SET NULL', 'SELECT ''Constraint already exists'' AS message')`,
    `PREPARE fk_stmt FROM @fk_sql`,
    `EXECUTE fk_stmt`,
    `DEALLOCATE PREPARE fk_stmt`,
    `SET @fk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fixed_deposits' AND CONSTRAINT_NAME = 'fk_fd_maturity_account')`,
    `SET @fk_sql = IF(@fk_exists = 0, 'ALTER TABLE fixed_deposits ADD CONSTRAINT fk_fd_maturity_account FOREIGN KEY (maturity_credited_to_id) REFERENCES accounts(id) ON DELETE SET NULL', 'SELECT ''Constraint already exists'' AS message')`,
    `PREPARE fk_stmt FROM @fk_sql`,
    `EXECUTE fk_stmt`,
    `DEALLOCATE PREPARE fk_stmt`,
    // ERD V2 Alignment: FDR - Data migration
    `UPDATE fixed_deposits SET institution_name = 'Unknown' WHERE institution_name IS NULL OR institution_name = ''`,
    `UPDATE fixed_deposits SET compounding_frequency = 'yearly' WHERE compounding_frequency IS NULL OR compounding_frequency = ''`,
    `UPDATE fixed_deposits SET interest_payout_frequency = 'on_maturity' WHERE interest_payout_frequency IS NULL OR interest_payout_frequency = ''`,
    `UPDATE fixed_deposits SET status = 'active' WHERE status IS NULL`,
    // ERD V2 Alignment: Sanchayapatra - Rename columns
    `ALTER TABLE sanchayapatra CHANGE COLUMN interest_rate annual_interest_rate DECIMAL(5,2) NOT NULL`,
    `ALTER TABLE sanchayapatra CHANGE COLUMN maturity_value actual_maturity_value DECIMAL(15,2) NULL`,
    // ERD V2 Alignment: Sanchayapatra - Add missing columns
    `ALTER TABLE sanchayapatra ADD COLUMN institution_name VARCHAR(100) NOT NULL AFTER user_id`,
    `ALTER TABLE sanchayapatra ADD COLUMN certificate_number VARCHAR(50) NOT NULL AFTER institution_name`,
    `ALTER TABLE sanchayapatra ADD COLUMN projected_maturity_value DECIMAL(15,2) AFTER maturity_date`,
    `ALTER TABLE sanchayapatra ADD COLUMN withholding_tax_rate DECIMAL(5,2) DEFAULT 10.00 AFTER actual_maturity_value`,
    `ALTER TABLE sanchayapatra ADD COLUMN encashment_date DATE NULL AFTER status`,
    `ALTER TABLE sanchayapatra ADD COLUMN encashment_value DECIMAL(15,2) NULL AFTER encashment_date`,
    `ALTER TABLE sanchayapatra ADD COLUMN encashment_credited_to_id INT NULL AFTER encashment_value`,
    `ALTER TABLE sanchayapatra ADD COLUMN note TEXT NULL AFTER encashment_credited_to_id`,
    `ALTER TABLE sanchayapatra ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER note`,
    `ALTER TABLE sanchayapatra ADD COLUMN deleted_at TIMESTAMP NULL AFTER updated_at`,
    // ERD V2 Alignment: Sanchayapatra - Update status enum
    `ALTER TABLE sanchayapatra MODIFY COLUMN status ENUM('active','matured','encashed','transferred') DEFAULT 'active'`,
    // ERD V2 Alignment: Sanchayapatra - Add foreign key constraint
    `SET @fk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sanchayapatra' AND CONSTRAINT_NAME = 'fk_sanchayapatra_encashment_account')`,
    `SET @fk_sql = IF(@fk_exists = 0, 'ALTER TABLE sanchayapatra ADD CONSTRAINT fk_sanchayapatra_encashment_account FOREIGN KEY (encashment_credited_to_id) REFERENCES accounts(id) ON DELETE SET NULL', 'SELECT ''Constraint already exists'' AS message')`,
    `PREPARE fk_stmt FROM @fk_sql`,
    `EXECUTE fk_stmt`,
    `DEALLOCATE PREPARE fk_stmt`,
    // ERD V2 Alignment: Sanchayapatra - Data migration
    `UPDATE sanchayapatra SET institution_name = 'Unknown' WHERE institution_name IS NULL OR institution_name = ''`,
    `UPDATE sanchayapatra SET certificate_number = CONCAT('CERT-', id) WHERE certificate_number IS NULL OR certificate_number = ''`,
    `UPDATE sanchayapatra SET withholding_tax_rate = 10.00 WHERE withholding_tax_rate IS NULL OR withholding_tax_rate = 0`,
    `UPDATE sanchayapatra SET status = 'active' WHERE status IS NULL`,
    // Add loan enhancement columns
    `ALTER TABLE loans ADD COLUMN loan_type ENUM('personal','home','auto','education','business','other') NULL AFTER name`,
    `ALTER TABLE loans ADD COLUMN purpose VARCHAR(255) NULL AFTER loan_type`,
    `ALTER TABLE loans ADD COLUMN interest_type ENUM('reducing_balance','flat') DEFAULT 'reducing_balance' AFTER interest_rate`,
    `ALTER TABLE loans ADD COLUMN tenure_months INT NULL AFTER interest_type`,
    `ALTER TABLE loans ADD COLUMN disbursement_date DATE NULL AFTER tenure_months`,
    `ALTER TABLE loans ADD COLUMN first_emi_date DATE NULL AFTER disbursement_date`,
    `ALTER TABLE loans ADD COLUMN emi_day_of_month TINYINT NULL AFTER first_emi_date`,
    `ALTER TABLE loans ADD COLUMN repayment_account_id INT NULL AFTER emi_day_of_month`,
    `ALTER TABLE loans ADD COLUMN total_paid DECIMAL(15,2) DEFAULT 0.00 AFTER repayment_account_id`,
    `ALTER TABLE loans ADD COLUMN total_interest_paid DECIMAL(15,2) DEFAULT 0.00 AFTER total_paid`,
    `ALTER TABLE loans ADD COLUMN total_principal_paid DECIMAL(15,2) DEFAULT 0.00 AFTER total_interest_paid`,
    `ALTER TABLE loans ADD COLUMN remaining_tenure INT NULL AFTER total_principal_paid`,
    `ALTER TABLE loans ADD COLUMN loan_account_number VARCHAR(50) NULL AFTER remaining_tenure`,
    `ALTER TABLE loans ADD COLUMN guarantor_name VARCHAR(100) NULL AFTER loan_account_number`,
    `ALTER TABLE loans ADD COLUMN collateral_description TEXT NULL AFTER guarantor_name`,
    `ALTER TABLE loans ADD COLUMN late_fee_rate DECIMAL(5,2) NULL AFTER collateral_description`,
    `ALTER TABLE loans ADD COLUMN prepayment_penalty_pct DECIMAL(5,2) NULL AFTER late_fee_rate`,
    `ALTER TABLE loans ADD COLUMN status ENUM('active','paid_off','foreclosed','restructured') DEFAULT 'active' AFTER prepayment_penalty_pct`,
    `ALTER TABLE loans ADD COLUMN closed_date DATE NULL AFTER status`,
    `ALTER TABLE loans ADD COLUMN document_attachment_id INT NULL AFTER closed_date`,
    // Add personal_lendings enhancement columns
    `ALTER TABLE personal_lendings ADD COLUMN counterparty_phone VARCHAR(20) NULL AFTER counterparty_name`,
    `ALTER TABLE personal_lendings ADD COLUMN counterparty_relation VARCHAR(50) NULL AFTER counterparty_contact`,
    `ALTER TABLE personal_lendings ADD COLUMN currency VARCHAR(3) DEFAULT 'BDT' AFTER counterparty_relation`,
    `ALTER TABLE personal_lendings ADD COLUMN source_account_id INT NULL AFTER currency`,
    `ALTER TABLE personal_lendings ADD COLUMN purpose VARCHAR(255) NULL AFTER source_account_id`,
    `ALTER TABLE personal_lendings ADD COLUMN settlement_date DATE NULL AFTER status`,
    // Add insurance_premiums enhancement columns
    `ALTER TABLE insurance_premiums ADD COLUMN policy_number VARCHAR(100) NULL AFTER type`,
    `ALTER TABLE insurance_premiums ADD COLUMN plan_name VARCHAR(100) NULL AFTER policy_number`,
    `ALTER TABLE insurance_premiums ADD COLUMN sum_assured DECIMAL(15,2) NULL AFTER plan_name`,
    `ALTER TABLE insurance_premiums ADD COLUMN premium_due_day TINYINT NULL AFTER premium_amount`,
    `ALTER TABLE insurance_premiums ADD COLUMN policy_start_date DATE NULL AFTER premium_due_day`,
    `ALTER TABLE insurance_premiums ADD COLUMN policy_end_date DATE NULL AFTER policy_start_date`,
    `ALTER TABLE insurance_premiums ADD COLUMN maturity_value DECIMAL(15,2) NULL AFTER policy_end_date`,
    `ALTER TABLE insurance_premiums ADD COLUMN surrender_value DECIMAL(15,2) NULL AFTER maturity_value`,
    `ALTER TABLE insurance_premiums ADD COLUMN nominee_name VARCHAR(100) NULL AFTER surrender_value`,
    `ALTER TABLE insurance_premiums ADD COLUMN nominee_relation VARCHAR(50) NULL AFTER nominee_name`,
    `ALTER TABLE insurance_premiums ADD COLUMN agent_name VARCHAR(100) NULL AFTER nominee_relation`,
    `ALTER TABLE insurance_premiums ADD COLUMN total_premium_paid DECIMAL(15,2) DEFAULT 0.00 AFTER agent_name`,
    `ALTER TABLE insurance_premiums ADD COLUMN policy_document_id INT NULL AFTER total_premium_paid`,
    `ALTER TABLE insurance_premiums ADD COLUMN status ENUM('active','lapsed','surrendered','matured','claimed') DEFAULT 'active' AFTER policy_document_id`,
    // Add bills enhancement columns
    `ALTER TABLE bills ADD COLUMN account_number VARCHAR(50) NULL AFTER provider`,
    `ALTER TABLE bills ADD COLUMN billing_address VARCHAR(255) NULL AFTER account_number`,
    `ALTER TABLE bills ADD COLUMN due_day TINYINT NULL AFTER billing_address`,
    `ALTER TABLE bills ADD COLUMN estimated_amount DECIMAL(12,2) NULL AFTER due_day`,
    `ALTER TABLE bills ADD COLUMN linked_account_id INT NULL AFTER estimated_amount`,
    `ALTER TABLE bills ADD COLUMN category_id INT NULL AFTER linked_account_id`,
    `ALTER TABLE bills ADD COLUMN is_active BOOLEAN DEFAULT TRUE AFTER category_id`,
    `ALTER TABLE bills ADD COLUMN meter_number VARCHAR(50) NULL AFTER is_active`,
    `ALTER TABLE bills ADD COLUMN tariff_rate DECIMAL(10,4) NULL AFTER meter_number`,
    `ALTER TABLE bills ADD COLUMN previous_reading DECIMAL(10,2) NULL AFTER tariff_rate`,
    `ALTER TABLE bills ADD COLUMN current_reading DECIMAL(10,2) NULL AFTER previous_reading`,
    `ALTER TABLE bills ADD COLUMN landlord_name VARCHAR(100) NULL AFTER current_reading`,
    `ALTER TABLE bills ADD COLUMN landlord_phone VARCHAR(20) NULL AFTER landlord_name`,
    `ALTER TABLE bills ADD COLUMN advance_deposit DECIMAL(15,2) NULL AFTER landlord_phone`,
    `ALTER TABLE bills ADD COLUMN lease_start_date DATE NULL AFTER advance_deposit`,
    `ALTER TABLE bills ADD COLUMN lease_end_date DATE NULL AFTER lease_start_date`,
    // Add subscriptions enhancement columns
    `ALTER TABLE subscriptions ADD COLUMN category ENUM('streaming','software','cloud','news','fitness','other') NULL AFTER service_name`,
    `ALTER TABLE subscriptions ADD COLUMN currency VARCHAR(3) DEFAULT 'BDT' AFTER category`,
    `ALTER TABLE subscriptions ADD COLUMN next_billing_date DATE NULL AFTER currency`,
    `ALTER TABLE subscriptions ADD COLUMN trial_end_date DATE NULL AFTER next_billing_date`,
    `ALTER TABLE subscriptions ADD COLUMN auto_renews BOOLEAN DEFAULT TRUE AFTER trial_end_date`,
    `ALTER TABLE subscriptions ADD COLUMN payment_method_type ENUM('account','credit_card') NULL AFTER auto_renews`,
    `ALTER TABLE subscriptions ADD COLUMN payment_method_id INT NULL AFTER payment_method_type`,
    `ALTER TABLE subscriptions ADD COLUMN category_id INT NULL AFTER payment_method_id`,
    `ALTER TABLE subscriptions ADD COLUMN last_used_date DATE NULL AFTER category_id`,
    `ALTER TABLE subscriptions ADD COLUMN cancellation_date DATE NULL AFTER last_used_date`,
    `ALTER TABLE subscriptions ADD COLUMN website_url VARCHAR(255) NULL AFTER cancellation_date`,
    // Add provident_fund enhancement columns
    `ALTER TABLE provident_fund ADD COLUMN pf_account_number VARCHAR(50) NULL AFTER employee_id`,
    `ALTER TABLE provident_fund ADD COLUMN employee_contribution_pct DECIMAL(5,2) NULL AFTER pf_account_number`,
    `ALTER TABLE provident_fund ADD COLUMN employer_contribution_pct DECIMAL(5,2) NULL AFTER employee_contribution_pct`,
    `ALTER TABLE provident_fund ADD COLUMN annual_interest_rate DECIMAL(5,2) NULL AFTER employer_contribution_pct`,
    `ALTER TABLE provident_fund ADD COLUMN vesting_years INT NULL AFTER annual_interest_rate`,
    `ALTER TABLE provident_fund ADD COLUMN current_corpus DECIMAL(15,2) DEFAULT 0.00 AFTER vesting_years`,
    `ALTER TABLE provident_fund ADD COLUMN employee_corpus DECIMAL(15,2) DEFAULT 0.00 AFTER current_corpus`,
    `ALTER TABLE provident_fund ADD COLUMN employer_corpus DECIMAL(15,2) DEFAULT 0.00 AFTER employee_corpus`,
    `ALTER TABLE provident_fund ADD COLUMN linked_income_id INT NULL AFTER employer_corpus`,
    `ALTER TABLE provident_fund ADD COLUMN note TEXT NULL AFTER linked_income_id`,
    // Add tax_records enhancement columns
    `ALTER TABLE tax_records ADD COLUMN fiscal_year VARCHAR(10) NULL AFTER tax_year`,
    `ALTER TABLE tax_records ADD COLUMN tax_year_start DATE NULL AFTER fiscal_year`,
    `ALTER TABLE tax_records ADD COLUMN tax_year_end DATE NULL AFTER tax_year_start`,
    `ALTER TABLE tax_records ADD COLUMN salary_income DECIMAL(15,2) DEFAULT 0.00 AFTER gross_income`,
    `ALTER TABLE tax_records ADD COLUMN business_income DECIMAL(15,2) DEFAULT 0.00 AFTER salary_income`,
    `ALTER TABLE tax_records ADD COLUMN rental_income DECIMAL(15,2) DEFAULT 0.00 AFTER business_income`,
    `ALTER TABLE tax_records ADD COLUMN investment_income DECIMAL(15,2) DEFAULT 0.00 AFTER rental_income`,
    `ALTER TABLE tax_records ADD COLUMN other_income DECIMAL(15,2) DEFAULT 0.00 AFTER investment_income`,
    `ALTER TABLE tax_records ADD COLUMN investment_in_dps DECIMAL(15,2) DEFAULT 0.00 AFTER other_income`,
    `ALTER TABLE tax_records ADD COLUMN investment_in_sanchayapatra DECIMAL(15,2) DEFAULT 0.00 AFTER investment_in_dps`,
    `ALTER TABLE tax_records ADD COLUMN investment_in_pf DECIMAL(15,2) DEFAULT 0.00 AFTER investment_in_sanchayapatra`,
    `ALTER TABLE tax_records ADD COLUMN insurance_premium_paid DECIMAL(15,2) DEFAULT 0.00 AFTER investment_in_pf`,
    `ALTER TABLE tax_records ADD COLUMN total_allowable_investment DECIMAL(15,2) NOT NULL AFTER insurance_premium_paid`,
    `ALTER TABLE tax_records ADD COLUMN investment_rebate_pct DECIMAL(5,2) DEFAULT 15.00 AFTER total_allowable_investment`,
    `ALTER TABLE tax_records ADD COLUMN investment_rebate_amount DECIMAL(15,2) DEFAULT 0.00 AFTER investment_rebate_pct`,
    `ALTER TABLE tax_records ADD COLUMN taxable_income DECIMAL(15,2) DEFAULT 0.00 AFTER investment_rebate_amount`,
    `ALTER TABLE tax_records ADD COLUMN tax_at_slab DECIMAL(15,2) DEFAULT 0.00 AFTER taxable_income`,
    `ALTER TABLE tax_records ADD COLUMN tax_liability_before_rebate DECIMAL(15,2) DEFAULT 0.00 AFTER tax_at_slab`,
    `ALTER TABLE tax_records ADD COLUMN tax_liability_after_rebate DECIMAL(15,2) DEFAULT 0.00 AFTER tax_liability_before_rebate`,
    `ALTER TABLE tax_records ADD COLUMN advance_tax_paid DECIMAL(15,2) DEFAULT 0.00 AFTER tax_deducted`,
    `ALTER TABLE tax_records ADD COLUMN net_tax_payable DECIMAL(15,2) DEFAULT 0.00 AFTER advance_tax_paid`,
    `ALTER TABLE tax_records ADD COLUMN assessment_year VARCHAR(10) NULL AFTER filing_date`,
    `ALTER TABLE tax_records ADD COLUMN acknowledgement_number VARCHAR(50) NULL AFTER assessment_year`,
    // Add budgets enhancement columns
    `ALTER TABLE budgets ADD COLUMN name VARCHAR(100) NULL AFTER user_id`,
    `ALTER TABLE budgets ADD COLUMN category_id VARCHAR(80) NULL AFTER name`,
    `ALTER TABLE budgets ADD COLUMN start_date DATE NULL AFTER period`,
    `ALTER TABLE budgets ADD COLUMN end_date DATE NULL AFTER start_date`,
    `ALTER TABLE budgets ADD COLUMN spent_amount DECIMAL(15,2) DEFAULT 0.00 AFTER end_date`,
    `ALTER TABLE budgets ADD COLUMN remaining_amount DECIMAL(15,2) DEFAULT 0.00 AFTER spent_amount`,
    `ALTER TABLE budgets ADD COLUMN utilization_pct DECIMAL(5,2) DEFAULT 0.00 AFTER remaining_amount`,
    `ALTER TABLE budgets ADD COLUMN alert_threshold_pct TINYINT DEFAULT 80 AFTER utilization_pct`,
    `ALTER TABLE budgets ADD COLUMN rollover_unspent BOOLEAN DEFAULT FALSE AFTER alert_threshold_pct`,
    `ALTER TABLE budgets ADD COLUMN is_active BOOLEAN DEFAULT TRUE AFTER rollover_unspent`,
    // ERD V2 Alignment: Fix budgets.category_id type to VARCHAR(80) (matches transactions.category_id)
    `ALTER TABLE budgets DROP FOREIGN KEY fk_budgets_category`,
    `ALTER TABLE budgets MODIFY COLUMN category_id VARCHAR(80) NULL`,
    // Add goals enhancement columns
    `ALTER TABLE goals ADD COLUMN description TEXT NULL AFTER name`,
    `ALTER TABLE goals ADD COLUMN monthly_required DECIMAL(15,2) DEFAULT 0.00 AFTER target_date`,
    `ALTER TABLE goals ADD COLUMN linked_account_id INT NULL AFTER monthly_required`,
    `ALTER TABLE goals ADD COLUMN icon VARCHAR(50) NULL AFTER linked_account_id`,
    `ALTER TABLE goals ADD COLUMN color VARCHAR(7) NULL AFTER icon`,
    `ALTER TABLE goals ADD COLUMN priority ENUM('high','medium','low') DEFAULT 'medium' AFTER color`,
    `ALTER TABLE goals ADD COLUMN progress_pct DECIMAL(5,2) DEFAULT 0.00 AFTER priority`,
    `ALTER TABLE goals ADD COLUMN achieved_date DATE NULL AFTER progress_pct`,
    // Add net_worth_snapshots enhancement columns
    `ALTER TABLE net_worth_snapshots ADD COLUMN mobile_banking DECIMAL(15,2) DEFAULT 0.00 AFTER account_balance`,
    `ALTER TABLE net_worth_snapshots ADD COLUMN mutual_funds DECIMAL(15,2) DEFAULT 0.00 AFTER mobile_banking`,
    `ALTER TABLE net_worth_snapshots ADD COLUMN provident_fund DECIMAL(15,2) DEFAULT 0.00 AFTER investment_value`,
    `ALTER TABLE net_worth_snapshots ADD COLUMN goal_savings DECIMAL(15,2) DEFAULT 0.00 AFTER provident_fund`,
    `ALTER TABLE net_worth_snapshots ADD COLUMN generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER personal_lending_balance`,
    // Add notifications enhancement columns
    `ALTER TABLE notifications ADD COLUMN severity ENUM('info','warning','critical') DEFAULT 'info' AFTER message`,
    `ALTER TABLE notifications ADD COLUMN channel ENUM('in_app','push','email','sms') DEFAULT 'in_app' AFTER severity`,
    `ALTER TABLE notifications ADD COLUMN read_at TIMESTAMP NULL AFTER is_read`,
    `ALTER TABLE notifications ADD COLUMN scheduled_for TIMESTAMP NULL AFTER read_at`,

    // ── ERD Alignment: credit_cards column renames ──────────────────────────
    `ALTER TABLE credit_cards CHANGE COLUMN name card_name VARCHAR(100) NOT NULL`,
    `ALTER TABLE credit_cards CHANGE COLUMN limit_amt credit_limit DECIMAL(15,2) NOT NULL DEFAULT 0.00`,
    `ALTER TABLE credit_cards CHANGE COLUMN due_amount current_outstanding DECIMAL(15,2) DEFAULT 0.00`,
    `ALTER TABLE credit_cards ADD COLUMN issuer VARCHAR(100) NOT NULL DEFAULT 'Unknown' AFTER user_id`,
    `ALTER TABLE credit_cards DROP COLUMN due_date`,

    // ── ERD Alignment: loans column renames ─────────────────────────────────
    `ALTER TABLE loans CHANGE COLUMN name lender_name VARCHAR(100) NOT NULL`,
    `ALTER TABLE loans CHANGE COLUMN principal principal_amount DECIMAL(15,2) NOT NULL`,
    `ALTER TABLE loans CHANGE COLUMN remaining outstanding_balance DECIMAL(15,2) NOT NULL`,
    `ALTER TABLE loans CHANGE COLUMN monthly_emi emi_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00`,
    `ALTER TABLE loans CHANGE COLUMN interest_rate annual_interest_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00`,
    `ALTER TABLE loans ADD COLUMN loan_type ENUM('personal','home','auto','student','business','informal') NOT NULL DEFAULT 'personal' AFTER lender_name`,
    `ALTER TABLE loans ADD COLUMN interest_type ENUM('flat','reducing_balance') NOT NULL DEFAULT 'reducing_balance' AFTER annual_interest_rate`,
    `ALTER TABLE loans ADD COLUMN disbursement_date DATE NULL AFTER interest_type`,
    `ALTER TABLE loans ADD COLUMN first_emi_date DATE NULL AFTER disbursement_date`,
    `ALTER TABLE loans ADD COLUMN status ENUM('active','closed','defaulted','restructured') DEFAULT 'active' AFTER prepayment_penalty_pct`,

    // ── ERD Alignment: sanchayapatra column renames ──────────────────────────
    `ALTER TABLE sanchayapatra CHANGE COLUMN principal_amount face_value DECIMAL(15,2) NOT NULL`,
    `ALTER TABLE sanchayapatra CHANGE COLUMN purchase_date issue_date DATE NOT NULL`,
    `ALTER TABLE sanchayapatra MODIFY COLUMN scheme_type ENUM('three_month_profit','five_year_bangladesh','family_savings','pensioner_savings','wage_earner') NOT NULL DEFAULT 'five_year_bangladesh'`,
    `ALTER TABLE sanchayapatra MODIFY COLUMN status ENUM('active','matured','encashed') DEFAULT 'active'`,
    `ALTER TABLE sanchayapatra ADD COLUMN interest_payment_frequency ENUM('monthly','quarterly','on_maturity') NOT NULL DEFAULT 'on_maturity' AFTER annual_interest_rate`,
    `ALTER TABLE sanchayapatra ADD COLUMN interest_payout_account_id INT NULL AFTER maturity_date`,
    `ALTER TABLE sanchayapatra ADD COLUMN source_account_id INT NULL AFTER interest_payout_account_id`,
    `ALTER TABLE sanchayapatra ADD COLUMN tin_required BOOLEAN DEFAULT TRUE AFTER withholding_tax_rate`,

    // ── ERD Alignment: personal_lendings column renames ──────────────────────
    `ALTER TABLE personal_lendings CHANGE COLUMN counterparty_contact counterparty_phone VARCHAR(20) NULL`,
    `ALTER TABLE personal_lendings CHANGE COLUMN principal_amount principal DECIMAL(15,2) NOT NULL`,
    `ALTER TABLE personal_lendings CHANGE COLUMN interest_rate annual_interest_rate DECIMAL(5,2) DEFAULT 0.00`,
    `ALTER TABLE personal_lendings CHANGE COLUMN start_date given_date DATE NOT NULL`,
    `ALTER TABLE personal_lendings CHANGE COLUMN due_date expected_return_date DATE NULL`,
    `ALTER TABLE personal_lendings CHANGE COLUMN notes note TEXT NULL`,
    `ALTER TABLE personal_lendings MODIFY COLUMN status ENUM('outstanding','partially_repaid','settled','written_off') DEFAULT 'outstanding'`,
    `ALTER TABLE personal_lendings DROP COLUMN outstanding_balance`,
    `ALTER TABLE lending_repayments CHANGE COLUMN lending_id personal_lending_id INT NOT NULL`,
    `ALTER TABLE lending_repayments CHANGE COLUMN notes note TEXT NULL`,
    `ALTER TABLE lending_repayments ADD COLUMN credited_to_account_id INT NULL AFTER amount`,

    // ── ERD Alignment: goals enum fix ────────────────────────────────────────
    `ALTER TABLE goals MODIFY COLUMN status ENUM('in_progress','achieved','paused','abandoned') DEFAULT 'in_progress'`,
    `UPDATE goals SET status = 'in_progress' WHERE status = 'active'`,
    `UPDATE goals SET status = 'achieved'   WHERE status = 'completed'`,
    `ALTER TABLE goals ADD COLUMN source_account_id INT NULL AFTER linked_account_id`,
    `ALTER TABLE goal_contributions CHANGE COLUMN contribution_date date DATE NOT NULL`,
    `ALTER TABLE goal_contributions CHANGE COLUMN notes note TEXT NULL`,
    `ALTER TABLE goal_contributions ADD COLUMN source_account_id INT NULL AFTER amount`,

    // ── ERD Alignment: tax_records rename ────────────────────────────────────
    `ALTER TABLE tax_records CHANGE COLUMN filing_date return_filed_date DATE NULL`,
    `ALTER TABLE tax_records CHANGE COLUMN notes note TEXT NULL`,
    `ALTER TABLE tax_records CHANGE COLUMN tax_deducted tds_deducted DECIMAL(15,2) DEFAULT 0.00`,
    `ALTER TABLE tax_records ADD COLUMN total_allowable_investment DECIMAL(15,2) DEFAULT 0.00`,

    // ── ERD Alignment: users google_id ──────────────────────────────────────
    `ALTER TABLE users ADD COLUMN google_id VARCHAR(100) NULL AFTER id`,
    `ALTER TABLE users CHANGE COLUMN avatar_url profile_photo_url VARCHAR(500) NULL`,
  ];
  for (const sql of alterations) {
    try {
      await conn.query(sql);
    } catch (e) {
      if (!SAFE_ERRNO.has(e.errno)) throw e;
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
