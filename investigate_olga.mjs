import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log("=== TRANSACCIÓN #690003 ===");
const [tx] = await conn.execute("SELECT * FROM transactions WHERE id = 690003");
console.log(JSON.stringify(tx[0], null, 2));

console.log("\n=== USUARIO (Olga Lopez) ===");
const userId = tx[0]?.userId;
const [user] = await conn.execute("SELECT id, name, email, phone FROM users WHERE id = ?", [userId]);
console.log(JSON.stringify(user[0], null, 2));

console.log("\n=== WALLET DEL USUARIO ===");
const [wallet] = await conn.execute("SELECT * FROM wallets WHERE userId = ?", [userId]);
console.log(JSON.stringify(wallet[0], null, 2));

console.log("\n=== WALLET TRANSACTIONS DE ESTA TRANSACCIÓN ===");
const [wt] = await conn.execute("SELECT * FROM wallet_transactions WHERE referenceId = 'TX-690003' OR description LIKE '%690003%' ORDER BY createdAt DESC");
console.log(JSON.stringify(wt, null, 2));

console.log("\n=== DEUDAS PENDIENTES DEL USUARIO ===");
const [debts] = await conn.execute("SELECT * FROM user_debts WHERE userId = ? ORDER BY createdAt DESC", [userId]);
console.log(JSON.stringify(debts, null, 2));

console.log("\n=== CONFIGURACIÓN DE VALOR FIJO / SUSCRIPCIÓN ===");
const [sub] = await conn.execute("SELECT * FROM subscriptions WHERE userId = ?", [userId]);
console.log(JSON.stringify(sub, null, 2));

console.log("\n=== TARIFA DE LA ESTACIÓN ===");
const stationId = tx[0]?.stationId;
const [tariff] = await conn.execute("SELECT * FROM tariffs WHERE stationId = ?", [stationId]);
console.log(JSON.stringify(tariff, null, 2));

console.log("\n=== METER VALUES (últimos 10) ===");
const [mv] = await conn.execute("SELECT * FROM meter_values WHERE transactionId = 690003 ORDER BY timestamp DESC LIMIT 10");
console.log(JSON.stringify(mv, null, 2));

console.log("\n=== OVERSTAY PENALTIES ===");
const [overstay] = await conn.execute("SELECT * FROM overstay_penalties WHERE transactionId = 690003");
console.log(JSON.stringify(overstay, null, 2));

await conn.end();
