ALTER TABLE `space_submissions`
  ADD COLUMN IF NOT EXISTS `minimum_investment_cop` BIGINT NULL,
  ADD COLUMN IF NOT EXISTS `estimated_roi_percent` DECIMAL(7,2) NULL,
  ADD COLUMN IF NOT EXISTS `estimated_payback_months` INT NULL,
  ADD COLUMN IF NOT EXISTS `financial_projection_updated_at` TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS `financial_projection_updated_by` INT NULL;
