export class VirtualBankError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class InvalidAccountNameError extends VirtualBankError {
  constructor(message: string = 'Invalid account name') {
    super(message);
  }
}

export class AccountNotFoundError extends VirtualBankError {
  constructor(accountId: string) {
    super(`Account with ID ${accountId} not found`);
    this.name = 'AccountNotFoundError';
  }
}

export class InsufficientBalanceError extends VirtualBankError {
  constructor(accountId: string, amount: number) {
    super(
      `Insufficient balance in account ${accountId} for withdrawal of ${amount}`
    );
  }
}

export class TransactionNotFoundError extends VirtualBankError {
  constructor(transactionId: string) {
    super(`Transaction with ID ${transactionId} not found`);
  }
}

export class InvalidRefundTransactionError extends Error {
  constructor(type: string) {
    super(`Invalid transaction type for refund: ${type}`);
    this.name = 'InvalidRefundTransactionError';
  }
}

export class UnsupportedTransactionTypeError extends Error {
  constructor(type: string) {
    super(`Unsupported transaction type: ${type}`);
    this.name = 'UnsupportedTransactionTypeError';
  }
}

export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}
