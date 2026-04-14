-- Add configurable financial model fields to charging_stations
ALTER TABLE `charging_stations` ADD COLUMN `evgreenSharePercent` decimal(5,2) NOT NULL DEFAULT '30.00';
ALTER TABLE `charging_stations` ADD COLUMN `investorSharePercent` decimal(5,2) NOT NULL DEFAULT '70.00';
ALTER TABLE `charging_stations` ADD COLUMN `hostSharePercent` decimal(5,2) NOT NULL DEFAULT '0.00';
ALTER TABLE `charging_stations` ADD COLUMN `energyPurchaseCostPerKwh` decimal(10,2) NOT NULL DEFAULT '850.00';
ALTER TABLE `charging_stations` ADD COLUMN `hostUserId` int;
ALTER TABLE `charging_stations` ADD COLUMN `hostName` varchar(255);

-- Add host role to users enum
ALTER TABLE `users` MODIFY COLUMN `role` enum('staff','technician','investor','user','admin','engineer','host') NOT NULL DEFAULT 'user';

-- Add host share and energy cost fields to financial_settlements
ALTER TABLE `financial_settlements` ADD COLUMN `totalEnergyCost` bigint NOT NULL DEFAULT 0;
ALTER TABLE `financial_settlements` ADD COLUMN `energyCostPerKwh` decimal(10,2) DEFAULT '850.00';
ALTER TABLE `financial_settlements` ADD COLUMN `revenueFromEnergy` bigint NOT NULL DEFAULT 0;
ALTER TABLE `financial_settlements` ADD COLUMN `revenueFromPenalties` bigint NOT NULL DEFAULT 0;
ALTER TABLE `financial_settlements` ADD COLUMN `revenueFromReservations` bigint NOT NULL DEFAULT 0;
ALTER TABLE `financial_settlements` ADD COLUMN `revenueFromAdvertising` bigint NOT NULL DEFAULT 0;
ALTER TABLE `financial_settlements` ADD COLUMN `hostSharePercent` decimal(5,2) NOT NULL DEFAULT '0.00';
ALTER TABLE `financial_settlements` ADD COLUMN `hostTotalAmount` bigint NOT NULL DEFAULT 0;
