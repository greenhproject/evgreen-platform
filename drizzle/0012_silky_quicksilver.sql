CREATE TABLE `loyalty_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pointsPerKwh` decimal(6,2) NOT NULL DEFAULT '1.00',
	`pointValueCop` decimal(10,2) NOT NULL DEFAULT '75.00',
	`minRedemptionPoints` int NOT NULL DEFAULT 100,
	`maxRedemptionPercent` decimal(5,2) NOT NULL DEFAULT '20.00',
	`marketplaceUrl` text,
	`marketplaceName` varchar(100) DEFAULT 'Marketplace EVGreen',
	`marketplaceDescription` varchar(300),
	`enabled` boolean NOT NULL DEFAULT true,
	`termsUrl` text,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `loyalty_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `loyalty_points` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`points` decimal(10,2) NOT NULL,
	`balanceAfter` decimal(10,2) NOT NULL,
	`loyalty_source` enum('charge_session','redemption','bonus','adjustment','expiry') NOT NULL,
	`transactionId` int,
	`kwhCharged` decimal(10,4),
	`description` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `loyalty_points_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `loyalty_redemptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`pointsUsed` decimal(10,2) NOT NULL,
	`discountAmountCop` decimal(12,2) NOT NULL,
	`redemption_type` enum('charge_discount','marketplace') NOT NULL,
	`transactionId` int,
	`redemption_status` enum('pending','applied','cancelled') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`appliedAt` timestamp,
	CONSTRAINT `loyalty_redemptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vehicle_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`brand` varchar(100) NOT NULL,
	`model` varchar(100) NOT NULL,
	`year` int,
	`batteryCapacityKwh` decimal(6,2),
	`realRangeKm` int,
	`connectorType` varchar(30),
	`chargeType` varchar(10),
	`maxChargePowerKw` decimal(6,2),
	`color` varchar(50),
	`licensePlate` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vehicle_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `vehicle_profiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `termsAcceptedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `termsVersion` varchar(20) DEFAULT '1.0';