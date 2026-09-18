ALTER TABLE `tenant_billing_settings`
  ADD COLUMN `billing_rounding_mode` enum('nearest_integer','two_decimals') NOT NULL DEFAULT 'two_decimals';
