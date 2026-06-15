import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log("=== TRANSACCIÓN #690003 ===");
const [tx] = await conn.execute("SELECT id, userId, stationId, evseId, startTime, endTime, kwhConsumed, energyCost, sessionCost, overstayCost, totalCost, transaction_status, chargeMode, targetValue, appliedPricePerKwh, startMethod, stopReason FROM transactions WHERE id = 690003");
console.log(JSON.stringify(tx[0], null, 2));

const userId = tx[0]?.userId;

console.log("\n=== DEUDAS PENDIENTES DEL USUARIO ===");
const [debts] = await conn.execute("SELECT * FROM user_debts WHERE userId = ? ORDER BY createdAt DESC", [userId]);
console.log(JSON.stringify(debts, null, 2));

console.log("\n=== WALLET TRANSACTIONS RECIENTES (últimas 5) ===");
const [wt] = await conn.execute("SELECT id, type, amount, balanceBefore, balanceAfter, description, referenceId, createdAt FROM wallet_transactions WHERE userId = ? ORDER BY createdAt DESC LIMIT 5", [userId]);
console.log(JSON.stringify(wt, null, 2));

console.log("\n=== TODAS LAS WALLET TX CON referenceId TX-690003 ===");
const [wtTx] = await conn.execute("SELECT id, type, amount, balanceBefore, balanceAfter, description, referenceId, createdAt FROM wallet_transactions WHERE referenceId = 'TX-690003'");
console.log(JSON.stringify(wtTx, null, 2));

console.log("\n=== OVERSTAY - buscar en tabla correcta ===");
try {
  const [ov] = await conn.execute("SELECT * FROM overstay_sessions WHERE transactionId = 690003");
  console.log(JSON.stringify(ov, null, 2));
} catch(e) {
  console.log("No existe overstay_sessions, probando overstay_records...");
  try {
    const [ov2] = await conn.execute("SELECT * FROM overstay_records WHERE transactionId = 690003");
    console.log(JSON.stringify(ov2, null, 2));
  } catch(e2) {
    console.log("Buscando tablas con 'overstay'...");
    const [tables] = await conn.execute("SHOW TABLES LIKE '%overstay%'");
    console.log(JSON.stringify(tables, null, 2));
  }
}

await conn.end();
