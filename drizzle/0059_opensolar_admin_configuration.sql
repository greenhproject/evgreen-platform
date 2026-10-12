-- Integración OpenSolar administrable desde Configuración.
-- El token se persiste cifrado; la prueba sólo realiza una lectura de organización.
ALTER TABLE `platform_settings`
  ADD COLUMN IF NOT EXISTS `opensolar_enabled` tinyint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `opensolar_org_id` varchar(80) NULL,
  ADD COLUMN IF NOT EXISTS `opensolar_api_key_encrypted` text NULL,
  ADD COLUMN IF NOT EXISTS `opensolar_last_test_at` timestamp NULL,
  ADD COLUMN IF NOT EXISTS `opensolar_last_test_status` enum('NEVER','SUCCESS','FAILED') NOT NULL DEFAULT 'NEVER',
  ADD COLUMN IF NOT EXISTS `opensolar_last_test_message` text NULL;
