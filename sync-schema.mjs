// Script to manually sync schema differences between Drizzle schema and actual DB
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function syncSchema() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  const alterStatements = [];
  
  // Helper to check if column exists
  async function columnExists(table, column) {
    try {
      const [rows] = await conn.query(`SHOW COLUMNS FROM \`${table}\` LIKE '${column}'`);
      return rows.length > 0;
    } catch(e) {
      return false;
    }
  }
  
  // Helper to check if index exists
  async function indexExists(table, indexName) {
    try {
      const [rows] = await conn.query(`SHOW INDEX FROM \`${table}\` WHERE Key_name = '${indexName}'`);
      return rows.length > 0;
    } catch(e) {
      return false;
    }
  }
  
  // Helper to execute ALTER safely
  async function safeAlter(sql, description) {
    try {
      await conn.query(sql);
      console.log(`✅ ${description}`);
    } catch(e) {
      if (e.code === 'ER_DUP_FIELDNAME' || e.code === 'ER_DUP_KEYNAME') {
        console.log(`⏭️  ${description} (already exists)`);
      } else {
        console.log(`❌ ${description}: ${e.message}`);
      }
    }
  }
  
  console.log('🔄 Syncing database schema...\n');
  
  // 1. Check charging_stations unique constraint on ocppIdentity
  if (!(await indexExists('charging_stations', 'charging_stations_ocppIdentity_unique'))) {
    await safeAlter(
      'ALTER TABLE charging_stations ADD UNIQUE INDEX charging_stations_ocppIdentity_unique (ocppIdentity)',
      'Add unique index on charging_stations.ocppIdentity'
    );
  } else {
    console.log('⏭️  charging_stations.ocppIdentity unique: already exists');
  }
  
  // 2. Check event_guests qrCode unique
  if (!(await indexExists('event_guests', 'event_guests_qrCode_unique'))) {
    await safeAlter(
      'ALTER TABLE event_guests ADD UNIQUE INDEX event_guests_qrCode_unique (qrCode)',
      'Add unique index on event_guests.qrCode'
    );
  } else {
    console.log('⏭️  event_guests.qrCode unique: already exists');
  }
  
  // 3. Check id_tags id_tag unique
  if (!(await indexExists('id_tags', 'id_tags_id_tag_unique'))) {
    await safeAlter(
      'ALTER TABLE id_tags ADD UNIQUE INDEX id_tags_id_tag_unique (id_tag)',
      'Add unique index on id_tags.id_tag'
    );
  } else {
    console.log('⏭️  id_tags.id_tag unique: already exists');
  }
  
  // 4. Check transactions columns
  const txCols = [
    { col: 'chargeMode', sql: "ALTER TABLE transactions ADD COLUMN chargeMode varchar(20) DEFAULT 'full_charge'" },
    { col: 'targetValue', sql: "ALTER TABLE transactions ADD COLUMN targetValue decimal(12,2) DEFAULT 0" },
    { col: 'appliedPricePerKwh', sql: "ALTER TABLE transactions ADD COLUMN appliedPricePerKwh decimal(10,2) DEFAULT NULL" },
    { col: 'manualSoc', sql: "ALTER TABLE transactions ADD COLUMN manualSoc int DEFAULT NULL" },
    { col: 'manualBatteryCapacityKwh', sql: "ALTER TABLE transactions ADD COLUMN manualBatteryCapacityKwh decimal(6,2) DEFAULT NULL" },
  ];
  
  for (const c of txCols) {
    if (!(await columnExists('transactions', c.col))) {
      await safeAlter(c.sql, `Add transactions.${c.col}`);
    } else {
      console.log(`⏭️  transactions.${c.col}: already exists`);
    }
  }
  
  // 5. Check soc_accuracy_log table
  try {
    await conn.query('SELECT 1 FROM soc_accuracy_log LIMIT 1');
    console.log('⏭️  soc_accuracy_log table: already exists');
  } catch(e) {
    await safeAlter(`
      CREATE TABLE soc_accuracy_log (
        id int AUTO_INCREMENT PRIMARY KEY,
        userId int NOT NULL,
        transactionId int NOT NULL,
        vehicleId int,
        manualSocStart int,
        manualBatteryCapacityKwh decimal(6,2),
        realKwhDelivered decimal(10,4),
        calculatedSocEnd decimal(5,2),
        chargerSocEnd int,
        batteryFullDetected boolean DEFAULT false,
        detectionMethod varchar(50),
        estimatedErrorKwh decimal(10,4),
        estimatedErrorSocPct decimal(5,2),
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `, 'Create soc_accuracy_log table');
  }
  
  // 6. Check user_debts table
  try {
    await conn.query('SELECT 1 FROM user_debts LIMIT 1');
    console.log('⏭️  user_debts table: already exists');
  } catch(e) {
    await safeAlter(`
      CREATE TABLE user_debts (
        id int AUTO_INCREMENT PRIMARY KEY,
        userId int NOT NULL,
        transactionId int,
        amount decimal(12,2) NOT NULL,
        reason varchar(100) NOT NULL,
        description text,
        debt_status enum('PENDING','PAID','FORGIVEN','PARTIAL') NOT NULL DEFAULT 'PENDING',
        paidAmount decimal(12,2) DEFAULT 0,
        paidAt timestamp,
        paymentMethod varchar(50),
        paymentReference varchar(255),
        forgivenBy int,
        forgivenAt timestamp,
        forgivenReason text,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `, 'Create user_debts table');
  }
  
  // 7. Check users table for missing columns
  const userCols = [
    { col: 'twoFactorEnabled', sql: "ALTER TABLE users ADD COLUMN twoFactorEnabled boolean DEFAULT false" },
    { col: 'twoFactorSecret', sql: "ALTER TABLE users ADD COLUMN twoFactorSecret varchar(255)" },
    { col: 'twoFactorVerifiedAt', sql: "ALTER TABLE users ADD COLUMN twoFactorVerifiedAt timestamp" },
    { col: 'pushSubscription', sql: "ALTER TABLE users ADD COLUMN pushSubscription text" },
  ];
  
  for (const c of userCols) {
    if (!(await columnExists('users', c.col))) {
      await safeAlter(c.sql, `Add users.${c.col}`);
    } else {
      console.log(`⏭️  users.${c.col}: already exists`);
    }
  }
  
  // 8. Check platform_settings for missing columns
  const psCols = [
    { col: 'defaultBasePricePerKwh', sql: "ALTER TABLE platform_settings ADD COLUMN defaultBasePricePerKwh decimal(10,2) NOT NULL DEFAULT 1200" },
    { col: 'defaultOverstayGracePeriodMinutes', sql: "ALTER TABLE platform_settings ADD COLUMN defaultOverstayGracePeriodMinutes int NOT NULL DEFAULT 10" },
  ];
  
  for (const c of psCols) {
    if (!(await columnExists('platform_settings', c.col))) {
      await safeAlter(c.sql, `Add platform_settings.${c.col}`);
    } else {
      console.log(`⏭️  platform_settings.${c.col}: already exists`);
    }
  }
  
  console.log('\n✅ Schema sync complete!');
  await conn.end();
}

syncSchema().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
