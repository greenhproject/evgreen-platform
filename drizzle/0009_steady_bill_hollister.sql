ALTER TABLE `users` ADD `emailNotifyEnabled` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD `emailNotifyReceipts` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD `emailNotifyWeeklyReport` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `emailNotifyPromotions` boolean DEFAULT false;