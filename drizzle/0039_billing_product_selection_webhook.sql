ALTER TABLE `tenant_billing_settings`
  ADD COLUMN `selected_product_id` varchar(150) NULL,
  ADD COLUMN `selected_product_name` varchar(255) NULL,
  ADD COLUMN `selected_product_code` varchar(150) NULL,
  ADD COLUMN `selected_product_price` decimal(14, 6) NULL,
  ADD COLUMN `selected_product_taxes` text NULL,
  ADD COLUMN `selected_product_unit` varchar(80) NULL,
  ADD COLUMN `selected_product_tax_included` tinyint NULL,
  ADD COLUMN `selected_product_synced_at` timestamp NULL,
  ADD COLUMN `webhook_secret` text NULL,
  ADD COLUMN `webhook_configured_at` timestamp NULL;
