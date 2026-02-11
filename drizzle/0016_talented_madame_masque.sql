CREATE TABLE `favorite_stations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stationId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `favorite_stations_id` PRIMARY KEY(`id`)
);
