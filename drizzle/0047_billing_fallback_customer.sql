ALTER TABLE `tenant_billing_settings`
  ADD COLUMN `fallback_customer_enabled` tinyint NOT NULL DEFAULT 0,
  ADD COLUMN `fallback_customer_id` varchar(100) NULL,
  ADD COLUMN `fallback_customer_name` varchar(255) NULL,
  ADD COLUMN `fallback_customer_document_type` varchar(30) NULL,
  ADD COLUMN `fallback_customer_document_number` varchar(50) NULL,
  ADD COLUMN `fallback_customer_email` varchar(320) NULL,
  ADD COLUMN `fallback_customer_address` varchar(500) NULL,
  ADD COLUMN `fallback_customer_city` varchar(100) NULL,
  ADD COLUMN `fallback_customer_department` varchar(100) NULL,
  ADD COLUMN `fallback_customer_kind_of_person` varchar(30) NULL,
  ADD COLUMN `fallback_customer_regime` varchar(40) NULL;

ALTER TABLE `electronic_invoices`
  ADD COLUMN `customer_source` enum('USER','FALLBACK') NOT NULL DEFAULT 'USER';
