const pool = require('../db/connection');

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function plusDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
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

    // Accounts
    const [accountsResult] = await conn.query(
      `INSERT INTO accounts (user_id, name, type, balance) VALUES ?`,
      [[
        [userId, 'DBBL Savings', 'bank', 45000.0],
        [userId, 'bKash', 'mobile_banking', 8500.0],
        [userId, 'Cash', 'cash', 3200.0],
      ]],
    );
    const firstAccountId = accountsResult.insertId;
    const dbblId = firstAccountId; // first row
    const bkashId = firstAccountId + 1;
    const cashId = firstAccountId + 2;

    // Credit cards
    await conn.query(
      `INSERT INTO credit_cards (user_id, name, limit_amt, due_amount, due_date) VALUES ?`,
      [[
        [userId, 'BRAC Visa Gold', 100000.0, 18750.0, plusDays(15)],
        [userId, 'City Bank Amex', 50000.0, 6200.0, plusDays(20)],
      ]],
    );

    // Loan
    const [loanRes] = await conn.query(
      `INSERT INTO loans (user_id, name, principal, remaining, monthly_emi, interest_rate)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, 'Home Loan', 200000.0, 200000.0, 8500.0, 9.5],
    );
    const loanId = loanRes.insertId;

    // DPS
    const [dpsRes] = await conn.query(
      `INSERT INTO dps (user_id, name, monthly_amount, total_deposited, maturity_amount, start_date, maturity_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, 'Islami Bank DPS', 5000.0, 15000.0, 180000.0, plusYears(-1).slice(0, 10), plusYears(2)],
    );
    const dpsId = dpsRes.insertId;

    // 20 realistic transactions over the last ~30 days.
    // Tuples: [user_id, account_id, type, amount, category, description, ref_type, ref_id, created_at]
    const tx = [
      [userId, dbblId,  'credit', 80000.0, 'Salary',     'Monthly salary credit',       'salary',         null,   daysAgo(28)],
      [userId, dbblId,  'debit',   5000.0, 'Savings',    'DPS installment - Islami Bank','dps',            dpsId,  daysAgo(28)],
      [userId, dbblId,  'debit',   8500.0, 'Loan',       'Home Loan EMI',                'loan_repayment', loanId, daysAgo(28)],
      [userId, bkashId, 'debit',   1850.0, 'Food',       'Grocery - Shwapno',            'expense',        null,   daysAgo(26)],
      [userId, bkashId, 'debit',    320.0, 'Transport',  'Pathao ride',                  'expense',        null,   daysAgo(25)],
      [userId, dbblId,  'debit',   2400.0, 'Utilities',  'DESCO electricity bill',       'expense',        null,   daysAgo(24)],
      [userId, bkashId, 'debit',    750.0, 'Food',       'Dinner at Sultans',            'expense',        null,   daysAgo(23)],
      [userId, bkashId, 'debit',    300.0, 'Transport',  'Uber to office',               'expense',        null,   daysAgo(22)],
      [userId, dbblId,  'debit',   3500.0, 'Shopping',   'Daraz - Headphones',           'expense',        null,   daysAgo(21)],
      [userId, cashId,  'debit',    220.0, 'Food',       'Tea & snacks',                 'expense',        null,   daysAgo(20)],
      [userId, bkashId, 'debit',    549.0, 'Utilities',  'Mobile recharge - GP',         'expense',        null,   daysAgo(18)],
      [userId, bkashId, 'debit',   1200.0, 'Health',     'Pharmacy - Lazz',              'expense',        null,   daysAgo(17)],
      [userId, dbblId,  'debit',   4500.0, 'Shopping',   'Aarong - Clothing',            'expense',        null,   daysAgo(15)],
      [userId, cashId,  'debit',    150.0, 'Transport',  'CNG to home',                  'expense',        null,   daysAgo(14)],
      [userId, dbblId,  'debit',   5000.0, 'Others',     'ATM withdrawal',               'expense',        null,   daysAgo(12)],
      [userId, bkashId, 'debit',    980.0, 'Food',       'Pizza Hut',                    'expense',        null,   daysAgo(10)],
      [userId, bkashId, 'debit',    650.0, 'Transport',  'Pathao bike',                  'expense',        null,   daysAgo(8)],
      [userId, dbblId,  'debit',   1800.0, 'Utilities',  'Internet bill - Link3',        'expense',        null,   daysAgo(6)],
      [userId, bkashId, 'debit',    420.0, 'Food',       'Coffee - North End',           'expense',        null,   daysAgo(4)],
      [userId, dbblId,  'debit',   2750.0, 'Shopping',   'Online - Pickaboo',            'expense',        null,   daysAgo(2)],
    ];

    await conn.query(
      `INSERT INTO transactions
        (user_id, account_id, type, amount, category, description, ref_type, ref_id, created_at)
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
