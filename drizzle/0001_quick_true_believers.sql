CREATE TABLE `charging_stations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`address` varchar(500) NOT NULL,
	`city` varchar(100) NOT NULL,
	`department` varchar(100),
	`country` varchar(100) NOT NULL DEFAULT 'Colombia',
	`postalCode` varchar(20),
	`latitude` decimal(10,8) NOT NULL,
	`longitude` decimal(11,8) NOT NULL,
	`ocppIdentity` varchar(100),
	`ocppPassword` varchar(255),
	`isOnline` boolean NOT NULL DEFAULT false,
	`isPublic` boolean NOT NULL DEFAULT true,
	`isActive` boolean NOT NULL DEFAULT true,
	`operatingHours` json,
	`amenities` json,
	`images` json,
	`upmeRegistrationId` varchar(100),
	`cargameId` varchar(100),
	`manufacturer` varchar(100),
	`model` varchar(100),
	`serialNumber` varchar(100),
	`firmwareVersion` varchar(50),
	`lastBootNotification` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `charging_stations_id` PRIMARY KEY(`id`),
	CONSTRAINT `charging_stations_ocppIdentity_unique` UNIQUE(`ocppIdentity`)
);
--> statement-breakpoint
CREATE TABLE `evses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stationId` int NOT NULL,
	`evseIdLocal` int NOT NULL,
	`connectorId` int NOT NULL DEFAULT 1,
	`connector_type` enum('TYPE_2','CCS_2','CHADEMO','TYPE_1') NOT NULL,
	`charge_type` enum('AC','DC') NOT NULL,
	`powerKw` decimal(8,2) NOT NULL,
	`maxVoltage` int,
	`maxAmperage` int,
	`connector_status` enum('AVAILABLE','PREPARING','CHARGING','SUSPENDED_EVSE','SUSPENDED_EV','FINISHING','RESERVED','UNAVAILABLE','FAULTED') NOT NULL DEFAULT 'UNAVAILABLE',
	`lastStatusUpdate` timestamp NOT NULL DEFAULT (now()),
	`currentTransactionId` int,
	`currentUserId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `evses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `investor_payouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`investorId` int NOT NULL,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`totalRevenue` decimal(14,2) NOT NULL,
	`investorShare` decimal(14,2) NOT NULL,
	`platformFee` decimal(14,2) NOT NULL,
	`transactionCount` int NOT NULL,
	`totalKwh` decimal(12,4) NOT NULL,
	`payment_status` enum('PENDING','COMPLETED','FAILED','REFUNDED') NOT NULL DEFAULT 'PENDING',
	`paidAt` timestamp,
	`paymentMethod` varchar(50),
	`paymentReference` varchar(100),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `investor_payouts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `maintenance_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stationId` int NOT NULL,
	`evseId` int,
	`technicianId` int,
	`reportedById` int,
	`title` varchar(255) NOT NULL,
	`description` text,
	`priority` varchar(20) DEFAULT 'MEDIUM',
	`category` varchar(50),
	`maintenance_status` enum('PENDING','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PENDING',
	`scheduledDate` timestamp,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`resolution` text,
	`partsUsed` json,
	`laborCost` decimal(12,2),
	`totalCost` decimal(12,2),
	`attachments` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `maintenance_tickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meter_values` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`transactionId` int NOT NULL,
	`evseId` int NOT NULL,
	`timestamp` timestamp NOT NULL,
	`energyKwh` decimal(12,4),
	`powerKw` decimal(8,2),
	`voltage` decimal(6,2),
	`current` decimal(6,2),
	`soc` int,
	`temperature` decimal(5,2),
	`context` varchar(50),
	`measurand` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meter_values_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`type` varchar(50) NOT NULL,
	`referenceId` int,
	`referenceType` varchar(50),
	`isRead` boolean NOT NULL DEFAULT false,
	`readAt` timestamp,
	`pushSent` boolean DEFAULT false,
	`pushSentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ocpp_logs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`stationId` int,
	`ocppIdentity` varchar(100),
	`direction` varchar(10) NOT NULL,
	`messageType` varchar(50) NOT NULL,
	`messageId` varchar(100),
	`payload` json,
	`errorCode` varchar(50),
	`errorDescription` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ocpp_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evseId` int NOT NULL,
	`userId` int NOT NULL,
	`stationId` int NOT NULL,
	`startTime` timestamp NOT NULL,
	`endTime` timestamp NOT NULL,
	`expiryTime` timestamp NOT NULL,
	`reservation_status` enum('ACTIVE','EXPIRED','CANCELLED','FULFILLED','NO_SHOW') NOT NULL DEFAULT 'ACTIVE',
	`reservationFee` decimal(10,2) DEFAULT '0',
	`noShowPenalty` decimal(10,2) DEFAULT '0',
	`isPenaltyApplied` boolean NOT NULL DEFAULT false,
	`transactionId` int,
	`ocppReservationId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reservations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subscription_tier` enum('FREE','BASIC','PREMIUM','ENTERPRISE') NOT NULL DEFAULT 'FREE',
	`discountPercentage` decimal(5,2) DEFAULT '0',
	`freeReservationsPerMonth` int DEFAULT 0,
	`prioritySupport` boolean DEFAULT false,
	`stripeSubscriptionId` varchar(100),
	`stripePriceId` varchar(100),
	`startDate` timestamp NOT NULL,
	`endDate` timestamp,
	`nextBillingDate` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`cancelledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stationId` int,
	`transactionId` int,
	`subject` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`category` varchar(50),
	`priority` varchar(20) DEFAULT 'MEDIUM',
	`status` varchar(20) DEFAULT 'OPEN',
	`assignedToId` int,
	`resolution` text,
	`resolvedAt` timestamp,
	`attachments` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `support_tickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tariffs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stationId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`pricePerKwh` decimal(10,2) NOT NULL,
	`pricePerMinute` decimal(10,2) DEFAULT '0',
	`pricePerSession` decimal(10,2) DEFAULT '0',
	`reservationFee` decimal(10,2) DEFAULT '0',
	`noShowPenalty` decimal(10,2) DEFAULT '0',
	`overstayPenaltyPerMinute` decimal(10,2) DEFAULT '0',
	`overstayGracePeriodMinutes` int DEFAULT 10,
	`timeBasedPricing` json,
	`isActive` boolean NOT NULL DEFAULT true,
	`validFrom` timestamp,
	`validTo` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tariffs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evseId` int NOT NULL,
	`userId` int NOT NULL,
	`stationId` int NOT NULL,
	`tariffId` int,
	`ocppTransactionId` varchar(100),
	`startTime` timestamp NOT NULL,
	`endTime` timestamp,
	`kwhConsumed` decimal(10,4) DEFAULT '0',
	`meterStart` decimal(12,4),
	`meterEnd` decimal(12,4),
	`energyCost` decimal(12,2) DEFAULT '0',
	`timeCost` decimal(12,2) DEFAULT '0',
	`sessionCost` decimal(12,2) DEFAULT '0',
	`overstayCost` decimal(12,2) DEFAULT '0',
	`totalCost` decimal(12,2) DEFAULT '0',
	`investorShare` decimal(12,2) DEFAULT '0',
	`platformFee` decimal(12,2) DEFAULT '0',
	`transaction_status` enum('PENDING','IN_PROGRESS','COMPLETED','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING',
	`startMethod` varchar(50),
	`stopReason` varchar(100),
	`reservationId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wallet_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`walletId` int NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(50) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`balanceBefore` decimal(12,2) NOT NULL,
	`balanceAfter` decimal(12,2) NOT NULL,
	`referenceId` int,
	`referenceType` varchar(50),
	`stripePaymentIntentId` varchar(100),
	`payment_status` enum('PENDING','COMPLETED','FAILED','REFUNDED') NOT NULL DEFAULT 'PENDING',
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wallet_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`balance` decimal(12,2) NOT NULL DEFAULT '0',
	`currency` varchar(3) NOT NULL DEFAULT 'COP',
	`stripeCustomerId` varchar(100),
	`creditLimit` decimal(12,2) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wallets_id` PRIMARY KEY(`id`),
	CONSTRAINT `wallets_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('staff','technician','investor','user','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `companyName` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `taxId` varchar(50);--> statement-breakpoint
ALTER TABLE `users` ADD `bankAccount` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `bankName` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `technicianLicense` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `assignedRegion` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);