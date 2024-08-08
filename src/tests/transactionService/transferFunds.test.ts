import { transferFunds } from '../../services/transactionService';
import * as accountService from '../../services/accountService';
import { pool } from '../../config/database';
import {
  AccountNotFoundError,
  InsufficientBalanceError
} from '../../utils/error';

jest.mock('../../config/database', () => ({
  pool: {
    connect: jest.fn().mockReturnThis(),
    query: jest.fn(),
    release: jest.fn()
  }
}));

jest.mock('../../services/accountService');

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('Transaction Function', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should transfer funds successfully', async () => {
    const mockFromAccount = {
      id: '123',
      name: 'From Account',
      balance: 100,
      created_at: new Date(),
      updated_at: new Date()
    };

    const mockToAccount = {
      id: '456',
      name: 'To Account',
      balance: 50,
      created_at: new Date(),
      updated_at: new Date()
    };

    const mockTransaction = {
      id: '789',
      from_account_id: '123',
      to_account_id: '456',
      type: 'transfer',
      amount: 50,
      reference_transaction_id: null,
      created_at: new Date(),
      updated_at: new Date()
    };

    (accountService.getAccountById as jest.Mock)
      .mockResolvedValueOnce(mockFromAccount)
      .mockResolvedValueOnce(mockToAccount);

    (pool.query as jest.Mock)
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE from balance
      .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE to balance
      .mockResolvedValueOnce({ rows: [mockTransaction] }) // INSERT transaction
      .mockResolvedValueOnce(undefined); // COMMIT

    const result = await transferFunds('123', '456', 50);
    expect(result).toEqual(mockTransaction);

    expect(accountService.getAccountById).toHaveBeenCalledWith('123');
    expect(accountService.getAccountById).toHaveBeenCalledWith('456');
    expect(pool.query).toHaveBeenCalledWith('BEGIN');
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
      [50, '123']
    );
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
      [50, '456']
    );
    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO transactions (from_account_id, to_account_id, type, amount, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *',
      ['123', '456', 'transfer', 50]
    );
    expect(pool.query).toHaveBeenCalledWith('COMMIT');
  });

  it('should allow transfer to cause negative balance if allowNegative is true', async () => {
    const mockFromAccount = {
      id: '123',
      name: 'From Account',
      balance: 30,
      created_at: new Date(),
      updated_at: new Date()
    };

    const mockToAccount = {
      id: '456',
      name: 'To Account',
      balance: 50,
      created_at: new Date(),
      updated_at: new Date()
    };

    const mockTransaction = {
      id: '789',
      from_account_id: '123',
      to_account_id: '456',
      type: 'transfer',
      amount: 50,
      reference_transaction_id: null,
      created_at: new Date(),
      updated_at: new Date()
    };

    (accountService.getAccountById as jest.Mock)
      .mockResolvedValueOnce(mockFromAccount)
      .mockResolvedValueOnce(mockToAccount);

    (pool.query as jest.Mock)
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE from balance
      .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE to balance
      .mockResolvedValueOnce({ rows: [mockTransaction] }) // INSERT transaction
      .mockResolvedValueOnce(undefined); // COMMIT

    const result = await transferFunds('123', '456', 50, true);
    expect(result).toEqual(mockTransaction);
    expect(pool.query).toHaveBeenCalledWith('BEGIN');
    expect(pool.query).toHaveBeenCalledWith('COMMIT');
  });

  it('should throw InsufficientBalanceError if balance is too low without allowNegative', async () => {
    const mockFromAccount = {
      id: '123',
      name: 'From Account',
      balance: 30,
      created_at: new Date(),
      updated_at: new Date()
    };

    const mockToAccount = {
      id: '456',
      name: 'To Account',
      balance: 50,
      created_at: new Date(),
      updated_at: new Date()
    };

    (accountService.getAccountById as jest.Mock)
      .mockResolvedValueOnce(mockFromAccount)
      .mockResolvedValueOnce(mockToAccount);

    await expect(transferFunds('123', '456', 50)).rejects.toThrow(
      InsufficientBalanceError
    );

    expect(pool.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('should throw AccountNotFoundError if one or both accounts are not found', async () => {
    (accountService.getAccountById as jest.Mock)
      .mockResolvedValueOnce(null) // From account not found
      .mockResolvedValueOnce({ id: '456', balance: 50 });

    await expect(transferFunds('123', '456', 50)).rejects.toThrow(
      AccountNotFoundError
    );

    expect(pool.query).toHaveBeenCalledWith('ROLLBACK');
  });
});
