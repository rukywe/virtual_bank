# Virtual Bank Account Management Library

## Overview

This library is designed to manage virtual bank accounts with functionalities for deposits, withdrawals, transfers, and refunds. It uses a PostgreSQL database for persistence

![Transaction Flow Diagram](system_overview.png)

## Implementation Details

### Database Schema

The system uses two main tables:

1. **`accounts`**: Stores account information including ID, name, and balance.
2. **`transactions`**: Records all transactions with details such as type, amount, involved accounts, and reference to original transactions for refunds.

### Database Optimization

I've implemented several indexes to optimize database query performance:

- Indexes on `from_account_id` and `to_account_id` for faster transaction lookups
- `type` index for quick filtering by transaction type
- `created_at` index for efficient date-based queries
- `reference_transaction_id` index to optimise refund processing

These indexes are created automatically during database setup, ensuring optimal performance in all deployments.

### Key Components

1. **Account Service**: Handles account-related operations (creation, balance retrieval).
2. **Transaction Service**: Manages all transaction types (deposit, withdrawal, transfer, refund).
3. **Transaction Helpers**: Provides utility functions for transaction processing.
4. **Error Handling**: Custom error classes for specific scenarios, ensuring that each error is captured and logged appropriately.
5. **Logging**: Utilizes the Winston logger for comprehensive logging throughout the application, ensuring traceability and debugging support.

### Transaction Flow

1. Validate the transaction (e.g., sufficient balance, valid accounts).
2. Begin a database transaction to ensure atomicity.
3. Update account balances based on the transaction type.
4. Record the transaction in the `transactions` table.
5. Commit the database transaction if all operations succeed, ensuring data consistency.

### Refund Mechanism

Refunds are implemented as reverse transactions, referencing the original transaction:

1. Validate the original transaction to ensure it can be refunded.
2. Create a new transaction of the opposite type (e.g., refund a deposit by creating a withdrawal).
3. Update account balances accordingly to reflect the refund.
4. Link the refund transaction to the original transaction for traceability.

### Input Validation

The library includes input validation to ensure data integrity:

- Validates account names during account creation.
- Ensures transaction amounts are positive numbers.
- Checks for the existence of accounts before processing transactions.
- Validates transaction IDs when processing refunds or querying histories.

## Running the Project

1. Clone the repository.
2. Install dependencies: `npm install`
3. create your `.env` file (and add DATABASE_URL=postgres://postgres:password@localhost:5432/virtual_bank)
4. Build Docker image `npm run docker:build`
5. Start the PostgreSQL database and application using Docker Compose: `npm run docker:up`
6. The application will set up the database schema and run the example scenarios automatically.

## Testing

Unit tests are provided for both the account and transaction services. Run tests using: `npm test`

## Business Logic

### Handling Negative Balances

In traditional banking, transactions are typically blocked if they would result in a negative balance, unless overdraft protection is in place. In this application, the logic has been structured to optionally allow negative balances, specifically when processing refunds:

1. **Default Behavior**: For deposits, withdrawals, and transfers, the system prevents transactions that would lead to a negative balance, ensuring account integrity.

2. **Refunds**: Refund transactions are allowed to result in negative balances to facilitate scenarios where the account needs to return funds without sufficient balance (like reversing a prior incorrect deposit).

3. **Business Context**: In a business setting, allowing negative balances can simulate scenarios where overdrafts or pending transactions are common. This is aligned with business cases where certain refunds must be processed regardless of balance, ensuring that the refund process is not obstructed.

### General Considerations

- **Consistency**: Transactions are ensured to be atomic using database transactions, so they either fully succeed or fail, maintaining consistent states.
- **Scalability**: my design separates concerns between different services (e.g., account and transaction services), allowing for easy scalability and extension.

## Example Usage

The project includes an `example.ts` file that demonstrates the usage of the virtual bank account management library. This example:

1. Creates accounts for two users (Alice and Kelvin)
2. Performs various transactions:
   - Deposit to Alice's account
   - Withdrawal from Alice's account
   - Transfer from Alice to Kelvin
3. Demonstrates refund scenarios:
   - Refunding a deposit
   - Refunding a withdrawal
   - Refunding a transfer
   - Attempting to refund a refund (which fails as expected)
   - Attempting to refund a non-existent transaction (which fails as expected)
4. Displays final account balances
5. Shows transaction history for both accounts

This example is run when the application is initialized with `npm run docker:up`
