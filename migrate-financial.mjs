import 'dotenv/config';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function run() {
  const conn = await mysql.createConnection(DATABASE_URL + '&multipleStatements=true');
  
  const statements = [
    // ===== 1. station_fixed_expenses =====
    `CREATE TABLE IF NOT EXISTS station_fixed_expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      stationId INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      category ENUM('insurance','connectivity','energy','maintenance','fiduciary','tax','admin','other') NOT NULL DEFAULT 'other',
      amount DECIMAL(14,2) NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'COP',
      frequency ENUM('monthly','quarterly','semiannual','annual','one_time') NOT NULL DEFAULT 'monthly',
      isActive TINYINT(1) NOT NULL DEFAULT 1,
      startDate BIGINT,
      endDate BIGINT,
      createdBy INT,
      createdAt BIGINT NOT NULL DEFAULT 0,
      updatedAt BIGINT NOT NULL DEFAULT 0
    )`,

    // ===== 2. settlement_periods =====
    `CREATE TABLE IF NOT EXISTS settlement_periods (
      id INT AUTO_INCREMENT PRIMARY KEY,
      stationId INT NOT NULL,
      periodType ENUM('monthly','quarterly','semiannual','annual') NOT NULL DEFAULT 'monthly',
      periodLabel VARCHAR(50) NOT NULL,
      startDate BIGINT NOT NULL,
      endDate BIGINT NOT NULL,
      status ENUM('open','calculating','closed','distributed','cancelled') NOT NULL DEFAULT 'open',
      grossRevenue DECIMAL(14,2) NOT NULL DEFAULT 0,
      totalExpenses DECIMAL(14,2) NOT NULL DEFAULT 0,
      netRevenue DECIMAL(14,2) NOT NULL DEFAULT 0,
      platformFee DECIMAL(14,2) NOT NULL DEFAULT 0,
      platformFeePercent DECIMAL(5,2) NOT NULL DEFAULT 30,
      investorPool DECIMAL(14,2) NOT NULL DEFAULT 0,
      investorPoolPercent DECIMAL(5,2) NOT NULL DEFAULT 70,
      totalKwhSold DECIMAL(12,4) NOT NULL DEFAULT 0,
      totalSessions INT NOT NULL DEFAULT 0,
      avgPricePerKwh DECIMAL(10,2) NOT NULL DEFAULT 0,
      notes TEXT,
      closedAt BIGINT,
      closedBy INT,
      createdAt BIGINT NOT NULL DEFAULT 0,
      updatedAt BIGINT NOT NULL DEFAULT 0
    )`,

    // ===== 3. settlement_expense_lines =====
    `CREATE TABLE IF NOT EXISTS settlement_expense_lines (
      id INT AUTO_INCREMENT PRIMARY KEY,
      settlementId INT NOT NULL,
      fixedExpenseId INT,
      name VARCHAR(255) NOT NULL,
      category ENUM('insurance','connectivity','energy','maintenance','fiduciary','tax','admin','other') NOT NULL DEFAULT 'other',
      amount DECIMAL(14,2) NOT NULL,
      waterfallOrder INT NOT NULL DEFAULT 0,
      createdAt BIGINT NOT NULL DEFAULT 0
    )`,

    // ===== 4. investor_distributions =====
    `CREATE TABLE IF NOT EXISTS investor_distributions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      settlementId INT NOT NULL,
      investorId INT NOT NULL,
      stationId INT NOT NULL,
      participationPercent DECIMAL(8,4) NOT NULL,
      grossAmount DECIMAL(14,2) NOT NULL,
      netAmount DECIMAL(14,2) NOT NULL,
      withholdingTax DECIMAL(14,2) NOT NULL DEFAULT 0,
      withholdingPercent DECIMAL(5,2) NOT NULL DEFAULT 0,
      status ENUM('pending','approved','paid','cancelled') NOT NULL DEFAULT 'pending',
      paymentMethod VARCHAR(50),
      paymentReference VARCHAR(255),
      paidAt BIGINT,
      notes TEXT,
      createdAt BIGINT NOT NULL DEFAULT 0,
      updatedAt BIGINT NOT NULL DEFAULT 0
    )`,

    // ===== 5. operational_metrics =====
    `CREATE TABLE IF NOT EXISTS operational_metrics (
      id INT AUTO_INCREMENT PRIMARY KEY,
      stationId INT NOT NULL,
      metricType ENUM('availability','response_time','platform_uptime','user_satisfaction','billing_accuracy','solar_generation') NOT NULL,
      periodLabel VARCHAR(50) NOT NULL,
      periodStart BIGINT NOT NULL,
      periodEnd BIGINT NOT NULL,
      targetValue DECIMAL(10,4) NOT NULL,
      actualValue DECIMAL(10,4) NOT NULL,
      unit VARCHAR(20) NOT NULL DEFAULT 'percent',
      complianceStatus ENUM('compliant','warning','non_compliant','improvement_plan') NOT NULL DEFAULT 'compliant',
      details JSON,
      createdAt BIGINT NOT NULL DEFAULT 0,
      updatedAt BIGINT NOT NULL DEFAULT 0
    )`,

    // ===== 6. financial_reports =====
    `CREATE TABLE IF NOT EXISTS financial_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      stationId INT NOT NULL,
      reportType ENUM('monthly_pl','quarterly_pl','annual_pl','waterfall','investor_statement','tax_certificate') NOT NULL,
      periodLabel VARCHAR(50) NOT NULL,
      periodStart BIGINT NOT NULL,
      periodEnd BIGINT NOT NULL,
      fileUrl TEXT,
      fileKey VARCHAR(255),
      generatedBy INT,
      status ENUM('generating','ready','error') NOT NULL DEFAULT 'generating',
      metadata JSON,
      createdAt BIGINT NOT NULL DEFAULT 0
    )`,

    // ===== Indexes =====
    'CREATE INDEX idx_sfe_station ON station_fixed_expenses(stationId)',
    'CREATE INDEX idx_sp_station ON settlement_periods(stationId)',
    'CREATE INDEX idx_sp_status ON settlement_periods(status)',
    'CREATE INDEX idx_sel_settlement ON settlement_expense_lines(settlementId)',
    'CREATE INDEX idx_id_settlement ON investor_distributions(settlementId)',
    'CREATE INDEX idx_id_investor ON investor_distributions(investorId)',
    'CREATE INDEX idx_id_station ON investor_distributions(stationId)',
    'CREATE INDEX idx_om_station ON operational_metrics(stationId)',
    'CREATE INDEX idx_om_type ON operational_metrics(metricType)',
    'CREATE INDEX idx_fr_station ON financial_reports(stationId)',
    'CREATE INDEX idx_fr_type ON financial_reports(reportType)',
  ];

  for (const sql of statements) {
    try {
      await conn.execute(sql);
      const tableName = sql.match(/(?:CREATE TABLE IF NOT EXISTS|CREATE INDEX \w+ ON) (\w+)/)?.[1] || 'index';
      console.log(`✓ ${tableName}`);
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME' || err.message.includes('Duplicate')) {
        console.log(`⊘ Already exists: ${err.message.substring(0, 80)}`);
      } else {
        console.error(`✗ Error: ${err.message.substring(0, 120)}`);
      }
    }
  }

  await conn.end();
  console.log('\n✅ Financial system migration complete!');
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
