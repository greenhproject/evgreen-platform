import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  async function safeExec(sql, desc) {
    try {
      await conn.query(sql);
      console.log(`✓ ${desc}`);
      return true;
    } catch (e) {
      if (e.message.includes('Duplicate') || e.message.includes('already exists') || e.message.includes('CANT_DROP')) {
        console.log(`⊘ ${desc} (already done)`);
        return true;
      }
      console.log(`✗ ${desc}: ${e.message}`);
      return false;
    }
  }

  async function columnExists(table, column) {
    const [rows] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`,
      [table, column]
    );
    return rows.length > 0;
  }

  async function indexExists(table, indexName) {
    const [rows] = await conn.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?`,
      [table, indexName]
    );
    return rows.length > 0;
  }

  console.log("=== Syncing DB with schema.ts ===\n");

  // 1. charging_stations - unique constraint on ocppIdentity
  if (!(await indexExists('charging_stations', 'charging_stations_ocppIdentity_unique'))) {
    await safeExec(
      "ALTER TABLE charging_stations ADD UNIQUE INDEX charging_stations_ocppIdentity_unique (ocppIdentity)",
      "charging_stations: add unique index on ocppIdentity"
    );
  } else {
    console.log("⊘ charging_stations: unique index on ocppIdentity already exists");
  }

  // 2. users - 2FA columns
  if (!(await columnExists('users', 'twoFactorEnabled'))) {
    await safeExec(
      "ALTER TABLE users ADD COLUMN twoFactorEnabled boolean DEFAULT false",
      "users: add twoFactorEnabled"
    );
  } else {
    console.log("⊘ users: twoFactorEnabled already exists");
  }
  if (!(await columnExists('users', 'twoFactorSecret'))) {
    await safeExec(
      "ALTER TABLE users ADD COLUMN twoFactorSecret varchar(255)",
      "users: add twoFactorSecret"
    );
  } else {
    console.log("⊘ users: twoFactorSecret already exists");
  }
  if (!(await columnExists('users', 'twoFactorVerifiedAt'))) {
    await safeExec(
      "ALTER TABLE users ADD COLUMN twoFactorVerifiedAt timestamp",
      "users: add twoFactorVerifiedAt"
    );
  } else {
    console.log("⊘ users: twoFactorVerifiedAt already exists");
  }

  // 3. transactions - chargeMode, targetValue, appliedPricePerKwh
  if (!(await columnExists('transactions', 'chargeMode'))) {
    await safeExec(
      "ALTER TABLE transactions ADD COLUMN chargeMode varchar(20) DEFAULT 'full_charge'",
      "transactions: add chargeMode"
    );
  } else {
    console.log("⊘ transactions: chargeMode already exists");
  }
  if (!(await columnExists('transactions', 'targetValue'))) {
    await safeExec(
      "ALTER TABLE transactions ADD COLUMN targetValue float",
      "transactions: add targetValue"
    );
  } else {
    console.log("⊘ transactions: targetValue already exists");
  }
  if (!(await columnExists('transactions', 'appliedPricePerKwh'))) {
    await safeExec(
      "ALTER TABLE transactions ADD COLUMN appliedPricePerKwh float",
      "transactions: add appliedPricePerKwh"
    );
  } else {
    console.log("⊘ transactions: appliedPricePerKwh already exists");
  }

  // 4. transactions - manualSoc, manualBatteryCapacityKwh
  if (!(await columnExists('transactions', 'manualSoc'))) {
    await safeExec(
      "ALTER TABLE transactions ADD COLUMN manualSoc int",
      "transactions: add manualSoc"
    );
  } else {
    console.log("⊘ transactions: manualSoc already exists");
  }
  if (!(await columnExists('transactions', 'manualBatteryCapacityKwh'))) {
    await safeExec(
      "ALTER TABLE transactions ADD COLUMN manualBatteryCapacityKwh float",
      "transactions: add manualBatteryCapacityKwh"
    );
  } else {
    console.log("⊘ transactions: manualBatteryCapacityKwh already exists");
  }

  // 5. soc_accuracy_log table
  const [socTable] = await conn.query(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='soc_accuracy_log'"
  );
  if (socTable.length === 0) {
    await safeExec(`
      CREATE TABLE soc_accuracy_log (
        id int AUTO_INCREMENT PRIMARY KEY,
        userId int NOT NULL,
        transactionId int NOT NULL,
        vehicleId int NOT NULL,
        manualSocStart int NOT NULL,
        manualBatteryCapacityKwh float NOT NULL,
        realKwhDelivered float NOT NULL,
        calculatedSocEnd int NOT NULL,
        chargerSocEnd int,
        batteryFullDetected boolean NOT NULL DEFAULT false,
        detectionMethod varchar(50),
        estimatedErrorKwh float,
        estimatedErrorSocPct int,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `, "soc_accuracy_log: create table");
  } else {
    console.log("⊘ soc_accuracy_log: table already exists");
  }

  // 6. user_debts table
  const [debtTable] = await conn.query(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user_debts'"
  );
  if (debtTable.length === 0) {
    await safeExec(`
      CREATE TABLE user_debts (
        id int AUTO_INCREMENT PRIMARY KEY,
        userId int NOT NULL,
        transactionId int,
        originalAmount bigint NOT NULL,
        remainingAmount bigint NOT NULL,
        reason varchar(100) NOT NULL,
        description text,
        debt_status enum('PENDING','PAID','PARTIAL','WAIVED') NOT NULL DEFAULT 'PENDING',
        autoChargeAttempts int NOT NULL DEFAULT 0,
        lastAutoChargeAt timestamp,
        paymentReference varchar(255),
        paidAt timestamp,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `, "user_debts: create table");
  } else {
    console.log("⊘ user_debts: table already exists");
  }

  // 7. user_login_sessions table
  const [loginTable] = await conn.query(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user_login_sessions'"
  );
  if (loginTable.length === 0) {
    await safeExec(`
      CREATE TABLE user_login_sessions (
        id int AUTO_INCREMENT PRIMARY KEY,
        userId int NOT NULL,
        userAgent text,
        ipAddress varchar(45),
        deviceType varchar(20),
        browser varchar(100),
        os varchar(100),
        location varchar(255),
        isActive boolean NOT NULL DEFAULT true,
        loginAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        lastActivityAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        logoutAt timestamp
      )
    `, "user_login_sessions: create table");
  } else {
    console.log("⊘ user_login_sessions: table already exists");
  }

  // 8. user_vehicles table
  const [vehicleTable] = await conn.query(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user_vehicles'"
  );
  if (vehicleTable.length === 0) {
    await safeExec(`
      CREATE TABLE user_vehicles (
        id int AUTO_INCREMENT PRIMARY KEY,
        userId int NOT NULL,
        brand varchar(100) NOT NULL,
        model varchar(100) NOT NULL,
        year int,
        batteryCapacityKwh float NOT NULL,
        connectorType varchar(20) NOT NULL DEFAULT 'TYPE_2',
        maxChargingPowerKw float,
        licensePlate varchar(20),
        color varchar(50),
        nickname varchar(100),
        isDefault boolean NOT NULL DEFAULT false,
        photoUrl text,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `, "user_vehicles: create table");
  } else {
    console.log("⊘ user_vehicles: table already exists");
  }

  // 9. Verify firmware_updates is fixed
  if (await columnExists('firmware_updates', 'firmware_status')) {
    await safeExec(
      "ALTER TABLE firmware_updates CHANGE COLUMN firmware_status status varchar(50) NOT NULL DEFAULT 'PENDING'",
      "firmware_updates: rename firmware_status -> status"
    );
  }

  // 10. crowdfunding_projects - ensure crowdfunding_status column name
  if (await columnExists('crowdfunding_projects', 'status')) {
    // Check if it's the crowdfunding status enum
    const [col] = await conn.query(
      "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crowdfunding_projects' AND COLUMN_NAME='status'"
    );
    if (col.length > 0 && col[0].COLUMN_TYPE.includes('DRAFT')) {
      await safeExec(
        "ALTER TABLE crowdfunding_projects CHANGE COLUMN status crowdfunding_status " + col[0].COLUMN_TYPE + " NOT NULL DEFAULT 'DRAFT'",
        "crowdfunding_projects: rename status -> crowdfunding_status"
      );
    }
  }

  // 11. crowdfunding_participations - ensure payment_status column name
  if (await columnExists('crowdfunding_participations', 'paymentStatus')) {
    await safeExec(
      "ALTER TABLE crowdfunding_participations CHANGE COLUMN paymentStatus payment_status enum('PENDING','COMPLETED','FAILED','REFUNDED') NOT NULL DEFAULT 'PENDING'",
      "crowdfunding_participations: rename paymentStatus -> payment_status"
    );
  }

  // Final verification
  console.log("\n=== Final Verification ===");
  const [allTables] = await conn.query(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME NOT LIKE '__drizzle%' ORDER BY TABLE_NAME"
  );
  console.log(`Total tables: ${allTables.length}`);
  
  await conn.end();
  console.log("\n✓ Schema sync complete!");
}

main().catch(e => { console.error(e); process.exit(1); });
