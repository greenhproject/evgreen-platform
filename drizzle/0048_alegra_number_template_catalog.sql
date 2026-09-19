ALTER TABLE `tenant_billing_settings`
  ADD COLUMN `alegra_number_template_id` varchar(100) NULL,
  ADD COLUMN `alegra_number_template_name` varchar(255) NULL,
  ADD COLUMN `alegra_number_template_prefix` varchar(50) NULL,
  ADD COLUMN `alegra_number_template_resolution` varchar(100) NULL,
  ADD COLUMN `alegra_number_template_start_date` varchar(30) NULL,
  ADD COLUMN `alegra_number_template_end_date` varchar(30) NULL,
  ADD COLUMN `alegra_number_template_start_number` int NULL,
  ADD COLUMN `alegra_number_template_end_number` int NULL,
  ADD COLUMN `alegra_number_template_current_number` int NULL,
  ADD COLUMN `alegra_number_template_synced_at` timestamp NULL;
