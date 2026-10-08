-- Hábitos de carga locales y semanales.
-- Exclusivamente aditiva e idempotente: no modifica sesiones ni perfiles existentes.
-- El perfil se recalculará sólo para usuarios con consentimiento AI_PROFILING.

ALTER TABLE `user_consumption_profile`
  ADD COLUMN IF NOT EXISTS `habitSlotDistribution` json NULL;

ALTER TABLE `user_consumption_profile`
  ADD COLUMN IF NOT EXISTS `habitTimezone` varchar(100) NULL DEFAULT 'America/Bogota';
