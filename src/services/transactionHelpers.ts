import { getAccountById } from './accountService';
import {
  AccountNotFoundError,
  UnsupportedTransactionTypeError,
  TransactionNotFoundError,
  InvalidRefundTransactionError
} from '../utils/error';
import { PoolClient } from '../../src/config/database';

interface Transaction {
  id: string;
  from_account_id: string;
  to_account_id: string | null;
  type: string;
  amount: number;
  reference_transaction_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export function validateRefundTransaction(transaction: Transaction): void {
  if (transaction.type === 'refund' || transaction.reference_transaction_id) {
    throw new InvalidRefundTransactionError(
      'Cannot refund a refund transaction'
    );
  }
}

export async function getTransactionById(
  transactionId: string,
  client: PoolClient
): Promise<Transaction> {
  try {
    const result = await client.query(
      'SELECT * FROM transactions WHERE id = $1',
      [transactionId]
    );
    if (result.rows.length === 0) {
      throw new TransactionNotFoundError(transactionId);
    }
    return result.rows[0];
  } catch (error) {
    if (error instanceof TransactionNotFoundError) {
      throw error;
    }
    throw new TransactionNotFoundError(transactionId);
  }
}

export async function reverseTransaction(
  transaction: Transaction,
  client: PoolClient
): Promise<void> {
  const fromAccount = await getAccountById(transaction.from_account_id);
  const toAccount = transaction.to_account_id
    ? await getAccountById(transaction.to_account_id)
    : null;

  if (!fromAccount || (transaction.to_account_id && !toAccount)) {
    throw new AccountNotFoundError(transaction.from_account_id);
  }

  switch (transaction.type) {
    case 'deposit':
      await client.query(
        'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
        [transaction.amount, transaction.from_account_id]
      );
      break;
    case 'withdrawal':
      await client.query(
        'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
        [transaction.amount, transaction.from_account_id]
      );
      break;
    case 'transfer':
      if (toAccount) {
        await client.query(
          'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
          [transaction.amount, transaction.from_account_id]
        );
        await client.query(
          'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
          [transaction.amount, transaction.to_account_id]
        );
      } else {
        throw new AccountNotFoundError(transaction.to_account_id || '');
      }
      break;
    default:
      throw new UnsupportedTransactionTypeError(transaction.type);
  }
}

export async function createRefundTransaction(
  transaction: Transaction,
  client: PoolClient
): Promise<Transaction> {
  let refundType: string;
  let fromAccountId: string | null = null;
  let toAccountId: string | null = null;

  switch (transaction.type) {
    case 'deposit':
      refundType = 'withdrawal';
      fromAccountId = transaction.from_account_id;
      break;
    case 'withdrawal':
      refundType = 'deposit';
      toAccountId = transaction.from_account_id;
      break;
    case 'transfer':
      refundType = 'transfer';
      fromAccountId = transaction.to_account_id;
      toAccountId = transaction.from_account_id;
      break;
    default:
      throw new UnsupportedTransactionTypeError(transaction.type);
  }

  const result = await client.query(
    'INSERT INTO transactions (from_account_id, to_account_id, type, amount, reference_transaction_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *',
    [fromAccountId, toAccountId, refundType, transaction.amount, transaction.id]
  );
  return result.rows[0];
}
