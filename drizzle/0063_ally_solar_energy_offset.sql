-- Conserva el indicador técnico de OpenSolar “Energía vs consumo” separado de
-- la cobertura financiera por autoconsumo. Puede exceder 100% por excedentes
-- exportables y no modifica registros existentes.

ALTER TABLE `space_submissions`
  ADD COLUMN IF NOT EXISTS `solar_program_energy_offset_percent` decimal(7,2) NULL;
