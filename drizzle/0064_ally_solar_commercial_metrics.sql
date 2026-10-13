-- Métricas comerciales explícitas provenientes de la propuesta solar.
-- Son nulas por defecto para no inferir beneficios en espacios históricos.
ALTER TABLE `space_submissions`
  ADD COLUMN IF NOT EXISTS `solar_program_total_energy_savings_cop` BIGINT NULL;

ALTER TABLE `space_submissions`
  ADD COLUMN IF NOT EXISTS `solar_program_annual_return_percent` DECIMAL(7,2) NULL;
