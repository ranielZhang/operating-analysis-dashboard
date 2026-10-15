// ============================================================
// 经营分析看板 · 数据引擎（唯一数据真源）
//
// 职责
//   1) 生成日粒度投放事实（消耗 / 应计收入 / 到账收入 / 充值）
//   2) 生成月度管理成本（人工成本 + 管理费用）
//   3) 组织轴 / 业务轴 双向聚合，两轴的公司合计口径一致
//   4) 月度滚动预估 / Cohort 回收 / 预警
//
// 口径（与 docs/01-需求梳理与模块规划.md 一致）
//   账面利润 = 已到账收入 − 充值支出 − 人工成本 − 管理费用      （银行流水口径）
//   经营利润 = 应计确认收入 − 投放消耗 − 人工成本 − 管理费用    （权责发生制 + 预估回收）
//   回收曲线 ROI(n) = curveA · ln(n) + curveB
//   ROI 沿用现有系统口径 = 累计收入 / 累计消耗（含本金，1.0 = 持平）
// ============================================================

import {
    ALL_PEOPLE,
    CAMPAIGNS,
    CAMPAIGN_MAP,
    CENTER_SALARY,
    DATA_START,
    GAMES,
    GAME_MAP,
    MAX_MONTH,
    MIN_MONTH,
    OFFICE_COST_PER_HEAD,
    ORG_MAP,
    ORG_NODES,
    PLATFORMS,
    PLATFORM_MAP,
    PROJECTS,
    SOCIAL_INSURANCE_RATE,
    TAX_RATE,
    TODAY,
    WELFARE_RATE,
    AVAILABLE_CASH,
    BUSINESS_DEALS,
    descendantsOf,
    mulberry32,
} from './dimensions';
import { applyBusiness, emptyBusiness, wantsSelf, zeroMoney, BUSINESS_TYPE_LABEL, type BizNode, type SelfGameStat } from './businessLayer';
import type { BusinessType } from './types';
import type {
    AlertItem,
    AnalysisFilter,
    CohortPoint,
    CostBreakdown,
    DimKey,
    ForecastPoint,
    MetricRow,
    Metrics,
    MonthlyPoint,
    RevenueBreakdown,
} from './types';

// ============================================================
// 0. 时间轴
// ============================================================
function monthIndexOf(month: string): number {
    const [y, m] = month.split('-').map(Number);
    return (y - 2024) * 12 + (m - 1);
}
function monthFromIndex(i: number): string {
    return `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}
const BASE_MONTH_IDX = monthIndexOf(MIN_MONTH);
export const MONTHS: string[] = Array.from(
    { length: monthIndexOf(MAX_MONTH) - BASE_MONTH_IDX + 1 },
    (_, i) => monthFromIndex(BASE_MONTH_IDX + i),
);
export const MONTH_COUNT = MONTHS.length;

const DAYS: string[] = (() => {
    const out: string[] = [];
    const d = new Date(`${DATA_START}T00:00:00Z`);
    const end = new Date(`${TODAY}T00:00:00Z`);
    while (d <= end) {
        out.push(d.toISOString().slice(0, 10));
        d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
})();
export const DAY_COUNT = DAYS.length;
const DAY_MONTH_IDX = new Int16Array(DAY_COUNT);
for (let i = 0; i < DAY_COUNT; i++) {
    const m = DAYS[i].slice(0, 7);
    DAY_MONTH_IDX[i] = m < MIN_MONTH ? -1 : monthIndexOf(m) - BASE_MONTH_IDX;
}
export function dayIndexOf(iso: string): number {
    return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${DATA_START}T00:00:00Z`)) / 86400000);
}

export const CURRENT_MONTH_IDX = monthIndexOf(TODAY.slice(0, 7)) - BASE_MONTH_IDX;
export const CURRENT_MONTH = MONTHS[CURRENT_MONTH_IDX];
/** 当月已过天数 / 当月天数（当月实时预估用） */
export const DAYS_ELAPSED = Number(TODAY.slice(8, 10));
export const DAYS_IN_MONTH = new Date(
    Date.UTC(Number(TODAY.slice(0, 4)), Number(TODAY.slice(5, 7)), 0),
).getUTCDate();

// ============================================================
// 1. 回收曲线
// ============================================================
/** 累计回收 ROI(n)（倍，1.0 = 回本） */
export function roiAt(n: number, a: number, b: number): number {
    if (n <= 0) return 0;
    return Math.max(0, a * Math.log(n) + b);
}
/** 幂律备选曲线：ROI(n) = p · n^q */
export function roiAtPower(n: number, p: number, q: number): number {
    if (n <= 0) return 0;
    return Math.max(0, p * Math.pow(n, q));
}
/** 幂律两点拟合（参数配置页做曲线对照） */
export function fitPower(d1: number, v1: number, d2: number, v2: number): { p: number; q: number } {
    const eps = 1e-3;
    const x1 = Math.max(d1, eps);
    const x2 = Math.max(d2, eps);
    const y1 = Math.max(v1, eps);
    const y2 = Math.max(v2, eps);
    const q = (Math.log(y2) - Math.log(y1)) / (Math.log(x2) - Math.log(x1));
    return { p: y1 / Math.pow(x1, q), q };
}

export const RECOVERY_MAX_DAY = 365;
const RATE_CACHE = new Map<string, Float64Array>();
function recoveryRateFor(gameId: string): Float64Array {
    const g = GAME_MAP.get(gameId);
    const key = `${gameId}:${g?.curveA}:${g?.curveB}`;
    let cached = RATE_CACHE.get(key);
    if (!cached) {
        cached = new Float64Array(RECOVERY_MAX_DAY + 1);
        let prev = 0;
        for (let k = 1; k <= RECOVERY_MAX_DAY; k++) {
            const cur = roiAt(k, g?.curveA ?? 0.2, g?.curveB ?? 0.15);
            cached[k] = Math.max(0, cur - prev);
            prev = cur;
        }
        RATE_CACHE.set(key, cached);
    }
    return cached;
}

// ============================================================
// 2. 造数常量
// ============================================================
const PLATFORM_WEIGHT: Record<string, number> = { pf1: 1.35, pf2: 1.15, pf3: 0.75, pf4: 0.5 };
const STAGE_FACTOR: Record<string, number> = { 测试期: 0.28, 成长期: 0.72, 成熟期: 1, 衰退期: 0.55 };
const SEASON = [1.06, 0.82, 0.98, 1.0, 1.02, 1.05, 1.12, 1.14, 1.0, 1.08, 1.16, 1.1];

export function hash01(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) hash = (Math.imul(hash, 31) + input.charCodeAt(i)) >>> 0;
    return (hash % 10000) / 10000;
}

function gameMonthSpend(gameId: string, monthIdx: number): number {
    const g = GAME_MAP.get(gameId);
    if (!g) return 0;
    const onlineIdx = monthIndexOf(g.onlineMonth) - BASE_MONTH_IDX;
    if (monthIdx < onlineIdx) return 0;
    const life = monthIdx - onlineIdx;
    const ramp = Math.min(1, (life + 1) / 3);
    const decay = life > 12 ? Math.pow(0.965, life - 12) : 1;
    const base = (g.keyGame ? 1_650_000 : 560_000) * (STAGE_FACTOR[g.stage] ?? 1);
    const year = 2024 + Math.floor((monthIdx + BASE_MONTH_IDX) / 12);
    const growth = Math.pow(1.18, year - 2024);
    const noise = 0.9 + hash01(`${gameId}:${monthIdx}:spend`) * 0.2;
    return Math.round(base * ramp * decay * SEASON[(monthIdx + BASE_MONTH_IDX) % 12] * growth * noise);
}

// ============================================================
// 3. 日粒度事实
// ============================================================
export interface CampaignSeries {
    campaignId: string;
    gameId: string;
    platformId: string;
    pitcherId: string;
    groupId: string;
    projectId: string;
    spend: Float64Array;
    accrual: Float64Array;
    cash: Float64Array;
    prepay: Float64Array;
    totalSpend: number;
}

const SERIES: CampaignSeries[] = (() => {
    const out: CampaignSeries[] = [];
    const weightOf = (campaignId: string): number => {
        const c = CAMPAIGN_MAP.get(campaignId);
        if (!c) return 0;
        return c.intensity * (0.75 + hash01(`skill:${c.pitcherId}`) * 0.6) * (PLATFORM_WEIGHT[c.platformId] ?? 1);
    };
    const groupWeight = new Map<string, number>();
    const gameWeight = new Map<string, number>();
    for (const c of CAMPAIGNS) {
        const k = `${c.gameId}:${c.platformId}`;
        groupWeight.set(k, (groupWeight.get(k) ?? 0) + weightOf(c.id));
        gameWeight.set(c.gameId, (gameWeight.get(c.gameId) ?? 0) + weightOf(c.id));
    }
    const perGameMonth = new Map<string, number>();
    for (const g of GAMES) {
        for (let mi = 0; mi < MONTH_COUNT; mi++) perGameMonth.set(`${g.id}:${mi}`, gameMonthSpend(g.id, mi));
    }

    for (const c of CAMPAIGNS) {
        const game = GAME_MAP.get(c.gameId);
        if (!game) continue;
        const platform = PLATFORM_MAP.get(c.platformId);
        const startIdx = Math.max(0, dayIndexOf(`${c.startMonth}-01`));
        const endIdx = c.endMonth ? Math.min(dayIndexOf(`${c.endMonth}-28`), DAY_COUNT - 1) : DAY_COUNT - 1;

        const monthSpend = new Float64Array(MONTH_COUNT);
        for (let mi = 0; mi < MONTH_COUNT; mi++) {
            const gTotal = perGameMonth.get(`${c.gameId}:${mi}`) ?? 0;
            if (gTotal <= 0) continue;
            const platShare = (groupWeight.get(`${c.gameId}:${c.platformId}`) ?? 0) / (gameWeight.get(c.gameId) || 1);
            const inPlatShare = weightOf(c.id) / (groupWeight.get(`${c.gameId}:${c.platformId}`) || 1);
            monthSpend[mi] = gTotal * platShare * inPlatShare;
        }

        const spend = new Float64Array(DAY_COUNT);
        for (let d = startIdx; d <= endIdx; d++) {
            const mi = DAY_MONTH_IDX[d];
            if (mi < 0) continue;
            const dow = new Date(`${DAYS[d]}T00:00:00Z`).getUTCDay();
            const noise = 0.86 + hash01(`${c.id}:${d}:d`) * 0.28;
            spend[d] = (monthSpend[mi] / 30) * (dow === 0 || dow === 6 ? 1.14 : 0.97) * noise;
        }

        const f = recoveryRateFor(c.gameId);
        const accrual = new Float64Array(DAY_COUNT);
        for (let d = startIdx; d <= endIdx; d++) {
            const s = spend[d];
            if (s <= 0) continue;
            const limit = Math.min(RECOVERY_MAX_DAY, DAY_COUNT - 1 - d);
            for (let k = 1; k <= limit; k++) accrual[d + k] += s * f[k];
        }

        const lag = platform?.settleLagDays ?? 45;
        const cash = new Float64Array(DAY_COUNT);
        for (let d = lag; d < DAY_COUNT; d++) cash[d] = accrual[d - lag];

        const prepay = new Float64Array(DAY_COUNT);
        for (let d = startIdx; d <= endIdx; d += 7) {
            let week = 0;
            for (let k = d; k < Math.min(d + 7, DAY_COUNT); k++) week += spend[k];
            if (week > 0) prepay[d] = Math.ceil((week * 1.05) / 10000) * 10000;
        }

        let totalSpend = 0;
        for (let d = 0; d < DAY_COUNT; d++) totalSpend += spend[d];

        out.push({
            campaignId: c.id,
            gameId: c.gameId,
            platformId: c.platformId,
            pitcherId: c.pitcherId,
            groupId: c.groupId,
            projectId: c.projectId,
            spend,
            accrual,
            cash,
            prepay,
            totalSpend,
        });
    }
    return out;
})();
const SERIES_BY_ID = new Map(SERIES.map((s) => [s.campaignId, s]));

// ============================================================
// 4. 月度维度预聚合
// ============================================================
export type FlowDim = 'center' | 'department' | 'group' | 'pitcher' | 'platform' | 'project' | 'game';

interface Flow {
    spend: number;
    prepay: number;
    accrual: number;
    cash: number;
    llz: number;
    adGold: number;
    iap: number;
}
export interface DimMonth {
    flow: Flow;
    exp90: number;
    exp180: number;
    exp360: number;
    cumSpend: number;
    cumPrepay: number;
    cumAccrual: number;
    cumExp90: number;
    cumExp180: number;
    cumExp360: number;
}
function emptyFlow(): Flow {
    return { spend: 0, prepay: 0, accrual: 0, cash: 0, llz: 0, adGold: 0, iap: 0 };
}
function emptyDimMonth(): DimMonth {
    return {
        flow: emptyFlow(),
        exp90: 0,
        exp180: 0,
        exp360: 0,
        cumSpend: 0,
        cumPrepay: 0,
        cumAccrual: 0,
        cumExp90: 0,
        cumExp180: 0,
        cumExp360: 0,
    };
}

/** 组合级月度（业务轴精确下钻用） */
const CAMPAIGN_MONTH = new Map<string, DimMonth[]>();
{
    for (const s of SERIES) {
        const game = GAME_MAP.get(s.gameId);
        if (!game) continue;
        const arr = Array.from({ length: MONTH_COUNT }, emptyDimMonth);
        const roi90 = roiAt(90, game.curveA, game.curveB);
        const roi180 = roiAt(180, game.curveA, game.curveB);
        const roi360 = roiAt(360, game.curveA, game.curveB);
        for (let d = 0; d < DAY_COUNT; d++) {
            const mi = DAY_MONTH_IDX[d];
            if (mi < 0) continue;
            const t = arr[mi];
            t.flow.spend += s.spend[d];
            t.flow.prepay += s.prepay[d];
            t.flow.accrual += s.accrual[d];
            t.flow.cash += s.cash[d];
            t.exp90 += s.spend[d] * roi90;
            t.exp180 += s.spend[d] * roi180;
            t.exp360 += s.spend[d] * roi360;
        }
        let cs = 0;
        let cp = 0;
        let ca = 0;
        let ce90 = 0;
        let ce180 = 0;
        let ce360 = 0;
        for (let mi = 0; mi < MONTH_COUNT; mi++) {
            const t = arr[mi];
            t.flow.llz = t.flow.accrual * game.iaaShare * game.liuliangzhuShare;
            t.flow.adGold = t.flow.accrual * game.iaaShare * (1 - game.liuliangzhuShare);
            t.flow.iap = t.flow.accrual * (1 - game.iaaShare);
            cs += t.flow.spend;
            cp += t.flow.prepay;
            ca += t.flow.accrual;
            ce90 += t.exp90;
            ce180 += t.exp180;
            ce360 += t.exp360;
            t.cumSpend = cs;
            t.cumPrepay = cp;
            t.cumAccrual = ca;
            t.cumExp90 = ce90;
            t.cumExp180 = ce180;
            t.cumExp360 = ce360;
        }
        CAMPAIGN_MONTH.set(s.campaignId, arr);
    }
}

// ============================================================
// 5. 管理成本（人工 + 管理费用）
// ============================================================
export interface OrgMonthCost {
    salary: number;
    socialInsurance: number;
    individualTax: number;
    projectBonus: number;
    welfare: number;
    office: number;
    headcount: number;
}
export function zeroCost(): OrgMonthCost {
    return { salary: 0, socialInsurance: 0, individualTax: 0, projectBonus: 0, welfare: 0, office: 0, headcount: 0 };
}
export function addCost(a: OrgMonthCost, b: OrgMonthCost): OrgMonthCost {
    return {
        salary: a.salary + b.salary,
        socialInsurance: a.socialInsurance + b.socialInsurance,
        individualTax: a.individualTax + b.individualTax,
        projectBonus: a.projectBonus + b.projectBonus,
        welfare: a.welfare + b.welfare,
        office: a.office + b.office,
        headcount: a.headcount + b.headcount,
    };
}
export function scaleCost(a: OrgMonthCost, k: number): OrgMonthCost {
    return {
        salary: a.salary * k,
        socialInsurance: a.socialInsurance * k,
        individualTax: a.individualTax * k,
        projectBonus: a.projectBonus * k,
        welfare: a.welfare * k,
        office: a.office * k,
        headcount: a.headcount * k,
    };
}
export function laborOf(c: OrgMonthCost): number {
    return c.salary + c.socialInsurance + c.individualTax + c.projectBonus;
}
export function adminOf(c: OrgMonthCost): number {
    return c.welfare + c.office;
}

/** 组织节点自身成本（不含下级），下标 = 全局月索引 */
const ORG_OWN_COST = new Map<string, OrgMonthCost[]>();
{
    const rand = mulberry32(515151);
    const centerOf = (personId: string): string => {
        const chain: string[] = [];
        let cur = ORG_MAP.get(personId);
        while (cur) {
            chain.unshift(cur.id);
            cur = cur.parentId ? ORG_MAP.get(cur.parentId) : undefined;
        }
        return chain[1] ?? 'c4';
    };
    for (const n of ORG_NODES) ORG_OWN_COST.set(n.id, Array.from({ length: MONTH_COUNT }, zeroCost));

    for (const p of ALL_PEOPLE) {
        const base = CENTER_SALARY[centerOf(p.id)] ?? 15000;
        const levelFactor = 0.72 + rand() * 0.85;
        const joinIdx = monthIndexOf(p.joinMonth) - BASE_MONTH_IDX;
        const arr = ORG_OWN_COST.get(p.id) as OrgMonthCost[];
        for (let mi = Math.max(0, joinIdx); mi < MONTH_COUNT; mi++) {
            const year = 2024 + Math.floor((mi + BASE_MONTH_IDX) / 12);
            const salary = Math.round((base * levelFactor * Math.pow(1.06, year - 2024)) / 100) * 100;
            const monthNum = ((mi + BASE_MONTH_IDX) % 12) + 1;
            const perf = p.isPitcher ? 0.6 + hash01(`perf:${p.id}:${mi}`) * 1.2 : 0.3 + hash01(`perf:${p.id}:${mi}`) * 0.5;
            arr[mi] = {
                salary,
                socialInsurance: Math.round(salary * SOCIAL_INSURANCE_RATE),
                individualTax: Math.round(salary * TAX_RATE),
                projectBonus: monthNum % 3 === 0 ? Math.round(salary * 0.8 * perf) : 0,
                welfare: 0,
                office: 0,
                headcount: 1,
            };
        }
    }

    // 管理费用按中心归集：福利费 = 中心人工成本 × 比例；办公费 = 中心人头 × 单价
    //
    // 然后**按人头下沉到中心下每一个人**。原因：管理费用若只挂在中心节点上，
    // 则「部门 / 小组 / 投手」三层汇总会漏掉管理费，导致 Σ部门 ≠ 公司合计
    // （实测差额精确等于 adminCost）。下沉后各层级汇总都能勾稽到公司合计。
    for (const center of ORG_NODES.filter((n) => n.level === 'center')) {
        const memberIds = descendantsOf(center.id).filter((id) => ORG_MAP.get(id)?.level === 'pitcher');
        const arr = ORG_OWN_COST.get(center.id) as OrgMonthCost[];
        for (let mi = 0; mi < MONTH_COUNT; mi++) {
            let labor = 0;
            let heads = 0;
            for (const id of memberIds) {
                const c = (ORG_OWN_COST.get(id) as OrgMonthCost[])[mi];
                labor += laborOf(c);
                heads += c.headcount;
            }
            if (heads === 0) continue;
            const welfare = Math.round(labor * WELFARE_RATE);
            const office = Math.round(heads * OFFICE_COST_PER_HEAD);
            const perWelfare = welfare / heads;
            const perOffice = office / heads;
            for (const id of memberIds) {
                const personArr = ORG_OWN_COST.get(id) as OrgMonthCost[];
                const row = personArr[mi];
                personArr[mi] = { ...row, welfare: row.welfare + perWelfare, office: row.office + perOffice };
            }
            // 中心自身不再持有管理费，避免与下属重复计入
            arr[mi] = { ...zeroCost() };
        }
    }
}

const SUBTREE_CACHE = new Map<string, string[]>();
export function subtreeIds(orgId: string): string[] {
    let c = SUBTREE_CACHE.get(orgId);
    if (!c) {
        c = descendantsOf(orgId);
        SUBTREE_CACHE.set(orgId, c);
    }
    return c;
}
const ALL_ORG_IDS = ORG_NODES.map((n) => n.id);
/** 全公司各月成本（缓存，避免重复遍历） */
const COMPANY_COST_BY_MONTH: OrgMonthCost[] = (() => {
    const out: OrgMonthCost[] = [];
    for (let mi = 0; mi < MONTH_COUNT; mi++) {
        let c = zeroCost();
        for (const id of ALL_ORG_IDS) c = addCost(c, (ORG_OWN_COST.get(id) as OrgMonthCost[])[mi]);
        out.push(c);
    }
    return out;
})();

/**
 * 当期（当月未走完）固定成本的摊薄因子。
 *
 * 人工工资与医社保 / 办公费等管理费用是**整月发生**的固定成本，而业务数据（消耗、回收）
 * 只到 `TODAY`。若不做摊薄，任何包含当月的区间都会把整月人工管理费用算进来，
 * 造成「当月已实现经营利润」被整月固定成本压出巨大负数（实测 −122 万），
 * 与当月全月预估（+214 万）自相矛盾。
 *
 * 口径：按当月已过天数比例确认固定成本（period-to-date 惯例），已结束月份恒为 1。
 */
function prorationOf(monthIdx: number): number {
    if (monthIdx < CURRENT_MONTH_IDX) return 1;
    if (monthIdx === CURRENT_MONTH_IDX) return DAYS_ELAPSED / DAYS_IN_MONTH;
    return 0;
}

/** 按未摊薄口径取某组织集合在某月的成本（用于“当月全月预估”这类需要整月成本的场景） */
function rawCostOfIds(ids: string[], monthIdx: number): OrgMonthCost {
    if (monthIdx < 0 || monthIdx >= MONTH_COUNT) return zeroCost();
    if (ids.length === ALL_ORG_IDS.length) return COMPANY_COST_BY_MONTH[monthIdx];
    let out = zeroCost();
    for (const id of ids) {
        const arr = ORG_OWN_COST.get(id);
        if (arr) out = addCost(out, arr[monthIdx]);
    }
    return out;
}

export function orgCostOf(orgId: string, monthIdx: number): OrgMonthCost {
    const ids = subtreeIds(orgId);
    let out = zeroCost();
    for (const id of ids) {
        const arr = ORG_OWN_COST.get(id);
        if (arr && monthIdx >= 0 && monthIdx < MONTH_COUNT) out = addCost(out, arr[monthIdx]);
    }
    // 人数保持时点口径，金额按当月进度摊薄
    const k = prorationOf(monthIdx);
    return k === 1 ? out : { ...scaleCost(out, k), headcount: out.headcount };
}

/** 指定组织集合在某月的成本合计（只算这些节点自身；含当月摊薄） */
function costOfIds(ids: string[], monthIdx: number): OrgMonthCost {
    const raw = rawCostOfIds(ids, monthIdx);
    const k = prorationOf(monthIdx);
    return k === 1 ? raw : { ...scaleCost(raw, k), headcount: raw.headcount };
}

// ============================================================
// 6. 过滤范围
// ============================================================
export interface Scope {
    monthIdx: number[];
    monthKeys: string[];
    campaignIds: string[];
    orgScopeIds: string[];
    pitcherIds: Set<string>;
    hasOrgFilter: boolean;
    /** 预估窗口（天），决定折算哪条预估曲线 */
    window: 90 | 180 | 360;
}

export function resolveScope(filter: AnalysisFilter): Scope {
    const startIdx = Math.max(0, monthIndexOf(filter.startMonth) - BASE_MONTH_IDX);
    const endIdx = Math.min(MONTH_COUNT - 1, monthIndexOf(filter.endMonth) - BASE_MONTH_IDX);
    const monthIdx: number[] = [];
    for (let i = startIdx; i <= endIdx; i++) monthIdx.push(i);

    const roots = [...filter.centerIds, ...filter.departmentIds, ...filter.groupIds, ...filter.pitcherIds].filter((id) =>
        ORG_MAP.has(id),
    );
    const hasOrgFilter = roots.length > 0;
    const orgScopeSet = new Set<string>();
    if (hasOrgFilter) {
        for (const r of roots) for (const id of subtreeIds(r)) orgScopeSet.add(id);
    } else {
        for (const id of ALL_ORG_IDS) orgScopeSet.add(id);
    }
    const orgScopeIds = [...orgScopeSet];
    const pitcherIds = new Set(orgScopeIds.filter((id) => ORG_MAP.get(id)?.isPitcher));

    const platformSet = new Set(filter.platformIds);
    const projectSet = new Set(filter.projectIds);
    const gameSet = new Set(filter.gameIds);
    const campaignIds = CAMPAIGNS.filter((c) => {
        if (hasOrgFilter && !pitcherIds.has(c.pitcherId)) return false;
        if (platformSet.size && !platformSet.has(c.platformId)) return false;
        if (projectSet.size && !projectSet.has(c.projectId)) return false;
        if (gameSet.size && !gameSet.has(c.gameId)) return false;
        return true;
    }).map((c) => c.id);

    return {
        monthIdx,
        monthKeys: monthIdx.map((i) => MONTHS[i]),
        campaignIds,
        orgScopeIds,
        pitcherIds,
        hasOrgFilter,
        window: filter.roiWindow,
    };
}

// ============================================================
// 7. 流量聚合与指标构造
// ============================================================
interface FlowAgg {
    flow: Flow;
    /** 选中区间消耗对应的预估总回收 */
    exp: number;
    cumSpend: number;
    cumPrepay: number;
    cumAccrual: number;
    /** 自数据起点累计消耗对应的预估总回收（存量口径，用于应收未收 / 回收完成度） */
    cumExp: number;
}
function emptyFlowAgg(): FlowAgg {
    return { flow: emptyFlow(), exp: 0, cumSpend: 0, cumPrepay: 0, cumAccrual: 0, cumExp: 0 };
}

interface MonthRange {
    /** 提取 DimMonth 中的窗口预估 */
    window: 90 | 180 | 360;
    /** 累计取到哪个月 */
    endIdx: number;
}
function expOf(t: DimMonth, w: 90 | 180 | 360): number {
    return w === 90 ? t.exp90 : w === 180 ? t.exp180 : t.exp360;
}
function accFlowAgg(out: FlowAgg, t: DimMonth, r: MonthRange): void {
    out.flow.spend += t.flow.spend;
    out.flow.prepay += t.flow.prepay;
    out.flow.accrual += t.flow.accrual;
    out.flow.cash += t.flow.cash;
    out.flow.llz += t.flow.llz;
    out.flow.adGold += t.flow.adGold;
    out.flow.iap += t.flow.iap;
    out.exp += expOf(t, r.window);
}
function finishAgg(out: FlowAgg, arr: DimMonth[], r: MonthRange): FlowAgg {
    if (r.endIdx >= 0 && r.endIdx < MONTH_COUNT) {
        const t = arr[r.endIdx];
        out.cumSpend += t.cumSpend;
        out.cumPrepay += t.cumPrepay;
        out.cumAccrual += t.cumAccrual;
        out.cumExp += r.window === 90 ? t.cumExp90 : r.window === 180 ? t.cumExp180 : t.cumExp360;
    }
    return out;
}


function sumCampaigns(campaignIds: string[], scope: Scope): FlowAgg {
    const out = emptyFlowAgg();
    const endIdx = scope.monthIdx.length ? scope.monthIdx[scope.monthIdx.length - 1] : -1;
    const r: MonthRange = { window: scope.window, endIdx };
    for (const cid of campaignIds) {
        const arr = CAMPAIGN_MONTH.get(cid);
        if (!arr) continue;
        for (const mi of scope.monthIdx) accFlowAgg(out, arr[mi], r);
        finishAgg(out, arr, r);
    }
    return out;
}

export function buildMetrics(agg: FlowAgg, cost: OrgMonthCost, basis: 'book' | 'operating'): Metrics {
    const labor = laborOf(cost);
    const admin = adminOf(cost);
    const revenue = basis === 'book' ? agg.flow.cash : agg.flow.accrual;
    const businessCost = basis === 'book' ? agg.flow.prepay : agg.flow.spend;

    const bookProfit = agg.flow.cash - agg.flow.prepay - labor - admin;
    const operatingProfit = agg.flow.accrual - agg.flow.spend - labor - admin;
    const profit = basis === 'book' ? bookProfit : operatingProfit;

    const prepayBalance = Math.max(0, agg.cumPrepay - agg.cumSpend);
    const receivable = Math.max(0, agg.cumExp - agg.cumAccrual);

    const revenueByType: RevenueBreakdown = {
        liuliangzhu: agg.flow.llz,
        adGold: agg.flow.adGold,
        iapShare: agg.flow.iap,
    };
    const costByType: CostBreakdown = {
        adSpend: agg.flow.spend,
        prepay: agg.flow.prepay,
        salary: cost.salary,
        socialInsurance: cost.socialInsurance,
        individualTax: cost.individualTax,
        projectBonus: cost.projectBonus,
        welfare: cost.welfare,
        office: cost.office,
    };

    return {
        revenue,
        accrualRevenue: agg.flow.accrual,
        cashRevenue: agg.flow.cash,
        revenueByType,
        businessCost,
        laborCost: labor,
        adminCost: admin,
        totalCost: businessCost + labor + admin,
        costByType,
        profit,
        margin: revenue > 0 ? profit / revenue : 0,
        bookProfit,
        operatingProfit,
        profitGap: operatingProfit - bookProfit,
        bookMargin: agg.flow.cash > 0 ? bookProfit / agg.flow.cash : 0,
        operatingMargin: agg.flow.accrual > 0 ? operatingProfit / agg.flow.accrual : 0,
        spend: agg.flow.spend,
        prepay: agg.flow.prepay,
        prepayBalance,
        receivable,
        cashGap: prepayBalance + receivable,
        // 以下三项统一为「自数据起点累计」口径，与现有系统“累计ROI”一致
        forecastRoi: agg.cumSpend > 0 ? agg.cumExp / agg.cumSpend : 0,
        actualRoi: agg.cumSpend > 0 ? agg.cumAccrual / agg.cumSpend : 0,
        recoveryRate: agg.cumExp > 0 ? agg.cumAccrual / agg.cumExp : 0,
        // 累计分母/分子直接透出：任何维度的聚合都能用 Σ分子 / Σ分母 精确重算累计比率，
        // 而不必从 forecastRoi / recoveryRate 反解（反解只在「区间 = 全历史」时成立）
        cumSpend: agg.cumSpend,
        cumExp: agg.cumExp,
        efficiencyRatio: labor > 0 ? operatingProfit / labor : 0,
        headcount: cost.headcount,
        perCapitaProfit: cost.headcount > 0 ? operatingProfit / cost.headcount : 0,
        ...emptyBusiness(),
    };
}

// ============================================================
// 8. 维度成员与成本口径
// ============================================================
const ORG_LEVEL_OF: Record<string, FlowDim> = {
    center: 'center',
    department: 'department',
    group: 'group',
    pitcher: 'pitcher',
};

function membersOf(
    dim: DimKey,
    parentId: string | null,
): Array<{ key: string; name: string; parentId: string | null; depth: number; hasChildren: boolean }> {
    switch (dim) {
        case 'company':
            return [
                {
                    key: 'company',
                    name: ORG_MAP.get('company')?.name ?? '全公司',
                    parentId: null,
                    depth: 0,
                    hasChildren: true,
                },
            ];
        case 'center':
        case 'department':
        case 'group':
        case 'pitcher': {
            const nodes = ORG_NODES.filter((n) => n.level === dim);
            // 无 parentId = 该层级扁平视图（供「分中心/分部门/分小组/分投手」图表使用）
            const list = parentId ? nodes.filter((n) => n.parentId === parentId) : nodes;
            const depth = { center: 1, department: 2, group: 3, pitcher: 4 }[dim] as number;
            return list.map((n) => ({
                key: n.id,
                name: n.name,
                parentId: n.parentId,
                depth,
                hasChildren: ORG_NODES.some((x) => x.parentId === n.id),
            }));
        }
        case 'platform': {
            if (parentId) return [];
            return PLATFORMS.map((p) => ({ key: p.id, name: p.name, parentId: null, depth: 1, hasChildren: true }));
        }
        case 'project': {
            const list = parentId ? PROJECTS.filter((p) => p.platformIds.includes(parentId)) : PROJECTS;
            return list.map((p) => ({ key: p.id, name: p.name, parentId, depth: 2, hasChildren: true }));
        }
        case 'game': {
            const list = parentId ? GAMES.filter((g) => g.projectId === parentId) : GAMES;
            return list.map((g) => ({ key: g.id, name: g.name, parentId: g.projectId, depth: 3, hasChildren: false }));
        }
        default:
            return [];
    }
}

function campaignsUnder(dim: FlowDim, id: string): string[] {
    return CAMPAIGNS.filter((c) => {
        if (dim === 'platform') return c.platformId === id;
        if (dim === 'project') return c.projectId === id;
        if (dim === 'game') return c.gameId === id;
        return false;
    }).map((c) => c.id);
}

/**
 * 组织轴：节点下投手的投放组合（**已与全局业务筛选求交**）
 *
 * 修复要点：早期实现按组织维度预聚合，导致按平台/项目/游戏筛选时组织轴不跟随，
 * 出现「公司消耗 101 万 vs 组织轴消耗 1.5 亿」的口径矛盾。
 * 现在统一从 `scope.campaignIds` 里筛出该节点下投手的组合，保证与公司合计同源。
 */
function campaignsOfOrgNode(nodeId: string, scope: Scope): string[] {
    const level = ORG_MAP.get(nodeId)?.level;
    const ids = level === 'pitcher' ? [nodeId] : subtreeIds(nodeId);
    const pitchers = new Set(ids.filter((id) => ORG_MAP.get(id)?.isPitcher));
    if (!pitchers.size) return [];
    return scope.campaignIds.filter((cid) => pitchers.has(CAMPAIGN_MAP.get(cid)?.pitcherId ?? ''));
}

function orgMetrics(filter: AnalysisFilter, scope: Scope, level: FlowDim, nodeId: string): Metrics {
    const cids = campaignsOfOrgNode(nodeId, scope);
    const agg = cids.length ? sumCampaigns(cids, scope) : emptyFlowAgg();
    void level;
    const cost = mergeCosts(scope.monthIdx.map((mi) => orgCostOf(nodeId, mi)));
    return buildMetrics(agg, cost, filter.basis);
}

/** 业务轴：成本池按消耗占比分摊 */
function businessMetrics(filter: AnalysisFilter, scope: Scope, dim: FlowDim, nodeId: string, totals: FlowAgg, pool: OrgMonthCost): Metrics {
    const ids = campaignsUnder(dim, nodeId).filter((id) => scope.campaignIds.includes(id));
    const agg = ids.length ? sumCampaigns(ids, scope) : emptyFlowAgg();
    const share = totals.flow.spend > 0 ? agg.flow.spend / totals.flow.spend : 0;
    return buildMetrics(agg, scaleCost(pool, share), filter.basis);
}

/**
 * 成本池：金额按区间累加；**人数取区间最后一个月**（时点值，不能按月累加）。
 */
function mergeCosts(monthCosts: OrgMonthCost[]): OrgMonthCost {
    let sum = zeroCost();
    let heads = 0;
    for (const c of monthCosts) {
        sum = addCost(sum, c);
        heads = c.headcount;
    }
    const last = monthCosts[monthCosts.length - 1];
    if (last) heads = last.headcount;
    return { ...sum, headcount: heads };
}
function poolOf(scope: Scope): OrgMonthCost {
    return mergeCosts(scope.monthIdx.map((mi) => costOfIds(scope.orgScopeIds, mi)));
}
function totalsOf(scope: Scope): FlowAgg {
    return sumCampaigns(scope.campaignIds, scope);
}

// ============================================================
// 9. 时间序列
// ============================================================
type Granularity = 'year' | 'quarter' | 'month';
function bucketKey(monthIdx: number, g: Granularity): string {
    const m = MONTHS[monthIdx];
    const [y, mm] = m.split('-');
    if (g === 'year') return y;
    if (g === 'quarter') return `${y}Q${Math.floor((Number(mm) - 1) / 3) + 1}`;
    return m;
}
function bucketLabel(monthIdx: number, g: Granularity): string {
    const m = MONTHS[monthIdx];
    const [y, mm] = m.split('-');
    if (g === 'year') return `${y}年`;
    if (g === 'quarter') return `${y}Q${Math.floor((Number(mm) - 1) / 3) + 1}`;
    return `${Number(mm)}月`;
}

function seriesOf(filter: AnalysisFilter, forceMonth: boolean): MonthlyPoint[] {
    const scope = resolveScope(filter);
    const g: Granularity = forceMonth ? 'month' : filter.granularity;
    const order: string[] = [];
    const groups = new Map<string, { label: string; idx: number[] }>();
    for (const mi of scope.monthIdx) {
        const k = bucketKey(mi, g);
        let grp = groups.get(k);
        if (!grp) {
            grp = { label: bucketLabel(mi, g), idx: [] };
            groups.set(k, grp);
            order.push(k);
        }
        grp.idx.push(mi);
    }
    return order.map((k) => {
        const grp = groups.get(k) as { label: string; idx: number[] };
        const sub: Scope = { ...scope, monthIdx: grp.idx, monthKeys: grp.idx.map((i) => MONTHS[i]) };
        const agg = sumCampaigns(scope.campaignIds, sub);
        const pool = mergeCosts(grp.idx.map((mi) => costOfIds(scope.orgScopeIds, mi)));
        return { month: k, label: grp.label, metrics: buildMetrics(agg, pool, filter.basis) };
    });
}

// ============================================================
// 10. 对外 API
// ============================================================
function monthCountOf(filter: AnalysisFilter): number {
    return Math.max(1, monthIndexOf(filter.endMonth) - monthIndexOf(filter.startMonth) + 1);
}
function shiftFilter(filter: AnalysisFilter, by: number): AnalysisFilter {
    return {
        ...filter,
        startMonth: monthFromIndex(monthIndexOf(filter.startMonth) + by),
        endMonth: monthFromIndex(monthIndexOf(filter.endMonth) + by),
    };
}

export interface StoreApi {
    months: string[];
    currentMonth: string;
    currentMonthIdx: number;
    daysElapsed: number;
    daysInMonth: number;
    defaultFilter: (over?: Partial<AnalysisFilter>) => AnalysisFilter;
    queryRows: (filter: AnalysisFilter, groupBy: DimKey, parentId?: string | null) => MetricRow[];
    metricsOf: (filter: AnalysisFilter, groupBy: DimKey, key: string) => Metrics | null;
    querySeries: (filter: AnalysisFilter) => MonthlyPoint[];
    queryMonthSeries: (filter: AnalysisFilter) => MonthlyPoint[];
    alerts: (filter: AnalysisFilter) => AlertItem[];
    forecast: (filter: AnalysisFilter, horizon?: number) => ForecastPoint[];
    cohorts: (filter: AnalysisFilter, count?: number) => CohortPoint[];
    /** 沙盒推演：按假设投影未来若干月的收入 / 成本 / 利润（算法与 buildForecast 同源） */
    project: (filter: AnalysisFilter, opts: ProjectOptions) => ProjectPoint[];
}

function grow(cur: number, base: number | undefined): number | null {
    if (base === undefined || !Number.isFinite(base) || base === 0) return null;
    return (cur - base) / Math.abs(base);
}

const BUSINESS_ORDER: BusinessType[] = ['self_op', 'sale', 'external'];

function isBusinessType(value: string): value is BusinessType {
    return value === 'self_op' || value === 'sale' || value === 'external';
}

function selfGameStats(filter: AnalysisFilter, scope: Scope): SelfGameStat[] {
    const key = [
        scope.monthIdx.join(','),
        filter.businessTypes.join(','),
        filter.gameIds.join(','),
        filter.projectIds.join(','),
        filter.platformIds.join(','),
        filter.basis,
        String(filter.roiWindow),
    ].join('|');
    const hit = selfGameCache.get(key);
    if (hit) return hit;
    const totals = totalsOf(scope);
    const pool = poolOf(scope);
    const stats = GAMES.filter((game) => {
        if (filter.gameIds.length && !filter.gameIds.includes(game.id)) return false;
        if (filter.projectIds.length && !filter.projectIds.includes(game.projectId)) return false;
        if (filter.platformIds.length) {
            const project = PROJECTS.find((item) => item.id === game.projectId);
            if (!project || !project.platformIds.some((id) => filter.platformIds.includes(id))) return false;
        }
        return true;
    }).map((game) => {
        const raw = businessMetrics(filter, scope, 'game', game.id, totals, pool);
        return {
            id: game.id,
            projectId: game.projectId,
            accrual: raw.accrualRevenue,
            cash: raw.cashRevenue,
            labor: raw.laborCost,
            spend: raw.spend,
            admin: raw.adminCost,
            operatingProfit: raw.operatingProfit,
            monetize: game.monetize,
            stage: game.stage,
        };
    });
    selfGameCache.set(key, stats);
    return stats;
}

const selfGameCache = new Map<string, SelfGameStat[]>();

function blankMetrics(basis: AnalysisFilter['basis']): Metrics {
    return zeroMoney(buildMetrics(emptyFlowAgg(), zeroCost(), basis));
}

function companyRaw(filter: AnalysisFilter, scope: Scope): Metrics {
    if (!wantsSelf(filter.businessTypes)) return blankMetrics(filter.basis);
    return buildMetrics(sumCampaigns(scope.campaignIds, scope), poolOf(scope), filter.basis);
}

function rawForNode(filter: AnalysisFilter, scope: Scope, node: BizNode): Metrics {
    const selfOn = wantsSelf(filter.businessTypes);
    if (node.level === 'company' || (node.level === 'businessType' && node.type === 'self_op')) {
        return node.type === 'self_op' && !selfOn ? blankMetrics(filter.basis) : companyRaw(filter, scope);
    }
    if (node.level === 'businessType') return blankMetrics(filter.basis);
    if (selfOn && node.type === 'self_op' && node.id && (node.level === 'platform' || node.level === 'project' || node.level === 'game')) {
        return businessMetrics(filter, scope, node.level, node.id, totalsOf(scope), poolOf(scope));
    }
    return blankMetrics(filter.basis);
}

function runwayMonths(filter: AnalysisFilter, scope: Scope): number | null {
    const end = CURRENT_MONTH_IDX - 1;
    const start = end - 2;
    if (start < 0) return null;
    const monthIdx = [start, start + 1, end];
    const sub: Scope = { ...scope, monthIdx, monthKeys: monthIdx.map((index) => MONTHS[index]) };
    const viewed = applyBusiness(companyRaw(filter, sub), { level: 'company' }, 3, filter.basis, filter, selfGameStats(filter, sub), null);
    const net = viewed.spend + viewed.otherDirectCost + viewed.laborCost + viewed.adminCost - viewed.cashCollection;
    const avg = net / 3;
    return avg > 0 ? AVAILABLE_CASH / avg : null;
}

function present(filter: AnalysisFilter, scope: Scope, node: BizNode): Metrics {
    const raw = node.level === 'org' ? blankMetrics(filter.basis) : rawForNode(filter, scope, node);
    const games = node.level === 'org' ? [] : selfGameStats(filter, scope);
    const runway = node.level === 'company' ? runwayMonths(filter, scope) : null;
    return applyBusiness(raw, node, scope.monthIdx.length || 1, filter.basis, filter, games, runway);
}

function bizRows(filter: AnalysisFilter, scope: Scope, groupBy: DimKey, parentId: string | null): MetricRow[] | null {
    if (groupBy === 'businessType') {
        const types = filter.businessTypes.length ? filter.businessTypes : BUSINESS_ORDER;
        return types.map((type) => {
            const metrics = present(filter, scope, { level: 'businessType', type });
            return {
                key: type,
                name: BUSINESS_TYPE_LABEL[type],
                parentId: 'company',
                depth: 1,
                hasChildren: true,
                mom: null,
                yoy: null,
                ...metrics,
            };
        });
    }
    if (groupBy === 'platform' && parentId && isBusinessType(parentId)) {
        const games = GAMES.filter((game) => {
            if (filter.gameIds.length && !filter.gameIds.includes(game.id)) return false;
            if (parentId !== 'self_op' && !BUSINESS_DEALS.some((deal) => deal.businessType === parentId && deal.gameId === game.id)) {
                return false;
            }
            return true;
        });
        const platformIds = new Set<string>();
        for (const game of games) {
            PROJECTS.find((project) => project.id === game.projectId)?.platformIds.forEach((id) => platformIds.add(id));
        }
        return PLATFORMS.filter((platform) => platformIds.has(platform.id) && (!filter.platformIds.length || filter.platformIds.includes(platform.id))).map(
            (platform) => {
                const metrics = present(filter, scope, { level: 'platform', type: parentId, id: platform.id });
                return {
                    key: `${parentId}|${platform.id}`,
                    name: platform.name,
                    parentId,
                    depth: 2,
                    hasChildren: true,
                    mom: null,
                    yoy: null,
                    ...metrics,
                };
            },
        );
    }
    const parsed = parentId?.includes('|') ? parentId.split('|') : null;
    if (parsed && isBusinessType(parsed[0]) && parsed[1]) {
        const type = parsed[0];
        const parentKey = parsed[1];
        if (groupBy === 'project') {
            const projects = PROJECTS.filter((project) => project.platformIds.includes(parentKey) && (!filter.projectIds.length || filter.projectIds.includes(project.id)));
            return projects
                .filter((project) => {
                    if (type === 'self_op') return GAMES.some((game) => game.projectId === project.id);
                    return BUSINESS_DEALS.some((deal) => deal.businessType === type && deal.projectId === project.id);
                })
                .map((project) => {
                    const metrics = present(filter, scope, { level: 'project', type, id: project.id });
                    return {
                        key: `${type}|${project.id}`,
                        name: project.name,
                        parentId,
                        depth: 3,
                        hasChildren: true,
                        mom: null,
                        yoy: null,
                        ...metrics,
                    };
                });
        }
        if (groupBy === 'game') {
            return GAMES.filter((game) => {
                if (game.projectId !== parentKey) return false;
                if (filter.gameIds.length && !filter.gameIds.includes(game.id)) return false;
                if (type !== 'self_op' && !BUSINESS_DEALS.some((deal) => deal.businessType === type && deal.gameId === game.id)) return false;
                return true;
            }).map((game) => {
                const metrics = present(filter, scope, { level: 'game', type, id: game.id });
                return {
                    key: `${type}|${game.id}`,
                    name: type === 'self_op' ? game.name : (BUSINESS_DEALS.find((deal) => deal.businessType === type && deal.gameId === game.id)?.name ?? game.name),
                    parentId,
                    depth: 4,
                    hasChildren: false,
                    mom: null,
                    yoy: null,
                    ...metrics,
                };
            });
        }
    }
    return null;
}

export const store: StoreApi = {
    months: MONTHS,
    currentMonth: CURRENT_MONTH,
    currentMonthIdx: CURRENT_MONTH_IDX,
    daysElapsed: DAYS_ELAPSED,
    daysInMonth: DAYS_IN_MONTH,

    defaultFilter(over: Partial<AnalysisFilter> = {}): AnalysisFilter {
        return {
            startMonth: '2025-07',
            endMonth: CURRENT_MONTH,
            granularity: 'month',
            basis: 'operating',
            roiWindow: 360,
            centerIds: [],
            departmentIds: [],
            groupIds: [],
            pitcherIds: [],
            platformIds: [],
            projectIds: [],
            gameIds: [],
            businessTypes: [],
            ...over,
        };
    },

    queryRows(filter, groupBy, parentId = null): MetricRow[] {
        const scope = resolveScope(filter);
        const rows: MetricRow[] = [];

        if (groupBy === 'month') {
            const points = seriesOf({ ...filter, granularity: 'month' }, true);
            points.forEach((p, i) => {
                rows.push({
                    key: p.month,
                    name: p.label,
                    parentId: null,
                    depth: -1,
                    hasChildren: false,
                    mom: grow(p.metrics.profit, points[i - 1]?.metrics.profit),
                    yoy: null,
                    ...p.metrics,
                });
            });
            return rows;
        }

        if (groupBy === 'company') {
            const metrics = present(filter, scope, { level: 'company' });
            rows.push({
                key: 'company',
                name: ORG_MAP.get('company')?.name ?? '全公司',
                parentId: null,
                depth: 0,
                hasChildren: true,
                mom: null,
                yoy: null,
                ...metrics,
            });
            return rows;
        }

        if (groupBy === 'center' || groupBy === 'department' || groupBy === 'group' || groupBy === 'pitcher') {
            const level = ORG_LEVEL_OF[groupBy];
            const prevFilter = shiftFilter(filter, -monthCountOf(filter));
            const prevScope = resolveScope(prevFilter);
            const yoyScope = resolveScope(shiftFilter(filter, -12));
            const inScope = new Set(scope.orgScopeIds);
            for (const item of membersOf(groupBy, parentId)) {
                if (!inScope.has(item.key)) continue;
                const m = orgMetrics(filter, scope, level, item.key);
                const shown = wantsSelf(filter.businessTypes) ? applyBusiness(m, { level: 'org' }, scope.monthIdx.length || 1, filter.basis, filter, [], null) : zeroMoney(m);
                const p = orgMetrics(prevFilter, prevScope, level, item.key);
                const y = orgMetrics(shiftFilter(filter, -12), yoyScope, level, item.key);
                rows.push({
                    key: item.key,
                    name: item.name,
                    parentId: item.parentId,
                    depth: item.depth,
                    hasChildren: item.hasChildren,
                    mom: grow(m.profit, p.profit),
                    yoy: grow(m.profit, y.profit),
                    ...shown,
                });
            }
            return rows;
        }

        const layered = bizRows(filter, scope, groupBy, parentId);
        if (layered) return layered;

        const dim = groupBy as FlowDim;
        const totals = totalsOf(scope);
        const pool = poolOf(scope);
        const prevFilter = shiftFilter(filter, -monthCountOf(filter));
        const prevScope = resolveScope(prevFilter);
        const prevTotals = totalsOf(prevScope);
        const prevPool = poolOf(prevScope);
        const yoyFilter = shiftFilter(filter, -12);
        const yoyScope = resolveScope(yoyFilter);
        const yoyTotals = totalsOf(yoyScope);
        const yoyPool = poolOf(yoyScope);
        const bizFilterActive =
            filter.platformIds.length + filter.projectIds.length + filter.gameIds.length + filter.pitcherIds.length +
                filter.groupIds.length + filter.departmentIds.length + filter.centerIds.length >
            0;
        const hasCampaign = new Set(
            scope.campaignIds.map((cid) => {
                const c = CAMPAIGN_MAP.get(cid);
                if (!c) return '';
                if (dim === 'platform') return c.platformId;
                if (dim === 'project') return c.projectId;
                return c.gameId;
            }),
        );
        for (const item of membersOf(groupBy, parentId)) {
            // 范围过滤生效时，隐藏该维度下没有任何投放的成员（除非用户显式选中了它），
            // 避免「按平台筛选后仍列出全部项目」这类空行污染。
            const explicitlySelected =
                filter.platformIds.includes(item.key) ||
                filter.projectIds.includes(item.key) ||
                filter.gameIds.includes(item.key);
            if (bizFilterActive && !hasCampaign.has(item.key) && !explicitlySelected) continue;
            const m = businessMetrics(filter, scope, dim, item.key, totals, pool);
            const p = businessMetrics(prevFilter, prevScope, dim, item.key, prevTotals, prevPool);
            const y = businessMetrics(yoyFilter, yoyScope, dim, item.key, yoyTotals, yoyPool);
            rows.push({
                key: item.key,
                name: item.name,
                parentId: item.parentId,
                depth: item.depth,
                hasChildren: item.hasChildren,
                mom: grow(m.profit, p.profit),
                yoy: grow(m.profit, y.profit),
                ...m,
            });
        }
        return rows;
    },

    metricsOf(filter, groupBy, key): Metrics | null {
        const scope = resolveScope(filter);
        if (groupBy === 'company' || groupBy === 'month') {
            return present(filter, scope, { level: 'company' });
        }
        if (groupBy === 'businessType' && isBusinessType(key)) {
            return present(filter, scope, { level: 'businessType', type: key });
        }
        if (key.includes('|')) {
            const [type, id] = key.split('|');
            if (isBusinessType(type) && id && (groupBy === 'platform' || groupBy === 'project' || groupBy === 'game')) {
                return present(filter, scope, { level: groupBy, type, id });
            }
        }
        if (groupBy === 'center' || groupBy === 'department' || groupBy === 'group' || groupBy === 'pitcher') {
            if (!scope.orgScopeIds.includes(key)) return null;
            const raw = orgMetrics(filter, scope, ORG_LEVEL_OF[groupBy], key);
            return wantsSelf(filter.businessTypes)
                ? applyBusiness(raw, { level: 'org' }, scope.monthIdx.length || 1, filter.basis, filter, [], null)
                : zeroMoney(raw);
        }
        return businessMetrics(filter, scope, groupBy as FlowDim, key, totalsOf(scope), poolOf(scope));
    },

    querySeries(filter) {
        return seriesOf(filter, false);
    },
    queryMonthSeries(filter) {
        return seriesOf({ ...filter, granularity: 'month' }, true);
    },
    alerts(filter) {
        return buildAlerts(filter);
    },
    forecast(filter, horizon = 6) {
        return buildForecast(filter, horizon);
    },
    cohorts(filter, count = 8) {
        return buildCohorts(filter, count);
    },
    project(filter, opts) {
        return projectMonths(filter, opts);
    },
};

// ============================================================
// 11. 预警
// ============================================================
function buildAlerts(filter: AnalysisFilter): AlertItem[] {
    const out: AlertItem[] = [];
    const games = store.queryRows(filter, 'game');
    const pitchers = store.queryRows(filter, 'pitcher');
    const groups = store.queryRows(filter, 'group');

    for (const g of games) {
        const meta = GAME_MAP.get(g.key);
        if (!meta) continue;
        if (g.spend > 200000 && g.forecastRoi > 0 && g.forecastRoi < meta.redLineRoi) {
            out.push({
                id: `roi-${g.key}`,
                level: g.forecastRoi < meta.redLineRoi * 0.85 ? 'high' : 'medium',
                type: 'ROI 低于红线',
                title: `${g.name} 累计预估 ROI ${g.forecastRoi.toFixed(2)} < 红线 ${meta.redLineRoi.toFixed(2)}`,
                desc: `本周期消耗 ${(g.spend / 10000).toFixed(0)} 万，累计预估回收 ROI 仅 ${g.forecastRoi.toFixed(2)}，按当前回收曲线 ${meta.paybackDays} 天内难以回本。`,
                dim: 'game',
                dimKey: g.key,
                dimName: g.name,
                value: g.forecastRoi,
                threshold: meta.redLineRoi,
                unit: '倍',
                suggestion: '压缩该游戏预算 20%~30%，优先复投高 ROI 版本；同步复查素材与版位结构。',
            });
        }
        if (g.operatingProfit < 0 && g.spend > 0) {
            out.push({
                id: `loss-${g.key}`,
                level: g.operatingMargin < -0.15 ? 'high' : 'medium',
                type: '单游戏经营亏损',
                title: `${g.name} 经营利润 ${(g.operatingProfit / 10000).toFixed(1)} 万`,
                desc: `经营利润率 ${(g.operatingMargin * 100).toFixed(1)}%，累计回收完成度 ${(g.recoveryRate * 100).toFixed(0)}%。`,
                dim: 'game',
                dimKey: g.key,
                dimName: g.name,
                value: g.operatingProfit,
                threshold: 0,
                unit: '元',
                suggestion: '纳入止损评估清单，明确观察期与止损线；若 30 日内 ROI 无改善则暂停投放。',
            });
        }
    }

    for (const p of pitchers) {
        if (p.spend < 100000) continue;
        if (p.efficiencyRatio > 0 && p.efficiencyRatio < 1) {
            out.push({
                id: `eff-${p.key}`,
                level: p.efficiencyRatio < 0.5 ? 'high' : 'low',
                type: '人效偏低',
                title: `${p.name} 人效比 ${p.efficiencyRatio.toFixed(2)}`,
                desc: `消耗 ${(p.spend / 10000).toFixed(0)} 万，经营利润 ${(p.operatingProfit / 10000).toFixed(1)} 万，人力成本 ${(p.laborCost / 10000).toFixed(1)} 万。`,
                dim: 'pitcher',
                dimKey: p.key,
                dimName: p.name,
                value: p.efficiencyRatio,
                threshold: 1,
                unit: '倍',
                suggestion: '调整该投手负责盘面，或安排高 ROI 游戏复投以提升单位人效。',
            });
        }
    }

    for (const gr of groups) {
        if (gr.spend > 500000 && gr.recoveryRate > 0 && gr.recoveryRate < 0.6) {
            out.push({
                id: `rec-${gr.key}`,
                level: 'medium',
                type: '回收完成度滞后',
                title: `${gr.name} 累计回收完成度仅 ${(gr.recoveryRate * 100).toFixed(0)}%`,
                desc: '本周期投放的存量用户回收进度落后于预估曲线，可能延长回本周期。',
                dim: 'group',
                dimKey: gr.key,
                dimName: gr.name,
                value: gr.recoveryRate,
                threshold: 0.6,
                unit: '%',
                suggestion: '复核预估曲线参数是否需要下调，并关注变现侧（广告填充率 / eCPM）表现。',
            });
        }
    }

    const total = store.metricsOf(filter, 'company', 'company');
    if (total && total.cashGap > 0 && total.accrualRevenue > 0) {
        const gapRatio = total.cashGap / total.accrualRevenue;
        if (gapRatio > 0.5) {
            out.push({
                id: 'cash-gap',
                level: 'medium',
                type: '现金缺口偏大',
                title: `现金缺口 ${(total.cashGap / 10000).toFixed(0)} 万`,
                desc: `预付余额 ${(total.prepayBalance / 10000).toFixed(0)} 万 + 应收未收 ${(total.receivable / 10000).toFixed(0)} 万，占应确认收入 ${(gapRatio * 100).toFixed(0)}%。`,
                dim: 'company',
                dimKey: 'company',
                dimName: '全公司',
                value: total.cashGap,
                threshold: total.accrualRevenue * 0.5,
                unit: '元',
                suggestion: '在放量节奏与现金流之间取平衡；对结算周期长的平台适当控制充值节奏。',
            });
        }
    }

    const order = { high: 0, medium: 1, low: 2 };
    return out.sort((a, b) => order[a.level] - order[b.level]).slice(0, 24);
}

// ============================================================
// 12. 月度滚动预估
// ============================================================
function buildForecast(filter: AnalysisFilter, horizon: number): ForecastPoint[] {
    const scope = resolveScope(filter);
    const out: ForecastPoint[] = [];
    const campaignIds = scope.campaignIds;

    /** 任意月索引 → 'YYYY-MM'（允许超出 MONTHS 范围的未来月份） */
    const monthKeyOf = (mi: number): string => MONTHS[mi] ?? monthFromIndex(BASE_MONTH_IDX + mi);
    const monthSpanOf = (mi: number): { first: number; last: number; mid: number } => {
        const key = monthKeyOf(mi);
        const first = Math.max(0, dayIndexOf(`${key}-01`));
        const last = Math.max(first, dayIndexOf(`${key}-28`) + 2);
        return { first, last, mid: (first + Math.min(last, DAY_COUNT - 1)) / 2 };
    };

    // 已发生月份 → 实际
    for (const mi of scope.monthIdx) {
        if (mi >= CURRENT_MONTH_IDX) continue;
        const sub: Scope = { ...scope, monthIdx: [mi], monthKeys: [MONTHS[mi]] };
        const agg = sumCampaigns(campaignIds, sub);
        const pool = costOfIds(scope.orgScopeIds, mi);
        const m = buildMetrics(agg, pool, filter.basis);
        out.push({
            month: MONTHS[mi],
            label: `${Number(MONTHS[mi].slice(5))}月`,
            actual: true,
            revenue: m.revenue,
            cost: m.businessCost + m.laborCost + m.adminCost,
            profit: m.profit,
            optimistic: m.profit,
            pessimistic: m.profit,
            confidence: 1,
        });
    }

/** 任意月份的 1 号距数据起点的天数（纯日期算术，允许超出数据范围） */
    const monthFirstDay = (mi: number): number => dayIndexOf(`${monthKeyOf(mi)}-01`);

    /** 任意月份的代表日（月中），用于把该月消耗视为月中的一次性投放 */
    const monthMidDay = (mi: number): number =>
        mi <= CURRENT_MONTH_IDX && mi < MONTH_COUNT
            ? monthSpanOf(mi).mid
            : (monthFirstDay(mi) + monthFirstDay(mi + 1)) / 2;

    // 基线：最近 3 个**完整**月（当月只过了一部分，纳入会把基线拉低）
    const completeIdxs = scope.monthIdx.filter((mi) => mi < CURRENT_MONTH_IDX);
    const trailingIdxs = (completeIdxs.length
        ? completeIdxs
        : scope.monthIdx.filter((mi) => mi <= CURRENT_MONTH_IDX)
    ).slice(-3);
    let trailingSpend = 0;
    for (const cid of campaignIds) {
        const arr = CAMPAIGN_MONTH.get(cid);
        if (!arr) continue;
        for (const mi of trailingIdxs) trailingSpend += arr[mi].flow.spend;
    }
    trailingSpend = trailingIdxs.length ? trailingSpend / trailingIdxs.length : 0;

    /** 某组合在某月的消耗：已发生月取实际值，未来月取「近 3 个完整月均值 × 季节系数」 */
    const trial = (cid: string, mi: number, projectCurrent = false): number => {
        const arr = CAMPAIGN_MONTH.get(cid);
        if (!arr) return 0;
        if (mi === CURRENT_MONTH_IDX && projectCurrent) {
            // 当月只过了一部分，按已过天数折算成整月口径
            const elapsed = Math.max(0.05, DAYS_ELAPSED / DAYS_IN_MONTH);
            return arr[mi].flow.spend / elapsed;
        }
        if (mi <= CURRENT_MONTH_IDX && mi < MONTH_COUNT) return arr[mi].flow.spend;
        let base = 0;
        if (trailingIdxs.length) {
            for (const i of trailingIdxs) base += arr[i].flow.spend;
            base /= trailingIdxs.length;
        }
        return base * (SEASON[(mi + BASE_MONTH_IDX) % 12] / 1.02);
    };

    /**
     * 某个自然月内、由「截至该月为止的全部 cohort」贡献的确认收入。
     *
     * 用与数据引擎**完全相同的卷积口径**：某月收入 = Σ_cohort 该月消耗 × [ROI(窗口末龄) − ROI(窗口初龄)]。
     * 这样预估值与实际月份天然同源、可直接比较，避免用近似式（首月回收率 × 消耗 + 存量增量）时
     * 因两点近似产生约 20% 的系统性低估。
     *
     * 窗口固定取 [该月 1 号, 次月 1 号)，因此逐月之间不会重复计入。
     */
    const recoveryOfMonth = (mi: number, projectCurrent = false): number => {
        const winStart = monthFirstDay(mi);
        const winEnd = monthFirstDay(mi + 1);
        let sum = 0;
        for (const cid of campaignIds) {
            const g = GAME_MAP.get(CAMPAIGN_MAP.get(cid)?.gameId ?? '');
            if (!g) continue;
            for (let src = 0; src <= mi; src++) {
                const spend = trial(cid, src, projectCurrent);
                if (spend <= 0) continue;
                const srcMid = monthMidDay(src);
                const t0 = Math.max(0, Math.min(RECOVERY_MAX_DAY, winStart - srcMid));
                const t1 = Math.max(0, Math.min(RECOVERY_MAX_DAY, winEnd - srcMid));
                if (t1 <= t0) continue;
                sum += spend * (roiAt(t1, g.curveA, g.curveB) - roiAt(t0, g.curveA, g.curveB));
            }
        }
        return Math.max(0, sum);
    };

    // 当月实时预估：已过天数实际 + 剩余天数外推
    //
    // 口径（与未来月完全同源，保证可比较）：
    //   全月收入     = 该自然月内全部 cohort 的确认回收，其中当月消耗按已过天数折算成整月
    //                  （复用 recoveryOfMonth 的同一套卷积，而不是另写一个近似系数）
    //   全月可变成本 = 当月实际消耗 ÷ (已过天数 / 当月天数)
    //   全月固定成本 = 整月人工 + 管理费用（整月都会发生，不摊薄）
    //   三档情景     = profit ± revenue × σ（符号安全；早期用 profit × 1.1 / × 0.86，
    //                  在利润为负时会出现「乐观比悲观更差」的方向反转）
    if (scope.monthIdx.includes(CURRENT_MONTH_IDX)) {
        const sub: Scope = { ...scope, monthIdx: [CURRENT_MONTH_IDX], monthKeys: [CURRENT_MONTH] };
        const agg = sumCampaigns(campaignIds, sub);
        const fullPool = rawCostOfIds(scope.orgScopeIds, CURRENT_MONTH_IDX);
        const elapsed = Math.max(0.05, DAYS_ELAPSED / DAYS_IN_MONTH);
        const revenue = recoveryOfMonth(CURRENT_MONTH_IDX, true);
        const cost = agg.flow.spend / elapsed + laborOf(fullPool) + adminOf(fullPool);
        const profit = revenue - cost;
        const sigma = 0.1;
        out.push({
            month: CURRENT_MONTH,
            label: `${Number(CURRENT_MONTH.slice(5))}月`,
            actual: false,
            revenue,
            cost,
            profit,
            optimistic: profit + revenue * sigma,
            pessimistic: profit - revenue * sigma * 1.15,
            confidence: 0.86,
        });
    }

    // 未来月份：**直接复用 projectMonths 的唯一实现**（中性参数下即为无干预基线）。
    //
    // 早期这里另写了一份 spendAt / 窗口卷积，与 projectMonths 的「当月消耗是否折算整月」
    // 和「代表日取月中还是数据截止日」两处细节不一致，导致同一家公司两个页面
    // 给出相差 1%~9% 的未来月收入。合并为一份实现后从根上消除漂移。
    const projected = projectMonths(filter, {
        horizon,
        spendScale: 1,
        curveAScale: 1,
        curveBScale: 1,
        laborScale: 1,
    });

    for (let h = 1; h <= horizon; h++) {
        // 注意：未来月份可以超出 MONTHS（历史月份轴）范围，不能因为 mi >= MONTH_COUNT 就 break，
        // 否则「未来滚动预估」永远为空（MONTHS 末月 = 当月）。
        const point = projected[h - 1];
        if (!point) break;
        const { revenue, cost, profit } = point;
        const sigma = 0.1 + h * 0.022;
        out.push({
            month: point.month,
            label: point.label,
            actual: false,
            revenue,
            cost,
            profit,
            optimistic: profit + revenue * sigma,
            pessimistic: profit - revenue * sigma * 1.15,
            confidence: Math.max(0.42, 0.86 - h * 0.06),
        });
    }

    return out;
}

// ============================================================
// 13. Cohort 回收曲线
// ============================================================
function buildCohorts(filter: AnalysisFilter, count: number): CohortPoint[] {
    const scope = resolveScope(filter);
    const out: CohortPoint[] = [];
    const lastActual = Math.min(
        CURRENT_MONTH_IDX,
        scope.monthIdx.length ? scope.monthIdx[scope.monthIdx.length - 1] : CURRENT_MONTH_IDX,
    );
    const startMi = Math.max(0, lastActual - count + 1);

    for (let mi = startMi; mi <= lastActual; mi++) {
        const monthKey = MONTHS[mi];
        const cohortStart = Math.max(0, dayIndexOf(`${monthKey}-01`));
        const cohortEnd = Math.min(DAY_COUNT - 1, dayIndexOf(`${monthKey}-28`) + 2);

        let cohortSpend = 0;
        let weightedA = 0;
        let weightedB = 0;
        for (const cid of scope.campaignIds) {
            const ser = SERIES_BY_ID.get(cid);
            const game = GAME_MAP.get(CAMPAIGN_MAP.get(cid)?.gameId ?? '');
            if (!ser || !game) continue;
            let s = 0;
            for (let d = cohortStart; d <= cohortEnd; d++) s += ser.spend[d];
            if (s <= 0) continue;
            cohortSpend += s;
            weightedA += s * game.curveA;
            weightedB += s * game.curveB;
        }
        if (cohortSpend <= 0) continue;
        const a = weightedA / cohortSpend;
        const b = weightedB / cohortSpend;

        for (let day = 30; day <= 360; day += 30) {
            const targetDay = cohortStart + day;
            out.push({
                cohortMonth: monthKey,
                day,
                roi: Number(roiAt(day, a, b).toFixed(4)),
                spend: cohortSpend,
                projected: targetDay >= DAY_COUNT,
            });
        }
    }
    return out;
}

// ============================================================
// 14. 沙盒推演（供「经营推演模拟器」使用）
//
// 为什么放在引擎里：推演页若自己另写一套「新增投放 × ROI(15 天) + 存量回看 ÷ 6」的近似式，
// 会与 buildForecast 的窗口卷积产生系统性偏差（实测约 40% 的收入低估 → 全部情景显示亏损），
// 让同一家公司出现「预估页盈利、推演页巨亏」的自相矛盾。这里提供唯一实现，两边同源。
// ============================================================
export interface ProjectOptions {
    /** 推演月数 */
    horizon: number;
    /** 预算倍率：1.2 = 投放预算 +20% */
    spendScale: number;
    /** 回收曲线 curveA 倍率 */
    curveAScale: number;
    /** 回收曲线 curveB 倍率 */
    curveBScale: number;
    /** 人工 / 管理费用倍率 */
    laborScale: number;
    /** 只推演这些平台（空 = 全部） */
    platformIds?: string[];
    /** 只推演这些游戏（空 = 全部） */
    gameIds?: string[];
}

export interface ProjectPoint {
    month: string;
    label: string;
    /** 该月投放消耗 */
    spend: number;
    /** 该月应确认收入 */
    revenue: number;
    /** 该月总成本（消耗 + 人工 + 管理费用） */
    cost: number;
    /** 该月经营利润 */
    profit: number;
}

function monthKeyAt(mi: number): string {
    return MONTHS[mi] ?? monthFromIndex(BASE_MONTH_IDX + mi);
}

export function projectMonths(filter: AnalysisFilter, opts: ProjectOptions): ProjectPoint[] {
    const scope = resolveScope(filter);
    const platformSet = new Set(opts.platformIds ?? []);
    const gameSet = new Set(opts.gameIds ?? []);

    // 受推演影响的投放组合
    const baseCids = scope.campaignIds.filter((cid) => {
        const c = CAMPAIGN_MAP.get(cid);
        if (!c) return false;
        if (platformSet.size && !platformSet.has(c.platformId)) return false;
        if (gameSet.size && !gameSet.has(c.gameId)) return false;
        return true;
    });

    // 基线：最近 3 个完整月的月均消耗
    const completeIdxs = scope.monthIdx.filter((mi) => mi < CURRENT_MONTH_IDX);
    const trailIdxs = (completeIdxs.length ? completeIdxs : scope.monthIdx.filter((mi) => mi <= CURRENT_MONTH_IDX)).slice(-3);
    const baseOf = new Map<string, number>();
    for (const cid of baseCids) {
        const arr = CAMPAIGN_MONTH.get(cid);
        if (!arr) continue;
        let sum = 0;
        for (const mi of trailIdxs) sum += arr[mi].flow.spend;
        baseOf.set(cid, trailIdxs.length ? sum / trailIdxs.length : 0);
    }

    // 固定成本基数
    const costMi = trailIdxs[trailIdxs.length - 1] ?? CURRENT_MONTH_IDX;
    const costRaw = rawCostOfIds(scope.orgScopeIds, costMi);

    const elapsed = Math.max(0.05, DAYS_ELAPSED / DAYS_IN_MONTH);
    const seasonOf = (mi: number) => SEASON[(mi + BASE_MONTH_IDX) % 12] / 1.02;

    /** 某组合在某月的消耗：历史取实际（当月折算整月），未来按基线 × 预算倍率 × 季节 */
    const spendAt = (cid: string, mi: number): number => {
        const arr = CAMPAIGN_MONTH.get(cid);
        if (!arr) return 0;
        if (mi < CURRENT_MONTH_IDX) return arr[mi].flow.spend;
        if (mi === CURRENT_MONTH_IDX) return arr[mi].flow.spend / elapsed;
        return (baseOf.get(cid) ?? 0) * opts.spendScale * seasonOf(mi);
    };

    const out: ProjectPoint[] = [];
    for (let h = 1; h <= opts.horizon; h++) {
        const mi = CURRENT_MONTH_IDX + h;
        const winStart = dayIndexOf(`${monthKeyAt(mi)}-01`);
        const winEnd = dayIndexOf(`${monthKeyAt(mi + 1)}-01`);

        let revenue = 0;
        let spend = 0;
        for (const cid of baseCids) {
            const c = CAMPAIGN_MAP.get(cid);
            const g = GAME_MAP.get(c?.gameId ?? '');
            if (!g) continue;
            const a = g.curveA * opts.curveAScale;
            const b = g.curveB * opts.curveBScale;
            for (let src = 0; src <= mi; src++) {
                const s = spendAt(cid, src);
                if (s <= 0) continue;
                if (src === mi) spend += s;
                const srcMid =
                    src < MONTH_COUNT
                        ? (dayIndexOf(`${monthKeyAt(src)}-01`) + dayIndexOf(`${monthKeyAt(src + 1)}-01`)) / 2
                        : (dayIndexOf(`${monthKeyAt(src)}-01`) + dayIndexOf(`${monthKeyAt(src + 1)}-01`)) / 2;
                const t0 = Math.max(0, Math.min(RECOVERY_MAX_DAY, winStart - srcMid));
                const t1 = Math.max(0, Math.min(RECOVERY_MAX_DAY, winEnd - srcMid));
                if (t1 <= t0) continue;
                revenue += s * (roiAt(t1, a, b) - roiAt(t0, a, b));
            }
        }
        const fixed = (laborOf(costRaw) + adminOf(costRaw)) * opts.laborScale * Math.pow(1.012, h);
        const cost = spend + fixed;
        const key = monthKeyAt(mi);
        out.push({
            month: key,
            label: `${Number(key.slice(5))}月`,
            spend,
            revenue: Math.max(0, revenue),
            cost,
            profit: Math.max(0, revenue) - cost,
        });
    }
    return out;
}

function checkBusinessInvariants(): void {
    const filter = store.defaultFilter();
    const company = store.metricsOf(filter, 'company', 'company');
    if (!company) return;
    const sum = BUSINESS_ORDER.reduce((acc, type) => acc + (store.metricsOf(filter, 'businessType', type)?.accrualRevenue ?? 0), 0);
    if (Math.abs(sum - company.accrualRevenue) > 1) {
        console.error('[口径] 三类确认收入之和与公司确认收入不一致', sum, company.accrualRevenue);
    }
    const subjects = company.revenueByType.liuliangzhu + company.revenueByType.adGold + company.revenueByType.iapShare;
    if (Math.abs(subjects - company.accrualSelf) > 1) {
        console.error('[口径] 自研三科目与自研确认收入不一致', subjects, company.accrualSelf);
    }
    for (const game of GAMES) {
        const row = store.metricsOf(filter, 'game', `self_op|${game.id}`);
        if (!row) continue;
        if (row.projectProfit > 1) {
            if (Math.abs(row.rdShare + row.issueShare - row.projectProfit) > 1) {
                console.error('[口径] 自研盈利项目两侧归属不等于项目利润', game.name);
            }
        } else if (Math.abs(row.rdShare) > 1 || Math.abs(row.issueShare) > 1) {
            console.error('[口径] 亏损或持平项目出现正向归属', game.name);
        }
    }
    const sale = store.metricsOf(filter, 'game', 'sale|g1');
    if (sale && !(sale.grossAmount > sale.accrualRevenue && sale.accrualRevenue + 1 >= sale.cashCollection)) {
        console.error('[口径] 出售合同额应大于确认收入，确认收入应不低于回款', sale.grossAmount, sale.accrualRevenue, sale.cashCollection);
    }
    const loss = store.metricsOf(filter, 'game', 'sale|g12');
    if (loss && (loss.projectProfit > 0 || loss.rdShare !== 0 || loss.issueShare !== 0)) {
        console.error('[口径] 亏损出售不应产生正向归属', loss.projectProfit, loss.rdShare);
    }
}

checkBusinessInvariants();
