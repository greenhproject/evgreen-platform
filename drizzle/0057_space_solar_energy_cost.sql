-- Configuración solar específica por espacio. Los históricos permanecen en
-- cobertura 0 %, por lo que no se modifica ningún costo ni proyección existente.
ALTER TABLE `space_submissions`
  ADD COLUMN IF NOT EXISTS `solar_coverage_percent` decimal(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS `solar_energy_cost_per_kwh` int NULL;

-- El proyecto de crowdfunding conserva la configuración heredada como snapshot
-- operativo; no se calculan ahorros sin una cobertura y costo solar declarados.
ALTER TABLE `crowdfunding_projects`
  ADD COLUMN IF NOT EXISTS `solar_coverage_percent` decimal(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS `solar_energy_cost_per_kwh` int NULL;

-- Extiende la bitácora solar existente sin alterar su evidencia histórica.
ALTER TABLE `space_solar_scope_history`
  ADD COLUMN IF NOT EXISTS `previous_solar_coverage_percent` decimal(5,2) NULL,
  ADD COLUMN IF NOT EXISTS `next_solar_coverage_percent` decimal(5,2) NULL,
  ADD COLUMN IF NOT EXISTS `previous_solar_energy_cost_per_kwh` int NULL,
  ADD COLUMN IF NOT EXISTS `next_solar_energy_cost_per_kwh` int NULL;
