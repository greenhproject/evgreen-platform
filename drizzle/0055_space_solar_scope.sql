-- Alcance solar de Espacios: dato técnico/comercial independiente de cualquier
-- cálculo financiero. Los espacios históricos conservan el valor seguro 0.
ALTER TABLE `space_submissions`
  ADD COLUMN IF NOT EXISTS `has_solar_panels` tinyint NOT NULL DEFAULT 0;

-- Bitácora de decisiones para trazabilidad de creación y edición administrativa.
CREATE TABLE IF NOT EXISTS `space_solar_scope_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `submission_id` int NOT NULL,
  `previous_has_solar_panels` tinyint NULL,
  `next_has_solar_panels` tinyint NOT NULL,
  `changed_by_id` int NULL,
  `changed_by_role` varchar(32) NULL,
  `change_source` enum('SUBMISSION','ADMIN_EDIT') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_space_solar_scope_history_submission_created` (`submission_id`, `created_at`)
);
