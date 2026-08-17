ALTER TABLE `api_webhooks` ADD COLUMN `organization_id` int;
--> statement-breakpoint
CREATE INDEX `idx_api_webhooks_organization_id` ON `api_webhooks` (`organization_id`);
