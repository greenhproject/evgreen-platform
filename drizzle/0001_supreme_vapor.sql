CREATE TABLE `org_billing_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_id` int NOT NULL,
	`billing_type` enum('setup','annual_renewal','transaction_fee','support_fee','minimum_fee') NOT NULL,
	`description` varchar(500),
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`period_start` timestamp,
	`period_end` timestamp,
	`transaction_count` int,
	`total_transaction_volume` decimal(14,2),
	`billing_status` enum('pending','paid','overdue','cancelled') NOT NULL DEFAULT 'pending',
	`paid_at` timestamp,
	`invoice_url` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `org_billing_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`org_plan` enum('starter','professional','enterprise') NOT NULL DEFAULT 'starter',
	`org_status` enum('active','suspended','trial','cancelled') NOT NULL DEFAULT 'trial',
	`contact_name` varchar(200),
	`contact_email` varchar(200),
	`contact_phone` varchar(50),
	`nit` varchar(50),
	`logo_url` text,
	`primary_color` varchar(20) DEFAULT '#22c55e',
	`secondary_color` varchar(20) DEFAULT '#1e40af',
	`custom_domain` varchar(200),
	`app_name` varchar(100),
	`network_member` boolean NOT NULL DEFAULT true,
	`setup_fee_per_charger` decimal(10,2),
	`annual_fee_per_charger` decimal(10,2),
	`transaction_fee_percent` decimal(5,2),
	`support_fee_percent` decimal(5,2),
	`network_discount` decimal(5,2) DEFAULT '1.00',
	`min_monthly_fee_per_charger` decimal(10,2),
	`support_included` boolean NOT NULL DEFAULT false,
	`max_chargers` int DEFAULT 10,
	`roaming_owner_percent` decimal(5,2) DEFAULT '80.00',
	`roaming_platform_percent` decimal(5,2) DEFAULT '15.00',
	`roaming_referral_percent` decimal(5,2) DEFAULT '5.00',
	`billing_email` varchar(200),
	`next_billing_date` timestamp,
	`trial_ends_at` timestamp,
	`notes` text,
	`owner_id` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_pricing_defaults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_plan` enum('starter','professional','enterprise') NOT NULL DEFAULT 'starter',
	`setup_fee_per_charger` decimal(10,2) NOT NULL,
	`annual_fee_per_charger` decimal(10,2) NOT NULL,
	`transaction_fee_percent` decimal(5,2) NOT NULL,
	`support_fee_percent` decimal(5,2) NOT NULL,
	`network_discount` decimal(5,2) NOT NULL DEFAULT '1.00',
	`min_monthly_fee_per_charger` decimal(10,2) NOT NULL,
	`max_chargers` int NOT NULL,
	`roaming_owner_percent` decimal(5,2) NOT NULL DEFAULT '80.00',
	`roaming_platform_percent` decimal(5,2) NOT NULL DEFAULT '15.00',
	`roaming_referral_percent` decimal(5,2) NOT NULL DEFAULT '5.00',
	`uptime_sla` decimal(5,2) NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `platform_pricing_defaults_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `user_consumption_profile` ADD `hourlyDistribution` json;--> statement-breakpoint
ALTER TABLE `user_consumption_profile` ADD `weekdayDistribution` json;--> statement-breakpoint
ALTER TABLE `user_consumption_profile` ADD `peakHour` int;--> statement-breakpoint
ALTER TABLE `user_consumption_profile` ADD `peakWeekday` int;--> statement-breakpoint
ALTER TABLE `user_consumption_profile` ADD `sessionsPerWeek` decimal(5,2);--> statement-breakpoint
ALTER TABLE `user_consumption_profile` ADD `priceSensitivity` decimal(4,3);--> statement-breakpoint
ALTER TABLE `user_consumption_profile` ADD `avgPricePaidPerKwh` decimal(10,2);--> statement-breakpoint
ALTER TABLE `user_consumption_profile` ADD `sessionsAnalyzed` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_consumption_profile` ADD `windowDays` int DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_consumption_profile` ADD `profile_confidence` enum('LOW','MEDIUM','HIGH') DEFAULT 'LOW' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_consumption_profile` ADD `computedAt` timestamp DEFAULT (now());