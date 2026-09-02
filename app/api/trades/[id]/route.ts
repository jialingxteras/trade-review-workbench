import { d1, ensureSchema } from '@/db/store';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  const body = await request.json() as { tradeDate?: string; strategy?: string; marketPhase?: string; tags?: string[]; planned?: boolean|null; notes?: string };
  const planned = body.planned === null ? 2 : body.planned === false ? 0 : 1;
  await d1().prepare(`UPDATE trades SET trade_date = ?, strategy = ?, market_phase = ?, tags = ?, planned = ?, notes = ? WHERE id = ?`).bind(
    body.tradeDate || '2026-09-02', body.strategy || '待标注', body.marketPhase || '未标注', JSON.stringify(body.tags || []), planned, body.notes || '', id,
  ).run();
  return Response.json({ ok: true });
}
