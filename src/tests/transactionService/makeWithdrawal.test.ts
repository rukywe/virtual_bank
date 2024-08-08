import { makeWithdrawal } from '../../services/transactionService';
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

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../services/accountService');

describe('Transaction Functions', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should make a withdrawal successfully', async () => {
    const mockAccount = {
      id: '123',
      name: 'Test Account',
      balance: 100,
      created_at: new Date(),
      updated_at: new Date()
    };

    const mockTransaction = {
      id: '456',
      from_account_id: '123',
      to_account_id: null,
      type: 'withdrawal',
      amount: 50,
      reference_transaction_id: null,
      created_at: new Date(),
      updated_at: new Date()
    };

    (accountService.getAccountById as jest.Mock).mockResolvedValue(mockAccount);

    (pool.query as jest.Mock)
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE balance
      .mockResolvedValueOnce({ rows: [mockTransaction] }) // INSERT transaction
      .mockResolvedValueOnce(undefined); // COMMIT

    const result = await makeWithdrawal('123', 50);
    expect(result).toEqual(mockTransaction);
    expect(pool.query).toHaveBeenCalledWith('BEGIN');
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
      [50, '123']
    );
    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO transactions (from_account_id, type, amount, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *',
      ['123', 'withdrawal', 50]
    );
    expect(pool.query).toHaveBeenCalledWith('COMMIT');
  });

  it('should allow withdrawal to cause negative balance if allowNegative is true', async () => {
    const mockAccount = {
      id: '123',
      name: 'Test Account',
      balance: 30,
      created_at: new Date(),
      updated_at: new Date()
    };

    const mockTransaction = {
      id: '456',
      from_account_id: '123',
      to_account_id: null,
      type: 'withdrawal',
      amount: 50,
      reference_transaction_id: null,
      created_at: new Date(),
      updated_at: new Date()
    };

    (accountService.getAccountById as jest.Mock).mockResolvedValue(mockAccount);

    (pool.query as jest.Mock)
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE balance
      .mockResolvedValueOnce({ rows: [mockTransaction] }) // INSERT transaction
      .mockResolvedValueOnce(undefined); // COMMIT

    const result = await makeWithdrawal('123', 50, true); // Allow negative
    expect(result).toEqual(mockTransaction);
    expect(pool.query).toHaveBeenCalledWith('BEGIN');
    expect(pool.query).toHaveBeenCalledWith('COMMIT');
  });

  it('should throw AccountNotFoundError for non-existent account', async () => {
    (accountService.getAccountById as jest.Mock).mockResolvedValue(null);

    await expect(makeWithdrawal('999', 50)).rejects.toThrow(
      AccountNotFoundError
    );
    expect(pool.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('should throw InsufficientBalanceError if balance is too low without allowNegative', async () => {
    const mockAccount = {
      id: '123',
      name: 'Test Account',
      balance: 30,
      created_at: new Date(),
      updated_at: new Date()
    };

    (accountService.getAccountById as jest.Mock).mockResolvedValue(mockAccount);

    await expect(makeWithdrawal('123', 50)).rejects.toThrow(
      InsufficientBalanceError
    );
    expect(pool.query).toHaveBeenCalledWith('ROLLBACK');
  });
});
