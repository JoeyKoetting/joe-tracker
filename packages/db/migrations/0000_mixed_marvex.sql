CREATE TABLE `ingest_run` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`mode` text NOT NULL,
	`fetched` integer DEFAULT 0 NOT NULL,
	`inserted` integer DEFAULT 0 NOT NULL,
	`updated` integer DEFAULT 0 NOT NULL,
	`unchanged` integer DEFAULT 0 NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `listing` (
	`jp_id` integer PRIMARY KEY NOT NULL,
	`joe_year` integer,
	`joe_issue_id` integer,
	`section` text,
	`title` text,
	`institution` text,
	`division` text,
	`department` text,
	`salary_range` text,
	`keywords` text,
	`full_text` text,
	`application_deadline` text,
	`status` text,
	`date_active` text,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`content_hash` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `listing_date_active_idx` ON `listing` (`date_active`);--> statement-breakpoint
CREATE INDEX `listing_section_idx` ON `listing` (`section`);--> statement-breakpoint
CREATE INDEX `listing_institution_idx` ON `listing` (`institution`);--> statement-breakpoint
CREATE INDEX `listing_deadline_idx` ON `listing` (`application_deadline`);--> statement-breakpoint
CREATE INDEX `listing_first_seen_idx` ON `listing` (`first_seen_at`);--> statement-breakpoint
CREATE TABLE `listing_jel` (
	`jp_id` integer NOT NULL,
	`code` text NOT NULL,
	`description` text,
	PRIMARY KEY(`jp_id`, `code`),
	FOREIGN KEY (`jp_id`) REFERENCES `listing`(`jp_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `listing_jel_code_idx` ON `listing_jel` (`code`);--> statement-breakpoint
CREATE TABLE `listing_location` (
	`jp_id` integer NOT NULL,
	`country` text NOT NULL,
	`state` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	PRIMARY KEY(`jp_id`, `country`, `state`, `city`),
	FOREIGN KEY (`jp_id`) REFERENCES `listing`(`jp_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `listing_location_country_idx` ON `listing_location` (`country`);--> statement-breakpoint
CREATE TABLE `mark` (
	`jp_id` integer PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mark_state_idx` ON `mark` (`state`);--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
