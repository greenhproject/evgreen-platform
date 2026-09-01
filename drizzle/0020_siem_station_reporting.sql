ALTER TABLE `charging_stations` ADD COLUMN IF NOT EXISTS `siem_reporting_enabled` tinyint NOT NULL DEFAULT 0;
CREATE INDEX `idx_station_siem_reporting` ON `charging_stations` (`siem_reporting_enabled`, `isActive`, `isPublic`);
