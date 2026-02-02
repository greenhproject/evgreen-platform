CREATE TABLE `price_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stationId` int NOT NULL,
	`evseId` int,
	`pricePerKwh` decimal(10,2) NOT NULL,
	`demandLevel` varchar(20) NOT NULL,
	`occupancyRate` decimal(5,2),
	`timeMultiplier` decimal(4,2),
	`dayMultiplier` decimal(4,2),
	`finalMultiplier` decimal(4,2),
	`isAutoPricing` boolean NOT NULL DEFAULT true,
	`transactionId` int,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `price_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `minPricePerKwh` decimal(10,2) DEFAULT '400' NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `maxPricePerKwh` decimal(10,2) DEFAULT '2500' NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `enableDynamicPricing` boolean DEFAULT true NOT NULL;