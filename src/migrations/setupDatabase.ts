import { pool } from '../config/database';
import logger from '../utils/logger';
import { isError } from '../utils/typeGuards';

async function setupDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    logger.info('Accounts table created or already exists.');

    // Create the transactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_account_id UUID REFERENCES accounts(id),
        to_account_id UUID REFERENCES accounts(id),
        type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'transfer', 'refund')),
        amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
        reference_transaction_id UUID REFERENCES transactions(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    logger.info('Transactions table created or already exists.');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_from_account_id ON transactions(from_account_id);
    `);
    logger.info('Index on from_account_id created or already exists.');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_to_account_id ON transactions(to_account_id);
    `);
    logger.info('Index on to_account_id created or already exists.');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    `);
    logger.info('Index on type created or already exists.');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
    `);
    logger.info('Index on created_at created or already exists.');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_reference_transaction_id ON transactions(reference_transaction_id);
    `);
    logger.info('Index on reference_transaction_id created or already exists.');

    logger.info('Database setup completed.');
  } catch (error) {
    if (isError(error)) {
      logger.error(`Error setting up database: ${error.message}`);
    } else {
      logger.error('An unknown error occurred while setting up the database.');
    }
  } finally {
    await pool.end();
  }
}

setupDatabase();
