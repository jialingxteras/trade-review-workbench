import { d1, ensureSchema, seedIfEmpty } from '@/db/store';

type TradeInput = {
  id?: string; tradeDate?: string; tradeTime?: string; symbol?: string; code?: string;
  side?: string; price?: number; quantity?: number; pnl?: number; returnPct?: number;
  strategy?: string; marketPhase?: string; tags?: string[]; planned?: boolean; notes?: string;
};

export async function GET() {
  await ensureSchema();
  await seedIfEmpty();
  const result = await d1().prepare('SELECT * FROM trades ORDER BY trade_date DESC, trade_time DESC').all();
  return Response.json({ trades: result.results });
}

export async function POST(request: Request) {
  await ensureSchema();
  const payload = await request.json() as TradeInput | TradeInput[];
  const items = Array.isArray(payload) ? payload : [payload];
  if (!items.length || items.length > 500) return Response.json({ error: '每次可导入 1–500 条记录' }, { status: 400 });
  const db = d1();
  const statements = items.map((item, index) => {
    if (!item.symbol || !item.code || !item.tradeDate) throw new Error(`第 ${index + 1} 行缺少标的、代码或日期`);
    const id = item.id || crypto.randomUUID();
    return db.prepare(`INSERT OR REPLACE INTO trades
      (id,trade_date,trade_time,symbol,code,side,price,quantity,pnl,return_pct,strategy,market_phase,tags,planned,notes,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
        id, item.tradeDate, item.tradeTime || '09:30', item.symbol, item.code,
        item.side || '买入', Number(item.price || 0), Number(item.quantity || 0),
        Number(item.pnl || 0), Number(item.returnPct || 0), item.strategy || '待标注', item.marketPhase || '未标注',
        JSON.stringify(item.tags || []), item.planned === undefined ? 2 : item.planned === false ? 0 : 1, item.notes || '', new Date().toISOString(),
      );
  });
  await db.batch(statements);
  return Response.json({ ok: true, imported: items.length });
}
