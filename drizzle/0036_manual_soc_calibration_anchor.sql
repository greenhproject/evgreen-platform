ALTER TABLE `transactions`
  ADD COLUMN `manualSocCalibrationKwh` decimal(10,4) NULL AFTER `manualBatteryCapacityKwh`;

ALTER TABLE `transactions`
  ADD COLUMN `manualSocCalibratedAt` timestamp NULL AFTER `manualSocCalibrationKwh`;
