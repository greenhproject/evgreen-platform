import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check transactions columns first
const [cols] = await conn.query("SHOW COLUMNS FROM transactions");
const colNames = cols.map(c => c.Field);
console.log("=== Transaction columns ===");
console.log(colNames.filter(c => c.toLowerCase().includes('price') || c.toLowerCase().includes('status') || c.toLowerCase().includes('cost')).join(', '));

// Get last 5 transactions with user phone
console.log("\n=== Last 5 Transactions with user phone ===");
const [txRows] = await conn.query(`
  SELECT t.id, t.userId, t.appliedPricePerKwh, t.totalCost, t.startTime, t.endTime,
         u.name, u.phone, u.email
  FROM transactions t
  LEFT JOIN users u ON u.id = t.userId
  ORDER BY t.id DESC LIMIT 5
`);
console.log(JSON.stringify(txRows, null, 2));

await conn.end();
