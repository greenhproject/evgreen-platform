ALTER TABLE `quote_settings` ADD `hostSharePercent` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `quote_settings` ADD `defaultEnergyCostPerKwh` int DEFAULT 700 NOT NULL;--> statement-breakpoint
ALTER TABLE `quote_settings` ADD `defaultSalePricePerKwh` int DEFAULT 1800 NOT NULL;--> statement-breakpoint
ALTER TABLE `quote_settings` ADD `defaultDailyHours` decimal(4,1) DEFAULT '4.0' NOT NULL;--> statement-breakpoint
ALTER TABLE `quotes` ADD `evgreenSharePercent` decimal(5,2) DEFAULT '30.00';--> statement-breakpoint
ALTER TABLE `quotes` ADD `investorSharePercent` decimal(5,2) DEFAULT '70.00';--> statement-breakpoint
ALTER TABLE `quotes` ADD `hostSharePercent` decimal(5,2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE `quotes` ADD `projectionEnergyCostPerKwh` int DEFAULT 700;--> statement-breakpoint
ALTER TABLE `quotes` ADD `projectionSalePricePerKwh` int DEFAULT 1800;--> statement-breakpoint
ALTER TABLE `quotes` ADD `projectionDailyHours` decimal(4,1) DEFAULT '4.0';--> statement-breakpoint
ALTER TABLE `quotes` ADD `projectionScenario` varchar(20) DEFAULT 'realistic';--> statement-breakpoint
ALTER TABLE `quotes` ADD `showProjection` boolean DEFAULT true;