ALTER TABLE `ocpp_alerts`
  MODIFY COLUMN `ocpp_alert_type` ENUM(
    'DISCONNECTION',
    'ERROR',
    'FAULT',
    'OFFLINE_TIMEOUT',
    'BOOT_REJECTED',
    'TRANSACTION_ERROR',
    'NO_TELEMETRY'
  ) NOT NULL;

ALTER TABLE `ocpp_alerts`
  ADD COLUMN `transaction_id` int NULL,
  ADD COLUMN `evse_id` int NULL;

ALTER TABLE `ocpp_alerts`
  ADD KEY `idx_ocpp_alerts_transaction_type_active` (`transaction_id`, `ocpp_alert_type`, `resolvedAt`),
  ADD KEY `idx_ocpp_alerts_station_type_created` (`stationId`, `ocpp_alert_type`, `createdAt`);
