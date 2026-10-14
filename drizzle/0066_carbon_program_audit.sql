-- Módulo de impacto ambiental y preauditoría de carbono.
-- Los registros no emiten ni venden créditos por sí mismos; conservan evidencia,
-- factores versionados, costos y lotes para revisión independiente.

CREATE TABLE IF NOT EXISTS `carbon_program_settings` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `country` VARCHAR(100) NOT NULL DEFAULT 'Colombia',
  `program_name` VARCHAR(255) NOT NULL DEFAULT 'Impacto EVGreen',
  `methodology_code` VARCHAR(120) NOT NULL DEFAULT 'PENDIENTE_DE_DEFINIR',
  `methodology_name` VARCHAR(255) NOT NULL DEFAULT 'Metodología por confirmar con el programa certificador',
  `methodology_status` ENUM('DRAFT','PRE_AUDIT','REGISTERED','VALIDATED','VERIFIED') NOT NULL DEFAULT 'DRAFT',
  `grid_inventory_factor_tco2e_per_mwh` DECIMAL(12,6) NOT NULL DEFAULT 0.220000,
  `grid_inventory_factor_year` INT NOT NULL DEFAULT 2024,
  `grid_inventory_factor_source_url` VARCHAR(500) NOT NULL,
  `solar_avoided_factor_tco2e_per_mwh` DECIMAL(12,6) NOT NULL DEFAULT 0.660000,
  `solar_avoided_factor_year` INT NOT NULL DEFAULT 2024,
  `solar_avoided_factor_source_url` VARCHAR(500) NOT NULL,
  `ev_displacement_factor_tco2e_per_mwh` DECIMAL(12,6),
  `ev_displacement_factor_source_url` VARCHAR(500),
  `ev_displacement_enabled` TINYINT NOT NULL DEFAULT 0,
  `estimated_credit_price_cop_per_tco2e` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `registry_commission_percent` DECIMAL(7,4) NOT NULL DEFAULT 0.0000,
  `minimum_sellable_tco2e` DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  `public_stats_enabled` TINYINT NOT NULL DEFAULT 0,
  `updated_by` INT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `carbon_program_settings_id` PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `carbon_solar_meter_readings` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `station_id` INT NOT NULL,
  `period_start` TIMESTAMP NOT NULL,
  `period_end` TIMESTAMP NOT NULL,
  `generation_kwh` DECIMAL(14,4) NOT NULL,
  `source_type` ENUM('INVERTER_METER','UTILITY_BILL','MANUAL_METER','OTHER') NOT NULL,
  `verification_status` ENUM('DRAFT','VERIFIED','REJECTED') NOT NULL DEFAULT 'DRAFT',
  `evidence_reference` VARCHAR(500),
  `note` TEXT,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `carbon_solar_meter_readings_id` PRIMARY KEY (`id`)
);
CREATE INDEX `idx_carbon_solar_station_period` ON `carbon_solar_meter_readings` (`station_id`,`period_start`,`period_end`);
CREATE INDEX `idx_carbon_solar_verification` ON `carbon_solar_meter_readings` (`verification_status`,`period_end`);

CREATE TABLE IF NOT EXISTS `carbon_cost_entries` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `category` ENUM('CONSULTING','VALIDATION','VERIFICATION','REGISTRY','LEGAL','MONITORING','COMMISSION','MARKETING','OTHER') NOT NULL,
  `cost_type` ENUM('FIXED','VARIABLE_PER_TCO2E','ONE_TIME') NOT NULL,
  `amount_cop` DECIMAL(15,2) NOT NULL,
  `periodicity` ENUM('MONTHLY','QUARTERLY','ANNUAL','ONE_TIME') NOT NULL DEFAULT 'ONE_TIME',
  `active_from` TIMESTAMP NOT NULL,
  `active_to` TIMESTAMP,
  `status` ENUM('ACTIVE','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  `note` TEXT,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `carbon_cost_entries_id` PRIMARY KEY (`id`)
);
CREATE INDEX `idx_carbon_cost_active` ON `carbon_cost_entries` (`status`,`active_from`);

CREATE TABLE IF NOT EXISTS `carbon_credit_lots` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `period_start` TIMESTAMP NOT NULL,
  `period_end` TIMESTAMP NOT NULL,
  `estimated_tco2e` DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  `verified_tco2e` DECIMAL(14,4),
  `issued_tco2e` DECIMAL(14,4),
  `sold_tco2e` DECIMAL(14,4),
  `status` ENUM('DRAFT','UNDER_REVIEW','VERIFIED','ISSUED','LISTED','SOLD','RETIRED','REJECTED') NOT NULL DEFAULT 'DRAFT',
  `registry_name` VARCHAR(120),
  `registry_project_reference` VARCHAR(255),
  `serial_reference` VARCHAR(500),
  `sale_price_cop_per_tco2e` DECIMAL(15,2),
  `note` TEXT,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `carbon_credit_lots_id` PRIMARY KEY (`id`)
);
CREATE INDEX `idx_carbon_lot_status_period` ON `carbon_credit_lots` (`status`,`period_end`);

CREATE TABLE IF NOT EXISTS `carbon_audit_events` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `event_type` VARCHAR(80) NOT NULL,
  `entity_type` VARCHAR(80) NOT NULL,
  `entity_id` INT,
  `actor_user_id` INT NOT NULL,
  `actor_role` VARCHAR(50) NOT NULL,
  `metadata` JSON,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `carbon_audit_events_id` PRIMARY KEY (`id`)
);
CREATE INDEX `idx_carbon_audit_entity` ON `carbon_audit_events` (`entity_type`,`entity_id`,`created_at`);
CREATE INDEX `idx_carbon_audit_created` ON `carbon_audit_events` (`created_at`);
