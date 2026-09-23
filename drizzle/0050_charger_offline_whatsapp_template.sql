-- Plantilla Utility para alertas operativas de cargador fuera de servicio.
-- Campos aditivos; no modifica ni invalida registros existentes.
ALTER TABLE `whatsapp_config`
  ADD COLUMN `chargerOfflineTemplateName` varchar(100) NOT NULL DEFAULT 'evgreen_cargador_fuera_de_servicio_v1',
  ADD COLUMN `chargerOfflineTemplateId` varchar(100) NULL,
  ADD COLUMN `chargerOfflineTemplateStatus` varchar(30) NOT NULL DEFAULT 'NOT_CONFIGURED',
  ADD COLUMN `chargerOfflineTemplateCheckedAt` timestamp NULL;
