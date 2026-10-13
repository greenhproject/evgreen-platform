-- Conserva por separado los términos financieros explícitos de la propuesta
-- OpenSolar del aliado. No modifica espacios existentes ni infiere cuotas.
-- La cuota contractual, la factura solar residual inicial y la factura residual
-- posterior al plazo se usan sólo si OpenSolar los devuelve explícitamente.

ALTER TABLE `space_submissions`
  ADD COLUMN IF NOT EXISTS `solar_program_monthly_financing_payment_cop` bigint NULL,
  ADD COLUMN IF NOT EXISTS `solar_program_initial_monthly_solar_bill_cop` bigint NULL,
  ADD COLUMN IF NOT EXISTS `solar_program_post_agreement_monthly_solar_bill_cop` bigint NULL;
