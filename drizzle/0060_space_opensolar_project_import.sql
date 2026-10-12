-- Referencia auditable al proyecto OpenSolar que sirvió de fuente para precargar datos técnicos.
-- No almacena la respuesta remota, contactos, token ni credenciales.
ALTER TABLE `space_submissions`
  ADD COLUMN IF NOT EXISTS `opensolar_project_id` varchar(80) NULL,
  ADD COLUMN IF NOT EXISTS `opensolar_project_title` varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS `opensolar_annual_consumption_kwh` decimal(14,2) NULL,
  ADD COLUMN IF NOT EXISTS `opensolar_project_imported_at` timestamp NULL;
