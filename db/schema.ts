import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const trades = sqliteTable('trades', {
  id: text('id').primaryKey(),
  tradeDate: text('trade_date').notNull(),
  tradeTime: text('trade_time').notNull(),
  symbol: text('symbol').notNull(),
  code: text('code').notNull(),
  side: text('side').notNull(),
  price: real('price').notNull(),
  quantity: integer('quantity').notNull(),
  pnl: real('pnl').notNull().default(0),
  returnPct: real('return_pct').notNull().default(0),
  strategy: text('strategy').notNull().default('待标注'),
  marketPhase: text('market_phase').notNull().default('未标注'),
  tags: text('tags').notNull().default('[]'),
  planned: integer('planned', { mode: 'boolean' }).notNull().default(true),
  notes: text('notes').notNull().default(''),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('idx_trades_date_time').on(table.tradeDate, table.tradeTime),
  index('idx_trades_strategy').on(table.strategy),
]);

export const marketSnapshots = sqliteTable('market_snapshots', {
  date: text('date').primaryKey(),
  phase: text('phase').notNull(),
  confidence: integer('confidence').notNull(),
  limitUp: integer('limit_up').notNull(),
  limitDown: integer('limit_down').notNull(),
  turnover: real('turnover').notNull(),
  breadth: integer('breadth').notNull(),
  upCount: integer('up_count').notNull().default(0),
  downCount: integer('down_count').notNull().default(0),
  flatCount: integer('flat_count').notNull().default(0),
  score: real('score').notNull().default(50),
  indices: text('indices').notNull().default('[]'),
  leadingSectors: text('leading_sectors').notNull().default('[]'),
  summary: text('summary').notNull(),
  source: text('source').notNull().default('manual'),
  refreshedAt: text('refreshed_at').notNull().default(''),
});

export const sectorSnapshots = sqliteTable('sector_snapshots', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  pctChange: real('pct_change').notNull(),
  leadStock: text('lead_stock').notNull().default(''),
  leadStockPct: real('lead_stock_pct').notNull().default(0),
  companyCount: integer('company_count').notNull().default(0),
  rank: integer('rank').notNull(),
}, (table) => [index('idx_sector_snapshots_date_rank').on(table.date, table.rank)]);

export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
