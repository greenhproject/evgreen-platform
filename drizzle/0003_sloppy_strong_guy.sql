CREATE TABLE `contactSubmissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`email` varchar(255) NOT NULL,
	`phone` varchar(30),
	`subject` varchar(200) NOT NULL,
	`message` text NOT NULL,
	`status` varchar(30) NOT NULL DEFAULT 'unread',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contactSubmissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `demoRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`company` varchar(120) NOT NULL,
	`email` varchar(255) NOT NULL,
	`phone` varchar(30),
	`chargerCount` varchar(30),
	`plan` varchar(30),
	`message` text,
	`status` varchar(30) NOT NULL DEFAULT 'pending',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `demoRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `org_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_id` int NOT NULL,
	`user_id` int NOT NULL,
	`role` enum('admin','viewer') NOT NULL DEFAULT 'admin',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `org_users_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `charging_stations` ADD `organization_id` int;--> statement-breakpoint
ALTER TABLE `organizations` ADD `enabled_modules` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `support_phone` varchar(50);--> statement-breakpoint
ALTER TABLE `organizations` ADD `support_email` varchar(200);--> statement-breakpoint
ALTER TABLE `organizations` ADD `support_whatsapp` varchar(50);--> statement-breakpoint
ALTER TABLE `organizations` ADD `support_mode` varchar(30) DEFAULT 'org_only';--> statement-breakpoint
ALTER TABLE `organizations` ADD `support_chat_embed` text;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD `organization_id` int;