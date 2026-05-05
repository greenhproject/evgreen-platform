CREATE TABLE `api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`keyHash` varchar(64) NOT NULL,
	`keyPrefix` varchar(12) NOT NULL,
	`permissions` json,
	`isActive` boolean NOT NULL DEFAULT true,
	`expiresAt` timestamp,
	`lastUsedAt` timestamp,
	`usageCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_keys_keyHash_unique` UNIQUE(`keyHash`)
);
--> statement-breakpoint
CREATE TABLE `api_webhooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`url` varchar(500) NOT NULL,
	`events` json NOT NULL,
	`secret` varchar(64),
	`isActive` boolean NOT NULL DEFAULT true,
	`lastTriggeredAt` timestamp,
	`failCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_webhooks_id` PRIMARY KEY(`id`)
);
