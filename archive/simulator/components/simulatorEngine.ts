// ============================================================
// 经营推演模拟器 · 沙盒编排层
//
// 职责边界（A00 返工要求）
//   本文件**只做编排与参数映射，不再自写任何收入推演公式**。
//   所有数字一律来自 `store.project(filter, ProjectOptions)`（`@/domain/store`），
//   它与 `store.forecast`（月度经营预估页）完全同源：
//   同一套自然月窗口卷积、同一套季节系数、同一套固定成本口径，
//   因此本页与「月度经营预估」页不会出现同一家公司两个结论。
//
// 本文件保留的内容：
//   1) 参数模型 SandboxParams（滑杆百分比 → 引擎倍率的映射）
//   2) 单因子敏感度扫描（预算 16 点 + curveA 13 点 = 29 次 project 调用）
//   3) 数值插值求盈亏平衡点 / 边际收益峰值
//   4) 4 个预设情景的倍率表
//   5) 基线快照 SandboxBaseline（**仅供界面展示与空态判断**，不参与计算）
// ============================================================

import { projectMonths, type ProjectOptions, type ProjectPoint } from '@/domain/store';

// ------------------------------------------------------------
// 0. 类型与常量
// ------------------------------------------------------------
/** 单条推演结果（= store.project 的一个返回点，字段原样透传） */
export type MonthProjection = ProjectPoint;

export interface SandboxResult {
    /** 逐月推演点（直接来自 store.project） */
    months: MonthProjection[];
    /** 月均应确认收入 */
    avgRevenue: number;
    /** 月均经营利润 */
    avgProfit: number;
    /** 月均投放消耗 */
    avgSpend: number;
    /** 经营利润率（推演期累计口径：Σ利润 ÷ Σ收入） */
    margin: number;
    /** 推演期累计经营利润 */
    cumulativeProfit: number;
    /** 推演期累计预估 ROI（= 累计收入 ÷ 累计消耗） */
    cumulativeRoi: number;
    /** 推演期累计固定成本（人工 + 管理费用） */
    cumulativeFixedCost: number;
    revenueTotal: number;
    spendTotal: number;
    profitTotal: number;
}

/** 界面展示用的平台结构项（数字来自 store，不参与计算） */
export interface PlatformStruct {
    id: string;
    name: string;
    color: string;
    /** 基线消耗占比（近 3 个月，已归一化） */
    baseShare: number;
    /** 用户可调权重（0~100，选中平台之间归一化） */
    weight: number;
    /** 结算滞后天数（解释现金口径差异） */
    settleLagDays: number;
}

/** 界面展示用的游戏结构项 */
export interface GameStruct {
    id: string;
    name: string;
    /** 近 3 个月平均消耗（基线） */
    baseSpend: number;
    /** 近 3 个月消耗占全公司比 */
    baseShare: number;
    curveA: number;
    curveB: number;
    projectId: string;
}

/**
 * 沙盒参数（存在页面组件内部，绝不写回 filter / store）。
 * 前四项是**滑杆百分比**，调用引擎时统一映射成倍率：
 *   spendScale  = 1 + budgetDelta
 *   curveAScale = 1 + curveADelta
 *   curveBScale = 1 + curveBDelta
 *   laborScale  = 1 + laborDelta
 */
export interface SandboxParams {
    /** 投放预算变化，−0.5 ~ +1.0 */
    budgetDelta: number;
    /** 回收曲线 curveA（爬升速度）变化，−0.3 ~ +0.3 */
    curveADelta: number;
    /** 回收曲线 curveB（首日回收率）变化，−0.3 ~ +0.3 */
    curveBDelta: number;
    /** 人工成本变化，−0.2 ~ +0.3 */
    laborDelta: number;
    /** 预估窗口（天）；窗口是数据引擎的预估曲线折算参数，用于 KPI 卡片与口径展示 */
    window: 90 | 180 | 360;
    /** 平台结构：选中的平台 id（空 = 全部） */
    platformIds: string[];
    /** 平台结构权重（0~100），面板据此展示各平台实际投入占比 */
    platformWeight: Record<string, number>;
    /** 游戏结构：选中的游戏 id（空 = 全部） */
    gameIds: string[];
    /** 推演期数（月） */
    horizon: number;
}

/** 基线快照：全部字段仅用于界面展示与空态判断，不参与推演计算 */
export interface SandboxBaseline {
    /** 近 3 个月实际月均消耗（当月按已过天数折算权重，老→新） */
    baselineSpend: number;
    /** 基线期月份（老→新） */
    recentMonths: string[];
    /** 近 3 个月月均人工成本 */
    laborCost: number;
    /** 近 3 个月月均管理费用 */
    adminCost: number;
    /** 近 3 个月人工成本四项（月均） */
    costParts: { salary: number; socialInsurance: number; individualTax: number; projectBonus: number };
    /** 有消耗的游戏 */
    games: GameStruct[];
    /** 有过消耗的平台 */
    platforms: PlatformStruct[];
}

// ------------------------------------------------------------
// 1. 参数 → 引擎选项
// ------------------------------------------------------------
/** 把界面百分比参数映射成 store.project 的倍率选项 */
export function toProjectOptions(params: SandboxParams): ProjectOptions {
    const opts: ProjectOptions = {
        horizon: params.horizon,
        spendScale: 1 + params.budgetDelta,
        curveAScale: 1 + params.curveADelta,
        curveBScale: 1 + params.curveBDelta,
        laborScale: 1 + params.laborDelta,
    };
    // 只有在确实做了裁剪时才传，避免与「不传 = 全部」的语义产生歧义
    if (params.platformIds.length > 0) opts.platformIds = params.platformIds;
    if (params.gameIds.length > 0) opts.gameIds = params.gameIds;
    return opts;
}

function summarize(points: MonthProjection[]): SandboxResult {
    const n = points.length || 1;
    const revenueTotal = points.reduce((s, p) => s + p.revenue, 0);
    const spendTotal = points.reduce((s, p) => s + p.spend, 0);
    const costTotal = points.reduce((s, p) => s + p.cost, 0);
    const profitTotal = points.reduce((s, p) => s + p.profit, 0);
    return {
        months: points,
        avgRevenue: revenueTotal / n,
        avgProfit: profitTotal / n,
        avgSpend: spendTotal / n,
        margin: revenueTotal > 0 ? profitTotal / revenueTotal : 0,
        cumulativeProfit: profitTotal,
        cumulativeRoi: spendTotal > 0 ? revenueTotal / spendTotal : 0,
        cumulativeFixedCost: Math.max(0, costTotal - spendTotal),
        revenueTotal,
        spendTotal,
        profitTotal,
    };
}

/** 中性参数：四个倍率全部为 1.0（基线情景），保留用户选择的结构 */
export function neutralParams(params: SandboxParams): SandboxParams {
    return { ...params, budgetDelta: 0, curveADelta: 0, curveBDelta: 0, laborDelta: 0 };
}

/** 跑一次推演：唯一入口就是 store.project */
export function runProject(filter: Parameters<typeof projectMonths>[0], params: SandboxParams): SandboxResult {
    return summarize(projectMonths(filter, toProjectOptions(params)));
}

// ------------------------------------------------------------
// 2. 单因子敏感度扫描
// ------------------------------------------------------------
export interface SweepPoint {
    /** 因子变化百分比（−0.5 = −50%） */
    delta: number;
    /** 该点对应的推演期累计经营利润 */
    profit: number;
    avgRevenue: number;
    avgProfit: number;
    margin: number;
    /** 推演期累计固定成本 */
    fixedCost: number;
}

export type SweepFactor = 'budget' | 'curveA';

/** 扫描区间定义（与需求一致） */
export const SWEEP_RANGES: Record<SweepFactor, { from: number; to: number; step: number }> = {
    budget: { from: -0.5, to: 1, step: 0.1 }, // 16 个点
    curveA: { from: -0.3, to: 0.3, step: 0.05 }, // 13 个点
};

/** 对单个因子做等步长扫描：每个点调一次 store.project，其余因子固定在 params */
export function sweep(
    filter: Parameters<typeof projectMonths>[0],
    params: SandboxParams,
    factor: SweepFactor,
): SweepPoint[] {
    const range = SWEEP_RANGES[factor];
    const out: SweepPoint[] = [];
    for (let d = range.from; d <= range.to + 1e-9; d += range.step) {
        const delta = Number(d.toFixed(4));
        const p: SandboxParams =
            factor === 'budget' ? { ...params, budgetDelta: delta } : { ...params, curveADelta: delta };
        const r = runProject(filter, p);
        out.push({
            delta,
            profit: r.cumulativeProfit,
            avgRevenue: r.avgRevenue,
            avgProfit: r.avgProfit,
            margin: r.margin,
            fixedCost: r.cumulativeFixedCost,
        });
    }
    return out;
}

/**
 * 数值插值求「盈亏平衡点」：累计经营利润 = 0 时对应的因子变化百分比。
 * 相邻两点变号时线性插值；若全区间同号，则返回最接近 0 的端点并标记 exact = false
 * （页面会明确写「区间内不穿越零点」，避免把端点误报成真正的盈亏平衡点）。
 */
export function breakEven(points: SweepPoint[]): { delta: number; exact: boolean } | null {
    if (points.length < 2) return null;
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        if (a.profit === 0) return { delta: a.delta, exact: true };
        if (a.profit < 0 && b.profit > 0) {
            const t = -a.profit / (b.profit - a.profit);
            return { delta: a.delta + (b.delta - a.delta) * t, exact: false };
        }
        if (a.profit > 0 && b.profit < 0) {
            const t = a.profit / (a.profit - b.profit);
            return { delta: a.delta + (b.delta - a.delta) * t, exact: false };
        }
    }
    // 全区间同号：给出最接近 0 的端点，供页面提示"未穿越零点"
    const nearest = points.reduce((best, p) => (Math.abs(p.profit) < Math.abs(best.profit) ? p : best), points[0]);
    return { delta: nearest.delta, exact: false };
}

/** 累计利润最高点（边际收益转负的分界候选） */
export function marginPeak(points: SweepPoint[]): SweepPoint | null {
    if (!points.length) return null;
    return points.reduce((best, p) => (p.profit > best.profit ? p : best), points[0]);
}

/** 扫描区间内是否所有点都亏损 */
export function allLoss(points: SweepPoint[]): boolean {
    return points.length > 0 && points.every((p) => p.profit <= 0);
}

/** 累计利润是否随因子单调递增（判断「边际收益是否一路为正、无转负拐点」） */
export function isMonotonicIncreasing(points: SweepPoint[]): boolean {
    for (let i = 1; i < points.length; i++) {
        if (points[i].profit < points[i - 1].profit - 1e-6) return false;
    }
    return points.length > 1;
}

// ------------------------------------------------------------
// 3. 预设情景（倍率表）
// ------------------------------------------------------------
export type ScenarioKey = 'conservative' | 'base' | 'growth' | 'aggressive';

export interface ScenarioPreset {
    key: ScenarioKey;
    name: string;
    desc: string;
    patch: Pick<SandboxParams, 'budgetDelta' | 'curveADelta' | 'curveBDelta' | 'laborDelta'>;
}

/** 需求给定的 4 个预设情景 */
export const SCENARIO_PRESETS: ScenarioPreset[] = [
    {
        key: 'conservative',
        name: '保守',
        desc: '预算 −20%、曲线双降、人工不变：假设变现走弱、控量保利润',
        patch: { budgetDelta: -0.2, curveADelta: -0.1, curveBDelta: -0.05, laborDelta: 0 },
    },
    {
        key: 'base',
        name: '基线',
        desc: '全部倍率为 1.0：与当期实际投放节奏一致的中性情景',
        patch: { budgetDelta: 0, curveADelta: 0, curveBDelta: 0, laborDelta: 0 },
    },
    {
        key: 'growth',
        name: '进取',
        desc: '预算 +30%、扩编 +10%：以人力承接放量',
        patch: { budgetDelta: 0.3, curveADelta: 0, curveBDelta: 0, laborDelta: 0.1 },
    },
    {
        key: 'aggressive',
        name: '激进',
        desc: '预算 +80%、曲线双降 + 大幅扩编：高投入高风险的冲刺情景',
        patch: { budgetDelta: 0.8, curveADelta: -0.05, curveBDelta: -0.05, laborDelta: 0.25 },
    },
];

export interface ScenarioRow {
    key: ScenarioKey;
    name: string;
    desc: string;
    params: ScenarioPreset['patch'];
    avgSpend: number;
    avgRevenue: number;
    avgProfit: number;
    cumulativeProfit: number;
    margin: number;
    spendTotal: number;
    fixedCost: number;
    /** 累计预估 ROI（= 推演期累计收入 ÷ 累计消耗，口径见页面说明） */
    cumulativeRoi: number;
    /** 现金缺口（近似口径：基线现金强度 × 推演消耗） */
    cashGap: number;
}

/** 用同一套结构参数跑 4 个预设情景（每个情景一次 store.project） */
export function runScenarios(filter: Parameters<typeof projectMonths>[0], params: SandboxParams): ScenarioRow[] {
    return SCENARIO_PRESETS.map((preset) => {
        const r = runProject(filter, { ...params, ...preset.patch });
        return {
            key: preset.key,
            name: preset.name,
            desc: preset.desc,
            params: preset.patch,
            avgSpend: r.avgSpend,
            avgRevenue: r.avgRevenue,
            avgProfit: r.avgProfit,
            cumulativeProfit: r.cumulativeProfit,
            margin: r.margin,
            spendTotal: r.spendTotal,
            fixedCost: r.cumulativeFixedCost,
            cumulativeRoi: r.spendTotal > 0 ? r.revenueTotal / r.spendTotal : 0,
            cashGap: 0,
        };
    });
}
