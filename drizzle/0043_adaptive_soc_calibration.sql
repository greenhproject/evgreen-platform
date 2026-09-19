-- Aprendizaje de SOC AC entre recalibraciones.
-- Campos aditivos: no modifican la capacidad declarada ni recalculan sesiones existentes.
ALTER TABLE `transactions`
  ADD COLUMN `manualSocEffectiveCapacityKwh` decimal(6,2) NULL AFTER `manualBatteryCapacityKwh`,
  ADD COLUMN `manualSocCalibrationCount` int NOT NULL DEFAULT 0 AFTER `manualSocCalibratedAt`;
