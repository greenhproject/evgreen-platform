-- Estado durable de una orden de detención remota.
-- Una orden OCPP aceptada no equivale al fin físico de la carga: éste sólo se
-- confirma mediante StopTransaction (OCPP 1.6) o TransactionEvent.Ended (2.0.1).
-- Operación exclusivamente aditiva; no modifica sesiones ni cobros existentes.
ALTER TABLE `transactions`
  ADD COLUMN `stopRequestedAt` timestamp NULL,
  ADD COLUMN `stop_request_status` enum('NONE','REQUESTED','ACCEPTED','REJECTED','TIMED_OUT','CONFIRMED') NOT NULL DEFAULT 'NONE',
  ADD COLUMN `stopRequestMessage` varchar(255) NULL;
