import { getTransactionHistory } from '../../services/transactionService';
import { pool } from '../../config/database';
import { DatabaseError } from '../../utils/error';

jest.mock('../../config/database', () => ({
  pool: {
    query: jest.fn()
  }
}));

describe('getTransactionHistory', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return transaction history for a valid account', async () => {
    const mockTransactions = [
      {
        id: 'tx1',
        from_account_id: 'account1',
        to_account_id: null,
        type: 'deposit',
        amount: 100,
        reference_transaction_id: null,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'tx2',
        from_account_id: null,
        to_account_id: 'account1',
        type: 'withdrawal',
        amount: 50,
        reference_transaction_id: null,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    (pool.query as jest.Mock).mockResolvedValue({ rows: mockTransactions });

    const result = await getTransactionHistory('account1');

    expect(result).toEqual(mockTransactions);

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['account1']);

    const [actualQuery] = (pool.query as jest.Mock).mock.calls[0];
    const expectedQueryContent =
      'SELECT * FROM transactions WHERE from_account_id = $1 OR to_account_id = $1 ORDER BY created_at DESC';
    expect(actualQuery.replace(/\s+/g, ' ').trim()).toBe(expectedQueryContent);
  });

  it('should throw a DatabaseError if the database query fails', async () => {
    (pool.query as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(getTransactionHistory('account1')).rejects.toThrow(
      DatabaseError
    );
  });
});
