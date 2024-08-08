import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const MAX_RETRIES = 5;
const RETRY_INTERVAL = 5000;

async function connectWithRetry(retries = MAX_RETRIES): Promise<void> {
  try {
    await pool.connect();
    console.log('Successfully connected to the database');
  } catch (err) {
    console.error('Failed to connect to the database:', err);
    if (retries > 0) {
      console.log(`Retrying in ${RETRY_INTERVAL / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL));
      await connectWithRetry(retries - 1);
    } else {
      console.error('Max retries reached. Exiting...');
      process.exit(1);
    }
  }
}

export { pool, PoolClient, connectWithRetry };
