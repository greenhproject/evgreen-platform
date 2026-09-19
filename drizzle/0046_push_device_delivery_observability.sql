-- Push móvil multidispositivo y trazabilidad verificable.
-- No altera ni borra users.fcm_token / push_subscription: los campos históricos
-- se conservan durante la transición para no interrumpir dispositivos existentes.

CREATE TABLE IF NOT EXISTS `push_devices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token` text NOT NULL,
  `token_hash` varchar(64) NOT NULL,
  `platform` enum('android','ios','web','unknown') NOT NULL DEFAULT 'unknown',
  `app_version` varchar(50) DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE','INVALID') NOT NULL DEFAULT 'ACTIVE',
  `registered_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_seen_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_accepted_at` timestamp NULL DEFAULT NULL,
  `last_received_at` timestamp NULL DEFAULT NULL,
  `last_opened_at` timestamp NULL DEFAULT NULL,
  `last_error_code` varchar(128) DEFAULT NULL,
  `last_error_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_push_devices_token_hash` (`token_hash`),
  KEY `idx_push_devices_user_status` (`user_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `push_delivery_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `delivery_id` varchar(80) NOT NULL,
  `user_id` int NOT NULL,
  `device_id` int DEFAULT NULL,
  `channel` enum('FCM','WEB_PUSH') NOT NULL,
  `status` enum('REQUESTED','ACCEPTED','RECEIVED','OPENED','FAILED') NOT NULL DEFAULT 'REQUESTED',
  `notification_type` varchar(50) NOT NULL,
  `provider_message_id` varchar(255) DEFAULT NULL,
  `requested_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `accepted_at` timestamp NULL DEFAULT NULL,
  `received_at` timestamp NULL DEFAULT NULL,
  `opened_at` timestamp NULL DEFAULT NULL,
  `failed_at` timestamp NULL DEFAULT NULL,
  `error_code` varchar(128) DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_push_delivery_events_delivery` (`delivery_id`),
  KEY `idx_push_delivery_events_user_created` (`user_id`,`requested_at`),
  KEY `idx_push_delivery_events_device_created` (`device_id`,`requested_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
