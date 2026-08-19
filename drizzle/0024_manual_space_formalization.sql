ALTER TABLE `space_submissions`
  ADD COLUMN IF NOT EXISTS `manual_formalization_reason` text NULL,
  ADD COLUMN IF NOT EXISTS `manual_formalization_evidence` text NULL,
  ADD COLUMN IF NOT EXISTS `manual_formalized_at` timestamp NULL,
  ADD COLUMN IF NOT EXISTS `manual_formalized_by` int NULL;
