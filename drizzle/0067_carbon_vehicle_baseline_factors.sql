-- Matriz auditable de factores de movilidad por vehículo/segmento.
-- Las filas se usan únicamente para una estimación preauditada y no emiten créditos.

CREATE TABLE IF NOT EXISTS `carbon_vehicle_baseline_factors` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `brand_key` VARCHAR(120) NOT NULL,
  `model_key` VARCHAR(120) NOT NULL,
  `display_name` VARCHAR(255) NOT NULL,
  `vehicle_segment` ENUM('PASSENGER_CAR','SUV_LIGHT_TRUCK','OTHER_LIGHT_EV') NOT NULL,
  `ev_consumption_kwh_per_100km` DECIMAL(9,4) NOT NULL,
  `baseline_fuel_economy_km_per_gallon` DECIMAL(9,4) NOT NULL,
  `baseline_fuel_emission_kgco2_per_gallon` DECIMAL(9,4) NOT NULL,
  `grid_factor_tco2e_per_mwh` DECIMAL(12,6) NOT NULL,
  `data_quality` ENUM('MODEL_SPECIFIC','SEGMENT_CONSERVATIVE','NEEDS_REVIEW') NOT NULL DEFAULT 'NEEDS_REVIEW',
  `source_url` VARCHAR(500) NOT NULL,
  `source_title` VARCHAR(255) NOT NULL,
  `methodology_note` TEXT,
  `is_active` TINYINT NOT NULL DEFAULT 1,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `carbon_vehicle_baseline_factors_id` PRIMARY KEY (`id`),
  CONSTRAINT `ux_carbon_vehicle_factor_match` UNIQUE (`brand_key`,`model_key`)
);
CREATE INDEX `idx_carbon_vehicle_factor_active` ON `carbon_vehicle_baseline_factors` (`is_active`,`vehicle_segment`);
