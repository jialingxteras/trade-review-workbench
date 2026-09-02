export type MarketMetrics = {
  upCount: number; downCount: number; flatCount: number; limitUp: number; limitDown: number;
  turnover: number; indexAverage: number;
};

export type PhaseResult = {
  phase: '冰点'|'修复'|'启动'|'发酵'|'高潮'|'分歧'|'退潮'|'混沌轮动';
  score: number; confidence: number; summary: string; preferred: string[]; avoid: string[]; reasons: string[];
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function analyzeMarket(metrics: MarketMetrics): PhaseResult {
  const total = Math.max(1, metrics.upCount + metrics.downCount + metrics.flatCount);
  const breadth = metrics.upCount / total * 100;
  const limitScore = clamp(50 + (metrics.limitUp - metrics.limitDown) * 1.25);
  const indexScore = clamp(50 + metrics.indexAverage * 12);
  const score = Math.round(breadth * .48 + limitScore * .34 + indexScore * .18);
  const imbalance = metrics.limitDown > metrics.limitUp * .5;
  const overheated = metrics.limitUp >= 90 && breadth >= 72;
  let phase: PhaseResult['phase'];
  if (score < 30) phase = '冰点';
  else if (score < 43) phase = metrics.indexAverage > 0 ? '修复' : '退潮';
  else if (score < 56) phase = imbalance ? '退潮' : '混沌轮动';
  else if (score < 67) phase = metrics.indexAverage >= 0 ? '启动' : '分歧';
  else if (score < 78) phase = '发酵';
  else phase = overheated ? '高潮' : '发酵';

  const playbook: Record<PhaseResult['phase'], [string[], string[]]> = {
    冰点: [['核心股试错低吸','首个主动修复'],['高位接力','跟风打板','重仓博弈']],
    修复: [['核心弱转强','分歧转一致','低吸辨识度'],['无辨识度跟风','缩量加速追高']],
    启动: [['新题材首板','板块共振突破','核心半路'],['旧周期补涨','尾盘无逻辑抢筹']],
    发酵: [['主线核心接力','分歧转一致','趋势回踩'],['后排跟风','一致性过强的缩量板']],
    高潮: [['持有核心','前排换手','等待分歧'],['追后排','临盘扩大仓位','高位缩量加速']],
    分歧: [['核心低吸','强承接回封','去弱留强'],['中位股接力','弱承接抄底','非主线交易']],
    退潮: [['空仓等待','超跌核心小仓试错'],['高位接力','弱转强追涨','模式外交易']],
    混沌轮动: [['低吸轮动核心','日内兑现','控制仓位'],['格局跟风','连续追涨','单一方向重仓']],
  };
  const reasons = [
    `上涨家数占比 ${breadth.toFixed(1)}%`,
    `涨停 ${metrics.limitUp} 家、跌停 ${metrics.limitDown} 家`,
    `核心指数平均涨幅 ${metrics.indexAverage >= 0 ? '+' : ''}${metrics.indexAverage.toFixed(2)}%`,
  ];
  const confidence = Math.round(clamp(65 + Math.abs(score - 50) * .45 + (total > 3000 ? 8 : 0)));
  return { phase, score, confidence, summary: buildSummary(phase), preferred: playbook[phase][0], avoid: playbook[phase][1], reasons };
}

function buildSummary(phase: PhaseResult['phase']) {
  const summaries: Record<PhaseResult['phase'], string> = {
    冰点:'亏钱效应充分释放，先观察主动修复信号。', 修复:'情绪从低位回暖，机会优先集中在高辨识度核心。',
    启动:'新方向开始形成共振，重点确认题材持续性。', 发酵:'赚钱效应扩散，主线核心仍是优先方向。',
    高潮:'一致性较强，持筹优于追高并为次日分歧做准备。', 分歧:'强弱开始分化，只处理有承接的核心标的。',
    退潮:'高位负反馈扩散，防守和回避错误交易优先。', 混沌轮动:'方向切换较快，适合低吸与快速兑现。',
  };
  return summaries[phase];
}
