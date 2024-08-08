import { pool } from './config/database';
import dotenv from 'dotenv';
import logger from './utils/logger';

dotenv.config();

logger.info('Database URL:', process.env.DATABASE_URL);

async function verifyDatabaseConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    logger.info(
      'Database connection successful. Current time:',
      result.rows[0].now
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error('Database connection error:', error.message);
    } else {
      logger.error('An unknown error occurred:', String(error));
    }
  } finally {
    await pool.end();
  }
}

verifyDatabaseConnection();
