CREATE TABLE `sector_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`pct_change` real NOT NULL,
	`lead_stock` text DEFAULT '' NOT NULL,
	`lead_stock_pct` real DEFAULT 0 NOT NULL,
	`company_count` integer DEFAULT 0 NOT NULL,
	`rank` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sector_snapshots_date_rank` ON `sector_snapshots` (`date`,`rank`);--> statement-breakpoint
ALTER TABLE `market_snapshots` ADD `up_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `market_snapshots` ADD `down_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `market_snapshots` ADD `flat_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `market_snapshots` ADD `score` real DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `market_snapshots` ADD `indices` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `market_snapshots` ADD `source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `market_snapshots` ADD `refreshed_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `trades` ADD `market_phase` text DEFAULT '未标注' NOT NULL;