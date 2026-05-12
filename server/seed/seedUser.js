const pool = require('../db/connection');

function dateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function plusYears(n) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + n);
  return d.toISOString().slice(0, 10);
}

async function seedNewUser(userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ── Accounts ─────────────────────────────────────────────────────────────
    const [accountsResult] = await conn.query(
      `INSERT INTO accounts (user_id, name, type, current_balance, opening_balance, currency) VALUES ?`,
      [[
        [userId, 'DBBL Savings',  'bank',           45000.00, 45000.00, 'BDT'],
        [userId, 'bKash',         'mobile_banking',  8500.00,  8500.00, 'BDT'],
        [userId, 'Cash',          'cash',             3200.00,  3200.00, 'BDT'],
      ]],
    );
    const firstAccountId = accountsResult.insertId;
    const dbblId  = firstAccountId;
    const bkashId = firstAccountId + 1;
    const cashId  = firstAccountId + 2;

    // ── Credit cards ─────────────────────────────────────────────────────────
    await conn.query(
      `INSERT INTO credit_cards
        (user_id, issuer, card_name, card_type, credit_limit, current_outstanding, billing_cycle_day, payment_due_day, annual_interest_rate)
       VALUES ?`,
      [[
        [userId, 'BRAC Bank',  'BRAC Visa Gold',    'visa',       100000.00, 18750.00, 1,  15, 24.00],
        [userId, 'City Bank',  'City Bank Amex',    'amex',        50000.00,  6200.00, 1,  20, 22.00],
      ]],
    );

    // ── Loans ─────────────────────────────────────────────────────────────────
    const [loanRes] = await conn.query(
      `INSERT INTO loans
        (user_id, lender_name, loan_type, principal_amount, outstanding_balance, annual_interest_rate, interest_type, tenure_months, emi_amount, disbursement_date, first_emi_date, repayment_account_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, 'DBBL', 'home', 2000000.00, 1850000.00, 9.50, 'reducing_balance', 240, 18500.00, plusYears(-1), dateStr(1), dbblId],
    );
    const loanId = loanRes.insertId;

    // ── DPS ───────────────────────────────────────────────────────────────────
    const [dpsRes] = await conn.query(
      `INSERT INTO dps
        (user_id, institution_name, dps_account_number, linked_account_id, installment_amount, annual_interest_rate, tenure_months, start_date, maturity_date, total_deposited, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, 'Islami Bank', 'DPS-2023-001', bkashId, 5000.00, 12.00, 60, plusYears(-1), plusYears(4), 60000.00, 'active'],
    );
    const dpsId = dpsRes.insertId;

    // ── Transactions (20 realistic entries) ───────────────────────────────────
    // Columns: user_id, account_id, type, amount, currency, transaction_date, category_id, source_type, payee, notes, ref_type, ref_id
    const tx = [
      [userId, dbblId,  'income',   80000.00, 'BDT', dateStr(-28), 'Salary',    'account', 'DBBL Salary',       'Monthly salary credit',        'salary',         null  ],
      [userId, dbblId,  'expense',   5000.00, 'BDT', dateStr(-28), 'Savings',   'account', 'Islami Bank',       'DPS installment',              'dps',            dpsId ],
      [userId, dbblId,  'expense',  18500.00, 'BDT', dateStr(-28), 'Loan',      'account', 'DBBL Home Loan',    'Home Loan EMI',                'loan_repayment', loanId],
      [userId, bkashId, 'expense',   1850.00, 'BDT', dateStr(-26), 'Food',      'account', 'Shwapno',           'Grocery shopping',             'expense',        null  ],
      [userId, bkashId, 'expense',    320.00, 'BDT', dateStr(-25), 'Transport', 'account', 'Pathao',            'Pathao ride',                  'expense',        null  ],
      [userId, dbblId,  'expense',   2400.00, 'BDT', dateStr(-24), 'Utilities', 'account', 'DESCO',             'Electricity bill',             'expense',        null  ],
      [userId, bkashId, 'expense',    750.00, 'BDT', dateStr(-23), 'Food',      'account', "Sultan's Dine",     'Dinner at Sultans',            'expense',        null  ],
      [userId, bkashId, 'expense',    300.00, 'BDT', dateStr(-22), 'Transport', 'account', 'Uber',              'Uber to office',               'expense',        null  ],
      [userId, dbblId,  'expense',   3500.00, 'BDT', dateStr(-21), 'Shopping',  'account', 'Daraz',             'Online - Headphones',          'expense',        null  ],
      [userId, cashId,  'expense',    220.00, 'BDT', dateStr(-20), 'Food',      'cash',    'Local stall',       'Tea & snacks',                 'expense',        null  ],
      [userId, bkashId, 'expense',    549.00, 'BDT', dateStr(-18), 'Utilities', 'account', 'Grameenphone',      'Mobile recharge',              'expense',        null  ],
      [userId, bkashId, 'expense',   1200.00, 'BDT', dateStr(-17), 'Health',    'account', 'Lazz Pharma',       'Pharmacy purchase',            'expense',        null  ],
      [userId, dbblId,  'expense',   4500.00, 'BDT', dateStr(-15), 'Shopping',  'account', 'Aarong',            'Clothing',                     'expense',        null  ],
      [userId, cashId,  'expense',    150.00, 'BDT', dateStr(-14), 'Transport', 'cash',    'CNG',               'CNG to home',                  'expense',        null  ],
      [userId, dbblId,  'expense',   5000.00, 'BDT', dateStr(-12), 'Others',    'account', 'ATM',               'ATM withdrawal',               'expense',        null  ],
      [userId, bkashId, 'expense',    980.00, 'BDT', dateStr(-10), 'Food',      'account', 'Pizza Hut',         'Pizza Hut',                    'expense',        null  ],
      [userId, bkashId, 'expense',    650.00, 'BDT', dateStr(-8),  'Transport', 'account', 'Pathao',            'Pathao bike',                  'expense',        null  ],
      [userId, dbblId,  'expense',   1800.00, 'BDT', dateStr(-6),  'Utilities', 'account', 'Link3 Internet',    'Internet bill',                'expense',        null  ],
      [userId, bkashId, 'expense',    420.00, 'BDT', dateStr(-4),  'Food',      'account', 'North End Coffee',  'Coffee',                       'expense',        null  ],
      [userId, dbblId,  'expense',   2750.00, 'BDT', dateStr(-2),  'Shopping',  'account', 'Pickaboo',          'Online shopping',              'expense',        null  ],
    ];

    await conn.query(
      `INSERT INTO transactions
        (user_id, account_id, type, amount, currency, transaction_date, category_id, source_type, payee, notes, ref_type, ref_id)
       VALUES ?`,
      [tx],
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { seedNewUser };
