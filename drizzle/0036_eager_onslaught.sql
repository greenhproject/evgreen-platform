CREATE TABLE `local_auth_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listId` int NOT NULL,
	`stationId` int NOT NULL,
	`idTag` varchar(50) NOT NULL,
	`idTagRefId` int,
	`auth_status` enum('Accepted','Blocked','Expired','ConcurrentTx') NOT NULL DEFAULT 'Accepted',
	`expiryDate` timestamp,
	`isMasterCard` boolean NOT NULL DEFAULT false,
	`label` varchar(100),
	`addedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `local_auth_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `local_auth_lists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stationId` int NOT NULL,
	`listVersion` int NOT NULL DEFAULT 0,
	`chargerListVersion` int DEFAULT 0,
	`local_auth_list_status` enum('SYNCED','PENDING','FAILED','OUTDATED') NOT NULL DEFAULT 'PENDING',
	`lastSyncAt` timestamp,
	`lastSyncResult` varchar(50),
	`offline_policy` enum('LOCAL_LIST_ONLY','FREE_VENDING','REJECT_ALL') NOT NULL DEFAULT 'LOCAL_LIST_ONLY',
	`entryCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `local_auth_lists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `offline_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stationId` int NOT NULL,
	`ocppTransactionId` varchar(100),
	`idTag` varchar(50),
	`connectorId` int,
	`meterStart` decimal(12,4),
	`meterEnd` decimal(12,4),
	`startTimestamp` timestamp,
	`endTimestamp` timestamp,
	`reconciled` boolean NOT NULL DEFAULT false,
	`reconciledAt` timestamp,
	`reconciledTransactionId` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `offline_transactions_id` PRIMARY KEY(`id`)
);
