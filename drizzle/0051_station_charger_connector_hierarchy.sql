-- Jerarquía física Estación → Cargador → Conector.
-- Migración exclusivamente aditiva e idempotente. No modifica datos existentes:
-- los EVSE históricos sin charger_id continúan operando como conectores legacy.
--
-- No se usa AFTER: la base histórica mezcla nombres camelCase y snake_case en
-- EVSE, y el orden físico de columna no tiene valor funcional.

ALTER TABLE `chargers`
  ADD COLUMN IF NOT EXISTS `charger_code` varchar(40) NULL;

ALTER TABLE `chargers`
  ADD COLUMN IF NOT EXISTS `display_name` varchar(120) NULL;

ALTER TABLE `chargers`
  ADD COLUMN IF NOT EXISTS `max_concurrent_sessions` int NOT NULL DEFAULT 1;

ALTER TABLE `evses`
  ADD COLUMN IF NOT EXISTS `connector_label` varchar(60) NULL;

ALTER TABLE `evses`
  ADD COLUMN IF NOT EXISTS `qr_token` varchar(80) NULL;

CREATE INDEX IF NOT EXISTS `idx_chargers_station_code`
  ON `chargers` (`station_id`, `charger_code`);

CREATE UNIQUE INDEX IF NOT EXISTS `ux_evses_qr_token`
  ON `evses` (`qr_token`);

-- Configure each Liboltek dual-output cabinet with max_concurrent_sessions = 2.
-- Keep the default 1 for models that share one physical charging session.
-- Tokens are optional and must be generated/assigned through Admin before
-- printing a connector-level QR label.
