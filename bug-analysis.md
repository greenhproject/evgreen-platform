# Bug Analysis: Charging Transaction Issues

## Bug 1: Transaction #630001 marked CANCELLED but was a real charge
- Transaction has 60.84 kWh, $71,240.47 total cost
- Status: CANCELLED with stopReason "AUTO_CLEANUP: Sin actividad por más de 60 minutos"
- The cleanup job checks `updatedAt` column which has `onUpdateNow()` in MySQL
- BUT: MeterValues updates kwhConsumed, totalCost etc. which SHOULD trigger onUpdateNow
- The cleanup ran and found the transaction's updatedAt was > 60 min old
- POSSIBLE CAUSE: The MeterValues may have stopped coming from the charger, or the charger disconnected
- REAL ISSUE: The cleanup should NOT cancel transactions that have significant energy consumed
- FIX: Before cancelling, check if kwhConsumed > 0 and totalCost > 0. If so, COMPLETE the transaction and charge the wallet instead of cancelling.

## Bug 2: Wallet not debited for transaction #630001
- Last wallet debit was on March 16 (ref 540006), balance is $106,527.70
- Transaction #630001 cost $71,240.47 but was never charged
- CAUSE: The cleanup marks as CANCELLED without running the wallet debit logic
- The StopTransaction handler (index.ts line 1264-1308) only runs when OCPP StopTransaction message arrives
- When cleanup cancels, it just sets status=CANCELLED and endTime, no wallet debit
- FIX: In cleanupOrphanedTransactions, if transaction has kwhConsumed > 0, complete it AND debit wallet

## Bug 3: "Saldo agotado" notifications sent incorrectly
- The MeterValues handler (index.ts line 1722-1761) calculates remainingBalance = userBalance - currentTotalCost
- BUT: user.walletBalance doesn't exist! The users table has no walletBalance column
- getUserById returns from users table which has no balance field
- The balance is in the wallets table (separate)
- So `user.walletBalance` is undefined, `parseFloat(undefined || "0")` = 0
- remainingBalance = 0 - currentTotalCost = negative number
- This ALWAYS triggers the "Saldo agotado" notification!
- FIX: Use db.getWalletByUserId(userId) instead of user.walletBalance

## Summary of fixes needed:
1. **cleanupOrphanedTransactions**: If kwhConsumed > 0, complete the transaction and debit wallet
2. **MeterValues balance check**: Use wallet table instead of non-existent user.walletBalance
3. **MeterValues "Saldo agotado"**: Add notification key to prevent duplicates
