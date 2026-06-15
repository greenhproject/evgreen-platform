/**
 * Direct SQL migration to add maintenanceFundAlertThreshold column
 * This bypasses drizzle-kit generate/migrate which has issues with existing tables
 */
import mysql from 'mysql2/promise';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  
  const connection = await mysql.createConnection(url);
  
  try {
    // Check if column already exists
    const [rows] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'charging_stations' 
       AND COLUMN_NAME = 'maintenanceFundAlertThreshold'`
    );
    
    if (Array.isArray(rows) && rows.length > 0) {
      console.log('Column maintenanceFundAlertThreshold already exists, skipping.');
    } else {
      await connection.execute(
        `ALTER TABLE \`charging_stations\` ADD \`maintenanceFundAlertThreshold\` decimal(15,2) DEFAULT '500000.00'`
      );
      console.log('Column maintenanceFundAlertThreshold added successfully!');
    }
    
    // Verify
    const [verify] = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'charging_stations' 
       AND COLUMN_NAME = 'maintenanceFundAlertThreshold'`
    );
    console.log('Verification:', verify);
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
