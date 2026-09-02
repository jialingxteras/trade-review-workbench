import { analyzeMarket } from './market-analysis';

type TushareResult = { code: number; msg: string; data?: { fields: string[]; items: unknown[][] } };
type Row = Record<string, string|number|null>;

async function query(token: string, apiName: string, params: Record<string, string>, fields: string): Promise<Row[]> {
  const response = await fetch('https://api.tushare.pro', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ api_name:apiName, token, params, fields }) });
  if (!response.ok) throw new Error(`行情源请求失败（HTTP ${response.status}）`);
  const payload = await response.json() as TushareResult;
  if (payload.code !== 0 || !payload.data) throw new Error(payload.msg || `${apiName} 暂不可用`);
  return payload.data.items.map(values => Object.fromEntries(payload.data!.fields.map((field,index)=>[field,values[index] as string|number|null])));
}

async function latestTradeDate(token: string, requested?: string) {
  if (requested) return requested.replaceAll('-','');
  const end = new Date(); const start = new Date(end); start.setDate(start.getDate()-14);
  const compact = (date: Date) => date.toISOString().slice(0,10).replaceAll('-','');
  const days = await query(token,'trade_cal',{exchange:'SSE',start_date:compact(start),end_date:compact(end),is_open:'1'},'cal_date,is_open');
  return String(days.map(day=>day.cal_date).sort().at(-1) || compact(end));
}

export async function fetchMarketSnapshot(token: string, requestedDate?: string) {
  const tradeDate = await latestTradeDate(token, requestedDate);
  const [daily, limits, ...indices] = await Promise.all([
    query(token,'daily',{trade_date:tradeDate},'ts_code,trade_date,close,pct_chg,amount'),
    query(token,'stk_limit',{trade_date:tradeDate},'ts_code,up_limit,down_limit'),
    ...['000001.SH','399001.SZ','399006.SZ'].map(tsCode=>query(token,'index_daily',{ts_code:tsCode,trade_date:tradeDate},'ts_code,close,pct_chg,amount')),
  ]);
  if (!daily.length) throw new Error(`${tradeDate} 没有日线数据，请确认日期是否为交易日`);
  const limitMap = new Map(limits.map(row=>[String(row.ts_code),row]));
  let limitUp=0, limitDown=0, upCount=0, downCount=0, flatCount=0, rawAmount=0;
  daily.forEach(row=>{ const pct=Number(row.pct_chg||0); const close=Number(row.close||0); const limit=limitMap.get(String(row.ts_code)); if(pct>.01)upCount++;else if(pct<-.01)downCount++;else flatCount++; if(limit&&Math.abs(close-Number(limit.up_limit))<.005)limitUp++; if(limit&&Math.abs(close-Number(limit.down_limit))<.005)limitDown++; rawAmount+=Number(row.amount||0); });
  const indexRows = indices.flat(); const indexAverage=indexRows.reduce((s,row)=>s+Number(row.pct_chg||0),0)/Math.max(1,indexRows.length);
  let sectors: Row[]=[]; let sectorNotice='';
  try { sectors=await query(token,'moneyflow_cnt_ths',{trade_date:tradeDate},'trade_date,ts_code,name,pct_change,lead_stock,pct_change_stock,company_num'); }
  catch(error){ sectorNotice=error instanceof Error?error.message:'板块接口权限不足'; }
  sectors=sectors.sort((a,b)=>Number(b.pct_change||0)-Number(a.pct_change||0)).slice(0,10);
  const metrics={upCount,downCount,flatCount,limitUp,limitDown,turnover:Math.round(rawAmount/100000),indexAverage};
  return { date:`${tradeDate.slice(0,4)}-${tradeDate.slice(4,6)}-${tradeDate.slice(6,8)}`, metrics, analysis:analyzeMarket(metrics), indices:indexRows, sectors, sectorNotice, source:'tushare' };
}
