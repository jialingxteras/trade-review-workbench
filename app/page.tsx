'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';

type Trade = {
  id: string; trade_date: string; trade_time: string; symbol: string; code: string;
  side: string; price: number; quantity: number; pnl: number; return_pct: number;
  strategy: string; market_phase: string; tags: string; planned: number; notes: string;
};

type MarketData = {
  date: string; source: string; refreshedAt?: string;
  metrics: { upCount:number; downCount:number; flatCount:number; limitUp:number; limitDown:number; turnover:number; indexAverage:number };
  analysis: { phase:string; score:number; confidence:number; summary:string; preferred:string[]; avoid:string[]; reasons:string[] };
  sectors: Array<{ name:string; pct_change:number; lead_stock?:string; company_num?:number }>;
  indices: Array<{ ts_code:string; pct_chg:number; close:number }>;
  recommendations: Array<{ strategy:string; samples:number; winRate:number; avgReturn:number; label:string; matched:boolean }>;
  provider: { name:string; configured:boolean };
};

const navItems = ['今日总览', '交易复盘', '模式库', '行情环境', '数据导入'];
const emptyMarket = { upCount:0, downCount:0, flatCount:0, limitUp:0, limitDown:0, turnover:0, indexAverage:0 };

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('文件中没有可导入的成交记录');
  const split = (line: string) => line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(v => v.trim().replace(/^\"|\"$/g, ''));
  const headers = split(lines[0]);
  const col = (...names: string[]) => headers.findIndex(h => names.some(n => h.toLowerCase().includes(n.toLowerCase())));
  const idx = {
    date: col('成交日期','日期','trade_date'), time: col('成交时间','委托时间','时间','trade_time'),
    symbol: col('证券名称','股票名称','标的','symbol'), code: col('证券代码','股票代码','code'),
    side: col('买卖标志','操作','方向','side'), price: col('成交价格','成交均价','价格','price'),
    quantity: col('成交数量','数量','quantity'), pnl: col('盈亏','净收益','pnl'),
    returnPct: col('收益率','return_pct'), strategy: col('交易手法','模式','strategy'), marketPhase: col('市场阶段','行情阶段','market_phase'), tags: col('标签','tags'),
  };
  if (idx.symbol < 0 || idx.code < 0) throw new Error('未找到“证券名称”和“证券代码”列');
  return lines.slice(1).map((line) => {
    const row = split(line); const date = idx.date >= 0 ? row[idx.date] : new Date().toISOString().slice(0,10);
    return { tradeDate: date.replaceAll('/','-'), tradeTime: idx.time >= 0 ? row[idx.time].slice(0,5) : '09:30', symbol: row[idx.symbol], code: row[idx.code], side: idx.side >= 0 ? row[idx.side] : '买入', price: Number(row[idx.price] || 0), quantity: Number(row[idx.quantity] || 0), pnl: Number(row[idx.pnl] || 0), returnPct: Number(String(row[idx.returnPct] || 0).replace('%','')), strategy: idx.strategy >= 0 ? row[idx.strategy] : '待标注', marketPhase: idx.marketPhase >= 0 ? row[idx.marketPhase] : '未标注', tags: idx.tags >= 0 ? row[idx.tags].split(/[|、;]/).filter(Boolean) : [] };
  }).filter(row => row.symbol && row.code);
}

export default function Home() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [active, setActive] = useState('今日总览');
  const [importRows, setImportRows] = useState<Record<string, unknown>[]>([]);
  const [modal, setModal] = useState<'import'|'review'|null>(null);
  const [selected, setSelected] = useState<Trade|null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [marketData, setMarketData] = useState<MarketData|null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [marketDate, setMarketDate] = useState('');

  const loadTrades = async () => {
    const response = await fetch('/api/trades');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '成交数据加载失败');
    setTrades(data.trades || []);
  };
  const loadMarket = async () => {
    const response=await fetch('/api/market'); const data=await response.json();
    if(!response.ok)throw new Error(data.error||'行情环境加载失败'); setMarketData(data); setMarketDate(data.date);
  };
  useEffect(() => { loadTrades().catch(e => setMessage(e.message)); loadMarket().catch(e=>setMessage(e.message)); }, []);

  const refreshMarket = async () => {
    setRefreshing(true); try { const response=await fetch('/api/market/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:marketDate||undefined})}); const data=await response.json(); if(!response.ok)throw new Error(data.error); await loadMarket(); setMessage(`已更新 ${data.date} 行情快照`); } catch(e){setMessage(e instanceof Error?e.message:'行情刷新失败')} finally{setRefreshing(false)}
  };

  const stats = useMemo(() => {
    const settled=trades.filter(t=>t.pnl!==0); const pnl = settled.reduce((sum,t)=>sum+Number(t.pnl),0); const wins = settled.filter(t=>t.pnl>0).length;
    const grossWin = trades.filter(t=>t.pnl>0).reduce((s,t)=>s+t.pnl,0); const grossLoss = Math.abs(trades.filter(t=>t.pnl<0).reduce((s,t)=>s+t.pnl,0));
    return { pnl, settled:settled.length, winRate: settled.length ? wins/settled.length*100 : 0, wins, losses:settled.filter(t=>t.pnl<0).length, planned:trades.filter(t=>t.planned===1).length, unknown:trades.filter(t=>t.planned===2).length, ratio: grossLoss ? grossWin/grossLoss : grossWin ? 99 : 0 };
  },[trades]);

  const modes = useMemo(() => {
    const grouped = new Map<string, Trade[]>(); trades.filter(t=>t.pnl!==0&&t.strategy!=='待标注').forEach(t => grouped.set(t.strategy,[...(grouped.get(t.strategy)||[]),t]));
    return [...grouped.entries()].map(([name,rows])=>({ name, rows:rows.length, rate:Math.round(rows.filter(r=>r.pnl>0).length/rows.length*100), avg:rows.reduce((s,r)=>s+r.return_pct,0)/rows.length })).sort((a,b)=>b.avg-a.avg).slice(0,4);
  },[trades]);

  const pickCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try { setImportRows(parseCsv(await file.text())); setMessage(''); } catch (e) { setMessage(e instanceof Error ? e.message : 'CSV 解析失败'); }
  };
  const saveImport = async () => {
    setSaving(true); try { const res = await fetch('/api/trades',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(importRows)}); const data=await res.json(); if(!res.ok)throw new Error(data.error); await loadTrades(); setModal(null); setImportRows([]); setMessage(`已成功导入 ${data.imported} 条成交记录`); } catch(e){setMessage(e instanceof Error?e.message:'导入失败')} finally{setSaving(false)}
  };
  const saveReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if(!selected)return; setSaving(true); const form=new FormData(event.currentTarget);
    try { const plannedValue=form.get('planned'); const res=await fetch(`/api/trades/${selected.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({tradeDate:form.get('tradeDate'),strategy:form.get('strategy'),marketPhase:form.get('marketPhase'),tags:String(form.get('tags')||'').split(/[、,]/).filter(Boolean),planned:plannedValue==='unknown'?null:plannedValue==='true',notes:form.get('notes')})}); if(!res.ok)throw new Error('保存失败'); await loadTrades(); await loadMarket(); setModal(null); setMessage('复盘标注已保存'); } catch(e){setMessage(e instanceof Error?e.message:'保存失败')} finally{setSaving(false)}
  };
  const currentMarket=marketData?.metrics||emptyMarket; const analysis=marketData?.analysis||{phase:'待获取',score:0,confidence:0,summary:'尚未获取真实行情，暂不判断市场阶段。',preferred:[],avoid:[],reasons:[]};
  const breadth=Math.round(currentMarket.upCount/Math.max(1,currentMarket.upCount+currentMarket.downCount+currentMarket.flatCount)*100);

  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><span>R</span><div><strong>复盘台</strong><small>TRADE REVIEW</small></div></div><p className="nav-label">工作台</p><nav>{navItems.map((item,i)=><button className={active===item?'active':''} onClick={()=>{setActive(item);if(item==='数据导入')setModal('import')}} key={item}><i>{['⌂','↗','◇','◎','▣'][i]}</i>{item}{item==='交易复盘'&&<b>{trades.filter(t=>!t.notes).length}</b>}</button>)}</nav><div className="review-progress"><p>本月复盘完成度</p><strong>18 / 22 天</strong><div><i /></div><small>连续复盘 6 天</small></div></aside>
    <section className="workspace">
      <header className="topbar"><div><p>{new Intl.DateTimeFormat('zh-CN',{dateStyle:'full'}).format(new Date())}</p><h1>{active==='今日总览'?'今日交易作战室':active}</h1></div><div className="actions"><button onClick={()=>setModal('import')}>导入成交</button><button onClick={()=>{setSelected(trades[0]||null);setModal('review')}}>＋ 记录复盘</button><span>JL</span></div></header>
      {message&&<button className="toast" onClick={()=>setMessage('')}>{message} ×</button>}
      <section className="market-banner"><div className="market-orb"><small>市场阶段</small><strong>{analysis.phase}</strong></div><div className="market-copy"><p><i/> {marketData?.source==='eastmoney'?'东财真实行情':'真实行情待获取'}{analysis.confidence?` · 置信度 ${analysis.confidence}%`:''}</p><h2>{analysis.summary}</h2><small>{analysis.reasons?.join('；') || '获取成功前不会生成市场阶段和交易建议。'}</small></div><div className="market-stats"><div><small>涨停 / 跌停</small><strong><em>{currentMarket.limitUp||'—'}</em> / {currentMarket.limitDown||'—'}</strong></div><div><small>两市成交额</small><strong>{currentMarket.turnover?`${currentMarket.turnover.toLocaleString()}亿`:'—'}</strong><em>{currentMarket.indexAverage?`${currentMarket.indexAverage>=0?'+':''}${currentMarket.indexAverage.toFixed(2)}%`:'—'}</em></div><div><small>赚钱效应</small><strong>{marketData?.source==='eastmoney'?`${breadth} / 100`:'—'}</strong></div></div></section>
      <section className="metric-grid">{[['已实现净收益',stats.settled?`${stats.pnl>=0?'+ ':''}¥${stats.pnl.toLocaleString()}`:'待结算',stats.settled?'基于已完成买卖配对':'当前只有买入成交','↗'],['已结算胜率',stats.settled?`${stats.winRate.toFixed(1)}%`:'暂无',stats.settled?`${stats.wins} 盈 / ${stats.losses} 亏 · 盈亏比 ${stats.ratio.toFixed(1)}`:'卖出成交导入后计算','◎'],['计划状态',`${stats.planned} 已确认`,`${stats.unknown} 笔待确认`,'✓'],['成交记录',String(trades.length),'来自你上传的成交截图','▥']].map((x,i)=><article key={x[0]}><small>{x[0]}</small><strong className={i===0&&stats.settled?(stats.pnl>=0?'rise':'fall'):''}>{x[1]}</strong><span>{x[3]}</span><p>{x[2]}</p></article>)}</section>
      {active==='行情环境'&&<section className="environment-grid">
        <article className="panel environment-main"><div className="environment-toolbar"><div><p className="eyebrow">DAILY REGIME ENGINE</p><h3>每日市场环境分析</h3></div><div className="source-control"><span className="connected">东财行情已连接</span><input aria-label="行情日期" title="东财快照接口读取当前交易日" type="date" value={marketDate} disabled/><button onClick={refreshMarket} disabled={refreshing}>{refreshing?'分析中…':'刷新东财行情'}</button></div></div>
          <div className="score-card"><div className="score-ring" style={{'--score':`${analysis.score*3.6}deg`} as React.CSSProperties}><span><strong>{analysis.score}</strong><small>环境得分</small></span></div><div><label>当前阶段</label><h2>{analysis.phase}</h2><p>{analysis.summary}</p><small>分析日期 {marketData?.date||marketDate} · 数据源 {marketData?.source==='eastmoney'?'东方财富':'演示快照'}</small></div></div>
          <div className="factor-grid">{[['上涨 / 下跌',`${currentMarket.upCount} / ${currentMarket.downCount}`,breadth],['涨停 / 跌停',`${currentMarket.limitUp} / ${currentMarket.limitDown}`,Math.min(100,50+(currentMarket.limitUp-currentMarket.limitDown))],['指数强度',`${currentMarket.indexAverage>=0?'+':''}${currentMarket.indexAverage.toFixed(2)}%`,Math.min(100,50+currentMarket.indexAverage*12)]].map(x=><div key={x[0]}><small>{x[0]}</small><strong>{x[1]}</strong><span><i style={{width:`${x[2]}%`}}/></span></div>)}</div>
        </article>
        <article className="panel playbook-card"><div className="panel-head"><div><p>ENVIRONMENT PLAYBOOK</p><h3>环境应对手册</h3></div></div><div className="playbook good"><label>适合关注</label>{analysis.preferred.map((item,i)=><p key={item}><b>{i+1}</b>{item}</p>)}</div><div className="playbook bad"><label>建议规避</label>{analysis.avoid.map((item,i)=><p key={item}><b>{i+1}</b>{item}</p>)}</div></article>
        <article className="panel sector-board"><div className="panel-head"><div><p>SECTOR STRENGTH</p><h3>领涨板块与核心标的</h3></div><label>{marketData?.sectors.length||0} 个板块</label></div><div className="sector-table"><div><span>排名</span><span>板块</span><span>领涨标的</span><span>成分数</span><span>涨跌幅</span></div>{(marketData?.sectors||[]).slice(0,8).map((sector,i)=><div key={sector.name}><b>0{i+1}</b><strong>{sector.name}</strong><span>{sector.lead_stock||'—'}</span><span>{sector.company_num||'—'}</span><em className={sector.pct_change>=0?'rise':'fall'}>{sector.pct_change>=0?'+':''}{Number(sector.pct_change).toFixed(2)}%</em></div>)}</div></article>
        <article className="panel personal-fit"><div className="panel-head"><div><p>PERSONAL EDGE</p><h3>你的手法 × 当前环境</h3></div><label>{marketData?.recommendations.some(r=>r.matched)?'同环境样本':'全量样本参考'}</label></div>{marketData?.recommendations.length?marketData.recommendations.map(r=><div className="fit-row" key={r.strategy}><div><strong>{r.strategy}</strong><small>{r.samples} 笔样本 · 胜率 {r.winRate}%</small></div><em className={r.avgReturn>=0?'rise':'fall'}>{r.avgReturn>=0?'+':''}{r.avgReturn.toFixed(2)}%</em><label className={r.label==='适用'?'优先':r.label==='规避'?'规避':'观察'}>{r.label}</label></div>):<p className="empty">给历史成交标注“市场阶段”后，这里会计算相同环境下的真实胜率。</p>}</article>
      </section>}
      {active!=='行情环境'&&
      <section className="content-grid"><article className="panel patterns"><div className="panel-head"><div><p>基于已导入的历史样本</p><h3>交易手法表现</h3></div><button onClick={()=>setActive('模式库')}>查看模式库 →</button></div>{modes.length?modes.map((m,i)=><div className="mode-row" key={m.name}><b>0{i+1}</b><div><strong>{m.name}</strong><small>{m.rows} 个历史样本</small></div><span className="rate"><i style={{width:`${m.rate}%`}}/></span><em>{m.rate}%</em><strong className={m.avg>=0?'rise':'fall'}>{m.avg>=0?'+':''}{m.avg.toFixed(1)}%</strong><label className={m.rate>=60?'优先':m.rate<40?'规避':'观察'}>{m.rate>=60?'优先':m.rate<40?'规避':'观察'}</label></div>):<p className="empty">导入成交并标注手法后，这里会自动形成模式统计。</p>}</article>
      <aside className="panel focus"><div className="panel-head"><div><p>MARKET FOCUS</p><h3>今日主线板块</h3></div><label>真实行情</label></div>{marketData?.sectors.length?marketData.sectors.slice(0,3).map((x,i)=><div className="sector" key={x.name}><b>0{i+1}</b><div><strong>{x.name}</strong><small>{x.lead_stock?`领涨：${x.lead_stock}`:'待识别领涨标的'}</small></div><em>{x.pct_change>=0?'+':''}{Number(x.pct_change).toFixed(2)}%</em></div>):<p className="empty">获取真实行情后显示板块排行。</p>}</aside>
      <article className="panel trades"><div className="panel-head"><div><p>EXECUTION REVIEW</p><h3>成交与执行</h3></div><button onClick={()=>{setSelected(trades[0]||null);setModal('review')}}>开始标注 →</button></div><div className="trade-head"><span>时间 / 标的</span><span>交易模式</span><span>执行标签</span><span>净收益</span></div>{trades.slice(0,8).map(t=><button className="trade-row" onClick={()=>{setSelected(t);setModal('review')}} key={t.id}><span><small>{t.trade_time}</small><strong>{t.symbol}</strong><em>{t.code}</em></span><span>{t.strategy}</span><span><label className={t.planned===1?'planned':t.planned===0?'impulsive':'pending-tag'}>{t.planned===1?'计划内':t.planned===0?'计划外':'待确认'}</label></span><b className={t.pnl>0?'rise':t.pnl<0?'fall':'pending-result'}>{t.pnl===0?'待结算':`${t.pnl>0?'+':''}${t.pnl.toLocaleString()}`}</b></button>)}</article></section>}
    </section>

    {modal==='import'&&<div className="modal-backdrop" onMouseDown={()=>setModal(null)}><section className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setModal(null)}>×</button><p className="eyebrow">DATA IMPORT</p><h2>导入成交数据</h2><p className="modal-desc">支持券商导出的 CSV。至少需包含证券名称和证券代码；系统会自动匹配日期、时间、方向、价格、数量、盈亏和标签。</p><label className="dropzone"><strong>选择 CSV 文件</strong><small>UTF-8 / 每次最多 500 条记录</small><input type="file" accept=".csv,text/csv" onChange={pickCsv}/></label>{importRows.length>0&&<div className="import-preview"><strong>识别到 {importRows.length} 条成交</strong><div>{importRows.slice(0,3).map((r,i)=><p key={i}>{String(r.tradeTime)}　{String(r.symbol)}　{String(r.code)}　{String(r.side)}</p>)}</div>{importRows.length>3&&<small>还有 {importRows.length-3} 条…</small>}</div>}<footer><button onClick={()=>setModal(null)}>取消</button><button disabled={!importRows.length||saving} onClick={saveImport}>{saving?'正在导入…':`确认导入 ${importRows.length||''} 条`}</button></footer></section></div>}
    {modal==='review'&&<div className="modal-backdrop" onMouseDown={()=>setModal(null)}><section className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setModal(null)}>×</button><p className="eyebrow">TRADE REVIEW</p><h2>复盘标注</h2>{selected?<form onSubmit={saveReview}><div className="trade-summary"><strong>{selected.symbol}</strong><span>{selected.code} · {selected.trade_time} · {selected.side} {selected.quantity}股</span></div><label>成交日期（截图未显示，请确认）<input type="date" name="tradeDate" defaultValue={selected.trade_date}/></label><label>交易手法<input name="strategy" defaultValue={selected.strategy} placeholder="如：弱转强、分歧转一致"/></label><label>当时的市场阶段<select name="marketPhase" defaultValue={selected.market_phase||'未标注'}>{['冰点','修复','启动','发酵','高潮','分歧','退潮','混沌轮动','未标注'].map(phase=><option key={phase}>{phase}</option>)}</select></label><label>标签<input name="tags" defaultValue={JSON.parse(selected.tags||'[]').join('、')} placeholder="用顿号或逗号分隔"/></label><label>是否计划内<select name="planned" defaultValue={selected.planned===1?'true':selected.planned===0?'false':'unknown'}><option value="unknown">待确认</option><option value="true">计划内</option><option value="false">计划外 / 冲动交易</option></select></label><label>复盘结论<textarea name="notes" defaultValue={selected.notes} placeholder="买入逻辑、执行偏差、下次如何处理…" rows={4}/></label><footer><button type="button" onClick={()=>setModal(null)}>取消</button><button disabled={saving} type="submit">{saving?'保存中…':'保存标注'}</button></footer></form>:<p className="empty">还没有可复盘的成交记录，请先导入数据。</p>}</section></div>}
  </main>;
}
