-- Programa solar 0 inversión para espacios aliados.
-- Los valores son supuestos declarados y no sustituyen el contrato de compraventa
-- de energía, el estudio de factura ni el diseño/ingeniería solar definitivo.
ALTER TABLE `space_submissions`
  ADD COLUMN IF NOT EXISTS `solar_program_enabled` tinyint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `solar_program_current_bill_cop` bigint NULL,
  ADD COLUMN IF NOT EXISTS `solar_program_savings_coverage_percent` decimal(5,2) NULL,
  ADD COLUMN IF NOT EXISTS `solar_program_agreement_years` int NULL,
  ADD COLUMN IF NOT EXISTS `solar_program_annual_cpi_percent` decimal(5,2) NULL,
  ADD COLUMN IF NOT EXISTS `solar_program_useful_life_years` int NULL,
  ADD COLUMN IF NOT EXISTS `solar_system_power_kwp` decimal(10,2) NULL,
  ADD COLUMN IF NOT EXISTS `solar_annual_generation_kwh` decimal(14,2) NULL,
  ADD COLUMN IF NOT EXISTS `solar_self_consumption_percent` decimal(5,2) NULL,
  ADD COLUMN IF NOT EXISTS `solar_export_percent` decimal(5,2) NULL,
  ADD COLUMN IF NOT EXISTS `solar_grid_tariff_cop_per_kwh` int NULL,
  ADD COLUMN IF NOT EXISTS `solar_offer_pdf_url` text NULL,
  ADD COLUMN IF NOT EXISTS `solar_offer_pdf_key` varchar(500) NULL,
  ADD COLUMN IF NOT EXISTS `solar_offer_pdf_name` varchar(255) NULL;
