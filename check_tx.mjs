import { createPool } from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = createPool(process.env.DATABASE_URL);
const [rows] = await pool.query(
  'SELECT * FROM transactions WHERE id = 690003'
);
console.log('TX 690003:', JSON.stringify(rows[0], null, 2));
await pool.end();
