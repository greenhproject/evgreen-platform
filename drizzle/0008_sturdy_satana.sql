ALTER TABLE `users` ADD `idTag` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_idTag_unique` UNIQUE(`idTag`);