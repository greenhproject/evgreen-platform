ALTER TABLE `platform_settings` ADD `defaultReservationFee` decimal(10,2) DEFAULT '5000' NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `defaultOverstayPenaltyPerMin` decimal(10,2) DEFAULT '500' NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `defaultConnectionFee` decimal(10,2) DEFAULT '2000' NOT NULL;