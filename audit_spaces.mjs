import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [cols1] = await conn.execute('DESCRIBE space_submissions');
console.log('space_submissions cols:', cols1.map(c => c.Field + ':' + c.Type).join('\n'));

const [cols2] = await conn.execute('DESCRIBE space_photos');
console.log('\nspace_photos cols:', cols2.map(c => c.Field + ':' + c.Type).join('\n'));

// Muestra de datos
const [samples] = await conn.execute('SELECT * FROM space_submissions ORDER BY createdAt DESC LIMIT 3');
console.log('\nSAMPLE DATA:', JSON.stringify(samples, null, 2));

const [photos] = await conn.execute('SELECT * FROM space_photos LIMIT 5');
console.log('\nSAMPLE PHOTOS:', JSON.stringify(photos, null, 2));

await conn.end();
