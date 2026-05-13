ALTER TABLE `chargers_catalog` ADD `commissionPercent` decimal(5,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `quote_items` ADD `commissionPercent` decimal(5,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `quote_items` ADD `commissionAmount` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `quotes` ADD `totalCommission` bigint DEFAULT 0;