import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  async function safeExec(sql, desc) {
    try {
      await conn.query(sql);
      console.log(`✓ ${desc}`);
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME' || e.code === 'ER_CANT_DROP_FIELD_OR_KEY' || e.message.includes('Duplicate column') || e.message.includes('already exists')) {
        console.log(`⊘ ${desc} (already done)`);
      } else {
        console.log(`✗ ${desc}: ${e.message}`);
      }
    }
  }

  // ===== firmware_updates table fixes =====
  // DB has firmware_status (enum) but schema expects status (varchar)
  await safeExec(
    "ALTER TABLE firmware_updates CHANGE COLUMN firmware_status status varchar(50) NOT NULL DEFAULT 'PENDING'",
    "firmware_updates: rename firmware_status -> status (varchar)"
  );
  
  // DB has initiated_at but schema expects started_at
  await safeExec(
    "ALTER TABLE firmware_updates CHANGE COLUMN initiated_at started_at timestamp NULL",
    "firmware_updates: rename initiated_at -> started_at"
  );
  
  // DB missing file_size column (schema has it)
  await safeExec(
    "ALTER TABLE firmware_updates ADD COLUMN file_size int NOT NULL DEFAULT 0",
    "firmware_updates: add file_size column"
  );
  
  // DB file_name is varchar(255) but schema expects varchar(500)
  await safeExec(
    "ALTER TABLE firmware_updates MODIFY COLUMN file_name varchar(500) NOT NULL",
    "firmware_updates: expand file_name to varchar(500)"
  );
  
  // DB missing created_at and updated_at
  await safeExec(
    "ALTER TABLE firmware_updates ADD COLUMN created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP",
    "firmware_updates: add created_at column"
  );
  await safeExec(
    "ALTER TABLE firmware_updates ADD COLUMN updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP",
    "firmware_updates: add updated_at column"
  );
  
  // DB missing error_message (check if it exists)
  const [fwCols] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='firmware_updates' AND COLUMN_NAME='error_message'");
  if (fwCols.length === 0) {
    await safeExec(
      "ALTER TABLE firmware_updates ADD COLUMN error_message text",
      "firmware_updates: add error_message column"
    );
  }
  
  // DB missing notes
  const [notesCols] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='firmware_updates' AND COLUMN_NAME='notes'");
  if (notesCols.length === 0) {
    await safeExec(
      "ALTER TABLE firmware_updates ADD COLUMN notes text",
      "firmware_updates: add notes column"
    );
  }

  // ===== Verify all tables match schema =====
  console.log("\n--- Verification ---");
  
  const tables = [
    'firmware_updates', 'crowdfunding_projects', 'crowdfunding_participations',
    'transactions', 'soc_accuracy_log', 'user_debts'
  ];
  
  for (const table of tables) {
    const [rows] = await conn.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${table}' ORDER BY ORDINAL_POSITION`);
    console.log(`\n${table} (${rows.length} cols):`);
    rows.forEach(r => console.log(`  ${r.COLUMN_NAME}`));
  }
  
  await conn.end();
  console.log("\nDone!");
}

main().catch(e => { console.error(e); process.exit(1); });
