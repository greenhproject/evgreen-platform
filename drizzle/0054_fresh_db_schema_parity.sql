-- Repara columnas que existen en producción y en drizzle/schema.ts pero que
-- nunca quedaron en el historial de migraciones (agregadas directamente a
-- producción) o que una migración previa borró por error. Cualquier base
-- construida desde cero (staging, recuperación ante desastre) queda sin
-- ellas. Confirmado localmente (base MySQL fresca + servidor real corriendo
-- ~70s) que los jobs periódicos de reservas (NoShow, recordatorios) y la
-- reconciliación de Wompi fallan con "Unknown column" sin este fix.
--
-- siigoCustomerId/worldOfficeCustomerId: nunca se generó la migración.
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `siigoCustomerId` varchar(100) NULL,
  ADD COLUMN IF NOT EXISTS `worldOfficeCustomerId` varchar(100) NULL;

-- network_access_mode: nunca se generó la migración.
ALTER TABLE `charging_stations`
  ADD COLUMN IF NOT EXISTS `network_access_mode` ENUM('PRIVATE','EVGREEN_NETWORK','ROAMING') NOT NULL DEFAULT 'EVGREEN_NETWORK';

-- defaultPricePerKwhAC/DC, costosOperativosAC, eficienciaCargaDC/AC: la
-- migración 0015 intentó "renombrar" estas columnas cambiando solo
-- mayúsculas finales (AC->Ac, DC->Dc). MySQL no distingue mayúsculas en
-- nombres de columna, así que el ADD con el nombre nuevo chocó como
-- duplicado (se omitió silenciosamente) y el DROP posterior del nombre
-- original sí se ejecutó, dejando la columna real eliminada por completo.
ALTER TABLE `platform_settings`
  ADD COLUMN IF NOT EXISTS `defaultPricePerKwhAC` decimal(10,2) NOT NULL DEFAULT '800',
  ADD COLUMN IF NOT EXISTS `defaultPricePerKwhDC` decimal(10,2) NOT NULL DEFAULT '1200',
  ADD COLUMN IF NOT EXISTS `costosOperativosAC` int NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS `eficienciaCargaDC` int NOT NULL DEFAULT 92,
  ADD COLUMN IF NOT EXISTS `eficienciaCargaAC` int NOT NULL DEFAULT 95;
