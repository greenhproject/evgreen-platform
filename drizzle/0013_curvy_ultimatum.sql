ALTER TABLE `platform_settings` ADD `whatsappPenaltyNotifIntervalMinutes` int DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `manualSocEnd` int;