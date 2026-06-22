ALTER TABLE `platform_pricing_defaults` MODIFY COLUMN `org_plan` enum('starter','professional','enterprise') NOT NULL;--> statement-breakpoint
ALTER TABLE `tariffs` ADD `priceMinKwh` decimal(10,2) DEFAULT '1000';--> statement-breakpoint
ALTER TABLE `tariffs` ADD `priceMaxKwh` decimal(10,2) DEFAULT '3000';--> statement-breakpoint
ALTER TABLE `tariffs` ADD `connectionFee` decimal(10,2) DEFAULT '0';