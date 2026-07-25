import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 1. Transacciones activas
const [active] = await conn.execute(`
  SELECT id, userId, evseId, ocppTransactionId, status, transaction_status, startTime, endTime, kwhConsumed, totalCost
  FROM transactions WHERE status = 'IN_PROGRESS' OR transaction_status = 'IN_PROGRESS'
  ORDER BY startTime DESC LIMIT 5
`);
console.log('ACTIVAS:', JSON.stringify(active));

// 2. Overstay locks
const [locks] = await conn.execute(`
  SELECT id, evseId, transactionId, instanceId, lastHeartbeat, accumulatedCost, lastChargeTime, startedAt
  FROM overstay_locks ORDER BY startedAt DESC LIMIT 10
`);
console.log('LOCKS:', JSON.stringify(locks));

// 3. WA logs del incidente (ayer UTC 20:00 en adelante)
const [wa] = await conn.execute(`
  SELECT id, eventType, status, LEFT(messageBody,100) as msg, createdAt
  FROM whatsapp_notification_log WHERE createdAt >= '2026-07-24 20:00:00'
  ORDER BY createdAt ASC LIMIT 20
`);
console.log('WA:', JSON.stringify(wa));

// 4. Sesiones recientes de EVG001 (evseId=1) y evseId=150001
const [sessions] = await conn.execute(`
  SELECT id, evseId, ocppTransactionId, status, transaction_status, startTime, endTime, kwhConsumed
  FROM transactions WHERE evseId IN (1, 150001) ORDER BY startTime DESC LIMIT 8
`);
console.log('SESSIONS:', JSON.stringify(sessions));

await conn.end();
