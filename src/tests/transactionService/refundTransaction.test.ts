import { refundTransaction } from '../../services/transactionService';
import * as transactionHelpers from '../../services/transactionHelpers';
import { pool } from '../../config/database';
import {
  TransactionNotFoundError,
  AccountNotFoundError,
  UnsupportedTransactionTypeError
} from '../../utils/error';

jest.mock('../../config/database', () => ({
  pool: {
    connect: jest.fn().mockReturnThis(),
    query: jest.fn(),
    release: jest.fn()
  }
}));

jest.mock('../../services/transactionHelpers');
jest.mock('../../services/accountService');

describe('Transaction Functions', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (pool.connect as jest.Mock).mockResolvedValue(mockClient);
  });

  it('should successfully refund a deposit', async () => {
    const mockTransaction = {
      id: '123',
      from_account_id: 'alice-id',
      to_account_id: null,
      type: 'deposit',
      amount: 100,
      reference_transaction_id: null,
      created_at: new Date(),
      updated_at: new Date()
    };

    const mockRefundTransaction = {
      ...mockTransaction,
      id: 'refund-123',
      type: 'withdrawal',
      reference_transaction_id: '123'
    };

    (transactionHelpers.getTransactionById as jest.Mock).mockResolvedValue(
      mockTransaction
    );
    (transactionHelpers.createRefundTransaction as jest.Mock).mockResolvedValue(
      mockRefundTransaction
    );

    const result = await refundTransaction('123');

    expect(result).toEqual(mockRefundTransaction);
    expect(transactionHelpers.getTransactionById).toHaveBeenCalledWith(
      '123',
      mockClient
    );
    expect(transactionHelpers.validateRefundTransaction).toHaveBeenCalledWith(
      mockTransaction
    );
    expect(transactionHelpers.reverseTransaction).toHaveBeenCalledWith(
      mockTransaction,
      mockClient
    );
    expect(transactionHelpers.createRefundTransaction).toHaveBeenCalledWith(
      mockTransaction,
      mockClient
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      'UPDATE transactions SET reference_transaction_id = $1 WHERE id = $2',
      ['refund-123', '123']
    );
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
  });

  it('should successfully refund a withdrawal', async () => {
    const mockTransaction = {
      id: '124',
      from_account_id: 'bob-id',
      to_account_id: null,
      type: 'withdrawal',
      amount: 50,
      reference_transaction_id: null,
      created_at: new Date(),
      updated_at: new Date()
    };

    const mockRefundTransaction = {
      ...mockTransaction,
      id: 'refund-124',
      type: 'deposit',
      reference_transaction_id: '124'
    };

    (transactionHelpers.getTransactionById as jest.Mock).mockResolvedValue(
      mockTransaction
    );
    (transactionHelpers.createRefundTransaction as jest.Mock).mockResolvedValue(
      mockRefundTransaction
    );

    const result = await refundTransaction('124');

    expect(result).toEqual(mockRefundTransaction);
    expect(transactionHelpers.getTransactionById).toHaveBeenCalledWith(
      '124',
      mockClient
    );
    expect(transactionHelpers.validateRefundTransaction).toHaveBeenCalledWith(
      mockTransaction
    );
    expect(transactionHelpers.reverseTransaction).toHaveBeenCalledWith(
      mockTransaction,
      mockClient
    );
    expect(transactionHelpers.createRefundTransaction).toHaveBeenCalledWith(
      mockTransaction,
      mockClient
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      'UPDATE transactions SET reference_transaction_id = $1 WHERE id = $2',
      ['refund-124', '124']
    );
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
  });

  it('should successfully refund a transfer', async () => {
    const mockTransaction = {
      id: '125',
      from_account_id: 'alice-id',
      to_account_id: 'bob-id',
      type: 'transfer',
      amount: 75,
      reference_transaction_id: null,
      created_at: new Date(),
      updated_at: new Date()
    };

    const mockRefundTransaction = {
      ...mockTransaction,
      id: 'refund-125',
      from_account_id: 'bob-id',
      to_account_id: 'alice-id',
      reference_transaction_id: '125'
    };

    (transactionHelpers.getTransactionById as jest.Mock).mockResolvedValue(
      mockTransaction
    );
    (transactionHelpers.createRefundTransaction as jest.Mock).mockResolvedValue(
      mockRefundTransaction
    );

    const result = await refundTransaction('125');

    expect(result).toEqual(mockRefundTransaction);
    expect(transactionHelpers.getTransactionById).toHaveBeenCalledWith(
      '125',
      mockClient
    );
    expect(transactionHelpers.validateRefundTransaction).toHaveBeenCalledWith(
      mockTransaction
    );
    expect(transactionHelpers.reverseTransaction).toHaveBeenCalledWith(
      mockTransaction,
      mockClient
    );
    expect(transactionHelpers.createRefundTransaction).toHaveBeenCalledWith(
      mockTransaction,
      mockClient
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      'UPDATE transactions SET reference_transaction_id = $1 WHERE id = $2',
      ['refund-125', '125']
    );
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
  });

  it('should throw TransactionNotFoundError if transaction does not exist', async () => {
    (transactionHelpers.getTransactionById as jest.Mock).mockRejectedValue(
      new TransactionNotFoundError('999')
    );

    await expect(refundTransaction('999')).rejects.toThrow(
      TransactionNotFoundError
    );
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('should throw AccountNotFoundError if account does not exist', async () => {
    const mockTransaction = {
      id: '126',
      from_account_id: 'non-existent-id',
      to_account_id: null,
      type: 'deposit',
      amount: 100,
      reference_transaction_id: null,
      created_at: new Date(),
      updated_at: new Date()
    };

    (transactionHelpers.getTransactionById as jest.Mock).mockResolvedValue(
      mockTransaction
    );
    (transactionHelpers.reverseTransaction as jest.Mock).mockRejectedValue(
      new AccountNotFoundError('non-existent-id')
    );

    await expect(refundTransaction('126')).rejects.toThrow(
      AccountNotFoundError
    );
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('should throw Error if trying to refund a refund', async () => {
    const mockTransaction = {
      id: '127',
      from_account_id: 'alice-id',
      to_account_id: null,
      type: 'refund',
      amount: 100,
      reference_transaction_id: '123',
      created_at: new Date(),
      updated_at: new Date()
    };

    (transactionHelpers.getTransactionById as jest.Mock).mockResolvedValue(
      mockTransaction
    );
    (
      transactionHelpers.validateRefundTransaction as jest.Mock
    ).mockImplementation(() => {
      throw new Error('Cannot refund a refund transaction');
    });

    await expect(refundTransaction('127')).rejects.toThrow(
      'Cannot refund a refund transaction'
    );
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
  });
  it('should throw UnsupportedTransactionTypeError for unsupported transaction types', async () => {
    const mockTransaction = {
      id: '128',
      from_account_id: 'alice-id',
      to_account_id: null,
      type: 'unsupported',
      amount: 100,
      reference_transaction_id: null,
      created_at: new Date(),
      updated_at: new Date()
    };

    (transactionHelpers.getTransactionById as jest.Mock).mockResolvedValue(
      mockTransaction
    );
    (
      transactionHelpers.validateRefundTransaction as jest.Mock
    ).mockImplementation(() => {});
    (transactionHelpers.reverseTransaction as jest.Mock).mockRejectedValue(
      new UnsupportedTransactionTypeError('unsupported')
    );

    await expect(refundTransaction('128')).rejects.toThrow(
      UnsupportedTransactionTypeError
    );
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
  });
});
