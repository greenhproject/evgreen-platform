CREATE TABLE `whatsapp_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phoneNumberId` varchar(100),
	`wabaId` varchar(100),
	`accessToken` text,
	`appSecret` text,
	`verifyToken` varchar(255),
	`displayPhone` varchar(30),
	`enabled` boolean NOT NULL DEFAULT false,
	`notifyChargeStart` boolean NOT NULL DEFAULT true,
	`notifyChargeEnd` boolean NOT NULL DEFAULT true,
	`notifyChargeProgress` boolean NOT NULL DEFAULT false,
	`notifyPenalty` boolean NOT NULL DEFAULT true,
	`notifyWalletRecharge` boolean NOT NULL DEFAULT true,
	`notifyChargerOffline` boolean NOT NULL DEFAULT false,
	`notifyReservation` boolean NOT NULL DEFAULT true,
	`notifyMonthlySummary` boolean NOT NULL DEFAULT false,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsapp_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_notification_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`toPhone` varchar(30) NOT NULL,
	`eventType` varchar(50) NOT NULL,
	`messageBody` text NOT NULL,
	`wa_notif_status` enum('sent','delivered','read','failed') NOT NULL DEFAULT 'sent',
	`wamid` varchar(128),
	`errorMessage` text,
	`referenceId` int,
	`referenceType` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsapp_notification_log_id` PRIMARY KEY(`id`)
);
