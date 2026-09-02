CREATE TABLE `market_snapshots` (
	`date` text PRIMARY KEY NOT NULL,
	`phase` text NOT NULL,
	`confidence` integer NOT NULL,
	`limit_up` integer NOT NULL,
	`limit_down` integer NOT NULL,
	`turnover` real NOT NULL,
	`breadth` integer NOT NULL,
	`leading_sectors` text DEFAULT '[]' NOT NULL,
	`summary` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` text PRIMARY KEY NOT NULL,
	`trade_date` text NOT NULL,
	`trade_time` text NOT NULL,
	`symbol` text NOT NULL,
	`code` text NOT NULL,
	`side` text NOT NULL,
	`price` real NOT NULL,
	`quantity` integer NOT NULL,
	`pnl` real DEFAULT 0 NOT NULL,
	`return_pct` real DEFAULT 0 NOT NULL,
	`strategy` text DEFAULT '待标注' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`planned` integer DEFAULT true NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
