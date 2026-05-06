CREATE TABLE `claims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(255) NOT NULL,
	`transactionId` int NOT NULL,
	`category` varchar(50) NOT NULL,
	`description` text NOT NULL,
	`requestedAmount` decimal(12,2),
	`status` varchar(30) NOT NULL DEFAULT 'PENDING',
	`resolvedByAdminId` int,
	`resolvedByAdminName` varchar(255),
	`resolution` text,
	`refundId` int,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `claims_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionId` int NOT NULL,
	`userId` int NOT NULL,
	`adminId` int NOT NULL,
	`adminName` varchar(255) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`refundType` varchar(50) NOT NULL,
	`reason` text NOT NULL,
	`claimId` int,
	`walletTransactionId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `refunds_id` PRIMARY KEY(`id`)
);
