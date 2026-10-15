/**
 * 成本分析页 · 共用口径模型
 *
 * 职责：科目树定义 / 颜色令牌解析 / 空值兜底 / 期间与占比小工具。
 * 纪律：本文件不产生任何业务数字，全部金额取自 store 返回的 Metrics。
 */
import type { CostBreakdown, Metrics } from '@/domain/types';

// ============================================================
// 一、成本科目树（总成本 → 3 大类 → 8 科目）
// ============================================================
export type CostGroupKey = 'business' | 'labor' | 'admin';

export interface CostLeafMeta {
    /** CostBreakdown 字段名 */
    key: keyof CostBreakdown;
    name: string;
    /** 口径说明（hover 提示用） */
    desc: string;
    /** 组内细分透明度：同色不同透明度 */
    alpha: number;
}

export interface CostGroupMeta {
    key: CostGroupKey;
    name: string;
    /** 设计令牌名（src/styles/theme.scss） */
    token: string;
    /** 令牌解析失败时的兜底值（与 theme.scss 一致；ECharts 不支持 CSS 变量，必须解析成具体色值） */
    fallback: string;
    desc: string;
    leaves: CostLeafMeta[];
}

export const COST_GROUPS: CostGroupMeta[] = [
    {
        key: 'business',
        name: '业务成本',
        token: '--oa-cost-ad',
        fallback: '#fd6464',
        desc: '投放消耗 + 充值支出：媒体后台实际消耗，以及已充值未消耗形成的预付款',
        leaves: [
            {
                key: 'adSpend',
                name: '投放成本',
                desc: '媒体后台当日实际消耗（不是充值额），恒为消耗口径',
                alpha: 1,
            },
            {
                key: 'prepay',
                name: '预付成本',
                desc: '已充值未消耗，形成预付款资产，是账面口径的现金流出，恒为充值额口径',
                alpha: 0.55,
            },
        ],
    },
    {
        key: 'labor',
        name: '人工成本',
        token: '--oa-cost-labor',
        fallback: '#4d94fa',
        desc: '工资 + 医社保（公司承担）+ 个税（代扣代缴）+ 项目奖金（季度末月发放）',
        leaves: [
            { key: 'salary', name: '工资', desc: '按各中心薪资基准 × 人头按月计提', alpha: 1 },
            { key: 'socialInsurance', name: '医社保', desc: '公司承担部分', alpha: 0.78 },
            { key: 'individualTax', name: '个税', desc: '代扣代缴（公司现金流口径）', alpha: 0.56 },
            { key: 'projectBonus', name: '项目奖金', desc: '季度末月发放，可按项目直接归集', alpha: 0.34 },
        ],
    },
    {
        key: 'admin',
        name: '管理费用',
        token: '--oa-cost-admin',
        fallback: '#06b6d4',
        desc: '福利费 + 办公费，按中心归集',
        leaves: [
            { key: 'welfare', name: '福利费', desc: '团建 / 节日福利 / 体检等', alpha: 1 },
            { key: 'office', name: '办公费', desc: '房租 / 水电 / 办公用品 / 软件订阅等', alpha: 0.6 },
        ],
    },
];

/** 8 个叶子科目（按大类顺序展开） */
export const COST_LEAVES: CostLeafMeta[] = COST_GROUPS.flatMap((g) => g.leaves);

export function groupMeta(key: CostGroupKey): CostGroupMeta {
    return COST_GROUPS.find((g) => g.key === key) as CostGroupMeta;
}

/** 叶子科目 → 所属大类 */
export function groupKeyOfLeaf(leafKey: keyof CostBreakdown): CostGroupKey {
    const hit = COST_GROUPS.find((g) => g.leaves.some((l) => l.key === leafKey));
    return (hit?.key ?? 'business') as CostGroupKey;
}

export function leafMeta(leafKey: keyof CostBreakdown): CostLeafMeta {
    for (const g of COST_GROUPS) {
        const hit = g.leaves.find((l) => l.key === leafKey);
        if (hit) return hit;
    }
    return { key: leafKey, name: String(leafKey), desc: '', alpha: 1 };
}

// ============================================================
// 二、取值与合计（金额恒等于子项之和，便于页面校验）
// ============================================================
export function leafValue(cb: CostBreakdown, key: keyof CostBreakdown): number {
    const v = cb[key];
    return Number.isFinite(v) ? v : 0;
}

/** 大类金额 = 其细项之和 */
export function groupValue(cb: CostBreakdown, key: CostGroupKey): number {
    return groupMeta(key).leaves.reduce((s, l) => s + leafValue(cb, l.key), 0);
}

/**
 * 结构口径总成本 = 8 科目之和。
 * 注意：投放消耗与充值额分别列示、不互相替代，因此该值与 Metrics.totalCost（业务成本随
 * filter.basis 取「消耗」或「充值」之一）存在差额，差额 = 当前口径未计入的那个科目。
 */
export function structTotal(cb: CostBreakdown): number {
    return COST_LEAVES.reduce((s, l) => s + leafValue(cb, l.key), 0);
}

export function structTotalOf(m: Metrics): number {
    return structTotal(m.costByType);
}

/** 当前口径未计入结构合计的业务科目（经营口径 = 预付成本；账面口径 = 投放成本） */
export function excludedBusinessLeaf(basis: 'book' | 'operating'): keyof CostBreakdown {
    return basis === 'operating' ? 'prepay' : 'adSpend';
}

// ============================================================
// 三、颜色令牌（DOM 直接用 var(--oa-*)，ECharts 需要解析成具体色值）
// ============================================================
const TOKEN_CACHE = new Map<string, string>();

/** 读取 :root 上的设计令牌；拿不到时返回与 theme.scss 一致的兜底值 */
export function tokenValue(name: string, fallback: string): string {
    if (typeof document === 'undefined') return fallback;
    const cached = TOKEN_CACHE.get(name);
    if (cached) return cached;
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const out = raw || fallback;
    TOKEN_CACHE.set(name, out);
    return out;
}

/** 大类色（ECharts 用具体色值；alpha < 1 时同色不同透明度） */
export function groupColor(key: CostGroupKey, alpha = 1): string {
    const g = groupMeta(key);
    const base = tokenValue(g.token, g.fallback);
    return alpha >= 1 ? base : withAlpha(base, alpha);
}

/** 叶子科目色 = 所属大类色 × 该科目透明度 */
export function leafColor(leafKey: keyof CostBreakdown): string {
    const meta = leafMeta(leafKey);
    return groupColor(groupKeyOfLeaf(leafKey), meta.alpha);
}

/** #rgb / #rrggbb → rgba()；非十六进制（含 CSS 变量）原样返回 */
export function withAlpha(color: string, alpha: number): string {
    const hex = color.trim();
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    let h = m[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ============================================================
// 四、小工具
// ============================================================
/** 空数据兜底骨架（全 0）。store 返回 null 时使用；此时页面渲染 PanelEmptyState，不会把它当业务数字展示 */
export const EMPTY_METRICS: Metrics = {
    revenue: 0,
    accrualRevenue: 0,
    cashRevenue: 0,
    revenueByType: { liuliangzhu: 0, adGold: 0, iapShare: 0 },
    businessCost: 0,
    laborCost: 0,
    adminCost: 0,
    totalCost: 0,
    costByType: {
        adSpend: 0,
        prepay: 0,
        salary: 0,
        socialInsurance: 0,
        individualTax: 0,
        projectBonus: 0,
        welfare: 0,
        office: 0,
    },
    profit: 0,
    margin: 0,
    bookProfit: 0,
    operatingProfit: 0,
    profitGap: 0,
    bookMargin: 0,
    operatingMargin: 0,
    spend: 0,
    prepay: 0,
    prepayBalance: 0,
    receivable: 0,
    cashGap: 0,
    forecastRoi: 0,
    actualRoi: 0,
    recoveryRate: 0,
    efficiencyRatio: 0,
    headcount: 0,
    cumSpend: 0,
    cumExp: 0,
    perCapitaProfit: 0,
    grossAmount: 0,
    cashCollection: 0,
    rdInvest: 0,
    otherDirectCost: 0,
    projectProfit: 0,
    rdShare: 0,
    issueShare: 0,
    budgetProfit: 0,
    profitAttainment: 0,
    availableCash: null,
    runwayMonths: null,
    matureProfit: 0,
    newProjectNeed: 0,
    accrualSelf: 0,
    accrualSale: 0,
    accrualExternal: 0,
};

/** 无数据判定：成本、投放、收入、人数全为 0 */
export function isEmptyMetrics(m: Metrics): boolean {
    return (
        m.totalCost === 0 &&
        m.laborCost === 0 &&
        m.adminCost === 0 &&
        m.spend === 0 &&
        m.prepay === 0 &&
        m.accrualRevenue === 0 &&
        m.cashRevenue === 0 &&
        structTotal(m.costByType) === 0
    );
}

/** 'YYYY-MM' 平移 */
export function shiftMonth(ym: string, by: number): string {
    const [y, m] = ym.split('-').map(Number);
    const t = y * 12 + (m - 1) + by;
    const year = Math.floor(t / 12);
    const month = ((t % 12) + 12) % 12;
    return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** '2026-06' → '26/6'（多月份趋势图的短标签，避免跨年重名） */
export function shortMonth(ym: string): string {
    return `${ym.slice(2, 4)}/${Number(ym.slice(5))}`;
}

/** 占比，分母为 0 时返回 0 */
export function share(value: number, total: number): number {
    if (!Number.isFinite(value) || !Number.isFinite(total) || total === 0) return 0;
    return value / total;
}

/** 增长率，(当前 − 基期) / |基期|；基期缺失或为 0 时返回 null（不显示环比） */
export function growth(cur: number, base: number | null | undefined): number | null {
    if (base === null || base === undefined || !Number.isFinite(base) || base === 0) return null;
    if (!Number.isFinite(cur)) return null;
    return (cur - base) / Math.abs(base);
}
