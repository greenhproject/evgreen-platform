ALTER TABLE `users` ADD `onboardingCompleted` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `onboardingStep` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` ADD `onboardingStartedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `onboardingCompletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `welcomeEmailSent` boolean DEFAULT false;