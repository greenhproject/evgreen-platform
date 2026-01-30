CREATE TABLE `ocpp_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stationId` int,
	`ocppIdentity` varchar(100) NOT NULL,
	`ocpp_alert_type` enum('DISCONNECTION','ERROR','FAULT','OFFLINE_TIMEOUT','BOOT_REJECTED','TRANSACTION_ERROR') NOT NULL,
	`ocpp_alert_severity` enum('info','warning','critical') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`payload` json,
	`acknowledged` boolean NOT NULL DEFAULT false,
	`acknowledgedAt` timestamp,
	`acknowledgedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ocpp_alerts_id` PRIMARY KEY(`id`)
);
