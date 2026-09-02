CREATE INDEX `idx_trades_date_time` ON `trades` (`trade_date`,`trade_time`);--> statement-breakpoint
CREATE INDEX `idx_trades_strategy` ON `trades` (`strategy`);