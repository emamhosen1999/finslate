const pool = require('../db/connection');

async function createBudgetsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS budgets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        category VARCHAR(100) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        period VARCHAR(20) DEFAULT 'monthly',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('Budgets table created successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error creating budgets table:', err);
    process.exit(1);
  }
}

createBudgetsTable();
