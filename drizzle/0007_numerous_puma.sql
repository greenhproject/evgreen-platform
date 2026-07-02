ALTER TABLE `whatsapp_config` ADD `adminPhone` varchar(30);--> statement-breakpoint
ALTER TABLE `whatsapp_notification_log` ADD `status` enum('sent','delivered','read','failed') DEFAULT 'sent' NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_notification_log` DROP COLUMN `wa_notif_status`;