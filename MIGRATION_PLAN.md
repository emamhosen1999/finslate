# Finslate — ERD Audit-Based Migration Plan

> **Source of truth:** `server/db/migrate.js` (authoritative ERD schema)  
> **Audit doc:** `.windsurf/plans/erd-audit-68e6f2.md`

---

## Completed ✅

### P0 — Critical Runtime Fixes (all done)
- [x] `personalLending.js` backend — `outstanding_balance` dropped → computed via subquery; `start_date` → `given_date`; removed all stale column refs
- [x] `PersonalLending.jsx` frontend — remapped 7 field names to ERD columns (`counterparty_phone`, `principal`, `annual_interest_rate`, `given_date`, `expected_return_date`, `note`, status `outstanding`)
- [x] `goals.js` backend — `contribution_date` → `date` in ORDER BY; `notes` → `note` in POST/PUT
- [x] `Goals.jsx` frontend — `contribution_date` → `date`, `completed` → `achieved`, category enum aligned, `notes` → `note`
- [x] `netWorth.js` — 3 personal_lendings queries fixed (computed outstanding_balance)
- [x] `analytics.js` — 1 personal_lendings query fixed (computed outstanding_balance)

### P1 — Data Integrity Fixes (all done)
- [x] `migrate.js` — `budgets.category_id` changed from `INT` to `VARCHAR(80)`, FK to `categories` removed
- [x] `auth.js` delete-account — added 15+ missing child table cleanups (lending_repayments, goal_contributions, loan_payments, fdr_renewals, insurance_premium_payments, sanchayapatra_interest_payments, investment_transactions, investment_snapshots, recurring_rules, reports, insurances)

### Previously Completed (Phases 2B–3E)
- [x] CSS responsive layout (sm/md/lg/xl breakpoints)
- [x] Dashboard, Accounts, Transactions, Budgets, Income pages
- [x] CreditCards, Loans, DPS, FDR, Sanchayapatra pages
- [x] Investments, Insurance, PersonalLending, PF, TaxRecords pages
- [x] Goals, NetWorth, Bills, Subscriptions, Notifications, Analytics, Profile pages

---

## Verified Aligned (20+ tables) ✅

| Table | Backend | Frontend |
|-------|---------|----------|
| `users` | `auth.js` ✅ | `Profile.jsx` ✅ |
| `accounts` | `accounts.js` ✅ | `Accounts.jsx` ✅ |
| `credit_cards` | `creditCards.js` ✅ | `CreditCards.jsx` ✅ |
| `loans` | `loan.js` ✅ | `Loan.jsx` ✅ |
| `transactions` | `transactions.js` ✅ | `Transactions.jsx` ✅ |
| `transfers` | `transfers.js` ✅ | — |
| `dps` | `dps.js` ✅ | `DPS.jsx` ✅ |
| `fixed_deposits` | `fixedDeposits.js` ✅ | `FixedDeposits.jsx` ✅ |
| `sanchayapatra` | `sanchayapatra.js` ✅ | `Sanchayapatra.jsx` ✅ |
| `investments` | `investments.js` ✅ | `Investments.jsx` ✅ |
| `insurances` | `insurance.js` ✅ | `Insurance.jsx` ✅ |
| `personal_lendings` | `personalLending.js` ✅ | `PersonalLending.jsx` ✅ |
| `goals` | `goals.js` ✅ | `Goals.jsx` ✅ |
| `tax_records` | `taxRecords.js` ✅ | `TaxRecords.jsx` ✅ |
| `provident_fund` | `providentFund.js` ✅ | `ProvidentFund.jsx` ✅ |
| `net_worth_snapshots` | `netWorth.js` ✅ | `NetWorth.jsx` ✅ |
| `notifications` | `notifications.js` ✅ | `Notifications.jsx` ✅ |
| `bills` | `bills.js` ✅ | `Bills.jsx` ✅ |
| `subscriptions` | `subscriptions.js` ✅ | `Subscriptions.jsx` ✅ |
| `budgets` | `budgets.js` ✅ | `Budgets.jsx` ✅ |
| `currencies` | `currencies.js` ✅ | `CurrencyManagement.jsx` ✅ |
| `recurring_transactions` | `recurringTransactions.js` ✅ | `RecurringTransactions.jsx` ✅ |
| `income_sources` | `incomeSources.js` ✅ | `IncomeSources.jsx` ✅ |

---

## P2 — Completed ✅

### P2-1: Deprecate `insurance_premiums` table — safe (no-op)
- `insurances` table is fully active; legacy table has no writes
- `auth.js` delete-account deletes from both (harmless safety measure)

### P2-2: Migrate `income_sources` → `incomes` — DONE
- [x] Created `server/routes/incomes.js` — full CRUD + sub-detail tables (salary, freelance, rental, dividend)
- [x] Rewrote `IncomeSources.jsx` to use `incomes` table with source_type enum, gross/tds/deductions, conditional sub-detail forms
- [x] Wired `/api/incomes` in server/index.js and client/src/api/client.js
- [x] Legacy `/api/income-sources` route preserved for backward compat

### P2-3: Migrate `recurring_transactions` → `recurring_rules` — DONE
- [x] Created `server/routes/recurringRules.js` — full CRUD + process endpoint with all ERD frequencies (daily/weekly/bi_weekly/monthly/quarterly/yearly)
- [x] Rewrote `RecurringTransactions.jsx` to use `recurring_rules` table with rule_type enum, is_active toggle, day_of_month, source/dest accounts
- [x] Wired `/api/recurring-rules` in server/index.js and client/src/api/client.js
- [x] Legacy `/api/recurring-transactions` route preserved for backward compat

---

## Remaining — Schema-only tables (no route/UI)

| Table | Status |
|-------|--------|
| `fdr_renewals` | Schema only |
| `tags` / `transaction_tags` | Schema only |
| `attachments` / `transaction_attachments` | Schema only |
| `categories` | Schema only (unused — budgets.category_id is now VARCHAR) |
