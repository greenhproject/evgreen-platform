CREATE TABLE `user_onboarding_progress` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `version` varchar(30) NOT NULL DEFAULT '2026-08-v1',
  `status` enum('IN_PROGRESS','COMPLETED','SKIPPED') NOT NULL DEFAULT 'IN_PROGRESS',
  `current_step` int NOT NULL DEFAULT 1,
  `started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_saved_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL,
  `skipped_at` timestamp NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_onboarding_progress_user_unique` (`user_id`)
);

CREATE TABLE `user_onboarding_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `event_type` varchar(60) NOT NULL,
  `granted` tinyint NULL,
  `policy_version` varchar(30) NULL,
  `ip_address` varchar(45) NULL,
  `user_agent` varchar(512) NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_onboarding_events_user_created_idx` (`user_id`, `created_at`)
);

ALTER TABLE `users`
  ADD COLUMN `electronic_invoice_opt_in` tinyint NOT NULL DEFAULT 0;
