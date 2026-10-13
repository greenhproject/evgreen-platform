CREATE TABLE IF NOT EXISTS `space_photo_history` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `submission_id` INT NOT NULL,
  `photo_id` INT NOT NULL,
  `action` VARCHAR(32) NOT NULL,
  `photo_type` VARCHAR(32) NOT NULL,
  `was_cover` TINYINT NOT NULL DEFAULT 0,
  `was_conceptual` TINYINT NOT NULL DEFAULT 0,
  `changed_by_id` INT,
  `changed_by_role` VARCHAR(32),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `space_photo_history_id` PRIMARY KEY (`id`)
);

CREATE INDEX `idx_space_photo_history_submission_created`
  ON `space_photo_history` (`submission_id`, `created_at`);
CREATE INDEX `idx_space_photo_history_photo`
  ON `space_photo_history` (`photo_id`);
