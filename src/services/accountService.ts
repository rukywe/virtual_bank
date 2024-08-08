import { pool } from '../config/database';
import { AccountNotFoundError, InvalidAccountNameError } from '../utils/error';
import logger from '../utils/logger';

interface Account {
  id: string;
  name: string;
  balance: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Creates a new bank account.
 * @param {string} name - The name of the account holder.
 * @returns {Promise<Account>} The newly created account.
 * @throws {InvalidAccountNameError} If the account name is invalid.
 */
export async function createAccount(name: string): Promise<Account> {
  if (!name || name.trim().length === 0) {
    throw new InvalidAccountNameError('Account name cannot be empty');
  }

  try {
    const INITIAL_ACCOUNT_BALANCE = 0.0;
    const result = await pool.query(
      'INSERT INTO accounts (name, balance, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING *',
      [name, INITIAL_ACCOUNT_BALANCE]
    );
    const account = result.rows[0];
    logger.info(`Account created for ${name}`);
    return account;
  } catch (error) {
    logger.error(`Error creating account: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Retrieves an account by its ID.
 * @param {string} accountId - The unique identifier of the account.
 * @returns {Promise<Account | null>} The account if found, null otherwise.
 * @throws {Error} If there's a database error during the query.
 */
export async function getAccountById(
  accountId: string
): Promise<Account | null> {
  try {
    const result = await pool.query('SELECT * FROM accounts WHERE id = $1', [
      accountId
    ]);
    if (result.rows.length === 0) {
      logger.warn(`Account with ID ${accountId} not found`);
      return null;
    }
    return result.rows[0];
  } catch (error) {
    logger.error(`Error retrieving account: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Gets the balance of an account.
 * @param {string} accountId - The unique identifier of the account.
 * @returns {Promise<number>} The balance of the account.
 * @throws {Error} If the account is not found or if there's a database error.
 */
export async function getAccountBalance(accountId: string): Promise<number> {
  const account = await getAccountById(accountId);
  if (!account) {
    throw new AccountNotFoundError(accountId);
  }
  return account.balance;
}
