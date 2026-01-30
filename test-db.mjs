import { getDb } from './server/db.ts';

async function test() {
  try {
    const db = await getDb();
    console.log('DB connection:', db ? 'OK' : 'FAILED');
  } catch (err) {
    console.error('DB Error:', err.message);
  }
}

test();
