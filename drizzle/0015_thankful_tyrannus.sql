CREATE TABLE `crowdfunding_participations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`investorId` int NOT NULL,
	`amount` bigint NOT NULL,
	`participationPercent` decimal(6,4) NOT NULL,
	`payment_status` enum('PENDING','COMPLETED','FAILED','REFUNDED') NOT NULL DEFAULT 'PENDING',
	`paymentDate` timestamp,
	`stripePaymentIntentId` varchar(255),
	`contractSigned` boolean NOT NULL DEFAULT false,
	`contractSignedAt` timestamp,
	`contractUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `crowdfunding_participations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crowdfunding_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`city` varchar(100) NOT NULL,
	`zone` varchar(255) NOT NULL,
	`address` varchar(500),
	`targetAmount` bigint NOT NULL,
	`raisedAmount` bigint NOT NULL DEFAULT 0,
	`minimumInvestment` bigint NOT NULL DEFAULT 50000000,
	`totalPowerKw` int NOT NULL DEFAULT 480,
	`chargerCount` int NOT NULL DEFAULT 4,
	`chargerPowerKw` int NOT NULL DEFAULT 120,
	`hasSolarPanels` boolean NOT NULL DEFAULT true,
	`estimatedRoiPercent` decimal(5,2) DEFAULT '85.00',
	`estimatedPaybackMonths` int DEFAULT 14,
	`crowdfunding_status` enum('DRAFT','OPEN','IN_PROGRESS','FUNDED','BUILDING','OPERATIONAL','CLOSED') NOT NULL DEFAULT 'DRAFT',
	`targetDate` timestamp,
	`launchDate` timestamp,
	`fundedDate` timestamp,
	`operationalDate` timestamp,
	`priority` int NOT NULL DEFAULT 0,
	`stationId` int,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `crowdfunding_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_guests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fullName` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(20),
	`company` varchar(255),
	`position` varchar(255),
	`qrCode` varchar(100) NOT NULL,
	`investment_package` enum('AC','DC_INDIVIDUAL','COLECTIVO'),
	`investmentAmount` bigint,
	`founderSlot` int,
	`event_guest_status` enum('INVITED','CONFIRMED','CHECKED_IN','NO_SHOW','CANCELLED') NOT NULL DEFAULT 'INVITED',
	`invitationSentAt` timestamp,
	`invitationEmailId` varchar(255),
	`checkedInAt` timestamp,
	`checkedInBy` int,
	`userId` int,
	`notes` text,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `event_guests_id` PRIMARY KEY(`id`),
	CONSTRAINT `event_guests_qrCode_unique` UNIQUE(`qrCode`)
);
--> statement-breakpoint
CREATE TABLE `event_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guestId` int NOT NULL,
	`amount` bigint NOT NULL,
	`reservationDeposit` bigint NOT NULL DEFAULT 1000000,
	`event_payment_status` enum('PENDING','PAID','PARTIAL','REFUNDED') NOT NULL DEFAULT 'PENDING',
	`paymentMethod` varchar(50),
	`paymentReference` varchar(255),
	`wompiTransactionId` varchar(255),
	`selected_package` enum('AC','DC_INDIVIDUAL','COLECTIVO') NOT NULL,
	`founderBenefits` boolean NOT NULL DEFAULT true,
	`founderDiscount` decimal(5,2) DEFAULT '5.00',
	`zoneFeeFree` boolean DEFAULT true,
	`registeredById` int,
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `event_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `platform_settings` MODIFY COLUMN `investorPercentage` int NOT NULL DEFAULT 70;--> statement-breakpoint
ALTER TABLE `platform_settings` MODIFY COLUMN `platformFeePercentage` int NOT NULL DEFAULT 30;--> statement-breakpoint
ALTER TABLE `charging_stations` ADD `premiumZone` enum('A','B','C') DEFAULT 'C' NOT NULL;--> statement-breakpoint
ALTER TABLE `charging_stations` ADD `premiumZoneFee` decimal(15,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `investor_payouts` ADD `investorPercentage` int DEFAULT 70 NOT NULL;--> statement-breakpoint
ALTER TABLE `investor_payouts` ADD `bankName` varchar(100);--> statement-breakpoint
ALTER TABLE `investor_payouts` ADD `bankAccount` varchar(100);--> statement-breakpoint
ALTER TABLE `investor_payouts` ADD `accountHolder` varchar(255);--> statement-breakpoint
ALTER TABLE `investor_payouts` ADD `accountType` varchar(50);--> statement-breakpoint
ALTER TABLE `investor_payouts` ADD `status` enum('PENDING','REQUESTED','APPROVED','PROCESSING','PAID','REJECTED') DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE `investor_payouts` ADD `requestedAt` timestamp;--> statement-breakpoint
ALTER TABLE `investor_payouts` ADD `approvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `investor_payouts` ADD `approvedBy` int;--> statement-breakpoint
ALTER TABLE `investor_payouts` ADD `investorNotes` text;--> statement-breakpoint
ALTER TABLE `investor_payouts` ADD `adminNotes` text;--> statement-breakpoint
ALTER TABLE `investor_payouts` ADD `rejectionReason` text;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `factorUtilizacionPremium` decimal(4,2) DEFAULT '2.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `costosOperativosIndividual` int DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `costosOperativosColectivo` int DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `costosOperativosAC` int DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `eficienciaCargaDC` int DEFAULT 92 NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `eficienciaCargaAC` int DEFAULT 95 NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `costoEnergiaRed` int DEFAULT 850 NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `costoEnergiaSolar` int DEFAULT 250 NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `precioVentaDefault` int DEFAULT 1800 NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `precioVentaMin` int DEFAULT 1400 NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `precioVentaMax` int DEFAULT 2200 NOT NULL;--> statement-breakpoint
ALTER TABLE `investor_payouts` DROP COLUMN `payment_status`;--> statement-breakpoint
ALTER TABLE `investor_payouts` DROP COLUMN `notes`;