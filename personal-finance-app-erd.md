# Personal Finance App — Finalized Entity · Attribute · Relationship Specification

> **Version:** 1.0.0  
> **Scope:** Complete personal financial management — BD-context aware  
> **Currency Default:** BDT (multi-currency capable)  
> **Notation:** PK = Primary Key · FK = Foreign Key · computed = derived, not stored · nullable = optional

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Entity Relationship Tree](#2-entity-relationship-tree)
3. [Core Entities](#3-core-entities)
   - 3.1 User
   - 3.2 Account
   - 3.3 Transfer
4. [Income Module](#4-income-module)
5. [Expense & Transaction Module](#5-expense--transaction-module)
6. [Credit Card Module](#6-credit-card-module)
7. [Savings Instruments](#7-savings-instruments)
   - 7.1 DPS
   - 7.2 FDR (Fixed Deposit)
   - 7.3 Sanchayapatra
8. [Investment Module](#8-investment-module)
9. [Loan Module](#9-loan-module)
10. [Personal Lending & Borrowing](#10-personal-lending--borrowing)
11. [Insurance Module](#11-insurance-module)
12. [Bills & Subscriptions](#12-bills--subscriptions)
13. [Provident Fund](#13-provident-fund)
14. [Tax Module](#14-tax-module)
15. [Budget Module](#15-budget-module)
16. [Goals Module](#16-goals-module)
17. [Net Worth Snapshot](#17-net-worth-snapshot)
18. [Recurring Rules](#18-recurring-rules)
19. [Notifications & Alerts](#19-notifications--alerts)
20. [Supporting Entities](#20-supporting-entities)
    - 20.1 Category
    - 20.2 Attachment
    - 20.3 Tag
    - 20.4 AuditLog
21. [Relationship Summary Matrix](#21-relationship-summary-matrix)
22. [Feature Function Matrix](#22-feature-function-matrix)
23. [Key Financial Formulas](#23-key-financial-formulas)
24. [Development Priority Tiers](#24-development-priority-tiers)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                            USER                                 │
├───────────┬────────────┬──────────┬──────────┬─────────────────┤
│  ASSETS   │ LIABILITIES│  INCOME  │ EXPENSES │   ANALYTICS     │
│           │            │          │          │                 │
│ Account   │ Loan       │ Salary   │ Transact │ Budget          │
│ FDR       │ CreditCard │ Freelance│ Bill     │ Goal            │
│ DPS       │ PersonalBo │ Rental   │ Subscript│ NetWorthSnapshot│
│ Sanchay   │ rrowing    │ Dividend │ Insurance│ CashFlowForecast│
│ Investment│            │ Business │ Premium  │ TaxRecord       │
│ PF        │            │ Other    │          │                 │
└───────────┴────────────┴──────────┴──────────┴─────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
         RecurringRule   Notification    AuditLog
```

---

## 2. Entity Relationship Tree

```
User
 ├── Account (Bank / Mutual Fund / Cash / Mobile Banking)
 │    ├── Transaction ◄─── (expense/income/adjustment)
 │    ├── Transfer (from_account → to_account)
 │    ├── DPSPayment (source_account)
 │    ├── FDRMaturityCredit (destination_account)
 │    ├── LoanPayment (source_account)
 │    └── CreditCardPayment (paid_from_account)
 │
 ├── Income
 │    ├── IncomeSource (Salary / Freelance / Rental / Dividend / Business / Other)
 │    └── → Transaction (auto-created credit entry)
 │
 ├── CreditCard
 │    ├── CreditCardStatement (monthly billing cycle)
 │    │    └── CreditCardPayment → Account
 │    └── Transaction (source_type = credit_card)
 │
 ├── DPS
 │    └── DPSPayment → Account (linked_account)
 │
 ├── FDR (Fixed Deposit Receipt)
 │    └── FDRRenewal (on maturity)
 │
 ├── Sanchayapatra
 │    └── SanchayapatraInterestPayment → Account
 │
 ├── Investment
 │    ├── InvestmentTransaction (buy / sell / dividend)
 │    └── InvestmentSnapshot (daily/weekly NAV log)
 │
 ├── Loan
 │    └── LoanPayment (EMI ledger) → Account
 │
 ├── PersonalLending
 │    └── LendingRepayment
 │
 ├── Insurance
 │    └── InsurancePremiumPayment → Account
 │
 ├── Bill
 │    └── BillPayment → Account / CreditCard
 │
 ├── Subscription
 │    └── SubscriptionPayment → Account / CreditCard
 │
 ├── ProvidentFund
 │    └── PFContribution (monthly log)
 │
 ├── TaxRecord (per fiscal year)
 │    └── TaxPayment
 │
 ├── Budget
 │    └── BudgetAlert
 │
 ├── Goal
 │    └── GoalContribution → Account
 │
 ├── NetWorthSnapshot (monthly computed record)
 │
 ├── RecurringRule ──► (polymorphic: any payable entity)
 │
 ├── Category (self-referential tree)
 │
 ├── Notification
 │
 ├── Attachment (polymorphic)
 │
 ├── Tag (polymorphic)
 │
 └── AuditLog
```

---

## 3. Core Entities

---

### 3.1 `users`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `name` | varchar(100) | NOT NULL | |
| `email` | varchar(150) | UNIQUE, NOT NULL | |
| `phone` | varchar(20) | nullable | |
| `password_hash` | varchar | NOT NULL | bcrypt / argon2 |
| `default_currency` | char(3) | default `BDT` | ISO 4217 |
| `timezone` | varchar(50) | default `Asia/Dhaka` | |
| `date_format` | varchar(20) | default `DD/MM/YYYY` | |
| `financial_year_start` | tinyint | default `7` | July for BD |
| `tin_number` | varchar(20) | nullable | Tax ID |
| `nid_number` | varchar(20) | nullable | National ID |
| `profile_photo_url` | varchar | nullable | |
| `notification_preferences` | json | nullable | push/email/sms flags |
| `is_active` | boolean | default `true` | |
| `last_login_at` | timestamp | nullable | |
| `created_at` | timestamp | NOT NULL | |
| `updated_at` | timestamp | NOT NULL | |

**Functions:**
- Register / Login / Logout / Password reset
- Update profile & preferences
- Export all data (GDPR-style JSON export)
- Delete account (cascade soft-delete)
- Set fiscal year start month

---

### 3.2 `accounts`

> Covers: Bank Account · Mobile Banking (bKash, Nagad) · Mutual Fund · Cash Wallet

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `type` | enum | NOT NULL | `bank` / `mobile_banking` / `mutual_fund` / `cash` |
| `name` | varchar(100) | NOT NULL | Display name e.g. "My DBBL Account" |
| `institution_name` | varchar(100) | nullable | Bank/MF company name |
| `account_number` | varchar(50) | nullable | Masked on display |
| `currency` | char(3) | default `BDT` | |
| `opening_balance` | decimal(15,2) | default `0.00` | Seed value |
| `current_balance` | decimal(15,2) | default `0.00` | Updated on every transaction |
| `color` | varchar(7) | nullable | Hex color for UI card |
| `icon` | varchar(50) | nullable | Icon key |
| `is_default` | boolean | default `false` | Used as primary account |
| `is_active` | boolean | default `true` | |
| `note` | text | nullable | |
| `created_at` | timestamp | NOT NULL | |
| `updated_at` | timestamp | NOT NULL | |
| `deleted_at` | timestamp | nullable | Soft delete |

#### Bank-Specific Sub-Attributes

| Column | Type | Notes |
|---|---|---|
| `branch_name` | varchar(100) | nullable |
| `routing_number` | varchar(20) | nullable |
| `account_type` | enum | `savings` / `current` / `SND` / `STD` |
| `swift_code` | varchar(11) | nullable, for international |

#### Mutual Fund Sub-Attributes

| Column | Type | Notes |
|---|---|---|
| `fund_name` | varchar(100) | nullable |
| `fund_type` | enum | `open_end` / `close_end` |
| `units_held` | decimal(15,4) | nullable |
| `nav_per_unit` | decimal(10,4) | nullable, manual or synced |
| `invested_amount` | decimal(15,2) | nullable, cost basis |
| `current_value` | computed | `units_held × nav_per_unit` |
| `unrealized_gain` | computed | `current_value − invested_amount` |
| `unrealized_gain_pct` | computed | `(gain / invested) × 100` |

**Functions:**
- View balance & transaction history (paginated, filterable)
- Add manual balance adjustment with note
- Set as default account
- View account summary card (balance, income, expense this month)
- Archive account (blocks new transactions, preserves history)
- Multi-currency support with exchange rate conversion
- Export statement (PDF/CSV) for date range

---

### 3.3 `transfers`

> Moves money between any two accounts owned by the user

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `from_account_id` | UUID | FK → accounts | |
| `to_account_id` | UUID | FK → accounts | Must differ from from |
| `amount` | decimal(15,2) | NOT NULL | Amount in from_account currency |
| `converted_amount` | decimal(15,2) | nullable | Amount in to_account currency |
| `exchange_rate` | decimal(10,6) | default `1.000000` | |
| `fee` | decimal(15,2) | default `0.00` | Wire / BEFTN / RTGS fee |
| `fee_account_id` | UUID | FK → accounts | nullable, which account absorbs fee |
| `transfer_date` | date | NOT NULL | |
| `note` | text | nullable | |
| `reference_no` | varchar(100) | nullable | Bank transaction ref |
| `status` | enum | default `completed` | `pending` / `completed` / `reversed` |
| `reversed_at` | timestamp | nullable | |
| `created_at` | timestamp | NOT NULL | |

**Functions:**
- Auto-create mirrored debit/credit `Transaction` entries on both accounts
- Cross-currency transfer with exchange rate logging
- Fee deduction from source account
- Reverse a transfer (creates compensating entries)
- Filter transfer history by account, date, amount range

---

## 4. Income Module

---

### `incomes`

> Structured income records — not just a transaction flag

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `source_type` | enum | NOT NULL | `salary` / `freelance` / `rental` / `dividend` / `business` / `gift` / `remittance` / `other` |
| `title` | varchar(100) | NOT NULL | e.g. "June 2025 Salary" |
| `gross_amount` | decimal(15,2) | NOT NULL | Before deductions |
| `tds_amount` | decimal(15,2) | default `0.00` | Tax deducted at source |
| `other_deductions` | decimal(15,2) | default `0.00` | PF, insurance etc. |
| `net_amount` | computed | | `gross − tds − other_deductions` |
| `currency` | char(3) | default `BDT` | |
| `income_date` | date | NOT NULL | Credit / receipt date |
| `credited_to_account_id` | UUID | FK → accounts | |
| `category_id` | UUID | FK → categories | |
| `description` | text | nullable | |
| `is_recurring` | boolean | default `false` | |
| `recurring_rule_id` | UUID | FK → recurring_rules | nullable |
| `created_at` | timestamp | NOT NULL | |

#### Salary Sub-Attributes (`income_salary_details`)

| Column | Type | Notes |
|---|---|---|
| `employer_name` | varchar(100) | |
| `basic_salary` | decimal(15,2) | |
| `house_rent_allowance` | decimal(15,2) | |
| `medical_allowance` | decimal(15,2) | |
| `transport_allowance` | decimal(15,2) | |
| `bonus` | decimal(15,2) | nullable |
| `provident_fund_deduction` | decimal(15,2) | |
| `pay_period` | enum | `monthly` / `weekly` / `bi_weekly` |
| `pay_slip_attachment_id` | UUID | FK → attachments |
| `employer_tin` | varchar(20) | nullable |

#### Freelance Sub-Attributes (`income_freelance_details`)

| Column | Type | Notes |
|---|---|---|
| `client_name` | varchar(100) | |
| `project_name` | varchar(100) | nullable |
| `invoice_number` | varchar(50) | nullable |
| `platform` | varchar(50) | Upwork / Fiverr / Direct |
| `platform_fee` | decimal(15,2) | default 0 |
| `invoice_attachment_id` | UUID | FK → attachments |

#### Rental Income Sub-Attributes (`income_rental_details`)

| Column | Type | Notes |
|---|---|---|
| `property_name` | varchar(100) | |
| `tenant_name` | varchar(100) | |
| `tenant_phone` | varchar(20) | |
| `advance_deposit` | decimal(15,2) | |
| `lease_start` | date | |
| `lease_end` | date | nullable |

#### Dividend Sub-Attributes (`income_dividend_details`)

| Column | Type | Notes |
|---|---|---|
| `investment_id` | UUID | FK → investments |
| `dividend_type` | enum | `cash` / `stock` |
| `units` | decimal(15,4) | nullable |
| `rate_per_unit` | decimal(10,4) | nullable |

**Functions:**
- Add income from any source type
- View monthly income breakdown by source type
- Compare income month-over-month
- Year-to-date income summary
- Auto-feed into tax module gross income
- Link salary income to PF contribution auto-calculation

---

## 5. Expense & Transaction Module

---

### `transactions`

> Universal ledger — every financial movement across all modules creates a transaction record

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `type` | enum | NOT NULL | `income` / `expense` / `transfer_debit` / `transfer_credit` / `adjustment` |
| `amount` | decimal(15,2) | NOT NULL | Always positive |
| `transaction_date` | date | NOT NULL | |
| `category_id` | UUID | FK → categories | nullable |
| `subcategory_id` | UUID | FK → categories | nullable |
| `source_type` | enum | NOT NULL | `account` / `credit_card` / `cash` |
| `source_id` | UUID | | Polymorphic FK |
| `payee` | varchar(100) | nullable | Merchant / person name |
| `description` | varchar(255) | nullable | Short label |
| `notes` | text | nullable | Detailed notes |
| `reference_no` | varchar(100) | nullable | Bank/card ref |
| `is_recurring` | boolean | default `false` | |
| `recurring_rule_id` | UUID | FK → recurring_rules | nullable |
| `is_split` | boolean | default `false` | Has split children |
| `parent_transaction_id` | UUID | FK → self | nullable, for splits |
| `is_verified` | boolean | default `false` | User-confirmed |
| `is_excluded_from_reports` | boolean | default `false` | |
| `created_at` | timestamp | NOT NULL | |
| `updated_at` | timestamp | NOT NULL | |
| `deleted_at` | timestamp | nullable | Soft delete |

### `transaction_tags` (pivot)

| Column | Type | Notes |
|---|---|---|
| `transaction_id` | UUID | FK → transactions |
| `tag_id` | UUID | FK → tags |

### `transaction_attachments` (pivot)

| Column | Type | Notes |
|---|---|---|
| `transaction_id` | UUID | FK → transactions |
| `attachment_id` | UUID | FK → attachments |

**Functions:**
- Full CRUD with soft delete and restore
- Split one transaction into multiple category amounts
- Bulk import via CSV (bank statement parsing — map columns to fields)
- Receipt photo / document attachment
- Filter by: date range · category · source · tag · payee · amount range · type
- Search by description or reference number
- Mark as verified (reconciliation)
- Exclude from reports (for internal transfers etc.)
- Monthly expense trend chart per category
- Duplicate detection on import

---

## 6. Credit Card Module

---

### `credit_cards`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `issuer` | varchar(100) | NOT NULL | BRAC Bank, City Bank, EBL |
| `card_name` | varchar(100) | NOT NULL | "Visa Platinum", "Amex Gold" |
| `card_number_last4` | char(4) | NOT NULL | Masked display |
| `card_type` | enum | NOT NULL | `visa` / `mastercard` / `amex` / `unionpay` |
| `credit_limit` | decimal(15,2) | NOT NULL | |
| `current_outstanding` | decimal(15,2) | default `0.00` | Total owed |
| `available_credit` | computed | | `credit_limit − current_outstanding` |
| `utilization_pct` | computed | | `(outstanding / limit) × 100` |
| `billing_cycle_day` | tinyint | NOT NULL | Day of month statement generates |
| `payment_due_day` | tinyint | NOT NULL | Days after billing cycle close |
| `annual_interest_rate` | decimal(5,2) | NOT NULL | e.g. 30.00 for 30% p.a. |
| `monthly_interest_rate` | computed | | `annual / 12` |
| `minimum_payment_pct` | decimal(5,2) | default `5.00` | % of outstanding |
| `minimum_payment_fixed` | decimal(10,2) | default `500.00` | Whichever is higher |
| `cash_advance_limit` | decimal(15,2) | nullable | |
| `cash_advance_rate` | decimal(5,2) | nullable | Usually higher than purchase rate |
| `reward_points` | int | default `0` | Loyalty points balance |
| `is_active` | boolean | default `true` | |
| `linked_bank_account_id` | UUID | FK → accounts | Default payment account |
| `color` | varchar(7) | nullable | Card UI color |
| `created_at` | timestamp | NOT NULL | |

---

### `credit_card_statements`

> One record per billing cycle

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `credit_card_id` | UUID | FK → credit_cards | |
| `statement_date` | date | NOT NULL | Cycle closing date |
| `due_date` | date | NOT NULL | Payment deadline |
| `opening_balance` | decimal(15,2) | NOT NULL | Carried from previous cycle |
| `total_purchases` | decimal(15,2) | default `0.00` | |
| `total_credits` | decimal(15,2) | default `0.00` | Refunds, cashbacks |
| `total_payments` | decimal(15,2) | default `0.00` | Payments made during cycle |
| `interest_charged` | decimal(15,2) | default `0.00` | On unpaid prior balance |
| `late_fee` | decimal(15,2) | default `0.00` | |
| `other_charges` | decimal(15,2) | default `0.00` | Annual fee, SMS fee |
| `closing_balance` | decimal(15,2) | NOT NULL | Total due |
| `minimum_due` | decimal(15,2) | NOT NULL | |
| `status` | enum | default `open` | `open` / `closed` / `fully_paid` / `partially_paid` |
| `pdf_attachment_id` | UUID | FK → attachments | nullable, e-statement |

**Interest Calculation:**

```
Unpaid Balance  = previous closing_balance − total_payments_made_before_due
Monthly Rate    = annual_interest_rate / 12 / 100
Interest        = Unpaid Balance × Monthly Rate
```

---

### `credit_card_payments`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `credit_card_id` | UUID | FK → credit_cards | |
| `statement_id` | UUID | FK → credit_card_statements | nullable |
| `paid_from_account_id` | UUID | FK → accounts | |
| `amount` | decimal(15,2) | NOT NULL | |
| `payment_type` | enum | NOT NULL | `full` / `minimum` / `partial` / `overlimit` |
| `payment_date` | date | NOT NULL | |
| `reference_no` | varchar(100) | nullable | |
| `note` | text | nullable | |

**Functions (Credit Card Module):**
- View current outstanding, available credit, utilization %
- View all statements with status
- Pay bill (full / minimum / partial) from any linked account
- Interest projection if only minimum is paid
- Warn on due date approaching (configurable N days before)
- Flag overdue payments
- Cash advance tracking (separate rate)
- Reward points ledger
- Statement PDF storage
- Spending breakdown per statement cycle

---

## 7. Savings Instruments

---

### 7.1 `dps` (Deposit Pension Scheme)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `institution_name` | varchar(100) | NOT NULL | |
| `dps_account_number` | varchar(50) | NOT NULL | |
| `linked_account_id` | UUID | FK → accounts | Auto-debit source |
| `installment_amount` | decimal(15,2) | NOT NULL | Monthly deposit |
| `annual_interest_rate` | decimal(5,2) | NOT NULL | |
| `tenure_months` | smallint | NOT NULL | 12 / 24 / 36 / 60 / 120 |
| `start_date` | date | NOT NULL | |
| `maturity_date` | computed | | `start_date + tenure_months` |
| `total_installments` | computed | | `tenure_months` |
| `paid_installments` | computed | | Count of paid DPS payments |
| `missed_installments` | computed | | Count of missed |
| `total_deposited` | computed | | `paid × installment_amount` |
| `projected_maturity_value` | computed | | See formula below |
| `actual_maturity_value` | decimal(15,2) | nullable | Entered on maturity |
| `withholding_tax_rate` | decimal(5,2) | default `10.00` | On interest |
| `status` | enum | default `active` | `active` / `matured` / `closed` / `broken` |
| `break_date` | date | nullable | If broken before maturity |
| `break_value` | decimal(15,2) | nullable | Actual amount received on break |
| `maturity_credited_to_id` | UUID | FK → accounts | nullable |
| `note` | text | nullable | |
| `created_at` | timestamp | NOT NULL | |

**Projected Maturity Value Formula:**

```
M = P × n + P × [n(n+1)/2] × (r/12)

Where:
  P = monthly installment amount
  n = tenure in months
  r = annual interest rate (as decimal, e.g. 0.12 for 12%)
```

---

### `dps_payments`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `dps_id` | UUID | FK → dps | |
| `installment_no` | smallint | NOT NULL | 1 → n |
| `due_date` | date | NOT NULL | |
| `paid_date` | date | nullable | null = not yet paid |
| `amount` | decimal(15,2) | NOT NULL | |
| `penalty` | decimal(15,2) | default `0.00` | Late payment charge |
| `source_account_id` | UUID | FK → accounts | |
| `status` | enum | default `upcoming` | `upcoming` / `paid` / `missed` |
| `receipt_attachment_id` | UUID | FK → attachments | nullable |

**Functions (DPS):**
- Track installment calendar (paid / missed / upcoming)
- Progress bar: `paid_installments / total_installments × 100`
- Alert N days before each installment due
- Calculate penalty on missed installments
- Simulate break value at any point
- Maturity value projection with tax deduction
- On maturity — credit to linked account

---

### 7.2 `fdr` (Fixed Deposit Receipt)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `institution_name` | varchar(100) | NOT NULL | |
| `fdr_account_number` | varchar(50) | nullable | |
| `source_account_id` | UUID | FK → accounts | Funded from |
| `principal_amount` | decimal(15,2) | NOT NULL | One-time lump sum |
| `annual_interest_rate` | decimal(5,2) | NOT NULL | |
| `compounding_frequency` | enum | NOT NULL | `monthly` / `quarterly` / `half_yearly` / `yearly` / `on_maturity` |
| `tenure_days` | int | nullable | Exact days (some banks use this) |
| `tenure_months` | smallint | nullable | Months |
| `start_date` | date | NOT NULL | |
| `maturity_date` | date | NOT NULL | |
| `projected_maturity_value` | computed | | See formula |
| `actual_maturity_value` | decimal(15,2) | nullable | |
| `interest_payout_frequency` | enum | default `on_maturity` | `monthly` / `quarterly` / `on_maturity` |
| `interest_payout_account_id` | UUID | FK → accounts | Where periodic interest goes |
| `withholding_tax_rate` | decimal(5,2) | default `10.00` | TDS on interest |
| `auto_renewal` | boolean | default `false` | Roll over on maturity |
| `renewal_count` | tinyint | default `0` | |
| `maturity_credited_to_id` | UUID | FK → accounts | nullable |
| `status` | enum | default `active` | `active` / `matured` / `broken` / `renewed` |
| `note` | text | nullable | |
| `created_at` | timestamp | NOT NULL | |

**Compound Interest Formula:**

```
M = P × (1 + r/n)^(n×t)

Where:
  P = principal
  r = annual interest rate (decimal)
  n = compounding frequency per year (12=monthly, 4=quarterly, 2=half-yearly, 1=yearly)
  t = time in years
```

---

### `fdr_renewals`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `fdr_id` | UUID | FK → fdr |
| `renewal_date` | date | |
| `new_principal` | decimal(15,2) | Principal + maturity interest |
| `new_rate` | decimal(5,2) | Rate at renewal time |
| `new_maturity_date` | date | |
| `renewal_no` | tinyint | |

---

### 7.3 `sanchayapatra`

> Bangladesh National Savings Directorate instruments

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `scheme_type` | enum | NOT NULL | `three_month_profit` / `five_year_bangladesh` / `family_savings` / `pensioner_savings` / `wage_earner` |
| `certificate_number` | varchar(50) | NOT NULL | |
| `issue_date` | date | NOT NULL | |
| `face_value` | decimal(15,2) | NOT NULL | Purchase amount |
| `annual_interest_rate` | decimal(5,2) | NOT NULL | Fixed by Bangladesh Bank |
| `interest_payment_frequency` | enum | NOT NULL | `monthly` / `quarterly` / `on_maturity` |
| `maturity_date` | date | NOT NULL | |
| `maturity_value` | computed | | Based on scheme rules |
| `interest_payout_account_id` | UUID | FK → accounts | Bank account for profit |
| `source_account_id` | UUID | FK → accounts | Purchased from |
| `withholding_tax_rate` | decimal(5,2) | default `10.00` | TDS on interest |
| `tin_required` | boolean | default `true` | Above BDT 2L |
| `encashment_date` | date | nullable | If encashed early |
| `encashment_value` | decimal(15,2) | nullable | |
| `status` | enum | default `active` | `active` / `matured` / `encashed` |
| `note` | text | nullable | |

---

### `sanchayapatra_interest_payments`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `sanchayapatra_id` | UUID | FK → sanchayapatra |
| `payment_no` | int | 1 → n |
| `due_date` | date | |
| `paid_date` | date | nullable |
| `gross_amount` | decimal(15,2) | |
| `tds_amount` | decimal(15,2) | |
| `net_amount` | decimal(15,2) | |
| `credited_to_account_id` | UUID | FK → accounts |
| `status` | enum | `upcoming` / `paid` / `missed` |

---

## 8. Investment Module

---

### `investments`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `type` | enum | NOT NULL | `stock` / `bond` / `mutual_fund` / `crypto` / `etf` / `commodity` |
| `name` | varchar(100) | NOT NULL | Full name |
| `symbol` | varchar(20) | nullable | Ticker: BEXIMCO, BTC |
| `exchange` | varchar(20) | nullable | DSE / CSE / Binance |
| `currency` | char(3) | default `BDT` | |
| `quantity_held` | decimal(15,4) | default `0.0000` | |
| `average_buy_price` | decimal(15,4) | default `0.0000` | Weighted average cost |
| `current_price` | decimal(15,4) | nullable | Manual or API-synced |
| `current_value` | computed | | `quantity × current_price` |
| `total_invested` | decimal(15,2) | default `0.00` | Total cost basis |
| `realized_gain_loss` | decimal(15,2) | default `0.00` | From sell transactions |
| `unrealized_gain_loss` | computed | | `current_value − total_invested` |
| `total_dividends_received` | decimal(15,2) | default `0.00` | |
| `total_return` | computed | | `realized + unrealized + dividends` |
| `return_pct` | computed | | `(total_return / total_invested) × 100` |
| `broker_name` | varchar(100) | nullable | |
| `bo_account_number` | varchar(50) | nullable | BO account for DSE/CSE |
| `status` | enum | default `active` | `active` / `sold` / `delisted` |
| `created_at` | timestamp | NOT NULL | |

---

### `investment_transactions`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `investment_id` | UUID | FK → investments | |
| `type` | enum | NOT NULL | `buy` / `sell` / `dividend` / `split` / `bonus` |
| `date` | date | NOT NULL | |
| `quantity` | decimal(15,4) | NOT NULL | |
| `price_per_unit` | decimal(15,4) | NOT NULL | |
| `total_amount` | computed | | `quantity × price` |
| `brokerage_fee` | decimal(10,2) | default `0.00` | |
| `tax` | decimal(10,2) | default `0.00` | |
| `net_amount` | computed | | `total ± fee ± tax` |
| `source_account_id` | UUID | FK → accounts | Cash account used |
| `note` | text | nullable | |

---

### `investment_snapshots`

> Periodic portfolio valuation for trend charting

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → users |
| `snapshot_date` | date | |
| `investment_id` | UUID | FK → investments |
| `price` | decimal(15,4) | |
| `quantity` | decimal(15,4) | |
| `value` | decimal(15,2) | |

**Functions (Investment):**
- Buy / Sell / Dividend log
- Portfolio overview: total invested, current value, P&L, return %
- Per-asset allocation pie chart
- XIRR calculation for true annualized return
- Price update (manual or future: API integration)
- Realized vs unrealized gain/loss report
- Dividend history and yield calculation

---

## 9. Loan Module

---

### `loans`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `lender_name` | varchar(100) | NOT NULL | Bank / institution / person |
| `loan_type` | enum | NOT NULL | `personal` / `home` / `auto` / `student` / `business` / `informal` |
| `purpose` | varchar(255) | nullable | |
| `principal_amount` | decimal(15,2) | NOT NULL | Original disbursed amount |
| `outstanding_balance` | decimal(15,2) | NOT NULL | Live remaining principal |
| `annual_interest_rate` | decimal(5,2) | NOT NULL | |
| `interest_type` | enum | NOT NULL | `flat` / `reducing_balance` |
| `tenure_months` | smallint | NOT NULL | |
| `emi_amount` | decimal(15,2) | NOT NULL | |
| `disbursement_date` | date | NOT NULL | |
| `first_emi_date` | date | NOT NULL | |
| `emi_day_of_month` | tinyint | NOT NULL | e.g. 10th of each month |
| `repayment_account_id` | UUID | FK → accounts | EMI auto-debit source |
| `total_paid` | computed | | Sum of all paid EMIs |
| `total_interest_paid` | computed | | Sum of interest portions paid |
| `total_principal_paid` | computed | | |
| `remaining_tenure` | computed | | Months left |
| `loan_account_number` | varchar(50) | nullable | |
| `guarantor_name` | varchar(100) | nullable | |
| `collateral_description` | text | nullable | |
| `late_fee_rate` | decimal(5,2) | default `0.00` | % per month overdue |
| `prepayment_penalty_pct` | decimal(5,2) | default `0.00` | |
| `status` | enum | default `active` | `active` / `closed` / `defaulted` / `restructured` |
| `closed_date` | date | nullable | |
| `document_attachment_id` | UUID | FK → attachments | nullable |
| `created_at` | timestamp | NOT NULL | |

**EMI Formula (Reducing Balance):**

```
EMI = P × [r × (1+r)^n] / [(1+r)^n − 1]

Where:
  P = principal
  r = monthly interest rate = annual_rate / 12 / 100
  n = tenure in months
```

**EMI Flat Rate:**

```
EMI = (P + P × annual_rate/100 × years) / (years × 12)
```

---

### `loan_payments`

> Full amortization ledger

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `loan_id` | UUID | FK → loans | |
| `installment_no` | smallint | NOT NULL | 1 → n |
| `due_date` | date | NOT NULL | |
| `paid_date` | date | nullable | |
| `emi_amount` | decimal(15,2) | NOT NULL | |
| `principal_portion` | decimal(15,2) | NOT NULL | |
| `interest_portion` | decimal(15,2) | NOT NULL | |
| `late_fee` | decimal(15,2) | default `0.00` | |
| `total_paid` | decimal(15,2) | nullable | |
| `outstanding_after` | decimal(15,2) | NOT NULL | Balance post this EMI |
| `source_account_id` | UUID | FK → accounts | |
| `status` | enum | default `upcoming` | `upcoming` / `paid` / `missed` / `partial` |
| `receipt_attachment_id` | UUID | FK → attachments | nullable |

**Functions (Loan):**
- Auto-generate full amortization schedule on creation
- Prepayment simulation: reduce EMI vs reduce tenure
- Overdue alert with late fee calculation
- Foreclosure calculation
- Total interest cost to date
- Loan payoff date tracker

---

## 10. Personal Lending & Borrowing

---

### `personal_lendings`

> Informal money given to or taken from individuals

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `direction` | enum | NOT NULL | `lent` (I gave) / `borrowed` (I took) |
| `counterparty_name` | varchar(100) | NOT NULL | Person or entity |
| `counterparty_phone` | varchar(20) | nullable | |
| `counterparty_relation` | varchar(50) | nullable | Friend / Colleague / Family |
| `principal` | decimal(15,2) | NOT NULL | |
| `annual_interest_rate` | decimal(5,2) | default `0.00` | Often 0 informal |
| `given_date` | date | NOT NULL | |
| `expected_return_date` | date | nullable | |
| `total_repaid` | computed | | Sum of repayments |
| `outstanding` | computed | | `principal − total_repaid` |
| `currency` | char(3) | default `BDT` | |
| `source_account_id` | UUID | FK → accounts | From which account |
| `purpose` | varchar(255) | nullable | |
| `status` | enum | default `outstanding` | `outstanding` / `partially_repaid` / `settled` / `written_off` |
| `settlement_date` | date | nullable | |
| `note` | text | nullable | |
| `created_at` | timestamp | NOT NULL | |

---

### `lending_repayments`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `personal_lending_id` | UUID | FK → personal_lendings |
| `repayment_date` | date | |
| `amount` | decimal(15,2) | |
| `credited_to_account_id` | UUID | FK → accounts |
| `note` | text | nullable |

**Functions:**
- Track who owes you, and who you owe
- Log partial repayments
- Reminder alert for expected return date
- Outstanding balance summary
- Write-off bad lending
- Interest calculation for interest-bearing informal loans

---

## 11. Insurance Module

---

### `insurances`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `type` | enum | NOT NULL | `life` / `term` / `health` / `vehicle` / `home` / `fire` / `travel` |
| `provider_name` | varchar(100) | NOT NULL | MetLife, Green Delta, Pragati |
| `policy_number` | varchar(100) | NOT NULL | |
| `plan_name` | varchar(100) | nullable | |
| `sum_assured` | decimal(15,2) | NOT NULL | Coverage amount |
| `premium_amount` | decimal(15,2) | NOT NULL | |
| `premium_frequency` | enum | NOT NULL | `monthly` / `quarterly` / `half_yearly` / `yearly` |
| `premium_due_day` | tinyint | NOT NULL | Day of month/period |
| `policy_start_date` | date | NOT NULL | |
| `policy_end_date` | date | nullable | null for whole life |
| `maturity_value` | decimal(15,2) | nullable | For endowment plans |
| `surrender_value` | decimal(15,2) | nullable | Current surrender estimate |
| `nominee_name` | varchar(100) | nullable | |
| `nominee_relation` | varchar(50) | nullable | |
| `agent_name` | varchar(100) | nullable | |
| `linked_account_id` | UUID | FK → accounts | Premium source |
| `total_premium_paid` | computed | | Sum of all payments |
| `policy_document_id` | UUID | FK → attachments | nullable |
| `status` | enum | default `active` | `active` / `lapsed` / `surrendered` / `matured` / `claimed` |
| `created_at` | timestamp | NOT NULL | |

---

### `insurance_premium_payments`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `insurance_id` | UUID | FK → insurances |
| `due_date` | date | |
| `paid_date` | date | nullable |
| `amount` | decimal(15,2) | |
| `late_fee` | decimal(15,2) | default `0.00` |
| `source_account_id` | UUID | FK → accounts |
| `receipt_attachment_id` | UUID | FK → attachments |
| `status` | enum | `upcoming` / `paid` / `missed` |

**Functions:**
- Premium payment calendar and alerts
- Policy overview (coverage, maturity, nominee)
- Lapse warning (missed premium count)
- Total premium invested vs coverage ratio
- Maturity value projection
- Claim filing note and status tracking

---

## 12. Bills & Subscriptions

---

### `bills`

> Recurring real-world bills — utilities, rent, etc.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `type` | enum | NOT NULL | `electricity` / `gas` / `water` / `internet` / `phone` / `house_rent` / `other` |
| `provider_name` | varchar(100) | NOT NULL | DESCO, DPDC, Titas |
| `account_number` | varchar(50) | nullable | Meter / customer number |
| `billing_address` | varchar(255) | nullable | |
| `due_day` | tinyint | NOT NULL | Day of month |
| `estimated_amount` | decimal(15,2) | nullable | For budget planning |
| `linked_account_id` | UUID | FK → accounts | Default payment account |
| `category_id` | UUID | FK → categories | |
| `is_active` | boolean | default `true` | |

#### Utility-Specific Sub-Attributes

| Column | Type | Notes |
|---|---|---|
| `meter_number` | varchar(50) | |
| `tariff_rate` | decimal(10,4) | Per unit rate |
| `previous_reading` | decimal(10,2) | |
| `current_reading` | decimal(10,2) | |
| `units_consumed` | computed | `current − previous` |

#### House Rent Sub-Attributes

| Column | Type | Notes |
|---|---|---|
| `landlord_name` | varchar(100) | |
| `landlord_phone` | varchar(20) | |
| `advance_deposit` | decimal(15,2) | |
| `lease_start_date` | date | |
| `lease_end_date` | date | nullable |

---

### `bill_payments`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `bill_id` | UUID | FK → bills |
| `billing_month` | date | First day of billing month |
| `amount` | decimal(15,2) | |
| `paid_date` | date | nullable |
| `meter_reading_previous` | decimal(10,2) | nullable |
| `meter_reading_current` | decimal(10,2) | nullable |
| `units_consumed` | decimal(10,2) | nullable |
| `source_account_id` | UUID | FK → accounts |
| `credit_card_id` | UUID | FK → credit_cards | nullable |
| `receipt_attachment_id` | UUID | FK → attachments | |
| `status` | enum | `upcoming` / `paid` / `overdue` |

---

### `subscriptions`

> Digital service subscriptions

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `service_name` | varchar(100) | NOT NULL | Netflix, Adobe, GitHub |
| `category` | enum | | `streaming` / `software` / `cloud` / `news` / `fitness` / `other` |
| `billing_cycle` | enum | NOT NULL | `monthly` / `yearly` / `weekly` |
| `amount` | decimal(15,2) | NOT NULL | |
| `currency` | char(3) | default `BDT` | |
| `next_billing_date` | date | NOT NULL | |
| `trial_end_date` | date | nullable | |
| `auto_renews` | boolean | default `true` | |
| `payment_method_type` | enum | | `account` / `credit_card` |
| `payment_method_id` | UUID | | Polymorphic |
| `category_id` | UUID | FK → categories | |
| `last_used_date` | date | nullable | For unused-subscription detection |
| `is_active` | boolean | default `true` | |
| `cancellation_date` | date | nullable | |
| `website_url` | varchar(255) | nullable | |

**Functions (Bills & Subscriptions):**
- Monthly bill calendar view
- Overdue alert for unpaid bills
- Subscription graveyard: flag subscriptions where `last_used_date > 30 days ago`
- Trial expiry alert
- Annual subscription cost summary
- Utility consumption trend chart (units/month)
- Rent advance deposit tracking

---

## 13. Provident Fund

---

### `provident_funds`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `employer_name` | varchar(100) | NOT NULL | |
| `pf_account_number` | varchar(50) | nullable | |
| `employee_contribution_pct` | decimal(5,2) | NOT NULL | % of basic salary |
| `employer_contribution_pct` | decimal(5,2) | NOT NULL | Matching % |
| `annual_interest_rate` | decimal(5,2) | NOT NULL | |
| `joined_date` | date | NOT NULL | |
| `vesting_years` | tinyint | nullable | Years to full employer vesting |
| `current_corpus` | decimal(15,2) | default `0.00` | Total accumulated |
| `employee_corpus` | decimal(15,2) | default `0.00` | |
| `employer_corpus` | decimal(15,2) | default `0.00` | |
| `linked_income_id` | UUID | FK → incomes | nullable, linked salary |
| `status` | enum | default `active` | `active` / `withdrawn` / `transferred` |

---

### `pf_contributions`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `provident_fund_id` | UUID | FK → provident_funds |
| `period` | date | First of contribution month |
| `employee_amount` | decimal(15,2) | |
| `employer_amount` | decimal(15,2) | |
| `interest_credited` | decimal(15,2) | default `0.00` |
| `cumulative_corpus` | decimal(15,2) | After this contribution |
| `note` | text | nullable |

---

## 14. Tax Module

---

### `tax_records`

> One record per fiscal year

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `fiscal_year` | varchar(10) | NOT NULL | e.g. `2024-25` |
| `tax_year_start` | date | NOT NULL | |
| `tax_year_end` | date | NOT NULL | |
| `gross_income` | decimal(15,2) | NOT NULL | Aggregated from Income module |
| `salary_income` | decimal(15,2) | default `0.00` | |
| `business_income` | decimal(15,2) | default `0.00` | |
| `rental_income` | decimal(15,2) | default `0.00` | |
| `investment_income` | decimal(15,2) | default `0.00` | Dividends, capital gains |
| `other_income` | decimal(15,2) | default `0.00` | |
| `investment_in_dps` | decimal(15,2) | default `0.00` | Rebate-eligible |
| `investment_in_sanchayapatra` | decimal(15,2) | default `0.00` | |
| `investment_in_pf` | decimal(15,2) | default `0.00` | |
| `insurance_premium_paid` | decimal(15,2) | default `0.00` | |
| `total_allowable_investment` | decimal(15,2) | NOT NULL | Min(actual, 25% of income, 1.5Cr) |
| `investment_rebate_pct` | decimal(5,2) | default `15.00` | % on allowable investment |
| `investment_rebate_amount` | computed | | `total_allowable × rebate_pct / 100` |
| `taxable_income` | computed | | After exemptions |
| `tax_at_slab` | decimal(15,2) | NOT NULL | Per BD slab rates |
| `tax_liability_before_rebate` | decimal(15,2) | NOT NULL | |
| `tax_liability_after_rebate` | computed | | `tax − investment_rebate` |
| `tds_deducted` | decimal(15,2) | default `0.00` | From salary, FDR, Sanchaya |
| `advance_tax_paid` | decimal(15,2) | default `0.00` | |
| `net_tax_payable` | computed | | `liability − TDS − advance` |
| `return_filed_date` | date | nullable | |
| `assessment_year` | varchar(10) | nullable | |
| `acknowledgement_number` | varchar(50) | nullable | |
| `note` | text | nullable | |

**BD Income Tax Slabs (Reference):**

```
First BDT 3,50,000      →  0%
Next  BDT 1,00,000      →  5%
Next  BDT 3,00,000      → 10%
Next  BDT 4,00,000      → 15%
Next  BDT 5,00,000      → 20%
Remaining               → 25%
(Women & Senior Citizens: First BDT 4,00,000 @ 0%)
```

---

### `tax_payments`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `tax_record_id` | UUID | FK → tax_records |
| `payment_type` | enum | `advance` / `self_assessment` / `demand` |
| `amount` | decimal(15,2) | |
| `payment_date` | date | |
| `challan_number` | varchar(50) | nullable |
| `source_account_id` | UUID | FK → accounts |
| `attachment_id` | UUID | FK → attachments |

**Functions (Tax):**
- Auto-populate income from Income module per fiscal year
- Auto-populate investment from DPS / FDR / Sanchayapatra / PF / Insurance
- Compute tax liability step-by-step with slab breakdown
- Compute investment rebate
- Net tax payable after TDS
- Exportable tax summary for return filing
- Challan tracking

---

## 15. Budget Module

---

### `budgets`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `name` | varchar(100) | nullable | e.g. "August 2025 Budget" |
| `category_id` | UUID | FK → categories | nullable (null = overall budget) |
| `period` | enum | NOT NULL | `monthly` / `weekly` / `yearly` / `custom` |
| `amount` | decimal(15,2) | NOT NULL | Budgeted cap |
| `start_date` | date | NOT NULL | |
| `end_date` | date | nullable | null = rolling current period |
| `spent_amount` | computed | | Sum of matching transactions |
| `remaining_amount` | computed | | `amount − spent_amount` |
| `utilization_pct` | computed | | `(spent / amount) × 100` |
| `alert_threshold_pct` | tinyint | default `80` | Alert when spent > this % |
| `rollover_unspent` | boolean | default `false` | Add surplus to next period |
| `is_active` | boolean | default `true` | |

---

### `budget_alerts`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `budget_id` | UUID | FK → budgets |
| `triggered_at` | timestamp | |
| `utilization_pct` | decimal(5,2) | At time of alert |
| `alert_type` | enum | `threshold` / `exceeded` / `period_end` |
| `is_read` | boolean | default `false` |

**Functions:**
- Per-category and overall monthly budget
- Real-time spend gauge (progress bar)
- Alert on threshold breach
- Alert on budget exceeded
- Month-end rollover management
- Historical budget vs actual comparison
- Suggested budget based on past 3 months average spending

---

## 16. Goals Module

---

### `goals`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `name` | varchar(100) | NOT NULL | "Emergency Fund", "Buy Car" |
| `description` | text | nullable | |
| `target_amount` | decimal(15,2) | NOT NULL | |
| `current_amount` | decimal(15,2) | default `0.00` | |
| `target_date` | date | nullable | |
| `monthly_required` | computed | | `(target − current) / months_left` |
| `linked_account_id` | UUID | FK → accounts | Dedicated savings account |
| `icon` | varchar(50) | nullable | |
| `color` | varchar(7) | nullable | |
| `priority` | enum | default `medium` | `high` / `medium` / `low` |
| `category` | enum | nullable | `emergency` / `travel` / `education` / `property` / `vehicle` / `other` |
| `progress_pct` | computed | | `(current / target) × 100` |
| `status` | enum | default `in_progress` | `in_progress` / `achieved` / `paused` / `abandoned` |
| `achieved_date` | date | nullable | |
| `created_at` | timestamp | NOT NULL | |

---

### `goal_contributions`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `goal_id` | UUID | FK → goals |
| `date` | date | |
| `amount` | decimal(15,2) | |
| `source_account_id` | UUID | FK → accounts |
| `note` | text | nullable |

**Functions:**
- Create goal with target and deadline
- Log manual contributions or link to recurring rule
- Progress tracker with projected completion date
- Alert when goal is achieved
- Simulate: "If I save X/month, I'll reach goal by Y"
- Multiple goals with priority ranking

---

## 17. Net Worth Snapshot

---

### `net_worth_snapshots`

> Computed monthly — enables net worth trend chart

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `snapshot_date` | date | NOT NULL | First of each month |
| `cash_and_bank` | decimal(15,2) | NOT NULL | Sum of all account balances |
| `mobile_banking` | decimal(15,2) | default `0.00` | |
| `mutual_funds` | decimal(15,2) | default `0.00` | MF current value |
| `dps_deposited` | decimal(15,2) | default `0.00` | Total deposited to date |
| `fdr_principal` | decimal(15,2) | default `0.00` | Active FDR principals |
| `sanchayapatra_face_value` | decimal(15,2) | default `0.00` | |
| `investment_portfolio` | decimal(15,2) | default `0.00` | Stocks + bonds + crypto |
| `provident_fund` | decimal(15,2) | default `0.00` | |
| `goal_savings` | decimal(15,2) | default `0.00` | Sum of goal accounts |
| `total_assets` | computed | | Sum of all asset columns |
| `loan_outstanding` | decimal(15,2) | default `0.00` | |
| `credit_card_outstanding` | decimal(15,2) | default `0.00` | |
| `personal_borrowings` | decimal(15,2) | default `0.00` | |
| `total_liabilities` | computed | | Sum of all liability columns |
| `net_worth` | computed | | `total_assets − total_liabilities` |
| `generated_at` | timestamp | NOT NULL | |

**Functions:**
- Auto-generated on 1st of every month (scheduled job)
- Manual snapshot trigger
- Net worth trend line chart (12 months, 5 years)
- Asset allocation donut chart
- Liability breakdown chart
- Month-over-month change (absolute + %)

---

## 18. Recurring Rules

---

### `recurring_rules`

> Powers all automatic / scheduled financial events

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `name` | varchar(100) | NOT NULL | "Monthly Salary", "Netflix Renewal" |
| `rule_type` | enum | NOT NULL | `income` / `expense` / `transfer` / `dps_installment` / `loan_emi` / `cc_payment` / `bill_payment` / `subscription` / `insurance_premium` / `goal_contribution` |
| `entity_type` | varchar(50) | nullable | Polymorphic source entity |
| `entity_id` | UUID | nullable | e.g. DPS id, Loan id |
| `amount` | decimal(15,2) | NOT NULL | |
| `category_id` | UUID | FK → categories | nullable |
| `source_account_id` | UUID | FK → accounts | nullable |
| `destination_account_id` | UUID | FK → accounts | nullable, for transfers |
| `frequency` | enum | NOT NULL | `daily` / `weekly` / `bi_weekly` / `monthly` / `quarterly` / `yearly` |
| `day_of_month` | tinyint | nullable | |
| `day_of_week` | tinyint | nullable | 0=Sun, 6=Sat |
| `start_date` | date | NOT NULL | |
| `end_date` | date | nullable | null = indefinite |
| `next_due_date` | date | NOT NULL | |
| `last_executed_date` | date | nullable | |
| `auto_create_transaction` | boolean | default `true` | |
| `description` | varchar(255) | nullable | |
| `is_active` | boolean | default `true` | |
| `created_at` | timestamp | NOT NULL | |

**Functions:**
- Upcoming payments calendar (30-day view)
- Auto-create transaction on due date
- Skip one occurrence
- Pause / resume rule
- Edit amount or schedule
- Notify N days before due

---

## 19. Notifications & Alerts

---

### `notifications`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `type` | enum | NOT NULL | See types below |
| `title` | varchar(200) | NOT NULL | |
| `body` | text | NOT NULL | |
| `entity_type` | varchar(50) | nullable | Polymorphic |
| `entity_id` | UUID | nullable | |
| `severity` | enum | default `info` | `info` / `warning` / `critical` |
| `channel` | enum | default `in_app` | `in_app` / `push` / `email` / `sms` |
| `is_read` | boolean | default `false` | |
| `read_at` | timestamp | nullable | |
| `scheduled_for` | timestamp | nullable | Future notifications |
| `created_at` | timestamp | NOT NULL | |

**Notification Types:**

| Type | Trigger |
|---|---|
| `loan_emi_due` | N days before EMI due |
| `loan_emi_missed` | Day after due, not paid |
| `cc_payment_due` | N days before CC payment deadline |
| `cc_overdue` | Payment deadline passed |
| `cc_utilization_high` | Utilization > 80% |
| `dps_installment_due` | N days before DPS debit |
| `dps_missed` | Installment not paid |
| `dps_maturity` | DPS reaching maturity |
| `fdr_maturity` | FDR maturing in N days |
| `sanchayapatra_maturity` | Certificate maturing |
| `insurance_premium_due` | N days before premium |
| `insurance_lapsed` | Premium missed, policy risk |
| `budget_threshold` | Budget at X% |
| `budget_exceeded` | Budget over limit |
| `subscription_renewal` | N days before auto-renewal |
| `subscription_trial_ending` | Trial ending soon |
| `goal_achieved` | Goal reached 100% |
| `bill_due` | Bill payment upcoming |
| `lending_overdue` | Personal lending past due date |
| `low_account_balance` | Account below threshold |
| `net_worth_snapshot` | Monthly snapshot generated |
| `tax_return_reminder` | Before filing deadline |

---

## 20. Supporting Entities

---

### 20.1 `categories`

> Self-referential two-level tree: Category → SubCategory

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | null = system default |
| `name` | varchar(100) | NOT NULL | |
| `type` | enum | NOT NULL | `income` / `expense` / `both` |
| `parent_id` | UUID | FK → self | null = root/parent category |
| `icon` | varchar(50) | nullable | |
| `color` | varchar(7) | nullable | Hex |
| `is_system` | boolean | default `false` | System defaults cannot be deleted |
| `sort_order` | smallint | default `0` | Display order |
| `is_active` | boolean | default `true` | |

**System Default Categories (Expense):**

```
Food & Dining       → Groceries, Restaurants, Coffee
Transport           → Fuel, Ride Share, Public Transport, Parking
Housing             → Rent, Utilities, Maintenance, Furniture
Healthcare          → Medicine, Doctor, Hospital, Pharmacy
Education           → Tuition, Books, Courses, Stationery
Shopping            → Clothes, Electronics, Personal Care
Entertainment       → Movies, Games, Hobbies, Sports
Travel              → Hotel, Flight, Tour, Visa
Communication       → Mobile Bill, Internet, Postal
Financial           → EMI, Insurance Premium, Bank Fee, DPS
Family              → Kids, Gifts, Events, Charity
Personal Care       → Salon, Gym, Cosmetics
```

**System Default Categories (Income):**

```
Employment          → Salary, Bonus, Allowance
Business            → Revenue, Profit
Investment          → Dividend, Capital Gain, Interest
Rental              → Property Rent
Freelance           → Project Payment, Consulting
Transfer            → Received Transfer
Other               → Gift, Remittance, Refund
```

---

### 20.2 `attachments`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `file_name` | varchar(255) | NOT NULL | |
| `file_type` | varchar(50) | NOT NULL | `image/jpeg` / `application/pdf` |
| `file_size_bytes` | int | NOT NULL | |
| `storage_path` | varchar(500) | NOT NULL | S3 key or local path |
| `public_url` | varchar(500) | nullable | Signed URL |
| `entity_type` | varchar(50) | nullable | Polymorphic |
| `entity_id` | UUID | nullable | |
| `uploaded_at` | timestamp | NOT NULL | |

---

### 20.3 `tags`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → users |
| `name` | varchar(50) | |
| `color` | varchar(7) | nullable |

---

### 20.4 `audit_logs`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → users |
| `action` | enum | `create` / `update` / `delete` / `restore` |
| `entity_type` | varchar(50) | |
| `entity_id` | UUID | |
| `old_values` | json | nullable |
| `new_values` | json | nullable |
| `ip_address` | varchar(45) | nullable |
| `user_agent` | varchar(255) | nullable |
| `created_at` | timestamp | |

---

## 21. Relationship Summary Matrix

| Entity | Relates To | Cardinality | Relationship Description |
|---|---|---|---|
| User | Account | 1:M | User owns many accounts |
| User | Income | 1:M | User has many income records |
| User | CreditCard | 1:M | User holds many credit cards |
| User | DPS | 1:M | User has multiple DPS schemes |
| User | FDR | 1:M | User has multiple FDRs |
| User | Sanchayapatra | 1:M | User holds multiple certificates |
| User | Investment | 1:M | User has portfolio |
| User | Loan | 1:M | User has multiple loans |
| User | PersonalLending | 1:M | User lends/borrows informally |
| User | Insurance | 1:M | User has multiple policies |
| User | Bill | 1:M | User has recurring bills |
| User | Subscription | 1:M | User has subscriptions |
| User | ProvidentFund | 1:M | User may have multiple PF accounts |
| User | TaxRecord | 1:M | One per fiscal year |
| User | Budget | 1:M | Multiple budgets per category |
| User | Goal | 1:M | Multiple savings goals |
| User | NetWorthSnapshot | 1:M | Monthly snapshots |
| User | RecurringRule | 1:M | Multiple automation rules |
| Account | Transaction | 1:M | Each account has many transactions |
| Account | Transfer | M:M | Transfers link two accounts |
| CreditCard | CreditCardStatement | 1:M | One statement per billing cycle |
| CreditCardStatement | CreditCardPayment | 1:M | Multiple payments per statement |
| DPS | DPSPayment | 1:M | One row per monthly installment |
| FDR | FDRRenewal | 1:M | Multiple renewal cycles |
| Sanchayapatra | InterestPayment | 1:M | Periodic interest payouts |
| Investment | InvestmentTransaction | 1:M | Buy / sell / dividend history |
| Loan | LoanPayment | 1:M | Full amortization schedule |
| PersonalLending | LendingRepayment | 1:M | Partial / full repayments |
| Insurance | PremiumPayment | 1:M | Per-period premium ledger |
| Bill | BillPayment | 1:M | Monthly payment record |
| RecurringRule | Transaction | 1:M | Auto-generated transactions |
| Category | Category | Self:ref | Parent-child subcategory tree |
| Transaction | Attachment | M:M | Via transaction_attachments pivot |
| Transaction | Tag | M:M | Via transaction_tags pivot |

---

## 22. Feature Function Matrix

| Module | Core Functions | Analytics |
|---|---|---|
| **Account** | Balance view, history, multi-currency, archive, export statement | Monthly income/expense, balance trend |
| **Income** | Multi-source income logging, payslip storage, TDS tracking | Source breakdown, YoY comparison |
| **Transaction** | CRUD, split, bulk import, CSV parse, receipt OCR, tagging, verify | Category heatmap, monthly trend |
| **Transfer** | Bank↔Bank, Bank↔Cash, cross-currency, fee logging, reverse | Transfer volume chart |
| **Credit Card** | Utilization gauge, statement view, bill payment, interest projection | Monthly spend per card, payment history |
| **DPS** | Installment calendar, maturity projection, break simulation, miss penalty | Progress bar, projected vs actual |
| **FDR** | Compound interest projection, auto-renewal, maturity alert | FDR maturity timeline |
| **Sanchayapatra** | Interest schedule, TDS tracking, encashment log | Yield comparison |
| **Investment** | Buy/sell/dividend log, portfolio overview, XIRR, price update | P&L chart, allocation pie |
| **Loan** | Amortization schedule, prepayment sim, foreclosure calc | Principal vs interest ratio |
| **Personal Lending** | Lend/borrow log, repayment tracking, write-off | Who owes me / I owe summary |
| **Insurance** | Premium calendar, lapse warning, claim note, maturity projection | Total premium vs coverage |
| **Bills** | Utility reading log, payment tracking, overdue alert | Monthly utility trend |
| **Subscriptions** | Renewal calendar, unused detection, trial alert | Annual subscription cost |
| **PF** | Monthly contribution log, corpus growth, vesting tracker | Corpus trend chart |
| **Tax** | Income aggregation, slab calc, rebate calc, challan log | Tax liability year-over-year |
| **Budget** | Per-category cap, alert threshold, rollover, AI suggestion | Budget vs actual bar chart |
| **Goals** | Contribution log, progress tracker, simulation | Goal completion forecast |
| **Net Worth** | Monthly auto-snapshot, asset/liability breakdown | Net worth trend (12m / 5y) |
| **Recurring** | Auto-log, upcoming calendar, skip/pause, edit | Upcoming obligations timeline |
| **Notifications** | Due date alerts, budget alerts, maturity alerts, goal achieved | Alert history log |

---

## 23. Key Financial Formulas

### DPS Maturity Value
```
M = P × n + P × [n(n+1)/2] × (r/12)
P = monthly installment
n = tenure months
r = annual interest rate (decimal)
```

### FDR Compound Interest
```
M = P × (1 + r/n)^(n×t)
P = principal
r = annual rate (decimal)
n = compounding frequency per year
t = years
```

### Loan EMI — Reducing Balance
```
EMI = P × [r(1+r)^n] / [(1+r)^n − 1]
P = outstanding principal
r = monthly rate = annual_rate / 12 / 100
n = remaining months
```

### Loan EMI — Flat Rate
```
EMI = (P + P × rate × years) / (years × 12)
```

### Credit Card Monthly Interest
```
Interest = Unpaid_Balance × (annual_rate / 12 / 100)
Unpaid_Balance = closing_balance − payments_made_before_due
```

### Investment Return (Simple)
```
Return% = ((current_value − total_invested) / total_invested) × 100
```

### Credit Card Utilization
```
Utilization% = (current_outstanding / credit_limit) × 100
Target: Keep below 30%
```

### Net Worth
```
Net Worth = Total Assets − Total Liabilities

Assets     = Cash + Bank + MF + DPS (deposited) + FDR + Sanchayapatra + Investments + PF + Goal Savings
Liabilities = Loan Outstanding + CC Outstanding + Personal Borrowings
```

### Goal Monthly Savings Required
```
Monthly_Required = (target_amount − current_amount) / months_until_target
```

### Tax Investment Rebate (BD)
```
Allowable = min(actual_investment, 25% of gross_income, BDT 15,000,000)
Rebate = Allowable × 15%
Net Tax = Slab_Tax − Rebate − TDS_Deducted
```

---

## 24. Development Priority Tiers

| Tier | Module | Justification |
|---|---|---|
| 🔴 **P0 — MVP Core** | Account | Foundation of everything |
| 🔴 **P0 — MVP Core** | Transaction (Expense) | Primary daily use |
| 🔴 **P0 — MVP Core** | Income | Required for P&L, tax, net worth |
| 🔴 **P0 — MVP Core** | Transfer | Essential for multi-account users |
| 🔴 **P0 — MVP Core** | Category | Required for every transaction |
| 🔴 **P0 — MVP Core** | Budget | Core behavioral feature |
| 🔴 **P0 — MVP Core** | Recurring Rules | Reduces manual entry friction |
| 🟠 **P1 — Phase 1** | Credit Card | Extremely common, high complexity |
| 🟠 **P1 — Phase 1** | Loan | High stakes — EMI tracking critical |
| 🟠 **P1 — Phase 1** | DPS | BD standard savings product |
| 🟠 **P1 — Phase 1** | Personal Lending | Very common informal BD finance |
| 🟠 **P1 — Phase 1** | Net Worth Snapshot | Key reporting milestone |
| 🟠 **P1 — Phase 1** | Notifications | Drives engagement and retention |
| 🟡 **P2 — Phase 2** | FDR | Common BD banking product |
| 🟡 **P2 — Phase 2** | Sanchayapatra | BD-specific, very popular |
| 🟡 **P2 — Phase 2** | Insurance | Risk tracking, premium calendar |
| 🟡 **P2 — Phase 2** | Bills & Subscriptions | UX quality, reduces missed payments |
| 🟡 **P2 — Phase 2** | Goals | Behavioral finance motivation |
| 🟡 **P2 — Phase 2** | Tax Module | Legal compliance need |
| 🟢 **P3 — Phase 3** | Investment Portfolio | Complex, DSE API integration |
| 🟢 **P3 — Phase 3** | Provident Fund | Niche but important for salaried |
| 🟢 **P3 — Phase 3** | Cash Flow Forecast | Advanced predictive analytics |
| 🟢 **P3 — Phase 3** | Statement Import (CSV/PDF) | Power user feature |
| 🟢 **P3 — Phase 3** | Multi-Currency Engine | For foreign income / travel |

---

*End of Specification — v1.0.0*  
*Next Steps: Laravel Migration Set → ERD (Mermaid) → API Contract (OpenAPI 3.0) → React UI Flow*
