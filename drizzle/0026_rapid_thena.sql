CREATE TABLE `pending_charge_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`stationId` int NOT NULL,
	`connectorId` int NOT NULL,
	`ocppIdentity` varchar(128) NOT NULL,
	`chargeMode` varchar(20) NOT NULL DEFAULT 'full_charge',
	`targetValue` decimal(12,2) NOT NULL DEFAULT '0',
	`estimatedCost` decimal(12,2) NOT NULL DEFAULT '0',
	`pricePerKwh` decimal(10,2) NOT NULL DEFAULT '1800',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`consumed` boolean NOT NULL DEFAULT false,
	CONSTRAINT `pending_charge_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `pending_charge_sessions_sessionId_unique` UNIQUE(`sessionId`)
);
