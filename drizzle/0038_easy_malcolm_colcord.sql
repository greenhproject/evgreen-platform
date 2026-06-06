CREATE TABLE `partner_applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_name` text NOT NULL,
	`contact_name` text NOT NULL,
	`email` varchar(255) NOT NULL,
	`phone` varchar(50) NOT NULL,
	`city` varchar(100),
	`current_brands` text,
	`annual_volume` varchar(100),
	`message` text,
	`partner_app_status` enum('pending','contacted','approved','rejected') NOT NULL DEFAULT 'pending',
	`created_at` bigint NOT NULL,
	`updated_at` bigint,
	CONSTRAINT `partner_applications_id` PRIMARY KEY(`id`)
);
