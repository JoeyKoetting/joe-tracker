ALTER TABLE `listing` ADD `review_date` text;
--> statement-breakpoint
ALTER TABLE `listing` ADD `application_requirements` text;
--> statement-breakpoint
ALTER TABLE `listing` ADD `reference_instructions` text;
--> statement-breakpoint
ALTER TABLE `listing` ADD `application_instructions` text;
--> statement-breakpoint
ALTER TABLE `listing` ADD `application_url` text;
--> statement-breakpoint
ALTER TABLE `listing` ADD `reference_url` text;
--> statement-breakpoint
CREATE INDEX `listing_review_date_idx` ON `listing` (`review_date`);
