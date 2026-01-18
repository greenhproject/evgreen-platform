CREATE TABLE `ai_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ai_provider` enum('manus','openai','anthropic','google','azure','custom') NOT NULL DEFAULT 'manus',
	`openaiApiKey` text,
	`anthropicApiKey` text,
	`googleApiKey` text,
	`azureApiKey` text,
	`azureEndpoint` text,
	`customApiKey` text,
	`customEndpoint` text,
	`modelName` varchar(100),
	`temperature` decimal(3,2) DEFAULT '0.7',
	`maxTokens` int DEFAULT 2000,
	`enableChat` boolean NOT NULL DEFAULT true,
	`enableRecommendations` boolean NOT NULL DEFAULT true,
	`enableTripPlanner` boolean NOT NULL DEFAULT true,
	`enableInvestorInsights` boolean NOT NULL DEFAULT true,
	`enableAdminAnalytics` boolean NOT NULL DEFAULT true,
	`dailyUserLimit` int DEFAULT 50,
	`dailyTotalLimit` int DEFAULT 10000,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`conversationType` varchar(50) NOT NULL DEFAULT 'chat',
	`title` varchar(255),
	`context` json,
	`isActive` boolean NOT NULL DEFAULT true,
	`messageCount` int NOT NULL DEFAULT 0,
	`lastMessageAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_messages` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`role` varchar(20) NOT NULL,
	`content` text NOT NULL,
	`tokenCount` int,
	`provider` varchar(50),
	`model` varchar(100),
	`structuredData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_usage` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`usageType` varchar(50) NOT NULL,
	`provider` varchar(50) NOT NULL,
	`model` varchar(100),
	`inputTokens` int DEFAULT 0,
	`outputTokens` int DEFAULT 0,
	`totalTokens` int DEFAULT 0,
	`estimatedCost` decimal(10,6),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_usage_id` PRIMARY KEY(`id`)
);
