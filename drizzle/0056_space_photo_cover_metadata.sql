ALTER TABLE `space_photos`
  ADD COLUMN IF NOT EXISTS `is_cover` TINYINT NOT NULL DEFAULT 0 AFTER `sortOrder`,
  ADD COLUMN IF NOT EXISTS `is_conceptual` TINYINT NOT NULL DEFAULT 0 AFTER `is_cover`;

CREATE INDEX `idx_space_photos_cover` ON `space_photos` (`submissionId`, `is_cover`, `sortOrder`);
