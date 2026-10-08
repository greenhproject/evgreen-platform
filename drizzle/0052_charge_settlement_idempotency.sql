-- Previene cobros duplicados ante retransmisiones OCPP 1.6 y StopTransaction.
-- Migración exclusivamente aditiva; las filas históricas permanecen sin clave.

ALTER TABLE `transactions`
  ADD COLUMN IF NOT EXISTS `ocppStartFingerprint` varchar(191) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS `ux_transactions_ocpp_start_fingerprint`
  ON `transactions` (`ocppStartFingerprint`);

CREATE UNIQUE INDEX IF NOT EXISTS `ux_transactions_ocpp_transaction_id`
  ON `transactions` (`ocppTransactionId`);

ALTER TABLE `wallet_transactions`
  ADD COLUMN IF NOT EXISTS `idempotencyKey` varchar(191) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS `ux_wallet_transactions_idempotency_key`
  ON `wallet_transactions` (`idempotencyKey`);
