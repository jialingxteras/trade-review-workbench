import { env } from 'cloudflare:workers';

const schema = [
  `CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY, trade_date TEXT NOT NULL, trade_time TEXT NOT NULL,
    symbol TEXT NOT NULL, code TEXT NOT NULL, side TEXT NOT NULL,
    price REAL NOT NULL, quantity INTEGER NOT NULL, pnl REAL NOT NULL DEFAULT 0,
    return_pct REAL NOT NULL DEFAULT 0, strategy TEXT NOT NULL DEFAULT '待标注', market_phase TEXT NOT NULL DEFAULT '未标注',
    tags TEXT NOT NULL DEFAULT '[]', planned INTEGER NOT NULL DEFAULT 1,
    notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_trades_date_time ON trades(trade_date, trade_time)`,
  `CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades(strategy)`,
  `CREATE TABLE IF NOT EXISTS market_snapshots (
    date TEXT PRIMARY KEY, phase TEXT NOT NULL, confidence INTEGER NOT NULL,
    limit_up INTEGER NOT NULL, limit_down INTEGER NOT NULL, turnover REAL NOT NULL,
    breadth INTEGER NOT NULL, up_count INTEGER NOT NULL DEFAULT 0, down_count INTEGER NOT NULL DEFAULT 0,
    flat_count INTEGER NOT NULL DEFAULT 0, score REAL NOT NULL DEFAULT 50, indices TEXT NOT NULL DEFAULT '[]',
    leading_sectors TEXT NOT NULL DEFAULT '[]', summary TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual', refreshed_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS sector_snapshots (
    id TEXT PRIMARY KEY, date TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL,
    pct_change REAL NOT NULL, lead_stock TEXT NOT NULL DEFAULT '', lead_stock_pct REAL NOT NULL DEFAULT 0,
    company_count INTEGER NOT NULL DEFAULT 0, rank INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sector_snapshots_date_rank ON sector_snapshots(date, rank)`,
  `CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
];

export function d1() {
  if (!env.DB) throw new Error('数据库尚未连接');
  return env.DB;
}

export async function ensureSchema() {
  const db = d1();
  const addColumn = async (table: string, name: string, type: string) => {
    try { await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`).run(); }
    catch (error) { if (!String(error).includes('duplicate column name')) throw error; }
  };
  await db.batch(schema.map((statement) => db.prepare(statement)));
  const tradeColumns = await db.prepare('PRAGMA table_info(trades)').all<{ name: string }>();
  if (!tradeColumns.results.some((column) => column.name === 'market_phase')) {
    await addColumn('trades', 'market_phase', "TEXT NOT NULL DEFAULT '未标注'");
  }
  const marketColumns = await db.prepare('PRAGMA table_info(market_snapshots)').all<{ name: string }>();
  const additions = [
    ['up_count', 'INTEGER NOT NULL DEFAULT 0'], ['down_count', 'INTEGER NOT NULL DEFAULT 0'],
    ['flat_count', 'INTEGER NOT NULL DEFAULT 0'], ['score', 'REAL NOT NULL DEFAULT 50'],
    ['indices', "TEXT NOT NULL DEFAULT '[]'"], ['source', "TEXT NOT NULL DEFAULT 'manual'"],
    ['refreshed_at', "TEXT NOT NULL DEFAULT ''"],
  ].filter(([name]) => !marketColumns.results.some((column) => column.name === name));
  for (const [name, type] of additions) await addColumn('market_snapshots', name, type);
  await db.prepare('PRAGMA optimize').run();
}

export async function seedIfEmpty() {
  const db = d1();
  const imported = await db.prepare("SELECT value FROM app_meta WHERE key='initial_statement_import_v1'").first();
  if (imported) return;
  const now = new Date().toISOString();
  const rows = [
    ['statement-1','2026-09-02','09:39:04','开开实业','600272','买入',18.6,10000,0,0,'待标注','未标注','["截图导入","全部成交","日期待确认"]',2,'根据首次上传的成交截图录入；截图未显示交易日期，请确认。',now],
    ['statement-2','2026-09-02','09:34:42','开开实业','600272','买入',19.46,20000,0,0,'待标注','未标注','["截图导入","全部成交","日期待确认"]',2,'根据首次上传的成交截图录入；截图未显示交易日期，请确认。',now],
  ];
  await db.batch([
    db.prepare("DELETE FROM trades WHERE id IN ('seed-1','seed-2','seed-3')"),
    ...rows.map((row) => db.prepare(`INSERT OR REPLACE INTO trades
    (id,trade_date,trade_time,symbol,code,side,price,quantity,pnl,return_pct,strategy,market_phase,tags,planned,notes,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(...row)),
    db.prepare("INSERT OR REPLACE INTO app_meta (key,value) VALUES ('initial_statement_import_v1',?)").bind(now),
  ]);
}
