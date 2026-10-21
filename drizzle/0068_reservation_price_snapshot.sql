ALTER TABLE `reservations`
  ADD COLUMN `locked_price_per_kwh` decimal(10,2) NULL,
  ADD COLUMN `locked_connection_fee` decimal(10,2) NULL,
  ADD COLUMN `price_locked_at` timestamp NULL;

ALTER TABLE `transactions`
  ADD COLUMN `applied_connection_fee` decimal(10,2) NULL;
