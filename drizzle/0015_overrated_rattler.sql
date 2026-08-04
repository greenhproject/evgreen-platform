CREATE TABLE `ad_campaign_creatives` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`creative_format` enum('SPLASH','CHARGING','MAP','PROMOTIONAL') NOT NULL DEFAULT 'PROMOTIONAL',
	`imageUrl` text NOT NULL,
	`imageUrlMobile` text,
	`title` varchar(255) NOT NULL,
	`subtitle` varchar(500),
	`body` text,
	`ctaText` varchar(100),
	`linkUrl` text,
	`creative_status` enum('draft','pending_review','approved','rejected') NOT NULL DEFAULT 'draft',
	`adminNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `ad_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`advertiserId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`campaign_objective` enum('awareness','traffic','conversions','app_install') NOT NULL DEFAULT 'awareness',
	`campaign_status` enum('draft','pending_review','approved','active','paused','completed','rejected') NOT NULL DEFAULT 'draft',
	`budgetTotal` int NOT NULL,
	`budgetSpent` int NOT NULL DEFAULT 0,
	`startDate` timestamp,
	`endDate` timestamp,
	`targetCities` json,
	`targetVehicleBrands` json,
	`targetSubscriptionTiers` json,
	`targetMinChargesPerMonth` int,
	`targetActivitySegments` json,
	`impressions` int NOT NULL DEFAULT 0,
	`clicks` int NOT NULL DEFAULT 0,
	`uniqueViews` int NOT NULL DEFAULT 0,
	`adminNotes` text,
	`reviewedById` int,
	`reviewedAt` timestamp,
	`aiSuggestions` json,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `advertiser_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`taxId` varchar(50),
	`industry` varchar(100),
	`website` varchar(255),
	`contactName` varchar(255),
	`contactPhone` varchar(30),
	`contactEmail` varchar(320),
	`monthlyBudget` int,
	`advertiser_status` enum('pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending',
	`adminNotes` text,
	`approvedAt` timestamp,
	`approvedById` int,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `chargers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stationId` int NOT NULL,
	`ocppIdentity` varchar(100) NOT NULL,
	`ocppPassword` varchar(255),
	`brand` varchar(100),
	`model` varchar(100),
	`serialNumber` varchar(100),
	`firmwareVersion` varchar(50),
	`powerKw` decimal(8,2),
	`charger_status` enum('ONLINE','OFFLINE','FAULTED','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
	`isOnline` tinyint NOT NULL DEFAULT 0,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`lastHeartbeat` timestamp,
	`lastBootNotification` timestamp,
	`manufacturer` varchar(100),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `evse_state_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evseId` int NOT NULL,
	`stationId` int NOT NULL,
	`chargerId` int,
	`previousStatus` varchar(30),
	`newStatus` varchar(30) NOT NULL,
	`triggered_by` enum('OCPP','SYSTEM','ADMIN','BILLING','OVERSTAY','RESERVATION','SIMULATOR') NOT NULL,
	`reason` varchar(255),
	`transactionId` int,
	`ocppMessageType` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `financial_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stationId` int NOT NULL,
	`reportType` enum('monthly_pl','quarterly_pl','annual_pl','waterfall','investor_statement','tax_certificate') NOT NULL,
	`periodLabel` varchar(50) NOT NULL,
	`periodStart` bigint NOT NULL,
	`periodEnd` bigint NOT NULL,
	`fileUrl` text,
	`fileKey` varchar(255),
	`generatedBy` int,
	`status` enum('generating','ready','error') NOT NULL DEFAULT 'generating',
	`metadata` json,
	`createdAt` bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settlement_expense_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settlementId` int NOT NULL,
	`fixedExpenseId` int,
	`name` varchar(255) NOT NULL,
	`category` enum('insurance','connectivity','energy','maintenance','fiduciary','tax','admin','other') NOT NULL DEFAULT 'other',
	`amount` decimal(14,2) NOT NULL,
	`waterfallOrder` int NOT NULL DEFAULT 0,
	`createdAt` bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settlement_periods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stationId` int NOT NULL,
	`periodType` enum('monthly','quarterly','semiannual','annual') NOT NULL DEFAULT 'monthly',
	`periodLabel` varchar(50) NOT NULL,
	`startDate` bigint NOT NULL,
	`endDate` bigint NOT NULL,
	`status` enum('open','calculating','closed','distributed','cancelled') NOT NULL DEFAULT 'open',
	`grossRevenue` decimal(14,2) NOT NULL DEFAULT '0',
	`totalExpenses` decimal(14,2) NOT NULL DEFAULT '0',
	`netRevenue` decimal(14,2) NOT NULL DEFAULT '0',
	`platformFee` decimal(14,2) NOT NULL DEFAULT '0',
	`platformFeePercent` decimal(5,2) NOT NULL DEFAULT '30',
	`investorPool` decimal(14,2) NOT NULL DEFAULT '0',
	`investorPoolPercent` decimal(5,2) NOT NULL DEFAULT '70',
	`totalKwhSold` decimal(12,4) NOT NULL DEFAULT '0',
	`totalSessions` int NOT NULL DEFAULT 0,
	`avgPricePerKwh` decimal(10,2) NOT NULL DEFAULT '0',
	`notes` text,
	`closedAt` bigint,
	`closedBy` int,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	`totalEnergyCost` decimal(14,2) NOT NULL DEFAULT '0.00',
	`energyCostPerKwh` decimal(10,2) DEFAULT '850.00',
	`revenueFromEnergy` decimal(14,2) NOT NULL DEFAULT '0.00',
	`revenueFromPenalties` decimal(14,2) NOT NULL DEFAULT '0.00',
	`revenueFromReservations` decimal(14,2) NOT NULL DEFAULT '0.00',
	`revenueFromAdvertising` decimal(14,2) NOT NULL DEFAULT '0.00',
	`hostSharePercent` decimal(5,2) NOT NULL DEFAULT '0.00',
	`hostPool` decimal(14,2) NOT NULL DEFAULT '0.00',
	`hostUserId` int
);
--> statement-breakpoint
ALTER TABLE `api_keys` DROP INDEX `api_keys_keyHash_unique`;--> statement-breakpoint
ALTER TABLE `chargers_catalog` DROP INDEX `chargers_catalog_slug_unique`;--> statement-breakpoint
ALTER TABLE `charging_stations` DROP INDEX `charging_stations_ocppIdentity_unique`;--> statement-breakpoint
ALTER TABLE `event_guests` DROP INDEX `event_guests_qrCode_unique`;--> statement-breakpoint
ALTER TABLE `id_tags` DROP INDEX `id_tags_id_tag_unique`;--> statement-breakpoint
ALTER TABLE `pending_charge_sessions` DROP INDEX `pending_charge_sessions_sessionId_unique`;--> statement-breakpoint
ALTER TABLE `quotes` DROP INDEX `quotes_quoteNumber_unique`;--> statement-breakpoint
ALTER TABLE `quotes` DROP INDEX `quotes_publicToken_unique`;--> statement-breakpoint
ALTER TABLE `space_submissions` DROP INDEX `space_submissions_code_unique`;--> statement-breakpoint
ALTER TABLE `user_consumption_profile` DROP INDEX `user_consumption_profile_userId_unique`;--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_openId_unique`;--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_email_unique`;--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_idTag_unique`;--> statement-breakpoint
ALTER TABLE `vehicle_profiles` DROP INDEX `vehicle_profiles_userId_unique`;--> statement-breakpoint
ALTER TABLE `wallets` DROP INDEX `wallets_userId_unique`;--> statement-breakpoint
ALTER TABLE `wompi_transactions` DROP INDEX `wompi_transactions_wompiTransactionId_unique`;--> statement-breakpoint
ALTER TABLE `wompi_transactions` DROP INDEX `wompi_transactions_reference_unique`;--> statement-breakpoint
ALTER TABLE `ai_config` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `ai_conversations` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `ai_messages` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `ai_usage` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `api_keys` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `api_webhooks` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `backup_logs` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `banner_daily_stats` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `banner_views` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `banners` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `charger_brands` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `charger_problem_reports` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `chargers_catalog` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `charging_stations` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `claims` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `contactSubmissions` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `crowdfunding_participations` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `crowdfunding_projects` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `demoRequests` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `event_guests` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `event_payments` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `evses` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `favorite_stations` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `financial_settlements` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `firmware_updates` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `id_tags` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `investor_leads` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `investor_payouts` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `investor_settlement_shares` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `local_auth_entries` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `local_auth_lists` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `loyalty_config` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `loyalty_points` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `loyalty_redemptions` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `maintenance_fund_records` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `maintenance_tasks` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `maintenance_tickets` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `meter_values` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `notifications` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `occupancy_liquidations` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `ocpp_alerts` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `ocpp_logs` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `offline_transactions` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `operational_metrics` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `org_billing_records` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `org_users` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `organizations` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `overstay_locks` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `partner_applications` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `pending_charge_sessions` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `personalized_offers` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `platform_pricing_defaults` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `platform_settings` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `price_history` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `quote_items` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `quote_settings` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `quotes` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `refunds` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `reservations` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `scheduled_maintenances` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `session_feedback` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `settlement_expense_items` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `soc_accuracy_log` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `space_photos` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `space_submissions` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `station_availability_alerts` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `station_demand_forecast` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `station_fixed_expenses` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `station_reviews` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `subscriptions` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `support_agents` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `support_messages` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `support_tickets` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `tariff_change_logs` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `tariffs` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `transactions` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `user_consumption_profile` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `user_data_consents` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `user_debts` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `user_location_history` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `user_login_sessions` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `user_route_patterns` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `user_vehicles` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `users` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `vehicle_profiles` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `wallet_transactions` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `wallets` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `whatsapp_config` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `whatsapp_notification_log` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `wompi_transactions` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `ai_config` MODIFY COLUMN `enableChat` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `ai_config` MODIFY COLUMN `enableRecommendations` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `ai_config` MODIFY COLUMN `enableTripPlanner` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `ai_config` MODIFY COLUMN `enableInvestorInsights` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `ai_config` MODIFY COLUMN `enableAdminAnalytics` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `ai_config` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `ai_conversations` MODIFY COLUMN `isActive` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `ai_conversations` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `ai_messages` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `ai_usage` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `api_keys` MODIFY COLUMN `isActive` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `api_keys` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `api_webhooks` MODIFY COLUMN `isActive` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `api_webhooks` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `backup_logs` MODIFY COLUMN `startedAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `backup_logs` MODIFY COLUMN `totalSizeBytes` bigint;--> statement-breakpoint
ALTER TABLE `backup_logs` MODIFY COLUMN `isAutomatic` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `backup_logs` MODIFY COLUMN `isDeleted` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `backup_logs` MODIFY COLUMN `isDeleted` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `banner_daily_stats` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `banner_views` MODIFY COLUMN `viewedAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `banner_views` MODIFY COLUMN `clicked` tinyint;--> statement-breakpoint
ALTER TABLE `banner_views` MODIFY COLUMN `clicked` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `banners` MODIFY COLUMN `targetHasCard` tinyint;--> statement-breakpoint
ALTER TABLE `banners` MODIFY COLUMN `isClosable` tinyint DEFAULT 1;--> statement-breakpoint
ALTER TABLE `banners` MODIFY COLUMN `showOnce` tinyint;--> statement-breakpoint
ALTER TABLE `banners` MODIFY COLUMN `showOnce` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `banners` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `charger_brands` MODIFY COLUMN `ocppPasswordRequired` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `charger_brands` MODIFY COLUMN `ocppPasswordRequired` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `charger_brands` MODIFY COLUMN `supportsSoC` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `charger_brands` MODIFY COLUMN `supportsSoC` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `charger_brands` MODIFY COLUMN `supportsPowerMeasurement` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `charger_brands` MODIFY COLUMN `supportsPowerMeasurement` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `charger_brands` MODIFY COLUMN `supportsCurrentMeasurement` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `charger_brands` MODIFY COLUMN `supportsCurrentMeasurement` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `charger_brands` MODIFY COLUMN `supportsVoltageMeasurement` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `charger_brands` MODIFY COLUMN `supportsVoltageMeasurement` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `charger_brands` MODIFY COLUMN `supportsRemoteStart` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `charger_brands` MODIFY COLUMN `supportsRemoteStop` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `charger_brands` MODIFY COLUMN `supportsReset` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `charger_brands` MODIFY COLUMN `supportsReservation` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `charger_brands` MODIFY COLUMN `supportsReservation` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `charger_brands` MODIFY COLUMN `supportsSmartCharging` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `charger_brands` MODIFY COLUMN `supportsSmartCharging` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `charger_brands` MODIFY COLUMN `supportsFirmwareUpdate` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `charger_brands` MODIFY COLUMN `supportsFirmwareUpdate` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `charger_brands` MODIFY COLUMN `isActive` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `charger_brands` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `charger_problem_reports` MODIFY COLUMN `resolvedAt` datetime;--> statement-breakpoint
ALTER TABLE `charger_problem_reports` MODIFY COLUMN `createdAt` datetime NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `charger_problem_reports` MODIFY COLUMN `updatedAt` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP);--> statement-breakpoint
ALTER TABLE `chargers_catalog` MODIFY COLUMN `includesTransformer` tinyint;--> statement-breakpoint
ALTER TABLE `chargers_catalog` MODIFY COLUMN `includesTransformer` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `chargers_catalog` MODIFY COLUMN `isActive` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `chargers_catalog` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `charging_stations` MODIFY COLUMN `isOnline` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `charging_stations` MODIFY COLUMN `isOnline` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `charging_stations` MODIFY COLUMN `isPublic` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `charging_stations` MODIFY COLUMN `isActive` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `charging_stations` MODIFY COLUMN `thumbnailUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `charging_stations` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `claims` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `claims` MODIFY COLUMN `updatedAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `contactSubmissions` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `crowdfunding_participations` MODIFY COLUMN `contractSigned` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `crowdfunding_participations` MODIFY COLUMN `contractSigned` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `crowdfunding_participations` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `crowdfunding_projects` MODIFY COLUMN `raisedAmount` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `crowdfunding_projects` MODIFY COLUMN `hasSolarPanels` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `crowdfunding_projects` MODIFY COLUMN `status` enum('DRAFT','OPEN','IN_PROGRESS','FUNDED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'DRAFT';--> statement-breakpoint
ALTER TABLE `crowdfunding_projects` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `demoRequests` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `event_guests` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `event_payments` MODIFY COLUMN `founderBenefits` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `event_payments` MODIFY COLUMN `zoneFeeFree` tinyint DEFAULT 1;--> statement-breakpoint
ALTER TABLE `event_payments` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `evses` MODIFY COLUMN `lastStatusUpdate` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `evses` MODIFY COLUMN `isActive` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `evses` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `favorite_stations` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `financial_settlements` MODIFY COLUMN `grossRevenue` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_settlements` MODIFY COLUMN `totalFixedExpenses` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_settlements` MODIFY COLUMN `netRevenue` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_settlements` MODIFY COLUMN `totalEnergyCost` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_settlements` MODIFY COLUMN `revenueFromEnergy` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_settlements` MODIFY COLUMN `revenueFromPenalties` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_settlements` MODIFY COLUMN `revenueFromReservations` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_settlements` MODIFY COLUMN `revenueFromAdvertising` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_settlements` MODIFY COLUMN `investorTotalAmount` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_settlements` MODIFY COLUMN `platformTotalAmount` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_settlements` MODIFY COLUMN `hostTotalAmount` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_settlements` MODIFY COLUMN `maintenanceFundAmount` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_settlements` MODIFY COLUMN `platformNetAmount` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_settlements` MODIFY COLUMN `contingencyReserve` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_settlements` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `firmware_updates` MODIFY COLUMN `progress` int;--> statement-breakpoint
ALTER TABLE `firmware_updates` MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `firmware_updates` MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `id_tags` MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `investor_leads` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `investor_payouts` MODIFY COLUMN `investorPercentage` int NOT NULL DEFAULT 80;--> statement-breakpoint
ALTER TABLE `investor_payouts` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `investor_settlement_shares` MODIFY COLUMN `expenseShare` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `investor_settlement_shares` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `local_auth_entries` MODIFY COLUMN `isMasterCard` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `local_auth_entries` MODIFY COLUMN `isMasterCard` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `local_auth_entries` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `local_auth_lists` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `loyalty_config` MODIFY COLUMN `enabled` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `loyalty_config` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `loyalty_points` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `loyalty_redemptions` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `maintenance_fund_records` MODIFY COLUMN `balanceAfter` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `maintenance_fund_records` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `maintenance_tasks` MODIFY COLUMN `actualCostCop` bigint;--> statement-breakpoint
ALTER TABLE `maintenance_tasks` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `maintenance_tickets` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `meter_values` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `isRead` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `isRead` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `pushSent` tinyint;--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `pushSent` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `occupancy_liquidations` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `ocpp_alerts` MODIFY COLUMN `acknowledged` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `ocpp_alerts` MODIFY COLUMN `acknowledged` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `ocpp_alerts` MODIFY COLUMN `autoResolved` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `ocpp_alerts` MODIFY COLUMN `autoResolved` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `ocpp_alerts` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `ocpp_logs` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `offline_transactions` MODIFY COLUMN `reconciled` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `offline_transactions` MODIFY COLUMN `reconciled` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `offline_transactions` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `operational_metrics` MODIFY COLUMN `calculatedAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `operational_metrics` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `org_billing_records` MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `org_users` MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `organizations` MODIFY COLUMN `network_member` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `organizations` MODIFY COLUMN `support_included` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` MODIFY COLUMN `support_included` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `organizations` MODIFY COLUMN `enabled_modules` json;--> statement-breakpoint
ALTER TABLE `organizations` MODIFY COLUMN `support_mode` enum('org_only','evgreen_included') NOT NULL DEFAULT 'org_only';--> statement-breakpoint
ALTER TABLE `organizations` MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `organizations` MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `overstay_locks` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `pending_charge_sessions` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `pending_charge_sessions` MODIFY COLUMN `consumed` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `pending_charge_sessions` MODIFY COLUMN `consumed` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `personalized_offers` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `platform_pricing_defaults` MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `platform_settings` MODIFY COLUMN `investorPercentage` int NOT NULL DEFAULT 80;--> statement-breakpoint
ALTER TABLE `platform_settings` MODIFY COLUMN `platformFeePercentage` int NOT NULL DEFAULT 20;--> statement-breakpoint
ALTER TABLE `platform_settings` MODIFY COLUMN `wompiTestMode` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `platform_settings` MODIFY COLUMN `enableEnergyBilling` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `platform_settings` MODIFY COLUMN `enableReservationBilling` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `platform_settings` MODIFY COLUMN `enableOccupancyPenalty` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `platform_settings` MODIFY COLUMN `notifyChargeComplete` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `platform_settings` MODIFY COLUMN `notifyReservationReminder` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `platform_settings` MODIFY COLUMN `notifyPromotions` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` MODIFY COLUMN `notifyPromotions` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `platform_settings` MODIFY COLUMN `upmeAutoReport` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `platform_settings` MODIFY COLUMN `ocppServerActive` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `platform_settings` MODIFY COLUMN `enableDynamicPricing` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `platform_settings` MODIFY COLUMN `enableDifferentiatedPricing` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `platform_settings` MODIFY COLUMN `alegraEnabled` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` MODIFY COLUMN `alegraEnabled` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `platform_settings` MODIFY COLUMN `alegraTestMode` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `platform_settings` MODIFY COLUMN `alegraAutoInvoice` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `platform_settings` MODIFY COLUMN `resendApiKey` text;--> statement-breakpoint
ALTER TABLE `platform_settings` MODIFY COLUMN `supportAutoAssign` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `platform_settings` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `price_history` MODIFY COLUMN `isAutoPricing` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `price_history` MODIFY COLUMN `recordedAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `quote_items` MODIFY COLUMN `includesTransformer` tinyint;--> statement-breakpoint
ALTER TABLE `quote_items` MODIFY COLUMN `includesTransformer` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `quote_items` MODIFY COLUMN `commissionAmount` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `quote_items` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `quotes` MODIFY COLUMN `subtotal` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `quotes` MODIFY COLUMN `discount` bigint;--> statement-breakpoint
ALTER TABLE `quotes` MODIFY COLUMN `total` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `quotes` MODIFY COLUMN `totalCommission` bigint;--> statement-breakpoint
ALTER TABLE `quotes` MODIFY COLUMN `showProjection` tinyint DEFAULT 1;--> statement-breakpoint
ALTER TABLE `quotes` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `refunds` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `reservations` MODIFY COLUMN `isPenaltyApplied` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` MODIFY COLUMN `isPenaltyApplied` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `reservations` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `scheduled_maintenances` MODIFY COLUMN `estimatedCostCop` bigint;--> statement-breakpoint
ALTER TABLE `scheduled_maintenances` MODIFY COLUMN `reminderSent` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `scheduled_maintenances` MODIFY COLUMN `reminderSent` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `scheduled_maintenances` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `session_feedback` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `settlement_expense_items` MODIFY COLUMN `isProrated` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `settlement_expense_items` MODIFY COLUMN `isProrated` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `settlement_expense_items` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `soc_accuracy_log` MODIFY COLUMN `batteryFullDetected` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `soc_accuracy_log` MODIFY COLUMN `batteryFullDetected` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `soc_accuracy_log` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `space_photos` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `space_submissions` MODIFY COLUMN `hasElectricalPanel` tinyint;--> statement-breakpoint
ALTER TABLE `space_submissions` MODIFY COLUMN `hasElectricalPanel` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `space_submissions` MODIFY COLUMN `hasInternet` tinyint;--> statement-breakpoint
ALTER TABLE `space_submissions` MODIFY COLUMN `hasInternet` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `space_submissions` MODIFY COLUMN `is24Hours` tinyint;--> statement-breakpoint
ALTER TABLE `space_submissions` MODIFY COLUMN `is24Hours` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `space_submissions` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `station_availability_alerts` MODIFY COLUMN `sendPush` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `station_availability_alerts` MODIFY COLUMN `sendWhatsapp` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `station_availability_alerts` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `station_demand_forecast` MODIFY COLUMN `lastCalculatedAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `station_demand_forecast` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `station_fixed_expenses` MODIFY COLUMN `isActive` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `station_fixed_expenses` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `station_reviews` MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `station_reviews` MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `subscriptions` MODIFY COLUMN `prioritySupport` tinyint;--> statement-breakpoint
ALTER TABLE `subscriptions` MODIFY COLUMN `prioritySupport` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `subscriptions` MODIFY COLUMN `monthlyAmountCents` bigint;--> statement-breakpoint
ALTER TABLE `subscriptions` MODIFY COLUMN `autoRechargeEnabled` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` MODIFY COLUMN `autoRechargeEnabled` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `subscriptions` MODIFY COLUMN `isActive` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `subscriptions` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `support_agents` MODIFY COLUMN `isOnline` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `support_agents` MODIFY COLUMN `isOnline` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `support_agents` MODIFY COLUMN `isAvailable` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `support_agents` MODIFY COLUMN `workDays` json;--> statement-breakpoint
ALTER TABLE `support_agents` MODIFY COLUMN `lastAssignedAt` datetime;--> statement-breakpoint
ALTER TABLE `support_agents` MODIFY COLUMN `createdAt` datetime NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `support_messages` MODIFY COLUMN `senderId` int NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `support_messages` MODIFY COLUMN `senderRole` varchar(20) NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `support_messages` MODIFY COLUMN `attachmentUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `support_messages` MODIFY COLUMN `readAt` datetime;--> statement-breakpoint
ALTER TABLE `support_messages` MODIFY COLUMN `createdAt` datetime NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `support_tickets` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `tariff_change_logs` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `tariffs` MODIFY COLUMN `autoPricing` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `tariffs` MODIFY COLUMN `autoPricing` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `tariffs` MODIFY COLUMN `isActive` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `tariffs` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `transactions` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `user_consumption_profile` MODIFY COLUMN `preferredHours` json;--> statement-breakpoint
ALTER TABLE `user_consumption_profile` MODIFY COLUMN `preferredDays` json;--> statement-breakpoint
ALTER TABLE `user_consumption_profile` MODIFY COLUMN `topStations` json;--> statement-breakpoint
ALTER TABLE `user_consumption_profile` MODIFY COLUMN `computedAt` timestamp DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `user_consumption_profile` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `user_data_consents` MODIFY COLUMN `granted` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `user_data_consents` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `user_debts` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `user_debts` MODIFY COLUMN `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `user_location_history` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `user_login_sessions` MODIFY COLUMN `isActive` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `user_login_sessions` MODIFY COLUMN `loginAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `user_login_sessions` MODIFY COLUMN `lastActivityAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `user_route_patterns` MODIFY COLUMN `lastUsed` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `user_route_patterns` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `user_route_patterns` MODIFY COLUMN `updatedAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `user_vehicles` MODIFY COLUMN `isDefault` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `user_vehicles` MODIFY COLUMN `isDefault` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `user_vehicles` MODIFY COLUMN `isActive` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `user_vehicles` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `birthDate` date;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('staff','technician','investor','user','admin','engineer','host','comercial','advertiser') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `isActive` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `investorTypes` json;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `isFounder` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `isFounder` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `investorTotalInvested` bigint;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `investorShowInWall` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `notifyChargingComplete` tinyint DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `notifyLowBalance` tinyint DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `notifyPromotions` tinyint DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `techNotifyNewTickets` tinyint DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `techNotifyCriticalAlerts` tinyint DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `techNotifyMaintenanceReminders` tinyint DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `techNotifyByEmail` tinyint DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `techNotifyByPush` tinyint DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `techAutoRefreshLogs` tinyint DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `techAvailableForEmergencies` tinyint DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `prefAutoLocate` tinyint DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `prefSaveHistory` tinyint DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `prefShareUsageData` tinyint;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `prefShareUsageData` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `twoFactorEnabled` tinyint;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `twoFactorEnabled` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `onboardingCompleted` tinyint;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `onboardingCompleted` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `welcomeEmailSent` tinyint;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `welcomeEmailSent` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `notifyProximity` tinyint DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `emailNotifyEnabled` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `emailNotifyReceipts` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `emailNotifyWeeklyReport` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `emailNotifyWeeklyReport` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `emailNotifyPromotions` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `emailNotifyPromotions` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `waNotifyChargeStart` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `waNotifyChargeEnd` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `waNotifyReminder` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `waNotifyReminder` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `waNotifyPenalty` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `waNotifyWallet` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `lastSignedIn` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `vehicle_profiles` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `wallet_transactions` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `wallets` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `whatsapp_config` MODIFY COLUMN `enabled` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_config` MODIFY COLUMN `enabled` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `whatsapp_config` MODIFY COLUMN `notifyChargeStart` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `whatsapp_config` MODIFY COLUMN `notifyChargeEnd` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `whatsapp_config` MODIFY COLUMN `notifyChargeProgress` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_config` MODIFY COLUMN `notifyChargeProgress` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `whatsapp_config` MODIFY COLUMN `notifyPenalty` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `whatsapp_config` MODIFY COLUMN `notifyWalletRecharge` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `whatsapp_config` MODIFY COLUMN `notifyChargerOffline` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_config` MODIFY COLUMN `notifyChargerOffline` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `whatsapp_config` MODIFY COLUMN `notifyReservation` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `whatsapp_config` MODIFY COLUMN `notifyMonthlySummary` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_config` MODIFY COLUMN `notifyMonthlySummary` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `whatsapp_config` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `whatsapp_notification_log` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `wompi_transactions` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `charging_stations` ADD `gestor_id` int;--> statement-breakpoint
ALTER TABLE `charging_stations` ADD `gestor_commission_percent` decimal(5,2) DEFAULT '3.75' NOT NULL;--> statement-breakpoint
ALTER TABLE `evses` ADD `charger_id` int;--> statement-breakpoint
ALTER TABLE `investor_payouts` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `loyalty_points` ADD `source` enum('charge_session','redemption','bonus','adjustment','expiry') NOT NULL;--> statement-breakpoint
ALTER TABLE `loyalty_redemptions` ADD `redemptionType` enum('charge_discount','marketplace') NOT NULL;--> statement-breakpoint
ALTER TABLE `loyalty_redemptions` ADD `status` enum('pending','applied','cancelled') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `maintenance_tasks` ADD `status` enum('pending','in_progress','completed','overdue','cancelled') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `overstay_locks` ADD `finishingNotified` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `overstay_locks` ADD `graceWarningNotified` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `defaultPricePerKwhAc` decimal(10,2) DEFAULT '800' NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `defaultPricePerKwhDc` decimal(10,2) DEFAULT '1200' NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `costosOperativosAc` int DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `eficienciaCargaDc` int DEFAULT 92 NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `eficienciaCargaAc` int DEFAULT 95 NOT NULL;--> statement-breakpoint
ALTER TABLE `scheduled_maintenances` ADD `frequency` enum('weekly','biweekly','monthly','quarterly','semiannual','annual','one_time') NOT NULL;--> statement-breakpoint
ALTER TABLE `scheduled_maintenances` ADD `status` enum('active','paused','completed','cancelled') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `space_submissions` ADD `gestor_id` int;--> statement-breakpoint
ALTER TABLE `space_submissions` ADD `gestor_commission_percent` decimal(5,2) DEFAULT '3.75' NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `subscription_status` enum('ACTIVE','SUSPENDED','CANCELLED_PENDING','CANCELLED') DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `suspendedAt` timestamp;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `suspendedUntil` timestamp;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `cancellationRequestedAt` timestamp;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `cancellationEffectiveDate` timestamp;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `billingCronTaskUid` varchar(100);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `renewalReminderSentAt` timestamp;--> statement-breakpoint
ALTER TABLE `support_messages` ADD `attachmentType` varchar(20);--> statement-breakpoint
ALTER TABLE `support_messages` ADD `attachmentName` varchar(255);--> statement-breakpoint
ALTER TABLE `support_tickets` ADD `rating` int;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD `ratingComment` text;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD `ratedAt` timestamp;--> statement-breakpoint
ALTER TABLE `transactions` ADD `status` enum('PENDING','IN_PROGRESS','COMPLETED','FAILED','CANCELLED') DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `org_id` int;--> statement-breakpoint
ALTER TABLE `users` ADD `org_user_type` enum('admin','viewer','end_user');--> statement-breakpoint
CREATE INDEX `idx_chargers_station` ON `chargers` (`stationId`);--> statement-breakpoint
CREATE INDEX `idx_chargers_ocpp_identity` ON `chargers` (`ocppIdentity`);--> statement-breakpoint
CREATE INDEX `idx_evse_state_log_evse` ON `evse_state_log` (`evseId`);--> statement-breakpoint
CREATE INDEX `idx_evse_state_log_station` ON `evse_state_log` (`stationId`);--> statement-breakpoint
CREATE INDEX `idx_evse_state_log_created` ON `evse_state_log` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_fr_station` ON `financial_reports` (`stationId`);--> statement-breakpoint
CREATE INDEX `idx_fr_type` ON `financial_reports` (`reportType`);--> statement-breakpoint
CREATE INDEX `idx_sel_settlement` ON `settlement_expense_lines` (`settlementId`);--> statement-breakpoint
CREATE INDEX `idx_sp_station` ON `settlement_periods` (`stationId`);--> statement-breakpoint
CREATE INDEX `idx_sp_status` ON `settlement_periods` (`status`);--> statement-breakpoint
CREATE INDEX `api_keys_keyHash_unique` ON `api_keys` (`keyHash`);--> statement-breakpoint
CREATE INDEX `uq_banner_date` ON `banner_daily_stats` (`bannerId`,`date`);--> statement-breakpoint
CREATE INDEX `chargers_catalog_slug_unique` ON `chargers_catalog` (`slug`);--> statement-breakpoint
CREATE INDEX `charging_stations_ocppIdentity_unique` ON `charging_stations` (`ocppIdentity`);--> statement-breakpoint
CREATE INDEX `qrCode` ON `event_guests` (`qrCode`);--> statement-breakpoint
CREATE INDEX `event_guests_qrCode_unique` ON `event_guests` (`qrCode`);--> statement-breakpoint
CREATE INDEX `idx_evses_station` ON `evses` (`stationId`);--> statement-breakpoint
CREATE INDEX `unique_user_station` ON `favorite_stations` (`userId`,`stationId`);--> statement-breakpoint
CREATE INDEX `idx_station_id` ON `firmware_updates` (`station_id`);--> statement-breakpoint
CREATE INDEX `idx_ocpp_identity` ON `firmware_updates` (`ocpp_identity`);--> statement-breakpoint
CREATE INDEX `idx_status` ON `firmware_updates` (`status`);--> statement-breakpoint
CREATE INDEX `id_tags_id_tag_unique` ON `id_tags` (`id_tag`);--> statement-breakpoint
CREATE INDEX `idx_loyalty_points_user` ON `loyalty_points` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_loyalty_points_tx` ON `loyalty_points` (`transactionId`);--> statement-breakpoint
CREATE INDEX `idx_loyalty_redemptions_user` ON `loyalty_redemptions` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_ocpp_logs_identity_type_created` ON `ocpp_logs` (`ocppIdentity`,`messageType`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_ocpp_logs_created` ON `ocpp_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_org_id` ON `org_billing_records` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_billing_status` ON `org_billing_records` (`billing_status`);--> statement-breakpoint
CREATE INDEX `uq_org_user` ON `org_users` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_org_slug` ON `organizations` (`slug`);--> statement-breakpoint
CREATE INDEX `pending_charge_sessions_sessionId_unique` ON `pending_charge_sessions` (`sessionId`);--> statement-breakpoint
CREATE INDEX `idx_offers_user` ON `personalized_offers` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_offers_status` ON `personalized_offers` (`userId`,`offer_status`);--> statement-breakpoint
CREATE INDEX `idx_plan` ON `platform_pricing_defaults` (`org_plan`);--> statement-breakpoint
CREATE INDEX `quotes_quoteNumber_unique` ON `quotes` (`quoteNumber`);--> statement-breakpoint
CREATE INDEX `quotes_publicToken_unique` ON `quotes` (`publicToken`);--> statement-breakpoint
CREATE INDEX `idx_reservations_evse_status` ON `reservations` (`evseId`,`reservation_status`);--> statement-breakpoint
CREATE INDEX `space_submissions_code_unique` ON `space_submissions` (`code`);--> statement-breakpoint
CREATE INDEX `idx_station_status` ON `station_availability_alerts` (`stationId`,`alert_req_status`);--> statement-breakpoint
CREATE INDEX `idx_user_status` ON `station_availability_alerts` (`userId`,`alert_req_status`);--> statement-breakpoint
CREATE INDEX `unique_station_day_hour` ON `station_demand_forecast` (`stationId`,`dayOfWeek`,`hourOfDay`);--> statement-breakpoint
CREATE INDEX `idx_station` ON `station_demand_forecast` (`stationId`);--> statement-breakpoint
CREATE INDEX `idx_day_hour` ON `station_demand_forecast` (`dayOfWeek`,`hourOfDay`);--> statement-breakpoint
CREATE INDEX `idx_station` ON `station_fixed_expenses` (`stationId`);--> statement-breakpoint
CREATE INDEX `idx_station_reviews_station` ON `station_reviews` (`station_id`);--> statement-breakpoint
CREATE INDEX `idx_station_reviews_user` ON `station_reviews` (`user_id`);--> statement-breakpoint
CREATE INDEX `unique_user` ON `support_agents` (`userId`);--> statement-breakpoint
CREATE INDEX `userId_unique` ON `user_consumption_profile` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_consent_user` ON `user_data_consents` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_consent_type` ON `user_data_consents` (`userId`,`consent_type`);--> statement-breakpoint
CREATE INDEX `users_openId_unique` ON `users` (`openId`);--> statement-breakpoint
CREATE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_idTag_unique` ON `users` (`idTag`);--> statement-breakpoint
CREATE INDEX `userId` ON `vehicle_profiles` (`userId`);--> statement-breakpoint
CREATE INDEX `wallets_userId_unique` ON `wallets` (`userId`);--> statement-breakpoint
CREATE INDEX `wompiTransactionId` ON `wompi_transactions` (`wompiTransactionId`);--> statement-breakpoint
CREATE INDEX `reference` ON `wompi_transactions` (`reference`);--> statement-breakpoint
ALTER TABLE `loyalty_points` DROP COLUMN `loyalty_source`;--> statement-breakpoint
ALTER TABLE `loyalty_redemptions` DROP COLUMN `redemption_type`;--> statement-breakpoint
ALTER TABLE `loyalty_redemptions` DROP COLUMN `redemption_status`;--> statement-breakpoint
ALTER TABLE `maintenance_tasks` DROP COLUMN `maintenance_task_status`;--> statement-breakpoint
ALTER TABLE `platform_settings` DROP COLUMN `defaultPricePerKwhAC`;--> statement-breakpoint
ALTER TABLE `platform_settings` DROP COLUMN `defaultPricePerKwhDC`;--> statement-breakpoint
ALTER TABLE `platform_settings` DROP COLUMN `costosOperativosAC`;--> statement-breakpoint
ALTER TABLE `platform_settings` DROP COLUMN `eficienciaCargaDC`;--> statement-breakpoint
ALTER TABLE `platform_settings` DROP COLUMN `eficienciaCargaAC`;--> statement-breakpoint
ALTER TABLE `platform_settings` DROP COLUMN `capexEstacionPremium`;--> statement-breakpoint
ALTER TABLE `platform_settings` DROP COLUMN `participacionMinimaColectiva`;--> statement-breakpoint
ALTER TABLE `platform_settings` DROP COLUMN `sliderMaxSimulador`;--> statement-breakpoint
ALTER TABLE `scheduled_maintenances` DROP COLUMN `maintenance_frequency`;--> statement-breakpoint
ALTER TABLE `scheduled_maintenances` DROP COLUMN `maintenance_schedule_status`;