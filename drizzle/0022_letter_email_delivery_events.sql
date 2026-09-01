ALTER TABLE `space_submissions`
  ADD COLUMN IF NOT EXISTS `letterEmailId` varchar(120),
  ADD COLUMN IF NOT EXISTS `letter_delivery_status` enum('SENT','DELIVERED','DELAYED','BOUNCED','FAILED','OPENED','CLICKED','COMPLAINED','SUPPRESSED') DEFAULT 'SENT',
  ADD COLUMN IF NOT EXISTS `letterDeliveryUpdatedAt` timestamp NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_space_letter_email_id` ON `space_submissions` (`letterEmailId`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `letter_email_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `submissionId` int NOT NULL,
  `providerEventId` varchar(120) NOT NULL,
  `providerEmailId` varchar(120) NOT NULL,
  `eventType` varchar(60) NOT NULL,
  `letter_email_delivery_status` enum('SENT','DELIVERED','DELAYED','BOUNCED','FAILED','OPENED','CLICKED','COMPLAINED','SUPPRESSED') NOT NULL,
  `recipientEmail` varchar(320),
  `occurredAt` timestamp NOT NULL,
  `receivedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `letter_email_events_provider_event_unique` UNIQUE(`providerEventId`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_letter_email_events_submission` ON `letter_email_events` (`submissionId`, `occurredAt`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_letter_email_events_email` ON `letter_email_events` (`providerEmailId`);
