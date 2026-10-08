ALTER TABLE `electronic_invoices`
  ADD COLUMN `billed_unit_price` decimal(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `billed_product_id` varchar(150) NULL,
  ADD COLUMN `billed_product_name` varchar(255) NULL;
