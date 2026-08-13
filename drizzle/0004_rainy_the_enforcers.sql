ALTER TABLE `user` ADD `auto_archive_days` integer;--> statement-breakpoint
ALTER TABLE `watchlist_item` ADD `watched_at` integer;--> statement-breakpoint
ALTER TABLE `watchlist_item` ADD `archived_at` integer;