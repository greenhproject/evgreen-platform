-- Separa los dos proyectos OpenSolar sin eliminar datos existentes:
-- 1) sistema solar de la electrolinera (inversión/costo de energía)
-- 2) sistema solar del aliado (EDS/comercio y programa de ahorro).
-- Nunca persiste respuestas crudas, contactos, tokens ni credenciales.

ALTER TABLE `space_submissions`
  ADD COLUMN IF NOT EXISTS `charging_solar_opensolar_project_id` varchar(80) NULL,
  ADD COLUMN IF NOT EXISTS `charging_solar_opensolar_project_title` varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS `charging_solar_annual_consumption_kwh` decimal(14,2) NULL,
  ADD COLUMN IF NOT EXISTS `charging_solar_opensolar_project_imported_at` timestamp NULL,
  ADD COLUMN IF NOT EXISTS `charging_solar_system_power_kwp` decimal(10,2) NULL,
  ADD COLUMN IF NOT EXISTS `charging_solar_annual_generation_kwh` decimal(14,2) NULL,
  ADD COLUMN IF NOT EXISTS `charging_solar_self_consumption_percent` decimal(5,2) NULL,
  ADD COLUMN IF NOT EXISTS `charging_solar_export_percent` decimal(5,2) NULL,
  ADD COLUMN IF NOT EXISTS `ally_solar_opensolar_project_id` varchar(80) NULL,
  ADD COLUMN IF NOT EXISTS `ally_solar_opensolar_project_title` varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS `ally_solar_annual_consumption_kwh` decimal(14,2) NULL,
  ADD COLUMN IF NOT EXISTS `ally_solar_opensolar_project_imported_at` timestamp NULL;

-- La referencia OpenSolar histórica vivía dentro del bloque del sistema de la
-- electrolinera. Se preserva como referencia del proyecto de carga. No se
-- traslada a los campos del aliado ni se asigna generación/potencia histórica
-- porque su finalidad original no es auditable de forma inequívoca.
UPDATE `space_submissions`
SET
  `charging_solar_opensolar_project_id` = COALESCE(`charging_solar_opensolar_project_id`, `opensolar_project_id`),
  `charging_solar_opensolar_project_title` = COALESCE(`charging_solar_opensolar_project_title`, `opensolar_project_title`),
  `charging_solar_annual_consumption_kwh` = COALESCE(`charging_solar_annual_consumption_kwh`, `opensolar_annual_consumption_kwh`),
  `charging_solar_opensolar_project_imported_at` = COALESCE(`charging_solar_opensolar_project_imported_at`, `opensolar_project_imported_at`)
WHERE `opensolar_project_id` IS NOT NULL
  AND `charging_solar_opensolar_project_id` IS NULL;
