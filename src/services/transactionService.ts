import { pool } from '../config/database';
import {
  AccountNotFoundError,
  DatabaseError,
  InsufficientBalanceError,
  InvalidRefundTransactionError
} from '../utils/error';
import logger from '../utils/logger';
import { getAccountById } from './accountService';
import {
  getTransactionById,
  validateRefundTransaction,
  reverseTransaction,
  createRefundTransaction
} from './transactionHelpers';

interface Transaction {
  id: string;
  from_account_id: string | null;
  to_account_id: string | null;
  type: string;
  amount: number;
  reference_transaction_id: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Makes a deposit to an account.
 * @param {string} accountId - The ID of the account to deposit to.
 * @param {number} amount - The amount to deposit.
 * @returns {Promise<Transaction>} The transaction record of the deposit.
 * @throws {AccountNotFoundError} If the account doesn't exist.
 * @throws {Error} If there's a database error during the transaction.
 */
export async function makeDeposit(
  accountId: string,
  amount: number
): Promise<Transaction> {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const account = await getAccountById(accountId);
      if (!account) {
        throw new AccountNotFoundError(accountId);
      }
      await client.query(
        'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
        [amount, accountId]
      );
      const result = await client.query(
        'INSERT INTO transactions (from_account_id, type, amount, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *',
        [accountId, 'deposit', amount]
      );
      await client.query('COMMIT');
      logger.info(`Deposit of ${amount} made to account ${accountId}`);
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error making deposit: ${(error as Error).message}`);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error(`Transaction error: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Makes a withdrawal from an account.
 * @param {string} accountId - The ID of the account to withdraw from.
 * @param {number} amount - The amount to withdraw.
 * @param {boolean} [allowNegative=false] - Whether to allow the balance to go negative.
 * @returns {Promise<Transaction>} The transaction record of the withdrawal.
 * @throws {AccountNotFoundError} If the account doesn't exist.
 * @throws {InsufficientBalanceError} If the account has insufficient funds and negative balance is not allowed.
 * @throws {Error} If there's a database error during the transaction.
 */
export async function makeWithdrawal(
  accountId: string,
  amount: number,
  allowNegative = false
): Promise<Transaction> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const account = await getAccountById(accountId);
    if (!account) {
      throw new AccountNotFoundError(accountId);
    }

    if (!allowNegative && account.balance < amount) {
      throw new InsufficientBalanceError(accountId, amount);
    }

    await client.query(
      'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
      [amount, accountId]
    );
    const result = await client.query(
      'INSERT INTO transactions (from_account_id, type, amount, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *',
      [accountId, 'withdrawal', amount]
    );

    await client.query('COMMIT');
    logger.info(`Withdrawal of ${amount} made from account ${accountId}`);
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Error making withdrawal: ${(error as Error).message}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Transfers funds between two accounts.
 * @param {string} fromAccountId - The ID of the account to transfer from.
 * @param {string} toAccountId - The ID of the account to transfer to.
 * @param {number} amount - The amount to transfer.
 * @param {boolean} [allowNegative=false] - Whether to allow the source account balance to go negative.
 * @returns {Promise<Transaction>} The transaction record of the transfer.
 * @throws {AccountNotFoundError} If either account doesn't exist.
 * @throws {InsufficientBalanceError} If the source account has insufficient funds and negative balance is not allowed.
 * @throws {Error} If there's a database error during the transaction.
 */
export async function transferFunds(
  fromAccountId: string,
  toAccountId: string,
  amount: number,
  allowNegative = false
): Promise<Transaction> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const fromAccount = await getAccountById(fromAccountId);
    const toAccount = await getAccountById(toAccountId);
    if (!fromAccount || !toAccount) {
      throw new AccountNotFoundError(fromAccountId || toAccountId);
    }

    if (!allowNegative && fromAccount.balance < amount) {
      throw new InsufficientBalanceError(fromAccountId, amount);
    }

    await client.query(
      'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
      [amount, fromAccountId]
    );

    await client.query(
      'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
      [amount, toAccountId]
    );

    const result = await client.query(
      'INSERT INTO transactions (from_account_id, to_account_id, type, amount, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *',
      [fromAccountId, toAccountId, 'transfer', amount]
    );

    await client.query('COMMIT');
    logger.info(
      `Transfer of ${amount} from account ${fromAccountId} to account ${toAccountId}`
    );
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Error making transfer: ${(error as Error).message}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Refunds a transaction.
 * @param {string} transactionId - The ID of the transaction to refund.
 * @returns {Promise<Transaction>} The transaction record of the refund.
 * @throws {InvalidRefundTransactionError} If the transaction is not eligible for refund.
 * @throws {Error} If there's a database error during the transaction or validation fails.
 */
export async function refundTransaction(
  transactionId: string
): Promise<Transaction> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const transaction = await getTransactionById(transactionId, client);

    try {
      validateRefundTransaction(transaction);
    } catch (error) {
      if (error instanceof InvalidRefundTransactionError) {
        throw error;
      }
      throw new Error(
        `Error validating transaction: ${(error as Error).message}`
      );
    }

    await reverseTransaction(transaction, client);
    const refundTransaction = await createRefundTransaction(
      transaction,
      client
    );

    await client.query(
      'UPDATE transactions SET reference_transaction_id = $1 WHERE id = $2',
      [refundTransaction.id, transactionId]
    );

    await client.query('COMMIT');
    logger.info(`Refund of transaction ${transactionId} completed`);
    return refundTransaction;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof InvalidRefundTransactionError) {
      logger.warn(`Attempted to refund a refund: ${transactionId}`);
    } else {
      logger.error(`Error refunding transaction: ${(error as Error).message}`);
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Retrieves the transaction history for an account.
 * @param {string} accountId - The ID of the account to get the history for.
 * @returns {Promise<Transaction[]>} An array of transaction records.
 * @throws {DatabaseError} If there's an error retrieving the transaction history.
 */
export async function getTransactionHistory(
  accountId: string
): Promise<Transaction[]> {
  try {
    const query = `
        SELECT * FROM transactions 
        WHERE from_account_id = $1 OR to_account_id = $1
        ORDER BY created_at DESC
      `
      .replace(/\s+/g, ' ')
      .trim();

    const result = await pool.query(query, [accountId]);
    return result.rows;
  } catch (error) {
    throw new DatabaseError(
      `Error retrieving transaction history: ${(error as Error).message}`
    );
  }
}
