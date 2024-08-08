import { makeDeposit } from '../../services/transactionService';
import { pool } from '../../config/database';
import { getAccountById } from '../../services/accountService';
import { AccountNotFoundError } from '../../utils/error';
import logger from '../../utils/logger';

jest.mock('../../config/database', () => ({
  pool: {
    connect: jest.fn()
  }
}));

jest.mock('../../services/accountService', () => ({
  getAccountById: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn()
}));

describe('makeDeposit', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (pool.connect as jest.Mock).mockResolvedValue(mockClient);
  });

  it('should successfully make a deposit', async () => {
    const accountId = 'test-account';
    const amount = 100;

    (getAccountById as jest.Mock).mockResolvedValue({
      id: accountId,
      balance: 0
    });
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'transaction-id',
            from_account_id: accountId,
            type: 'deposit',
            amount
          }
        ]
      })
      .mockResolvedValueOnce({});

    const result = await makeDeposit(accountId, amount);

    expect(result).toEqual(
      expect.objectContaining({
        id: 'transaction-id',
        from_account_id: accountId,
        type: 'deposit',
        amount
      })
    );

    expect(mockClient.query).toHaveBeenCalledTimes(4);
    expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockClient.query).toHaveBeenNthCalledWith(
      2,
      'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
      [amount, accountId]
    );
    expect(mockClient.query).toHaveBeenNthCalledWith(
      3,
      'INSERT INTO transactions (from_account_id, type, amount, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *',
      [accountId, 'deposit', amount]
    );
    expect(mockClient.query).toHaveBeenNthCalledWith(4, 'COMMIT');

    expect(mockClient.release).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      `Deposit of ${amount} made to account ${accountId}`
    );
  });

  it('should throw AccountNotFoundError if account does not exist', async () => {
    const accountId = 'non-existent-account';
    const amount = 100;

    (getAccountById as jest.Mock).mockResolvedValue(null);
    mockClient.query.mockResolvedValueOnce({});

    await expect(makeDeposit(accountId, amount)).rejects.toThrow(
      AccountNotFoundError
    );

    expect(mockClient.query).toHaveBeenCalledTimes(2);
    expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockClient.query).toHaveBeenNthCalledWith(2, 'ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error making deposit')
    );
  });

  it('should rollback transaction and throw error if update fails', async () => {
    const accountId = 'test-account';
    const amount = 100;

    (getAccountById as jest.Mock).mockResolvedValue({
      id: accountId,
      balance: 0
    });
    mockClient.query
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('Update failed'));

    await expect(makeDeposit(accountId, amount)).rejects.toThrow(
      'Update failed'
    );

    expect(mockClient.query).toHaveBeenCalledTimes(3);
    expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockClient.query).toHaveBeenNthCalledWith(
      2,
      'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
      [amount, accountId]
    );
    expect(mockClient.query).toHaveBeenNthCalledWith(3, 'ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error making deposit')
    );
  });
});
