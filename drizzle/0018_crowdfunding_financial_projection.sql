ALTER TABLE `crowdfunding_projects`
  ADD COLUMN `financial_projection_snapshot` json NULL,
  ADD COLUMN `financial_projection_scenario` varchar(20) NULL,
  ADD COLUMN `financial_projection_updated_at` timestamp NULL,
  ADD COLUMN `financial_projection_updated_by` int NULL;
