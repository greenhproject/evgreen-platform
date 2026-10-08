-- Protección de reservas afectadas por indisponibilidad operacional.
-- La extensión de ENUM conserva todos los estados existentes y es no destructiva.
ALTER TABLE `reservations`
  MODIFY COLUMN `reservation_status` ENUM('ACTIVE','EXPIRED','CANCELLED','FULFILLED','NO_SHOW','SERVICE_UNAVAILABLE') NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN `service_issue_code` varchar(80) NULL,
  ADD COLUMN `service_issue_at` timestamp NULL;

CREATE INDEX `idx_reservations_status_end` ON `reservations` (`reservation_status`, `endTime`);
