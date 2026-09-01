ALTER TABLE `crowdfunding_projects`
  ADD COLUMN IF NOT EXISTS `space_inheritance_snapshot` JSON NULL,
  ADD COLUMN IF NOT EXISTS `financial_override_reason` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `financial_override_at` TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS `financial_override_by` INT NULL;
