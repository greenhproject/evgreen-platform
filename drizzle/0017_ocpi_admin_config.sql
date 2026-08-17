-- Centro administrativo OCPI / CargaME-SIEM.
-- Los secretos se guardan cifrados por la aplicación; nunca se exponen por API.
ALTER TABLE `platform_settings`
  ADD COLUMN IF NOT EXISTS `ocpi_provider` enum('CARGAME') NOT NULL DEFAULT 'CARGAME',
  ADD COLUMN IF NOT EXISTS `ocpi_environment` enum('SANDBOX','PRODUCTION') NOT NULL DEFAULT 'SANDBOX',
  ADD COLUMN IF NOT EXISTS `ocpi_enabled` tinyint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `ocpi_auto_sync` tinyint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `ocpi_versions_url` text,
  ADD COLUMN IF NOT EXISTS `ocpi_country_code` varchar(2) DEFAULT 'CO',
  ADD COLUMN IF NOT EXISTS `ocpi_party_id` varchar(3),
  ADD COLUMN IF NOT EXISTS `ocpi_modules` json,
  ADD COLUMN IF NOT EXISTS `ocpi_token_encrypted` text,
  ADD COLUMN IF NOT EXISTS `ocpi_mtls_cert_encrypted` text,
  ADD COLUMN IF NOT EXISTS `ocpi_mtls_key_encrypted` text,
  ADD COLUMN IF NOT EXISTS `ocpi_last_test_at` timestamp NULL,
  ADD COLUMN IF NOT EXISTS `ocpi_last_test_status` enum('NEVER','SUCCESS','FAILED') NOT NULL DEFAULT 'NEVER',
  ADD COLUMN IF NOT EXISTS `ocpi_last_test_message` text;
