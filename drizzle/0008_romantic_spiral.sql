ALTER TABLE `platform_settings` ADD `resendApiKey` varchar(255);--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `emailFrom` varchar(255) DEFAULT 'noreply@evgreen.lat';--> statement-breakpoint
ALTER TABLE `users` ADD `waNotifyChargeStart` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD `waNotifyChargeEnd` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD `waNotifyReminder` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `waNotifyPenalty` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD `waNotifyWallet` boolean DEFAULT true;