import { createAccount, getAccountBalance } from './services/accountService';
import {
  makeDeposit,
  makeWithdrawal,
  transferFunds,
  refundTransaction,
  getTransactionHistory
} from './services/transactionService';

async function runExample() {
  try {
    console.log('--- Starting Virtual Bank Example ---');

    // Create accounts for Alice and Kelvin
    const aliceAccount = await createAccount('Alice');
    const kelvinAccount = await createAccount('Kelvin');
    console.log('Initial Accounts:');
    console.log('Alice:', aliceAccount);
    console.log('Kelvin:', kelvinAccount);

    // Make deposits to both accounts
    console.log('\n--- Making Initial Deposits ---');
    await makeDeposit(aliceAccount.id, 500);
    await makeDeposit(kelvinAccount.id, 300);
    console.log(
      `Alice's balance after deposit: ${await getAccountBalance(
        aliceAccount.id
      )}`
    );
    console.log(
      `Kelvin's balance after deposit: ${await getAccountBalance(
        kelvinAccount.id
      )}`
    );

    // Alice makes a withdrawal
    console.log('\n--- Alice Makes a Withdrawal ---');
    const withdrawalAmount = 150;
    await makeWithdrawal(aliceAccount.id, withdrawalAmount);
    console.log(
      `Alice's balance after withdrawal of ${withdrawalAmount}: ${await getAccountBalance(
        aliceAccount.id
      )}`
    );

    // Alice transfers to Kelvin
    console.log('\n--- Alice Transfers to Kelvin ---');
    const transferAmount = 100;
    const transferTransaction = await transferFunds(
      aliceAccount.id,
      kelvinAccount.id,
      transferAmount
    );
    console.log(`Transfer transaction:`, transferTransaction);
    console.log(
      `Alice's balance after transfer: ${await getAccountBalance(
        aliceAccount.id
      )}`
    );
    console.log(
      `Kelvin's balance after transfer: ${await getAccountBalance(
        kelvinAccount.id
      )}`
    );

    // Refund the transfer
    console.log('\n--- Refunding the Transfer ---');
    const transferRefund = await refundTransaction(transferTransaction.id);
    console.log(
      `Alice's balance after transfer refund: ${await getAccountBalance(
        aliceAccount.id
      )}`
    );
    console.log(
      `Kelvin's balance after transfer refund: ${await getAccountBalance(
        kelvinAccount.id
      )}`
    );

    // Kelvin makes a withdrawal
    console.log('\n--- Kelvin Makes a Withdrawal ---');
    await makeWithdrawal(kelvinAccount.id, 50);
    console.log(
      `Kelvin's balance after withdrawal: ${await getAccountBalance(
        kelvinAccount.id
      )}`
    );

    // Display final balances
    console.log('\n--- Final Account Balances ---');
    console.log(
      `Alice's final balance: ${await getAccountBalance(aliceAccount.id)}`
    );
    console.log(
      `Kelvin's final balance: ${await getAccountBalance(kelvinAccount.id)}`
    );

    // Display transaction history for Alice
    console.log('\n--- Transaction History for Alice ---');
    const aliceHistory = await getTransactionHistory(aliceAccount.id);
    aliceHistory.forEach((transaction, index) => {
      console.log(`Transaction ${aliceHistory.length - index}:`);
      console.log(`  Type: ${transaction.type}`);
      console.log(`  Amount: ${transaction.amount}`);
      console.log(`  From: ${transaction.from_account_id || 'N/A'}`);
      console.log(`  To: ${transaction.to_account_id || 'N/A'}`);
      console.log(`  Created At: ${transaction.created_at}`);
      console.log(
        `  Reference ID: ${transaction.reference_transaction_id || 'N/A'}`
      );
    });

    // Display transaction history for Kelvin
    console.log('\n--- Transaction History for Kelvin ---');
    const kelvinHistory = await getTransactionHistory(kelvinAccount.id);
    kelvinHistory.forEach((transaction, index) => {
      console.log(`Transaction ${kelvinHistory.length - index}:`);
      console.log(`  Type: ${transaction.type}`);
      console.log(`  Amount: ${transaction.amount}`);
      console.log(`  From: ${transaction.from_account_id || 'N/A'}`);
      console.log(`  To: ${transaction.to_account_id || 'N/A'}`);
      console.log(`  Created At: ${transaction.created_at}`);
      console.log(
        `  Reference ID: ${transaction.reference_transaction_id || 'N/A'}`
      );
    });

    // ---"Should Fail" Scenarios ---

    // Attempt to refund a refund (should fail)
    console.log('\n--- Attempting to Refund a Refund (Should Fail) ---');
    try {
      await refundTransaction(transferRefund.id);
    } catch (error) {
      console.log('Error refunding a refund:', (error as Error).message);
    }

    // Attempt to refund a non-existent transaction (should fail)
    console.log(
      '\n--- Attempting to Refund a Non-existent Transaction (Should Fail) ---'
    );
    try {
      await refundTransaction('non-existent-id');
    } catch (error) {
      console.log(
        'Error refunding non-existent transaction:',
        (error as Error).message
      );
    }
  } catch (error) {
    console.error('Error running example:', (error as Error).message);
  }
}

runExample();
