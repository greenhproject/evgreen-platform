-- Reserva y WhatsApp: campos aditivos, sin modificar registros existentes.
ALTER TABLE `users`
  ADD COLUMN `waNotifyReservations` tinyint NOT NULL DEFAULT 1;

ALTER TABLE `whatsapp_config`
  ADD COLUMN `reservationTemplateName` varchar(100) NULL DEFAULT 'evgreen_reserva_actualizacion_v1',
  ADD COLUMN `reservationTemplateId` varchar(100) NULL,
  ADD COLUMN `reservationTemplateStatus` varchar(30) NULL DEFAULT 'NOT_CONFIGURED',
  ADD COLUMN `reservationTemplateCheckedAt` timestamp NULL;
