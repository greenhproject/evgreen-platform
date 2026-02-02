ALTER TABLE `users` ADD `fcmToken` text;--> statement-breakpoint
ALTER TABLE `users` ADD `fcmTokenUpdatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `notifyChargingComplete` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD `notifyLowBalance` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD `notifyPromotions` boolean DEFAULT true;