ALTER TABLE `user` ADD `calendar_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `user_calendar_token_unique` ON `user` (`calendar_token`);