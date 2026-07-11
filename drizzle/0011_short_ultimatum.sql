CREATE TABLE `station_availability_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stationId` int NOT NULL,
	`connectorType` varchar(30),
	`stationName` varchar(200),
	`userPhone` varchar(30),
	`userName` varchar(100),
	`sendPush` boolean NOT NULL DEFAULT true,
	`sendWhatsapp` boolean NOT NULL DEFAULT true,
	`alert_req_status` enum('PENDING','SENT','CANCELLED','EXPIRED') NOT NULL DEFAULT 'PENDING',
	`sentAt` timestamp,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `station_availability_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `banners` ADD `targetDepartments` json;--> statement-breakpoint
ALTER TABLE `banners` ADD `targetStationCities` json;--> statement-breakpoint
ALTER TABLE `banners` ADD `targetStationIds` json;--> statement-breakpoint
ALTER TABLE `banners` ADD `targetVehicleBrands` json;--> statement-breakpoint
ALTER TABLE `banners` ADD `targetVehicleModels` json;--> statement-breakpoint
ALTER TABLE `banners` ADD `targetConnectorTypes` json;--> statement-breakpoint
ALTER TABLE `banners` ADD `targetBatteryMinKwh` int;--> statement-breakpoint
ALTER TABLE `banners` ADD `targetBatteryMaxKwh` int;--> statement-breakpoint
ALTER TABLE `banners` ADD `targetMinChargesPerMonth` int;--> statement-breakpoint
ALTER TABLE `banners` ADD `targetMaxChargesPerMonth` int;--> statement-breakpoint
ALTER TABLE `banners` ADD `targetMinSpendPerMonth` int;--> statement-breakpoint
ALTER TABLE `banners` ADD `targetMaxSpendPerMonth` int;--> statement-breakpoint
ALTER TABLE `banners` ADD `targetStartMethods` json;--> statement-breakpoint
ALTER TABLE `banners` ADD `targetChargeHoursStart` int;--> statement-breakpoint
ALTER TABLE `banners` ADD `targetChargeHoursEnd` int;--> statement-breakpoint
ALTER TABLE `banners` ADD `targetHasCard` boolean;--> statement-breakpoint
ALTER TABLE `banners` ADD `targetWalletMinBalance` int;--> statement-breakpoint
ALTER TABLE `banners` ADD `targetWalletMaxBalance` int;--> statement-breakpoint
ALTER TABLE `banners` ADD `targetMinAvgRecharge` int;--> statement-breakpoint
ALTER TABLE `banners` ADD `targetActivitySegments` json;