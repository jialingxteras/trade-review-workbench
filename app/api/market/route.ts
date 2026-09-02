import { d1, ensureSchema } from '@/db/store';
import { analyzeMarket } from '@/lib/market-analysis';

export async function GET() {
  await ensureSchema();
  const db=d1();
  const snapshot=await db.prepare('SELECT * FROM market_snapshots ORDER BY date DESC LIMIT 1').first<Record<string, unknown>>();
  const base=snapshot ? {
    date:snapshot.date, metrics:{upCount:Number(snapshot.up_count),downCount:Number(snapshot.down_count),flatCount:Number(snapshot.flat_count),limitUp:Number(snapshot.limit_up),limitDown:Number(snapshot.limit_down),turnover:Number(snapshot.turnover),indexAverage:JSON.parse(String(snapshot.indices||'[]')).reduce((s:number,x:{pct_chg?:number})=>s+Number(x.pct_chg||0),0)/Math.max(1,JSON.parse(String(snapshot.indices||'[]')).length)},
    analysis:{phase:snapshot.phase,score:Number(snapshot.score),confidence:Number(snapshot.confidence),summary:snapshot.summary}, indices:JSON.parse(String(snapshot.indices||'[]')), sectors:JSON.parse(String(snapshot.leading_sectors||'[]')), source:snapshot.source, refreshedAt:snapshot.refreshed_at,
  } : { date:'', metrics:{upCount:0,downCount:0,flatCount:0,limitUp:0,limitDown:0,turnover:0,indexAverage:0}, analysis:{phase:'待获取',score:0,confidence:0,summary:'尚未获取真实行情，暂不判断市场阶段。',preferred:[],avoid:[],reasons:[]}, indices:[], sectors:[], source:'none', refreshedAt:'' };
  const fullAnalysis=analyzeMarket(base.metrics);
  const phase=String(base.analysis.phase||fullAnalysis.phase);
  let stats=await db.prepare(`SELECT strategy, COUNT(*) samples, SUM(CASE WHEN pnl>0 THEN 1 ELSE 0 END) wins, AVG(return_pct) avg_return, SUM(pnl) total_pnl FROM trades WHERE market_phase=? AND strategy!='待标注' AND pnl!=0 GROUP BY strategy ORDER BY avg_return DESC`).bind(phase).all();
  let matched=true;
  if(!stats.results.length){ matched=false; stats=await db.prepare(`SELECT strategy, COUNT(*) samples, SUM(CASE WHEN pnl>0 THEN 1 ELSE 0 END) wins, AVG(return_pct) avg_return, SUM(pnl) total_pnl FROM trades WHERE strategy!='待标注' AND pnl!=0 GROUP BY strategy ORDER BY avg_return DESC`).all(); }
  const recommendations=stats.results.map((row:Record<string,unknown>)=>({strategy:row.strategy,samples:Number(row.samples),winRate:Math.round(Number(row.wins)/Number(row.samples)*100),avgReturn:Number(row.avg_return),totalPnl:Number(row.total_pnl),matched,label:Number(row.samples)>=3&&Number(row.avg_return)>0?'适用':Number(row.avg_return)<0?'规避':'观察'}));
  return Response.json({ ...base, analysis:{...fullAnalysis,...base.analysis}, recommendations, provider:{name:'东方财富行情',configured:true} });
}
