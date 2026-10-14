/* eslint-disable no-console */
import { store, MONTHS, CURRENT_MONTH, DAYS_ELAPSED, DAYS_IN_MONTH, roiAt } from '../src/domain/store';
import { GAME_MAP } from '../src/domain/dimensions';

const f = store.defaultFilter({ startMonth: '2025-01', endMonth: CURRENT_MONTH });

const yuan = (n: number) => `${(n / 1e4).toFixed(0)}万`;

console.log(`月份范围 ${MONTHS[0]} ~ ${MONTHS[MONTHS.length - 1]}，当月 ${CURRENT_MONTH}（已过 ${DAYS_ELAPSED}/${DAYS_IN_MONTH} 天）`);

console.log('\n=== 公司合计（2025-01 ~ 当月）===');
const c = store.metricsOf(f, 'company', 'company');
if (c) {
    console.log(`应计收入 ${yuan(c.accrualRevenue)}  到账收入 ${yuan(c.cashRevenue)}`);
    console.log(`投放消耗 ${yuan(c.spend)}  充值支出 ${yuan(c.prepay)}`);
    console.log(`人工 ${yuan(c.laborCost)}  管理 ${yuan(c.adminCost)}  人数 ${c.headcount.toFixed(0)}`);
    console.log(`账面利润 ${yuan(c.bookProfit)} (${(c.bookMargin * 100).toFixed(1)}%)`);
    console.log(`经营利润 ${yuan(c.operatingProfit)} (${(c.operatingMargin * 100).toFixed(1)}%)`);
    console.log(`口径差额 ${yuan(c.profitGap)}  现金缺口 ${yuan(c.cashGap)}  预付余额 ${yuan(c.prepayBalance)}  应收未收 ${yuan(c.receivable)}`);
    console.log(`预估ROI ${c.forecastRoi.toFixed(3)}  实际ROI ${c.actualRoi.toFixed(3)}  回收完成度 ${(c.recoveryRate * 100).toFixed(1)}%  人效比 ${c.efficiencyRatio.toFixed(2)}`);
}

console.log('\n=== 分中心 ===');
for (const r of store.queryRows(f, 'center')) {
    console.log(`${r.name.padEnd(6)} 消耗 ${yuan(r.spend).padStart(8)} 收入 ${yuan(r.accrualRevenue).padStart(8)} 经营利润 ${yuan(r.operatingProfit).padStart(9)} 人数 ${r.headcount.toFixed(0).padStart(3)} 人效 ${r.efficiencyRatio.toFixed(2)}`);
}

console.log('\n=== 分平台 ===');
for (const r of store.queryRows(f, 'platform')) {
    console.log(`${r.name.padEnd(6)} 消耗 ${yuan(r.spend).padStart(8)} 经营利润 ${yuan(r.operatingProfit).padStart(9)} ROI ${r.forecastRoi.toFixed(3)} 利润率 ${(r.operatingMargin * 100).toFixed(1)}%`);
}

console.log('\n=== 分游戏（Top/Bottom）===');
const games = store.queryRows(f, 'game').sort((a, b) => b.operatingProfit - a.operatingProfit);
for (const r of [...games.slice(0, 5), ...games.slice(-5)]) {
    const g = GAME_MAP.get(r.key);
    console.log(`${r.name.padEnd(7)} 消耗 ${yuan(r.spend).padStart(8)} 经营利润 ${yuan(r.operatingProfit).padStart(9)} 预估ROI ${r.forecastRoi.toFixed(2)} 红线 ${g?.redLineRoi} 回收 ${(r.recoveryRate * 100).toFixed(0)}%`);
}

console.log('\n=== 月度序列（近 12 个月）===');
for (const p of store.queryMonthSeries(store.defaultFilter({ startMonth: '2025-07' }))) {
    console.log(`${p.label.padStart(5)} 应计收入 ${yuan(p.metrics.accrualRevenue).padStart(8)} 到账 ${yuan(p.metrics.cashRevenue).padStart(8)} 账面利润 ${yuan(p.metrics.bookProfit).padStart(9)} 经营利润 ${yuan(p.metrics.operatingProfit).padStart(9)}`);
}

console.log('\n=== 月度预估 ===');
for (const p of store.forecast(store.defaultFilter({ startMonth: '2025-07' }), 6)) {
    console.log(`${p.label.padStart(5)} ${p.actual ? '实际' : '预估'} 收入 ${yuan(p.revenue).padStart(8)} 成本 ${yuan(p.cost).padStart(8)} 利润 ${yuan(p.profit).padStart(9)} 乐观 ${yuan(p.optimistic).padStart(9)} 悲观 ${yuan(p.pessimistic).padStart(9)} 置信 ${p.confidence.toFixed(2)}`);
}

console.log('\n=== 预警 ===');
for (const a of store.alerts(f).slice(0, 8)) {
    console.log(`[${a.level}] ${a.type} | ${a.title}`);
}

console.log('\n=== Cohort（近 3 期）===');
const co = store.cohorts(f, 3);
for (const p of co.filter((x) => [90, 180, 360].includes(x.day))) {
    console.log(`${p.cohortMonth} D${p.day} ROI ${p.roi.toFixed(3)} 消耗 ${yuan(p.spend)} ${p.projected ? '(预估)' : '(实际)'}`);
}

console.log('\n=== 曲线校验（g1 vs 现有系统 d1≈20%/d90≈105%）===');
const g1 = GAME_MAP.get('g1');
if (g1) {
    for (const d of [1, 3, 7, 30, 90, 180, 360]) {
        console.log(`D${d}: ${(roiAt(d, g1.curveA, g1.curveB) * 100).toFixed(1)}%`);
    }
}

console.log('\n=== 交叉下钻：投放一组 × 腾讯广告 ===');
const grp = store.queryRows(f, 'group').find((r) => r.name === '投放一组');
console.log('投放一组 经营利润', grp ? yuan(grp.operatingProfit) : 'n/a');
const f2 = store.defaultFilter({ groupIds: grp ? [grp.key] : [], platformIds: ['pf1'] });
console.log('该组合 经营利润', yuan(store.metricsOf(f2, 'company', 'company')?.operatingProfit ?? 0));
