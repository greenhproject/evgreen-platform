CREATE TABLE `charger_brands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brand` varchar(100) NOT NULL,
	`model` varchar(100) NOT NULL,
	`displayName` varchar(200) NOT NULL,
	`imageUrl` text,
	`ocppVersion` varchar(20) NOT NULL DEFAULT '1.6',
	`ocppPasswordRequired` boolean NOT NULL DEFAULT false,
	`charge_type` enum('AC','DC') NOT NULL,
	`defaultPowerKw` decimal(8,2) NOT NULL,
	`maxPowerKw` decimal(8,2),
	`minChargingCurrentA` int,
	`maxChargingCurrentA` int,
	`defaultVoltage` int,
	`phases` int DEFAULT 1,
	`supportedConnectors` json,
	`supportedMeasurands` json,
	`energyUnit` varchar(10) NOT NULL DEFAULT 'Wh',
	`supportsSoC` boolean NOT NULL DEFAULT false,
	`supportsPowerMeasurement` boolean NOT NULL DEFAULT false,
	`supportsCurrentMeasurement` boolean NOT NULL DEFAULT false,
	`supportsVoltageMeasurement` boolean NOT NULL DEFAULT false,
	`supportsRemoteStart` boolean NOT NULL DEFAULT true,
	`supportsRemoteStop` boolean NOT NULL DEFAULT true,
	`supportsReset` boolean NOT NULL DEFAULT true,
	`supportsReservation` boolean NOT NULL DEFAULT false,
	`supportsSmartCharging` boolean NOT NULL DEFAULT false,
	`supportsFirmwareUpdate` boolean NOT NULL DEFAULT false,
	`ocppConfig` json,
	`meterValueInterval` int DEFAULT 30,
	`cloudApiBaseUrl` varchar(500),
	`cloudApiAuthMethod` varchar(50),
	`cloudApiDocsUrl` varchar(500),
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `charger_brands_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `charger_problem_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stationId` int,
	`stationName` varchar(255),
	`connectorId` varchar(50),
	`problemType` varchar(50) NOT NULL,
	`description` text,
	`photoUrl` varchar(500),
	`status` varchar(20) NOT NULL DEFAULT 'PENDING',
	`priority` varchar(20) NOT NULL DEFAULT 'MEDIUM',
	`assignedToId` int,
	`resolution` text,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `charger_problem_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financial_settlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stationId` int NOT NULL,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`settlement_period_type` enum('WEEKLY','MONTHLY','QUARTERLY') NOT NULL,
	`grossRevenue` bigint NOT NULL DEFAULT 0,
	`totalSessions` int NOT NULL DEFAULT 0,
	`totalKwh` decimal(12,4) DEFAULT '0',
	`totalFixedExpenses` bigint NOT NULL DEFAULT 0,
	`netRevenue` bigint NOT NULL DEFAULT 0,
	`totalEnergyCost` bigint NOT NULL DEFAULT 0,
	`energyCostPerKwh` decimal(10,2) DEFAULT '850.00',
	`revenueFromEnergy` bigint NOT NULL DEFAULT 0,
	`revenueFromPenalties` bigint NOT NULL DEFAULT 0,
	`revenueFromReservations` bigint NOT NULL DEFAULT 0,
	`revenueFromAdvertising` bigint NOT NULL DEFAULT 0,
	`investorSharePercent` decimal(5,2) NOT NULL DEFAULT '70.00',
	`platformSharePercent` decimal(5,2) NOT NULL DEFAULT '30.00',
	`hostSharePercent` decimal(5,2) NOT NULL DEFAULT '0.00',
	`investorTotalAmount` bigint NOT NULL DEFAULT 0,
	`platformTotalAmount` bigint NOT NULL DEFAULT 0,
	`hostTotalAmount` bigint NOT NULL DEFAULT 0,
	`maintenanceFundPercent` decimal(5,2) NOT NULL DEFAULT '5.00',
	`maintenanceFundAmount` bigint NOT NULL DEFAULT 0,
	`platformNetAmount` bigint NOT NULL DEFAULT 0,
	`contingencyReserve` bigint NOT NULL DEFAULT 0,
	`waterfallBreakdown` json,
	`settlement_status` enum('DRAFT','APPROVED','DISTRIBUTED','CLOSED') NOT NULL DEFAULT 'DRAFT',
	`approvedBy` int,
	`approvedAt` timestamp,
	`distributedAt` timestamp,
	`notes` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financial_settlements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `firmware_updates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`station_id` int NOT NULL,
	`ocpp_identity` varchar(255) NOT NULL,
	`file_name` varchar(500) NOT NULL,
	`file_size` int NOT NULL,
	`file_url` text NOT NULL,
	`version` varchar(100),
	`status` varchar(50) NOT NULL DEFAULT 'PENDING',
	`progress` int NOT NULL DEFAULT 0,
	`error_message` text,
	`notes` text,
	`initiated_by` int,
	`started_at` timestamp,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `firmware_updates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `id_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`id_tag` varchar(50) NOT NULL,
	`user_id` int,
	`id_tag_type` enum('APP','RFID','NFC','REMOTE') NOT NULL DEFAULT 'APP',
	`id_tag_status` enum('ACTIVE','BLOCKED','EXPIRED','LOST') NOT NULL DEFAULT 'ACTIVE',
	`label` varchar(100),
	`serial_number` varchar(100),
	`expires_at` timestamp,
	`parent_id_tag` varchar(50),
	`max_active_transactions` int DEFAULT 1,
	`last_used_at` timestamp,
	`last_used_station_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `id_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `id_tags_id_tag_unique` UNIQUE(`id_tag`)
);
--> statement-breakpoint
CREATE TABLE `investor_settlement_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settlementId` int NOT NULL,
	`investorUserId` int NOT NULL,
	`participationPercent` decimal(8,4) NOT NULL,
	`grossShare` bigint NOT NULL,
	`expenseShare` bigint NOT NULL DEFAULT 0,
	`netShare` bigint NOT NULL,
	`investor_share_status` enum('PENDING','CREDITED','PAID') NOT NULL DEFAULT 'PENDING',
	`creditedAt` timestamp,
	`paymentReference` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `investor_settlement_shares_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `maintenance_fund_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stationId` int NOT NULL,
	`maintenance_fund_type` enum('deposit','withdrawal') NOT NULL,
	`amount` bigint NOT NULL,
	`description` text NOT NULL,
	`maintenanceType` varchar(100),
	`maintenanceDetail` text,
	`technicianName` varchar(255),
	`invoiceNumber` varchar(100),
	`settlementId` int,
	`balanceAfter` bigint NOT NULL DEFAULT 0,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `maintenance_fund_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operational_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stationId` int NOT NULL,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`availabilityPercent` decimal(5,2) DEFAULT '0',
	`totalUptimeHours` decimal(10,2) DEFAULT '0',
	`totalDowntimeHours` decimal(10,2) DEFAULT '0',
	`avgCriticalResponseHours` decimal(8,2) DEFAULT '0',
	`criticalTicketsCount` int DEFAULT 0,
	`criticalTicketsResolved` int DEFAULT 0,
	`platformUptimePercent` decimal(5,2) DEFAULT '99.50',
	`userSatisfactionScore` decimal(3,2) DEFAULT '0',
	`totalReviews` int DEFAULT 0,
	`billingAccuracyPercent` decimal(5,2) DEFAULT '100.00',
	`totalTransactions` int DEFAULT 0,
	`disputedTransactions` int DEFAULT 0,
	`solarGenerationPercent` decimal(5,2) DEFAULT '0',
	`solarKwhGenerated` decimal(12,4) DEFAULT '0',
	`solarKwhExpected` decimal(12,4) DEFAULT '0',
	`sla_status` enum('COMPLIANT','WARNING','BREACH') NOT NULL DEFAULT 'COMPLIANT',
	`slaBreachCount` int DEFAULT 0,
	`consecutiveBreachMonths` int DEFAULT 0,
	`penaltyApplied` varchar(100),
	`calculatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `settlement_expense_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settlementId` int NOT NULL,
	`expenseId` int,
	`name` varchar(255) NOT NULL,
	`expense_category` enum('ENERGY','INSURANCE','CONNECTIVITY','MAINTENANCE','FIDUCIARY','TAX','CONTINGENCY','ADMIN','OTHER') NOT NULL,
	`originalAmount` bigint NOT NULL,
	`proratedAmount` bigint NOT NULL,
	`waterfallPriority` int NOT NULL,
	`isProrated` boolean NOT NULL DEFAULT false,
	`prorateFormula` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `settlement_expense_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `soc_accuracy_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`transactionId` int NOT NULL,
	`vehicleId` int,
	`manualSocStart` int NOT NULL,
	`manualBatteryCapacityKwh` float NOT NULL,
	`realKwhDelivered` float NOT NULL,
	`calculatedSocEnd` int,
	`chargerSocEnd` int,
	`batteryFullDetected` boolean NOT NULL DEFAULT false,
	`detectionMethod` varchar(50),
	`estimatedErrorKwh` float,
	`estimatedErrorSocPct` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `soc_accuracy_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `station_demand_forecast` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stationId` int NOT NULL,
	`dayOfWeek` int NOT NULL,
	`hourOfDay` int NOT NULL,
	`avgSessionsPerSlot` decimal(8,4) DEFAULT '0',
	`avgOccupancyRate` decimal(5,2) DEFAULT '0',
	`avgKwhPerSlot` decimal(10,4) DEFAULT '0',
	`avgRevenuePerSlot` decimal(12,2) DEFAULT '0',
	`trend` varchar(20) DEFAULT 'STABLE',
	`trendPercent` decimal(6,2) DEFAULT '0',
	`suggestedDemandMultiplier` decimal(4,3) DEFAULT '1.000',
	`confidenceScore` int DEFAULT 0,
	`sampleSize` int DEFAULT 0,
	`lastCalculatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `station_demand_forecast_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `station_fixed_expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stationId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`expense_category` enum('ENERGY','INSURANCE','CONNECTIVITY','MAINTENANCE','FIDUCIARY','TAX','CONTINGENCY','ADMIN','OTHER') NOT NULL,
	`description` text,
	`amountCop` bigint NOT NULL,
	`expense_periodicity` enum('MONTHLY','BIMONTHLY','QUARTERLY','SEMIANNUAL','ANNUAL','ONE_TIME') NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp,
	`providerName` varchar(255),
	`contractReference` varchar(255),
	`waterfallPriority` int NOT NULL DEFAULT 5,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int NOT NULL,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `station_fixed_expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `station_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`station_id` int NOT NULL,
	`user_id` int NOT NULL,
	`rating` int NOT NULL,
	`comment` text,
	`owner_response` text,
	`owner_response_at` timestamp,
	`is_approved` tinyint NOT NULL DEFAULT 1,
	`is_visible` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `station_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `support_agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`isOnline` boolean NOT NULL DEFAULT false,
	`isAvailable` boolean NOT NULL DEFAULT true,
	`scheduleStart` varchar(10) DEFAULT '08:00',
	`scheduleEnd` varchar(10) DEFAULT '17:00',
	`workDays` json DEFAULT ('[1,2,3,4,5]'),
	`maxConcurrentTickets` int NOT NULL DEFAULT 5,
	`activeTicketCount` int NOT NULL DEFAULT 0,
	`lastAssignedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `support_agents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `support_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`senderId` int NOT NULL,
	`senderRole` varchar(20) NOT NULL,
	`message` text NOT NULL,
	`attachmentUrl` text,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `support_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tariff_change_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tariffId` int,
	`stationId` int,
	`changedBy` int NOT NULL,
	`changedByName` varchar(255),
	`changedByRole` varchar(50),
	`tariff_change_type` enum('CREATE','UPDATE','GLOBAL_UPDATE','DEACTIVATE') NOT NULL,
	`previousValues` json,
	`newValues` json,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tariff_change_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_consumption_profile` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`totalSessions` int NOT NULL DEFAULT 0,
	`totalKwh` decimal(12,4) NOT NULL DEFAULT '0',
	`totalSpentCop` decimal(15,2) NOT NULL DEFAULT '0',
	`avgKwhPerSession` decimal(8,4) NOT NULL DEFAULT '0',
	`avgCostPerSession` decimal(12,2) NOT NULL DEFAULT '0',
	`avgSessionDurationMin` int NOT NULL DEFAULT 0,
	`monthlyAvgSpent` decimal(12,2) NOT NULL DEFAULT '0',
	`monthlyAvgKwh` decimal(10,4) NOT NULL DEFAULT '0',
	`monthlyAvgSessions` decimal(6,2) NOT NULL DEFAULT '0',
	`preferredHours` json DEFAULT ('[]'),
	`preferredDays` json DEFAULT ('[]'),
	`topStations` json DEFAULT ('[]'),
	`preferredChargeType` varchar(10),
	`preferredConnectorType` varchar(20),
	`avgChargePowerKw` decimal(8,2) DEFAULT '0',
	`typicalChargeFrequencyDays` decimal(6,2),
	`lastChargeAt` timestamp,
	`nextPredictedChargeAt` timestamp,
	`userScore` int NOT NULL DEFAULT 0,
	`scoreBreakdown` json,
	`recommendedTier` varchar(20),
	`estimatedMonthlySavingsWithUpgrade` decimal(10,2) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_consumption_profile_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_consumption_profile_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `user_debts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`transactionId` int,
	`originalAmount` decimal(12,2) NOT NULL,
	`remainingAmount` decimal(12,2) NOT NULL,
	`reason` varchar(100) NOT NULL,
	`description` text,
	`debt_status` enum('PENDING','PAID','PARTIAL','WAIVED') NOT NULL DEFAULT 'PENDING',
	`autoChargeAttempts` int NOT NULL DEFAULT 0,
	`lastAutoChargeAt` timestamp,
	`paymentReference` varchar(255),
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_debts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_location_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`latitude` decimal(10,7) NOT NULL,
	`longitude` decimal(10,7) NOT NULL,
	`accuracy` decimal(8,2),
	`source` varchar(50) DEFAULT 'chat',
	`address` varchar(500),
	`city` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_location_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_login_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userAgent` text,
	`ipAddress` varchar(45),
	`deviceType` varchar(20),
	`browser` varchar(100),
	`os` varchar(100),
	`location` varchar(255),
	`isActive` boolean NOT NULL DEFAULT true,
	`loginAt` timestamp NOT NULL DEFAULT (now()),
	`lastActivityAt` timestamp NOT NULL DEFAULT (now()),
	`logoutAt` timestamp,
	CONSTRAINT `user_login_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_route_patterns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`originLatitude` decimal(10,7) NOT NULL,
	`originLongitude` decimal(10,7) NOT NULL,
	`originName` varchar(200),
	`originAddress` varchar(500),
	`destinationLatitude` decimal(10,7) NOT NULL,
	`destinationLongitude` decimal(10,7) NOT NULL,
	`destinationName` varchar(200),
	`destinationAddress` varchar(500),
	`frequency` int NOT NULL DEFAULT 1,
	`estimatedDistanceKm` decimal(8,2),
	`averageDurationMinutes` int,
	`typicalDepartureHour` int,
	`typicalDays` json,
	`preferredChargingStops` json,
	`lastUsed` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_route_patterns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_vehicles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`brand` varchar(100) NOT NULL,
	`model` varchar(100) NOT NULL,
	`year` int,
	`licensePlate` varchar(20),
	`batteryCapacityKwh` decimal(6,2),
	`rangeKm` int,
	`connectorTypes` json NOT NULL,
	`maxChargePowerKw` decimal(6,2),
	`batteryLevel` int,
	`lastBatteryUpdate` timestamp,
	`isDefault` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`imageUrl` text,
	`nickname` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_vehicles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wompi_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`wompiTransactionId` varchar(255),
	`reference` varchar(255) NOT NULL,
	`amountInCents` bigint NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'COP',
	`wompi_tx_status` enum('PENDING','APPROVED','DECLINED','VOIDED','ERROR') NOT NULL DEFAULT 'PENDING',
	`wompi_tx_type` enum('WALLET_RECHARGE','SUBSCRIPTION','INVESTMENT_DEPOSIT','OTHER') NOT NULL,
	`paymentMethodType` varchar(50),
	`customerEmail` varchar(320),
	`description` text,
	`integritySignature` text,
	`processedAt` timestamp,
	`webhookReceivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wompi_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `wompi_transactions_wompiTransactionId_unique` UNIQUE(`wompiTransactionId`),
	CONSTRAINT `wompi_transactions_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('staff','technician','investor','user','admin','engineer','host') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `charging_stations` ADD `imageUrl` text;--> statement-breakpoint
ALTER TABLE `charging_stations` ADD `thumbnailUrl` text;--> statement-breakpoint
ALTER TABLE `charging_stations` ADD `contactPhone` varchar(20);--> statement-breakpoint
ALTER TABLE `charging_stations` ADD `chargerBrandId` int;--> statement-breakpoint
ALTER TABLE `charging_stations` ADD `evgreenSharePercent` decimal(5,2) DEFAULT '30.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `charging_stations` ADD `investorSharePercent` decimal(5,2) DEFAULT '70.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `charging_stations` ADD `hostSharePercent` decimal(5,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `charging_stations` ADD `maintenanceFundPercent` decimal(5,2) DEFAULT '5.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `charging_stations` ADD `maintenanceFundAlertThreshold` decimal(15,2) DEFAULT '500000.00';--> statement-breakpoint
ALTER TABLE `charging_stations` ADD `energyPurchaseCostPerKwh` decimal(10,2) DEFAULT '850.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `charging_stations` ADD `hostUserId` int;--> statement-breakpoint
ALTER TABLE `charging_stations` ADD `hostName` varchar(255);--> statement-breakpoint
ALTER TABLE `crowdfunding_participations` ADD `paymentStatus` enum('PENDING','COMPLETED','FAILED','REFUNDED') DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE `crowdfunding_participations` ADD `paymentReference` varchar(255);--> statement-breakpoint
ALTER TABLE `crowdfunding_projects` ADD `status` enum('DRAFT','OPEN','IN_PROGRESS','FUNDED','BUILDING','OPERATIONAL','CLOSED') DEFAULT 'DRAFT' NOT NULL;--> statement-breakpoint
ALTER TABLE `ocpp_alerts` ADD `resolvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `ocpp_alerts` ADD `autoResolved` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `ocpp_alerts` ADD `resolvedReason` varchar(255);--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `wompiPublicKey` text;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `wompiPrivateKey` text;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `wompiIntegritySecret` text;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `wompiEventsSecret` text;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `wompiTestMode` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `defaultBasePricePerKwh` decimal(10,2) DEFAULT '1200' NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `defaultOverstayGracePeriodMinutes` int DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `eventName` varchar(255) DEFAULT 'Gran Lanzamiento Red de Carga EVGreen';--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `eventDate` varchar(100) DEFAULT 'Por confirmar';--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `eventTime` varchar(100) DEFAULT 'Por confirmar';--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `eventVenueName` varchar(255) DEFAULT 'Por confirmar';--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `eventAddress` varchar(500) DEFAULT 'Bogotá, Colombia';--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `eventCity` varchar(100) DEFAULT 'Bogotá';--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `eventContactPhone` varchar(50);--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `eventContactEmail` varchar(255) DEFAULT 'evgreen@greenhproject.com';--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `eventGoogleMapsUrl` text;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `eventWazeUrl` text;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `eventDressCode` varchar(100) DEFAULT 'Business Casual';--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `eventDescription` text;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `eventMaxGuests` int DEFAULT 30;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `eventBgImageUrl` text;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `alegraEmail` varchar(255);--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `alegraToken` text;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `alegraEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `alegraTestMode` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `alegraDefaultItemId` varchar(50);--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `alegraDefaultTaxId` varchar(50);--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `alegraAutoInvoice` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `alegraPaymentMethodId` varchar(50);--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `alegraPaymentAccountId` varchar(50);--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `alegraResolutionNumber` varchar(100);--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `supportEmail` varchar(255) DEFAULT 'soporte@greenhproject.com';--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `supportPhone` varchar(50) DEFAULT '+573001234567';--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `supportAutoAssign` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `wompiPaymentSourceId` varchar(100);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `wompiCardToken` varchar(100);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `cardBrand` varchar(20);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `cardLastFour` varchar(4);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `cardHolderName` varchar(255);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `monthlyAmountCents` bigint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `lastPaymentDate` timestamp;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `lastPaymentReference` varchar(255);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `failedPaymentCount` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `autoRechargeEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `autoRechargeThreshold` int DEFAULT 10000;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `autoRechargeAmount` int DEFAULT 20000;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `lastAutoRechargeAt` timestamp;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `autoRechargeFailCount` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `transactions` ADD `ocppNumericTxId` int;--> statement-breakpoint
ALTER TABLE `transactions` ADD `manualSoc` int;--> statement-breakpoint
ALTER TABLE `transactions` ADD `manualBatteryCapacityKwh` decimal(6,2);--> statement-breakpoint
ALTER TABLE `transactions` ADD `chargeMode` varchar(20) DEFAULT 'full_charge';--> statement-breakpoint
ALTER TABLE `transactions` ADD `targetValue` decimal(12,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `transactions` ADD `appliedPricePerKwh` decimal(10,2);--> statement-breakpoint
ALTER TABLE `users` ADD `birthDate` varchar(10);--> statement-breakpoint
ALTER TABLE `users` ADD `address` varchar(500);--> statement-breakpoint
ALTER TABLE `users` ADD `city` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `document_type` enum('CC','NIT','CE','PASAPORTE','TI','PEP');--> statement-breakpoint
ALTER TABLE `users` ADD `documentNumber` varchar(50);--> statement-breakpoint
ALTER TABLE `users` ADD `fiscalAddress` varchar(500);--> statement-breakpoint
ALTER TABLE `users` ADD `fiscalCity` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `fiscalDepartment` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `kind_of_person` enum('PERSON_ENTITY','LEGAL_ENTITY');--> statement-breakpoint
ALTER TABLE `users` ADD `regime` enum('SIMPLIFIED_REGIME','COMMON_REGIME','NOT_RESPONSIBLE_FOR_IVA');--> statement-breakpoint
ALTER TABLE `users` ADD `alegraContactId` varchar(50);--> statement-breakpoint
ALTER TABLE `users` ADD `investorTypes` json DEFAULT ('[]');--> statement-breakpoint
ALTER TABLE `users` ADD `investor_type` enum('individual','collective','founder');--> statement-breakpoint
ALTER TABLE `users` ADD `isFounder` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `founderTitle` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `founderOrder` int;--> statement-breakpoint
ALTER TABLE `users` ADD `investorPhotoUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `investorQuote` varchar(500);--> statement-breakpoint
ALTER TABLE `users` ADD `investorBio` text;--> statement-breakpoint
ALTER TABLE `users` ADD `investorBadge` varchar(50);--> statement-breakpoint
ALTER TABLE `users` ADD `investorJoinedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `investorTotalInvested` bigint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` ADD `investorShowInWall` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD `pushSubscription` text;--> statement-breakpoint
ALTER TABLE `users` ADD `techNotifyNewTickets` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD `techNotifyCriticalAlerts` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD `techNotifyMaintenanceReminders` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD `techNotifyByEmail` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD `techNotifyByPush` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD `techDefaultView` varchar(20) DEFAULT 'dashboard';--> statement-breakpoint
ALTER TABLE `users` ADD `techAutoRefreshLogs` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD `techRefreshInterval` int DEFAULT 30;--> statement-breakpoint
ALTER TABLE `users` ADD `techAvailableForEmergencies` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD `techWorkingHoursStart` varchar(5) DEFAULT '08:00';--> statement-breakpoint
ALTER TABLE `users` ADD `techWorkingHoursEnd` varchar(5) DEFAULT '18:00';--> statement-breakpoint
ALTER TABLE `users` ADD `prefLanguage` varchar(10) DEFAULT 'es';--> statement-breakpoint
ALTER TABLE `users` ADD `prefDistanceUnit` varchar(5) DEFAULT 'km';--> statement-breakpoint
ALTER TABLE `users` ADD `prefCurrency` varchar(5) DEFAULT 'COP';--> statement-breakpoint
ALTER TABLE `users` ADD `prefAutoLocate` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD `prefSaveHistory` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD `prefShareUsageData` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `twoFactorEnabled` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `twoFactorSecret` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `twoFactorVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `notifyProximity` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD `proximityRadiusKm` int DEFAULT 5;--> statement-breakpoint
ALTER TABLE `users` ADD `lastProximityAlertAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `lastProximityStationId` int;--> statement-breakpoint
ALTER TABLE `soc_accuracy_log` ADD CONSTRAINT `soc_accuracy_log_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `soc_accuracy_log` ADD CONSTRAINT `soc_accuracy_log_transactionId_transactions_id_fk` FOREIGN KEY (`transactionId`) REFERENCES `transactions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `soc_accuracy_log` ADD CONSTRAINT `soc_accuracy_log_vehicleId_user_vehicles_id_fk` FOREIGN KEY (`vehicleId`) REFERENCES `user_vehicles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `crowdfunding_participations` DROP COLUMN `payment_status`;--> statement-breakpoint
ALTER TABLE `crowdfunding_participations` DROP COLUMN `stripePaymentIntentId`;--> statement-breakpoint
ALTER TABLE `crowdfunding_projects` DROP COLUMN `crowdfunding_status`;--> statement-breakpoint
ALTER TABLE `platform_settings` DROP COLUMN `stripePublicKey`;--> statement-breakpoint
ALTER TABLE `platform_settings` DROP COLUMN `stripeSecretKey`;--> statement-breakpoint
ALTER TABLE `platform_settings` DROP COLUMN `stripeWebhookSecret`;--> statement-breakpoint
ALTER TABLE `platform_settings` DROP COLUMN `stripeTestMode`;--> statement-breakpoint
ALTER TABLE `subscriptions` DROP COLUMN `stripeSubscriptionId`;--> statement-breakpoint
ALTER TABLE `subscriptions` DROP COLUMN `stripePriceId`;--> statement-breakpoint
ALTER TABLE `wallet_transactions` DROP COLUMN `stripePaymentIntentId`;--> statement-breakpoint
ALTER TABLE `wallets` DROP COLUMN `stripeCustomerId`;