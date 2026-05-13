CREATE TABLE `investor_leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`spaceId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(20),
	`interestedAmount` bigint,
	`message` text,
	`lead_status` enum('new','contacted','converted','discarded') NOT NULL DEFAULT 'new',
	`adminNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `investor_leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `space_submissions` ADD `viewCount` int DEFAULT 0 NOT NULL;