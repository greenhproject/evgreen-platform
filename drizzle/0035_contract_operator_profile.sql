ALTER TABLE `platform_settings`
  ADD COLUMN `contract_operator_legal_name` varchar(255) DEFAULT 'Green House Project SAS',
  ADD COLUMN `contract_operator_tax_id` varchar(64) DEFAULT '901.447.678-0',
  ADD COLUMN `contract_operator_representative_name` varchar(255),
  ADD COLUMN `contract_operator_representative_document` varchar(64),
  ADD COLUMN `contract_operator_representative_title` varchar(120) DEFAULT 'Representante legal',
  ADD COLUMN `contract_operator_email` varchar(320),
  ADD COLUMN `contract_operator_phone` varchar(50),
  ADD COLUMN `contract_operator_notification_address` varchar(500),
  ADD COLUMN `contract_operator_domicile` varchar(160) DEFAULT 'Colombia',
  ADD COLUMN `contract_operator_verified_at` timestamp NULL,
  ADD COLUMN `contract_operator_verified_by` int;

UPDATE `platform_settings`
SET
  `contract_operator_legal_name` = COALESCE(NULLIF(`contract_operator_legal_name`, ''), NULLIF(`companyName`, ''), 'Green House Project SAS'),
  `contract_operator_tax_id` = COALESCE(NULLIF(`contract_operator_tax_id`, ''), NULLIF(`nit`, ''), '901.447.678-0'),
  `contract_operator_email` = COALESCE(NULLIF(`contract_operator_email`, ''), NULLIF(`contactEmail`, '')),
  `contract_operator_phone` = COALESCE(NULLIF(`contract_operator_phone`, ''), NULLIF(`supportPhone`, '')),
  `contract_operator_representative_title` = COALESCE(NULLIF(`contract_operator_representative_title`, ''), 'Representante legal'),
  `contract_operator_domicile` = COALESCE(NULLIF(`contract_operator_domicile`, ''), 'Colombia');
