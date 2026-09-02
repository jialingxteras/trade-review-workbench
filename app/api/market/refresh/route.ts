import { d1, ensureSchema } from '@/db/store';
import { fetchEastmoneySnapshot } from '@/lib/eastmoney';

export async function POST(request: Request) {
  await ensureSchema();
  await request.json().catch(()=>({}));
  try {
    const snapshot=await fetchEastmoneySnapshot();
    const {metrics,analysis}=snapshot; const db=d1();
    await db.prepare(`INSERT OR REPLACE INTO market_snapshots (date,phase,confidence,limit_up,limit_down,turnover,breadth,up_count,down_count,flat_count,score,indices,leading_sectors,summary,source,refreshed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      snapshot.date,analysis.phase,analysis.confidence,metrics.limitUp,metrics.limitDown,metrics.turnover,Math.round(metrics.upCount/Math.max(1,metrics.upCount+metrics.downCount+metrics.flatCount)*100),metrics.upCount,metrics.downCount,metrics.flatCount,analysis.score,JSON.stringify(snapshot.indices),JSON.stringify(snapshot.sectors),analysis.summary,snapshot.source,new Date().toISOString(),
    ).run();
    if(snapshot.sectors.length){ await db.prepare('DELETE FROM sector_snapshots WHERE date=?').bind(snapshot.date).run(); await db.batch(snapshot.sectors.map((sector,index)=>db.prepare(`INSERT INTO sector_snapshots (id,date,code,name,pct_change,lead_stock,lead_stock_pct,company_count,rank) VALUES (?,?,?,?,?,?,?,?,?)`).bind(`${snapshot.date}-${sector.ts_code||index}`,snapshot.date,String(sector.ts_code||''),String(sector.name||''),Number(sector.pct_change||0),String(sector.lead_stock||''),Number(sector.pct_change_stock||0),Number(sector.company_num||0),index+1))); }
    return Response.json(snapshot);
  } catch(error){ return Response.json({error:error instanceof Error?error.message:'行情刷新失败'},{status:502}); }
}
