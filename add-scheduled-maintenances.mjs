import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

async function migrate() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set');

  const url = new URL(dbUrl);
  const sslParam = url.searchParams.get('ssl');
  let sslConfig = undefined;
  if (sslParam) {
    try {
      sslConfig = JSON.parse(sslParam);
    } catch {
      sslConfig = { rejectUnauthorized: true };
    }
  }
  url.searchParams.delete('ssl');

  const conn = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 4000,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: sslConfig,
  });

  console.log('Connected to database');

  // Create scheduled_maintenances table
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS scheduled_maintenances (
      id INT AUTO_INCREMENT PRIMARY KEY,
      stationId INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      maintenanceType VARCHAR(100) NOT NULL,
      frequency ENUM('weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual', 'one_time') NOT NULL,
      nextDueDate TIMESTAMP NOT NULL,
      lastCompletedDate TIMESTAMP NULL,
      preferredTimeStart VARCHAR(5) NOT NULL DEFAULT '08:00',
      preferredTimeEnd VARCHAR(5) NOT NULL DEFAULT '17:00',
      assignedTechnicianId INT,
      assignedEngineerId INT,
      estimatedCostCop BIGINT DEFAULT 0,
      reminderDaysBefore INT NOT NULL DEFAULT 3,
      reminderSent BOOLEAN NOT NULL DEFAULT FALSE,
      status ENUM('active', 'paused', 'completed', 'cancelled') NOT NULL DEFAULT 'active',
      notes TEXT,
      createdBy INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log('Created scheduled_maintenances table');

  // Create maintenance_tasks table
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS maintenance_tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      scheduleId INT NOT NULL,
      stationId INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      maintenanceType VARCHAR(100) NOT NULL,
      dueDate TIMESTAMP NOT NULL,
      scheduledDate TIMESTAMP NULL,
      completedDate TIMESTAMP NULL,
      assignedTechnicianId INT,
      status ENUM('pending', 'in_progress', 'completed', 'overdue', 'cancelled') NOT NULL DEFAULT 'pending',
      completionNotes TEXT,
      actualCostCop BIGINT DEFAULT 0,
      fundRecordId INT,
      qualityRating INT,
      ratingNotes TEXT,
      ratedBy INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log('Created maintenance_tasks table');

  await conn.end();
  console.log('Migration completed successfully');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
