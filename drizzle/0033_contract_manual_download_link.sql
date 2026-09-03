ALTER TABLE `site_contracts`
  ADD COLUMN `manual_download_token_hash` varchar(64) NULL,
  ADD COLUMN `manual_download_expires_at` timestamp NULL;

CREATE UNIQUE INDEX `site_contracts_manual_download_token_unique`
  ON `site_contracts` (`manual_download_token_hash`);
