ALTER TABLE `platform_settings` ADD COLUMN IF NOT EXISTS `ocpi_inbound_token_encrypted` text NULL;

CREATE TABLE IF NOT EXISTS `ocpi_remote_locations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `provider` varchar(32) NOT NULL DEFAULT 'CARGAME',
  `country_code` varchar(2) NOT NULL,
  `party_id` varchar(3) NOT NULL,
  `location_id` varchar(64) NOT NULL,
  `name` varchar(255) NULL,
  `address` varchar(255) NULL,
  `city` varchar(120) NULL,
  `latitude` varchar(32) NULL,
  `longitude` varchar(32) NULL,
  `status` varchar(32) NOT NULL DEFAULT 'ACTIVE',
  `last_updated` datetime NULL,
  `raw_location` json NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ocpi_remote_location_partner_location` (`provider`,`country_code`,`party_id`,`location_id`),
  KEY `idx_ocpi_remote_locations_provider_updated` (`provider`,`updated_at`)
);
