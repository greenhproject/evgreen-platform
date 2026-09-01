CREATE TABLE IF NOT EXISTS `space_status_history` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `submission_id` INT NOT NULL,
  `from_status` ENUM('pending','under_review','approved','rejected','letter_sent','letter_accepted','published','funded','in_construction','operational') NOT NULL,
  `to_status` ENUM('pending','under_review','approved','rejected','letter_sent','letter_accepted','published','funded','in_construction','operational') NOT NULL,
  `changed_by_id` INT NULL,
  `changed_by_role` VARCHAR(32) NULL,
  `note` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_space_status_history_submission_created` (`submission_id`, `created_at`)
);
