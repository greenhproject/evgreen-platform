ALTER TABLE `platform_settings`
  ADD COLUMN IF NOT EXISTS `resend_webhook_secret_encrypted` text NULL,
  ADD COLUMN IF NOT EXISTS `resend_webhook_configured_at` timestamp NULL;
