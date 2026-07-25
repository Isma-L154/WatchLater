CREATE TABLE `watchlist_item` (
	`id` text PRIMARY KEY NOT NULL,
	`tmdb_id` integer NOT NULL,
	`media_type` text NOT NULL,
	`title` text NOT NULL,
	`poster_path` text,
	`release_date` text,
	`overview` text,
	`vote_average` real,
	`watched` integer DEFAULT false NOT NULL,
	`added_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_tmdb_media` ON `watchlist_item` (`tmdb_id`,`media_type`);