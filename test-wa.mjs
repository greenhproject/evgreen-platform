// Test WhatsApp service directly
import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('No DATABASE_URL'); process.exit(1); }

const conn = await mysql.createConnection(DB_URL);

// Get config
const [cfgRows] = await conn.query('SELECT * FROM whatsapp_config LIMIT 1');
const cfg = cfgRows[0];
console.log('Config:', { enabled: cfg.enabled, phoneNumberId: cfg.phoneNumberId, token_len: cfg.accessToken?.length });

if (!cfg.enabled || !cfg.phoneNumberId || !cfg.accessToken) {
  console.error('WhatsApp not configured properly');
  process.exit(1);
}

// Normalize phone
let phone = '3214567644'.replace(/[\s\-\+]/g, '');
if (phone.length === 10 && (phone.startsWith('3') || phone.startsWith('6'))) {
  phone = '57' + phone;
}
console.log('Sending to phone:', phone);

// Send test message
const url = `https://graph.facebook.com/v18.0/${cfg.phoneNumberId}/messages`;
const body = {
  messaging_product: 'whatsapp',
  to: phone,
  type: 'text',
  text: { body: '✅ *EVGreen - Test de diagnóstico*\n\nSi recibes este mensaje, las notificaciones WhatsApp están funcionando correctamente.' }
};

const resp = await fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${cfg.accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

const data = await resp.json();
console.log('Response status:', resp.status);
console.log('Response body:', JSON.stringify(data, null, 2));

await conn.end();
