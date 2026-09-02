import { analyzeMarket } from './market-analysis';

type DiffRow = Record<string, string|number|null>;
type EastmoneyList = { rc:number; data?:{ total:number; diff:DiffRow[] } };
type LimitPool = { rc:number; data?:{ tc:number; qdate:number; pool?:Array<Record<string,unknown>> } };

const headers = { Referer:'https://quote.eastmoney.com/', 'User-Agent':'Mozilla/5.0 (compatible; TradeReviewWorkbench/1.0)' };
const listBase = 'https://push2.eastmoney.com/api/qt/clist/get';

async function getJson<T>(url: string): Promise<T> {
  const response=await fetch(url,{headers});
  if(!response.ok)throw new Error(`东财行情请求失败（HTTP ${response.status}）`);
  return response.json() as Promise<T>;
}

function query(params: Record<string,string|number>) {
  return new URLSearchParams(Object.entries(params).map(([key,value])=>[key,String(value)])).toString();
}

function shanghaiDate() {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}

async function fetchList(fs: string, fields: string, pageSize=6000) {
  const url=`${listBase}?${query({pn:1,pz:pageSize,po:1,np:1,fltt:2,invt:2,fid:'f3',fs,fields})}`;
  const payload=await getJson<EastmoneyList>(url);
  if(payload.rc!==0||!payload.data)throw new Error('东财行情列表暂不可用');
  return payload.data.diff||[];
}

export async function fetchEastmoneySnapshot() {
  const date=shanghaiDate(); const compact=date.replaceAll('-','');
  const stockFields='f2,f3,f6,f12,f14,f15,f16,f17,f18';
  const boardFields='f3,f12,f14,f62,f128,f136';
  const [stocks,industryBoards,conceptBoards,indexPayload,upPool,downPool]=await Promise.all([
    fetchList('m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23',stockFields),
    fetchList('m:90+t:2',boardFields,100), fetchList('m:90+t:3',boardFields,100),
    getJson<EastmoneyList>(`https://push2.eastmoney.com/api/qt/ulist.np/get?${query({fltt:2,invt:2,fields:'f12,f14,f2,f3,f6',secids:'1.000001,0.399001,0.399006'})}`),
    getJson<LimitPool>(`https://push2ex.eastmoney.com/getTopicZTPool?${query({ut:'7eea3edcaed734bea9cbfc24409ed989',dpt:'wz.ztzt',Pageindex:0,pagesize:5,sort:'fbt:asc',date:compact})}`),
    getJson<LimitPool>(`https://push2ex.eastmoney.com/getTopicDTPool?${query({ut:'7eea3edcaed734bea9cbfc24409ed989',dpt:'wz.ztzt',Pageindex:0,pagesize:5,sort:'fbt:asc',date:compact})}`),
  ]);
  if(!stocks.length)throw new Error('东财未返回 A 股行情，请稍后重试');
  let upCount=0,downCount=0,flatCount=0,amount=0;
  for(const stock of stocks){ const pct=Number(stock.f3); if(!Number.isFinite(pct))continue; if(pct>.01)upCount++;else if(pct<-.01)downCount++;else flatCount++; amount+=Number(stock.f6||0); }
  const indices=indexPayload.data?.diff||[];
  const indexAverage=indices.reduce((sum,row)=>sum+Number(row.f3||0),0)/Math.max(1,indices.length);
  const sectors=[...industryBoards,...conceptBoards].filter(row=>Number.isFinite(Number(row.f3))).sort((a,b)=>Number(b.f3)-Number(a.f3)).filter((row,index,all)=>all.findIndex(candidate=>candidate.f14===row.f14)===index).slice(0,10).map(row=>({ ts_code:String(row.f12||''), name:String(row.f14||''), pct_change:Number(row.f3||0), lead_stock:String(row.f128||''), pct_change_stock:Number(row.f136||0), company_num:0, main_inflow:Number(row.f62||0) }));
  const metrics={upCount,downCount,flatCount,limitUp:Number(upPool.data?.tc||0),limitDown:Number(downPool.data?.tc||0),turnover:Math.round(amount/100000000),indexAverage};
  return { date,metrics,analysis:analyzeMarket(metrics),indices:indices.map(row=>({ts_code:String(row.f12||''),name:String(row.f14||''),close:Number(row.f2||0),pct_chg:Number(row.f3||0),amount:Number(row.f6||0)})),sectors,sectorNotice:'',source:'eastmoney' };
}
