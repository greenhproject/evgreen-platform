CREATE TABLE IF NOT EXISTS `crowdfunding_station_link_repairs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `projectId` int NOT NULL,
  `orphanedStationId` int NOT NULL,
  `action` varchar(64) NOT NULL,
  `reason` text NOT NULL,
  `actorId` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cf_station_link_repairs_project_created` (`projectId`, `createdAt`),
  KEY `idx_cf_station_link_repairs_station` (`orphanedStationId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
