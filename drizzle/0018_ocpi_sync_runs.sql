CREATE TABLE IF NOT EXISTS `ocpi_sync_runs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `station_id` int NULL,
  `operation` enum('CATALOG_PREVIEW','LOCATION_PUBLISH') NOT NULL,
  `status` enum('PENDING','SKIPPED','SUCCESS','FAILED') NOT NULL,
  `message` text NULL,
  `details` json NULL,
  `created_by` int NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ocpi_sync_runs_station_created` (`station_id`, `created_at`),
  KEY `idx_ocpi_sync_runs_status_created` (`status`, `created_at`)
);
