ALTER TABLE `crowdfunding_projects` ADD `cancellation_reason` text NULL;
ALTER TABLE `crowdfunding_projects` ADD `cancelled_at` timestamp NULL;
ALTER TABLE `crowdfunding_projects` ADD `cancelled_by` int NULL;
