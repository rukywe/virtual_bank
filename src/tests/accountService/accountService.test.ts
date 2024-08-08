import { createAccount } from '../../services/accountService';
import { pool } from '../../config/database';
import { InvalidAccountNameError } from '../../utils/error';

jest.mock('../../config/database', () => ({
  pool: {
    query: jest.fn()
  }
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('Account Functions', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAccount', () => {
    it('should create an account successfully', async () => {
      const mockAccount = {
        id: '123',
        name: 'Test Account',
        balance: 0,
        created_at: new Date(),
        updated_at: new Date()
      };
      (pool.query as jest.Mock).mockResolvedValue({ rows: [mockAccount] });

      const result = await createAccount('Test Account');
      expect(result).toEqual(mockAccount);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
        'Test Account'
      ]);
    });

    it('should throw InvalidAccountNameError for empty name', async () => {
      await expect(createAccount('')).rejects.toThrow(InvalidAccountNameError);
    });

    it('should throw an error if database query fails', async () => {
      (pool.query as jest.Mock).mockRejectedValue(new Error('DB error'));
      await expect(createAccount('Test Account')).rejects.toThrow('DB error');
    });
  });
});
