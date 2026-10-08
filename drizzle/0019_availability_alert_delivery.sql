ALTER TABLE `station_availability_alerts`
  MODIFY COLUMN `alert_req_status` ENUM('PENDING','PROCESSING','SENT','CANCELLED','EXPIRED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `availability_push_status` ENUM('PENDING','SENT','FAILED','NOT_AVAILABLE','NOT_REQUESTED') NOT NULL DEFAULT 'PENDING' AFTER `alert_req_status`;

ALTER TABLE `station_availability_alerts`
  ADD COLUMN `availability_whatsapp_status` ENUM('PENDING','SENT','FAILED','WAITING_TEMPLATE','NO_PHONE','NOT_AVAILABLE','NOT_REQUESTED') NOT NULL DEFAULT 'PENDING' AFTER `availability_push_status`,
  ADD COLUMN `pushError` TEXT NULL,
  ADD COLUMN `whatsappError` TEXT NULL,
  ADD COLUMN `attemptCount` INT NOT NULL DEFAULT 0,
  ADD COLUMN `lastAttemptAt` TIMESTAMP NULL,
  ADD COLUMN `nextAttemptAt` TIMESTAMP NULL,
  ADD COLUMN `processingStartedAt` TIMESTAMP NULL;

ALTER TABLE `station_availability_alerts`
  ADD INDEX `idx_station_retry` (`stationId`, `alert_req_status`, `nextAttemptAt`);

ALTER TABLE `whatsapp_config`
  ADD COLUMN `notifyStationAvailable` TINYINT NOT NULL DEFAULT 1;

ALTER TABLE `whatsapp_config`
  ADD COLUMN `stationAvailableTemplateName` VARCHAR(100) NULL DEFAULT 'evgreen_estacion_disponible_v1',
  ADD COLUMN `stationAvailableTemplateId` VARCHAR(100) NULL,
  ADD COLUMN `stationAvailableTemplateStatus` VARCHAR(30) NULL DEFAULT 'NOT_CONFIGURED',
  ADD COLUMN `stationAvailableTemplateCheckedAt` TIMESTAMP NULL;
