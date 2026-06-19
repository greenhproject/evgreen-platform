CREATE TABLE `occupancy_liquidations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionId` int NOT NULL,
	`stationId` int NOT NULL,
	`hostUserId` int,
	`minutesCharged` decimal(8,2) NOT NULL,
	`occupancyRatePerMinute` int NOT NULL,
	`parkingRatePerMinute` int NOT NULL,
	`userCharge` int NOT NULL,
	`allyTransfer` int NOT NULL,
	`evgreenMargin` int NOT NULL,
	`allyPaidAt` timestamp,
	`periodYear` int NOT NULL,
	`periodMonth` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `occupancy_liquidations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `charging_stations` ADD `parkingRatePerMinute` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `charging_stations` ADD `occupancyRatePerMinute` int DEFAULT 0 NOT NULL;