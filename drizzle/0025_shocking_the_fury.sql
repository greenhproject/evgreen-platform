CREATE TABLE `overstay_locks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evseId` int NOT NULL,
	`transactionId` int NOT NULL,
	`instanceId` varchar(100) NOT NULL,
	`lastHeartbeat` timestamp NOT NULL,
	`accumulatedCost` decimal(12,2) DEFAULT '0',
	`lastChargeTime` timestamp NOT NULL,
	`startedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `overstay_locks_id` PRIMARY KEY(`id`)
);
