-- Accounts: every watchlist row now belongs to exactly one signed-in user.
--
-- Hand-adjusted from the generated output. drizzle-kit emitted a plain
-- `ALTER TABLE watchlist_item ADD user_id text NOT NULL`, which SQLite rejects
-- on a table that already has rows (there is no value to backfill with). The
-- table is therefore rebuilt via the standard 12-step ALTER TABLE procedure,
-- carrying existing rows over to a placeholder owner.

CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`google_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`avatar_url` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_google_id_unique` ON `user` (`google_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_session_user` ON `session` (`user_id`);--> statement-breakpoint

-- Placeholder owner for rows saved before accounts existed. Created only when
-- there is actually something to adopt, so a fresh database stays clean. The
-- first person to sign in inherits these rows and the placeholder is deleted
-- (see `claimLegacyItems` in the OAuth callback).
INSERT INTO `user` (`id`, `google_id`, `email`, `name`, `avatar_url`, `created_at`)
SELECT '__legacy__', '__legacy__', '', 'Pre-accounts list', NULL, 0
WHERE EXISTS (SELECT 1 FROM `watchlist_item`);--> statement-breakpoint

DROP INDEX `uq_tmdb_media`;--> statement-breakpoint
CREATE TABLE `__new_watchlist_item` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`media_type` text NOT NULL,
	`title` text NOT NULL,
	`poster_path` text,
	`release_date` text,
	`overview` text,
	`vote_average` real,
	`watched` integer DEFAULT false NOT NULL,
	`added_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_watchlist_item`
	(`id`, `user_id`, `tmdb_id`, `media_type`, `title`, `poster_path`, `release_date`, `overview`, `vote_average`, `watched`, `added_at`)
SELECT `id`, '__legacy__', `tmdb_id`, `media_type`, `title`, `poster_path`, `release_date`, `overview`, `vote_average`, `watched`, `added_at`
FROM `watchlist_item`;--> statement-breakpoint
DROP TABLE `watchlist_item`;--> statement-breakpoint
ALTER TABLE `__new_watchlist_item` RENAME TO `watchlist_item`;--> statement-breakpoint
CREATE INDEX `idx_watchlist_user` ON `watchlist_item` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_user_tmdb_media` ON `watchlist_item` (`user_id`,`tmdb_id`,`media_type`);
