CREATE TABLE `banner_daily_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bannerId` int NOT NULL,
	`date` date NOT NULL,
	`impressions` int NOT NULL DEFAULT 0,
	`clicks` int NOT NULL DEFAULT 0,
	`uniqueViews` int NOT NULL DEFAULT 0,
	`totalDwellSeconds` int NOT NULL DEFAULT 0,
	`dwellCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `banner_daily_stats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session_feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionId` int NOT NULL,
	`userId` int NOT NULL,
	`stationId` int,
	`rating` int NOT NULL,
	`comment` varchar(300),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `session_feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `banner_views` ADD `viewDurationSeconds` int;--> statement-breakpoint
ALTER TABLE `banner_views` ADD `city` varchar(100);--> statement-breakpoint
ALTER TABLE `banner_views` ADD `vehicleType` varchar(100);--> statement-breakpoint
ALTER TABLE `banner_views` ADD `hourOfDay` tinyint;