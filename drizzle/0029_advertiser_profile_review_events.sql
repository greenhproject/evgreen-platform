-- Bitácora auditable de decisiones administrativas sobre perfiles de anunciantes.
-- Se crea de forma aislada porque el generador detectó renombres históricos ajenos
-- a este cambio; no modifica columnas ni datos existentes.
CREATE TABLE IF NOT EXISTS `advertiser_profile_review_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `profileId` int NOT NULL,
  `action` enum('approved','rejected','suspended') NOT NULL,
  `notes` text,
  `actorId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_advertiser_review_profile_created` (`profileId`, `createdAt`)
);
