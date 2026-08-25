-- Alinea el esquema de producción con drizzle/schema.ts.
-- La columna permite al flujo de sobretiempo consultar transacciones finalizadas
-- sin fallar en instalaciones creadas antes de transaction_status.
ALTER TABLE `transactions`
  ADD COLUMN `transactionStatus` enum('PENDING','IN_PROGRESS','COMPLETED','FAILED','CANCELLED')
  NOT NULL DEFAULT 'PENDING' AFTER `status`;

UPDATE `transactions`
SET `transactionStatus` = `status`
WHERE `transactionStatus` = 'PENDING' AND `status` <> 'PENDING';
