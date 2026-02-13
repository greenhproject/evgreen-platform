CREATE TABLE `user_vehicles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`brand` varchar(100) NOT NULL,
	`model` varchar(100) NOT NULL,
	`year` int,
	`licensePlate` varchar(20),
	`batteryCapacityKwh` decimal(6,2),
	`rangeKm` int,
	`connectorTypes` json NOT NULL,
	`maxChargePowerKw` decimal(6,2),
	`isDefault` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`imageUrl` text,
	`nickname` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_vehicles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `wompiPublicKey` text;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `wompiPrivateKey` text;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `wompiIntegritySecret` text;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `wompiEventsSecret` text;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `wompiTestMode` boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE `platform_settings` DROP COLUMN `stripePublicKey`;--> statement-breakpoint
ALTER TABLE `platform_settings` DROP COLUMN `stripeSecretKey`;--> statement-breakpoint
ALTER TABLE `platform_settings` DROP COLUMN `stripeWebhookSecret`;--> statement-breakpoint
ALTER TABLE `platform_settings` DROP COLUMN `stripeTestMode`;
