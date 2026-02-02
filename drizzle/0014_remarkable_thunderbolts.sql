ALTER TABLE `platform_settings` ADD `defaultPricePerKwhAC` decimal(10,2) DEFAULT '800' NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `defaultPricePerKwhDC` decimal(10,2) DEFAULT '1200' NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `enableDifferentiatedPricing` boolean DEFAULT true NOT NULL;