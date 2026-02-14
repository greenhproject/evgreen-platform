-- Add 2FA columns to users table
ALTER TABLE `users` ADD COLUMN `twoFactorEnabled` boolean DEFAULT false;
ALTER TABLE `users` ADD COLUMN `twoFactorSecret` varchar(255);
ALTER TABLE `users` ADD COLUMN `twoFactorVerifiedAt` timestamp;

-- Create user login sessions table
CREATE TABLE IF NOT EXISTS `user_login_sessions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `userAgent` text,
  `ipAddress` varchar(45),
  `deviceType` varchar(20),
  `browser` varchar(100),
  `os` varchar(100),
  `location` varchar(255),
  `isActive` boolean NOT NULL DEFAULT true,
  `loginAt` timestamp NOT NULL DEFAULT (now()),
  `lastActivityAt` timestamp NOT NULL DEFAULT (now()),
  `logoutAt` timestamp,
  CONSTRAINT `user_login_sessions_id` PRIMARY KEY(`id`)
);
