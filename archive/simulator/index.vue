<template>
    <div class="sim">
        <!-- 沙盒声明：本页不写回全局筛选与数据引擎 -->
        <div class="sim__notice">
            <span class="sim__notice-tag">沙盒</span>
            <span>
                本页为沙盒推演，参数与结果不影响其它页面。基线取自当前全局筛选范围（{{ filterRange }}，近 3 个月实际月均消耗
                {{ money(baselineSpend) }}），自 {{ nextMonthLabel }} 起向未来推演 {{ params.horizon }} 个月。
                <em class="sim__notice-em">
                    推演数字与「月度经营预估」页同源（同一套窗口卷积与季节系数），可用作 what-if 对照。
                </em>
            </span>
        </div>

        <PanelEmptyState v-if="isEmpty" :text="emptyText" class="sim__empty" />

        <div v-else class="sim__grid">
            <!-- 左栏：假设控制面板 -->
            <div class="sim__left">
                <AssumptionPanel
                    :params="params"
                    :platforms="baseline.platforms"
                    :games="baseline.games"
                    @reset="resetToBaseline"
                    @apply-filter="applyGlobalFilter"
                />

                <PanelCard title="基线口径" subtitle="推演所用的真实基线">
                    <ul class="sim__base-list">
                        <li>
                            <span>基线月均消耗</span><b class="oa-num">{{ money(baselineSpend) }}</b>
                        </li>
                        <li>
                            <span>基线月均人工成本</span><b class="oa-num">{{ money(baseline.laborCost) }}</b>
                        </li>
                        <li>
                            <span>基线月均管理费用</span><b class="oa-num">{{ money(baseline.adminCost) }}</b>
                        </li>
                        <li>
                            <span>基线期现金缺口</span>
                            <b class="oa-num">{{ money(baseCashGap) }}（期末，近似）</b>
                        </li>
                        <li>
                            <span>选中游戏加权曲线</span>
                            <b class="oa-num">
                                ROI(n) = {{ weightedCurve.a.toFixed(3) }}·ln n + {{ weightedCurve.b.toFixed(3) }}
                            </b>
                        </li>
                        <li>
                            <span>折算窗口 ROI({{ params.window }}d)</span>
                            <b class="oa-num">{{ ratio(curveWindowRoi) }} 倍</b>
                        </li>
                        <li>
                            <span>结构覆盖</span>
                            <b class="oa-num">
                                {{ params.platformIds.length }}/{{ baseline.platforms.length }} 平台 ·
                                {{ params.gameIds.length }}/{{ baseline.games.length }} 游戏
                            </b>
                        </li>
                        <li>
                            <span>基线期</span>
                            <b>{{ recentMonthLabels }}</b>
                        </li>
                        <li>
                            <span>加权结算滞后</span>
                            <b class="oa-num">{{ settleLag.toFixed(0) }} 天</b>
                        </li>
                        <li>
                            <span>人工成本四项（月均）</span>
                            <b class="oa-num">{{ laborPartsText }}</b>
                        </li>
                    </ul>
                    <p class="sim__base-note">
                        当月（{{ store.currentMonth }}）数据只过 {{ store.daysElapsed }}/{{ store.daysInMonth }} 天，上表月均值已按
                        {{ percent(currentWeight, 0) }} 权重折算以免拉低基线；引擎内部则统一按「最近 3 个完整月」取基线，与
                        <b>月度经营预估</b>页完全一致。曲线参数按每个游戏自己的 curveA/curveB 逐组合卷积，上表加权值仅供参考。
                    </p>
                </PanelCard>
            </div>

            <!-- 右栏：推演结果 -->
            <div class="sim__right">
                <!-- 区块 2：核心指标（基线值 → 推演值 → 变化率） -->
                <div class="sim__kpis">
                    <ScenarioKpiCard
                        label="月均应确认收入"
                        :value="result.avgRevenue"
                        :base="baseResult.avgRevenue"
                        format="moneyAuto"
                        tone="revenue"
                        hint="与「月度经营预估」页同一套窗口卷积口径"
                    />
                    <ScenarioKpiCard
                        label="月均经营利润"
                        :value="result.avgProfit"
                        :base="baseResult.avgProfit"
                        format="moneyAuto"
                        tone="operating"
                        colored
                        hint="应确认收入 − 投放消耗 − 人工 − 管理费用"
                    />
                    <ScenarioKpiCard
                        label="经营利润率"
                        :value="result.margin"
                        :base="baseResult.margin"
                        format="percent"
                        tone="operating"
                        colored
                        hint="推演期累计口径：累计经营利润 ÷ 累计应确认收入"
                    />
                    <ScenarioKpiCard
                        label="累计预估 ROI"
                        :value="result.cumulativeRoi"
                        :base="baseResult.cumulativeRoi"
                        format="ratio"
                        suffix="倍"
                        :hint="`推演期累计收入 ÷ 累计消耗（预估窗口 ${params.window} 天）`"
                    />
                    <ScenarioKpiCard
                        label="推演期累计经营利润"
                        :value="result.cumulativeProfit"
                        :base="baseResult.cumulativeProfit"
                        format="moneyAuto"
                        tone="gap"
                        colored
                        :hint="`${params.horizon} 个月合计 · 期末现金缺口约 ${money(cashGap)}（近似口径）`"
                        :badge="result.cumulativeProfit >= 0 ? '累计盈利' : '累计亏损'"
                        :badge-tone="result.cumulativeProfit >= 0 ? 'success' : 'danger'"
                    />
                </div>

                <!-- 区块 3：推演曲线 -->
                <InvestmentCurveChart :base="baseResult.months" :sim="result.months" />

                <!-- 区块 4：敏感度分析 -->
                <SensitivityChart
                    :budget-points="sensitivity.budgetPoints"
                    :curve-points="sensitivity.curvePoints"
                    :budget-break-even="sensitivity.budgetBreakEven"
                    :curve-break-even="sensitivity.curveBreakEven"
                    :budget-peak="sensitivity.budgetPeak"
                    :no-positive-solution="sensitivity.noPositiveSolution"
                    :conclusion="sensitivity.conclusion"
                />

                <!-- 区块 5：情景对比 -->
                <ScenarioTable :rows="scenarioRows" :active-key="activeScenario" @pick="pickScenario" />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { computed, reactive } from 'vue';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { roiAt, store } from '@/domain/store';
    import { GAME_MAP, PLATFORMS } from '@/domain/dimensions';
    import { money, monthLabel, percent, ratio } from '@/utils/format';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import AssumptionPanel from './components/AssumptionPanel.vue';
    import ScenarioKpiCard from './components/ScenarioKpiCard.vue';
    import InvestmentCurveChart from './components/InvestmentCurveChart.vue';
    import SensitivityChart from './components/SensitivityChart.vue';
    import ScenarioTable from './components/ScenarioTable.vue';
    import {
        SCENARIO_PRESETS,
        allLoss,
        breakEven,
        isMonotonicIncreasing,
        marginPeak,
        neutralParams,
        runProject,
        runScenarios,
        sweep,
        type GameStruct,
        type PlatformStruct,
        type SandboxBaseline,
        type SandboxParams,
        type ScenarioKey,
        type ScenarioRow,
        type SweepPoint,
    } from './components/simulatorEngine';

    /**
     * 经营推演模拟器（what-if 决策沙盒）
     *
     * 无 props：只从 useAnalysisFilter() 读取全局筛选作为「基线范围」，**绝不写回** filter。
     * 所有推演参数存放在本组件内部的 reactive(params)，推演结果全部在本页计算，
     * 不影响任何其它页面（其它页面读的是 store + 全局 filter，本页两者都不改）。
     */
    defineOptions({ name: 'SimulatorPage' });

    const { filter } = useAnalysisFilter();

    // ============================================================
    // 1. 基线快照（近 3 个月真实数据，只读）
    // ============================================================
    /** 当月不满月，按已过天数折算权重，避免把基线月均拉低 */
    const currentWeight = Math.max(0.2, store.daysElapsed / store.daysInMonth);

    const recentPoints = computed(() => store.queryMonthSeries(filter).slice(-3));
    /** 近 3 个月权重（老 → 新） */
    const recentWeights = computed(() =>
        recentPoints.value.map((_, i) => (i === recentPoints.value.length - 1 ? currentWeight : 1)),
    );

    function avg(xs: number[]): number {
        return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0;
    }

    /** 基线月均消耗：近 3 个月实际消耗按权重折算 */
    const baselineSpend = computed(() => {
        const pts = recentPoints.value;
        const ws = recentWeights.value;
        let num = 0;
        let den = 0;
        pts.forEach((p, i) => {
            num += p.metrics.spend * ws[i];
            den += ws[i];
        });
        return den > 0 ? num / den : 0;
    });

    const baselineLabor = computed(() => avg(recentPoints.value.map((p) => p.metrics.laborCost)));
    const baselineAdmin = computed(() => avg(recentPoints.value.map((p) => p.metrics.adminCost)));
    const baselineCostParts = computed(() => {
        const pts = recentPoints.value;
        const pick = (f: (m: (typeof pts)[number]['metrics']) => number) => avg(pts.map((p) => f(p.metrics)));
        return {
            salary: pick((m) => m.costByType.salary),
            socialInsurance: pick((m) => m.costByType.socialInsurance),
            individualTax: pick((m) => m.costByType.individualTax),
            projectBonus: pick((m) => m.costByType.projectBonus),
        };
    });

    /** 只取某一个月指标的小工具（平台 / 游戏基线按近 3 个月逐月取，再求平均） */
    function monthMetrics(month: string, dim: 'platform' | 'game', key: string): number {
        const m = store.metricsOf({ ...filter, startMonth: month, endMonth: month }, dim, key);
        return m?.spend ?? 0;
    }

    /** 平台结构：近 3 个月消耗占比（= 结构权重初值） */
    const platformShares = computed<PlatformStruct[]>(() => {
        const pts = recentPoints.value;
        const rows = PLATFORMS.map((p) => ({
            p,
            v: avg(pts.map((pt) => monthMetrics(pt.month, 'platform', p.id))),
        }));
        const total = rows.reduce((s, x) => s + x.v, 0);
        return rows.map((x) => ({
            id: x.p.id,
            name: x.p.name,
            color: x.p.color,
            baseShare: total > 0 ? x.v / total : 0,
            weight: total > 0 ? (x.v / total) * 100 : 100 / PLATFORMS.length,
            settleLagDays: x.p.settleLagDays,
        }));
    });

    /** 游戏结构：近 3 个月有消耗的游戏及其占比 */
    const gameShares = computed<GameStruct[]>(() => {
        const pts = recentPoints.value;
        const rows = [...GAME_MAP.values()].map((g) => ({
            g,
            v: avg(pts.map((pt) => monthMetrics(pt.month, 'game', g.id))),
        }));
        const total = rows.reduce((s, x) => s + x.v, 0);
        return rows
            .filter((x) => x.v > 0)
            .map((x) => ({
                id: x.g.id,
                name: x.g.name,
                baseSpend: x.v,
                baseShare: total > 0 ? x.v / total : 0,
                curveA: x.g.curveA,
                curveB: x.g.curveB,
                projectId: x.g.projectId,
            }))
            .sort((a, b) => b.baseSpend - a.baseSpend);
    });

    /**
     * 现金强度 = 推演期「预付超出消耗」+「应收未收」占消耗的比例，全部来自 store 真实数据：
     *   1) 预付系数：近 3 个月 实际充值 ÷ 实际消耗（实测 ≈1.16，即充值比消耗高约 16%）
     *   2) 应收未收占比：该月之后剩余的回收 = 1 − ROI(30 天代表龄) ÷ ROI(窗口)
     * 于是 期末现金缺口 ≈ 实际现金缺口 ×(预算倍率) + 推演期消耗 × 现金强度。
     */
    const cashGapPerSpend = computed(() => {
        const pts = recentPoints.value;
        const spend = pts.reduce((s, p) => s + p.metrics.spend, 0);
        if (spend <= 0) return 0;
        const prepayRatio = pts.reduce((s, p) => s + p.metrics.prepay, 0) / spend;
        const a = weightedCurve.value.a * (1 + params.curveADelta);
        const b = Math.max(0, weightedCurve.value.b * (1 + params.curveBDelta));
        const full = roiAt(params.window, a, b);
        const recoveredShare = full > 0 ? Math.min(1, roiAt(30, a, b) / full) : 1;
        return Math.max(0, prepayRatio - (1 - recoveredShare));
    });

    /** 当期实际现金缺口水平（近 3 个月月均），代表「不受预算变化影响的存量部分」 */
    const actualCashGap = computed(() => {
        const pts = recentPoints.value;
        return pts.length ? pts.reduce((s, p) => s + p.metrics.cashGap, 0) / pts.length : 0;
    });

    /**
     * 基线情景（中性参数）的期末现金缺口：
     * 存量部分按预算倍率等比放大，增量部分 = 推演期消耗 × 现金强度。
     */
    const baseCashGap = computed(
        () => actualCashGap.value * (1 + params.budgetDelta) + baseResult.value.spendTotal * cashGapPerSpend.value,
    );

    // ============================================================
    // 2. 沙盒参数（组件内部，绝不写回 filter / store）
    // ============================================================
    const SANDBOX_DEFAULTS = {
        budgetDelta: 0,
        curveADelta: 0,
        curveBDelta: 0,
        window: 360 as 90 | 180 | 360,
        laborDelta: 0,
        horizon: 6,
    };

    const params = reactive<SandboxParams>({
        ...SANDBOX_DEFAULTS,
        platformIds: PLATFORMS.map((p) => p.id),
        platformWeight: {},
        gameIds: [],
    });

    const baseline = reactive<SandboxBaseline>({
        baselineSpend: 0,
        recentMonths: [],
        costParts: { salary: 0, socialInsurance: 0, individualTax: 0, projectBonus: 0 },
        laborCost: 0,
        adminCost: 0,
        games: [],
        platforms: [],
    });

    /** 把 store 的真实基线写进沙盒快照；keepParams=false 时同时把结构参数重置为「当前真实结构」 */
    function syncBaseline(keepParams: boolean) {
        baseline.baselineSpend = baselineSpend.value;
        baseline.recentMonths = recentPoints.value.map((p) => p.month);
        baseline.costParts = baselineCostParts.value;
        baseline.laborCost = baselineLabor.value;
        baseline.adminCost = baselineAdmin.value;
        baseline.games = gameShares.value;
        baseline.platforms = platformShares.value;
        if (keepParams) return;
        params.platformWeight = Object.fromEntries(
            baseline.platforms.map((p) => [p.id, Math.round(p.baseShare * 100)]),
        );
        params.platformIds = baseline.platforms.map((p) => p.id);
        /*
         * 默认游戏结构 = 当前有消耗的全部游戏。
         * 刻意不截断成 8 个：引擎的固定成本（人工 + 管理费用）不随游戏选择缩放，
         * 只投部分游戏会人为压低收入、却保留全部固定成本，使默认视图与
         * 「月度经营预估」页（覆盖全部投放组合）出现十几个百分点的口径差。
         * 选择器仍保留 8 个上限作为操作护栏。
         */
        params.gameIds = baseline.games.map((g) => g.id);
    }

    function resetToBaseline() {
        Object.assign(params, { ...SANDBOX_DEFAULTS });
        syncBaseline(false);
    }

    /** 把全局筛选的组织 / 平台 / 游戏范围读进来作为沙盒初始结构（只读 filter） */
    function applyGlobalFilter() {
        if (filter.platformIds.length) {
            params.platformIds = PLATFORMS.filter((p) => filter.platformIds.includes(p.id)).map((p) => p.id);
        }
        if (filter.gameIds.length) {
            params.gameIds = filter.gameIds.filter((id) => baseline.games.some((g) => g.id === id)).slice(0, 8);
        } else {
            const projectIds = new Set(filter.projectIds);
            const scoped = projectIds.size
                ? baseline.games.filter((g) => projectIds.has(g.projectId))
                : baseline.games;
            params.gameIds = scoped.slice(0, 8).map((g) => g.id);
        }
    }

    /*
     * 同步调用而不是放进 onMounted：
     * onMounted 只在客户端执行，会让首屏先渲染一帧「未选择任何游戏」空态再跳成正常内容（闪屏），
     * 也让服务端渲染（SSR 冒烟测试）拿不到初始结构。这里在 setup 阶段就完成初始化，
     * 客户端与服务端行为一致。
     */
    syncBaseline(false);

    // ============================================================
    // 3. 推演计算（全部数字来自 store.project，与 buildForecast 同源）
    // ============================================================
    /** 基线情景：结构与用户一致，但四个倍率参数全部归零（= 引擎的中性参数） */
    const neutral = computed<SandboxParams>(() => neutralParams(params));

    const result = computed(() => runProject(filter, params));
    const baseResult = computed(() => runProject(filter, neutral.value));
    /** 推演月份取引擎返回值（**不用页面自己外推的月份**，保证与预估页同源） */
    const horizonMonths = computed(() => result.value.months);

    /** 当前参数命中的预设情景（手动调参时为 null） */
    const activeScenario = computed<ScenarioKey | null>(() => {
        const hit = SCENARIO_PRESETS.find(
            (p) =>
                Math.abs(p.patch.budgetDelta - params.budgetDelta) < 1e-6 &&
                Math.abs(p.patch.curveADelta - params.curveADelta) < 1e-6 &&
                Math.abs(p.patch.curveBDelta - params.curveBDelta) < 1e-6 &&
                Math.abs(p.patch.laborDelta - params.laborDelta) < 1e-6,
        );
        return hit ? hit.key : null;
    });

    /**
     * 情景对比表：4 个预设情景各跑一次 store.project（每个情景一次引擎调用）。
     * 现金缺口 = 实际现金缺口 ×消耗放大倍数 + 推演期消耗 ×现金强度（系数均来自 store，见 cashGapPerSpend）。
     */
    const scenarioRows = computed<ScenarioRow[]>(() =>
        runScenarios(filter, params).map((r) => ({
            ...r,
            cashGap: cashGapOf(r.spendTotal),
        })),
    );

    /** 推演期消耗 → 期末现金缺口（近似口径，系数来自 store 真实数据） */
    function cashGapOf(spendTotal: number): number {
        const basePeriodSpend = baseline.baselineSpend * Math.max(1, params.horizon);
        const scale = basePeriodSpend > 0 ? Math.min(2, Math.max(0, spendTotal / basePeriodSpend)) : 1;
        return actualCashGap.value * scale + spendTotal * cashGapPerSpend.value;
    }

    /** 当前推演情景的期末现金缺口 */
    const cashGap = computed(() => cashGapOf(result.value.spendTotal));

    function pickScenario(key: ScenarioKey) {
        const preset = SCENARIO_PRESETS.find((p) => p.key === key);
        if (preset) Object.assign(params, preset.patch);
    }

    /** 展示用：选中游戏的加权曲线参数（说明「引擎按各游戏自己的曲线卷积」） */
    const weightedCurve = computed(() => {
        const sel = new Set(params.gameIds);
        const games = baseline.games.filter((g) => sel.has(g.id));
        const w = games.reduce((s, g) => s + g.baseSpend, 0);
        if (w <= 0) return { a: 0, b: 0 };
        return {
            a: games.reduce((s, g) => s + g.baseSpend * g.curveA, 0) / w,
            b: games.reduce((s, g) => s + g.baseSpend * g.curveB, 0) / w,
        };
    });

    /** 展示用：当前 curveA/curveB 倍率下、按窗口折算的累计回收倍数 */
    const curveWindowRoi = computed(() =>
        roiAt(
            params.window,
            weightedCurve.value.a * (1 + params.curveADelta),
            Math.max(0, weightedCurve.value.b * (1 + params.curveBDelta)),
        ),
    );

    /** 选中平台按归一化权重加权后的结算滞后天数（解释平台结构对现金口径的影响） */
    const settleLag = computed(() => {
        const sel = baseline.platforms.filter((p) => params.platformIds.includes(p.id));
        const total = sel.reduce((s, p) => s + Math.max(0, params.platformWeight[p.id] ?? 0), 0);
        if (total <= 0) return 0;
        return sel.reduce((s, p) => s + p.settleLagDays * (Math.max(0, params.platformWeight[p.id] ?? 0) / total), 0);
    });

    // ============================================================
    // 4. 敏感度分析（单因子扫描：预算 16 点 + curveA 13 点 = 29 次 store.project）
    // ============================================================
    const sensitivity = computed(() => {
        const budgetPoints = sweep(filter, params, 'budget');
        const curvePoints = sweep(filter, params, 'curveA');
        const budgetBreakEven = breakEven(budgetPoints);
        const curveBreakEven = breakEven(curvePoints);
        const budgetPeak = marginPeak(budgetPoints);
        const curvePeak = marginPeak(curvePoints);
        return {
            budgetPoints,
            curvePoints,
            budgetBreakEven,
            curveBreakEven,
            budgetPeak,
            curvePeak,
            budgetMonotonic: isMonotonicIncreasing(budgetPoints),
            curveMonotonic: isMonotonicIncreasing(curvePoints),
            noPositiveSolution: allLoss(budgetPoints) && allLoss(curvePoints),
            conclusion: buildConclusion(
                budgetPoints,
                budgetBreakEven,
                budgetPeak,
                curvePoints,
                curveBreakEven,
                curvePeak,
                isMonotonicIncreasing(budgetPoints),
                isMonotonicIncreasing(curvePoints),
            ),
        };
    });

    /** 取扫描点中最接近给定变化的点 */
    function at(points: SweepPoint[], delta: number): SweepPoint | null {
        if (!points.length) return null;
        return points.reduce((best, p) => (Math.abs(p.delta - delta) < Math.abs(best.delta - delta) ? p : best), points[0]);
    }

    function pct(delta: number, digits = 1): string {
        return `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(digits)}%`;
    }

    /**
     * 结论文本完全由本次扫描结果生成（29 次 store.project 的真实输出），没有任何写死的数字与结论。
     * 三种情形分开表述：区间内变号（真盈亏平衡点）/ 全区间同号（不会穿越零点）/ 存在峰值（边际收益转负）。
     */
    function buildConclusion(
        budgetPoints: SweepPoint[],
        budgetBe: { delta: number; exact: boolean } | null,
        budgetPeak: SweepPoint | null,
        curvePoints: SweepPoint[],
        curveBe: { delta: number; exact: boolean } | null,
        curvePeak: SweepPoint | null,
        budgetMonotonic: boolean,
        curveMonotonic: boolean,
    ): string {
        if (!budgetPoints.length) return '暂无可用推演区间，无法给出敏感度结论。';
        const parts: string[] = [];
        const zero = at(budgetPoints, 0);
        const plus20 = at(budgetPoints, 0.2);
        const budgetAllPositive = budgetPoints.every((p) => p.profit > 0);
        const curveAllPositive = curvePoints.every((p) => p.profit > 0);

        if (zero && plus20) {
            const rate = Math.abs(zero.profit) > 1 ? (plus20.profit - zero.profit) / Math.abs(zero.profit) : 0;
            const up = plus20.profit >= zero.profit;
            parts.push(
                `投放预算增加 20% 时，${params.horizon} 个月累计经营利润从 ${money(zero.profit)} ${
                    up ? '提升' : '下降'
                }到 ${money(plus20.profit)}（${pct(rate)}），边际收益${up ? '为正' : '已转负'}`,
            );
        }

        // 预算：区分"有峰值（边际收益转负）"与"单调（边际收益一路为正）"
        if (budgetMonotonic && budgetPeak) {
            parts.push(
                `预算 −50% ~ +100% 全区间累计利润单调递增（${money(budgetPoints[0].profit)} → ${money(
                    budgetPoints[budgetPoints.length - 1].profit,
                )}），未见边际收益转负拐点，峰值出现在区间右端 ${pct(budgetPeak.delta, 0)}`,
            );
        } else if (budgetPeak) {
            parts.push(
                `扫描区间内累计利润在预算 ${pct(budgetPeak.delta, 0)} 处达到峰值 ${money(
                    budgetPeak.profit,
                )}，超过该点后边际收益转负`,
            );
        }

        if (budgetBe && budgetBe.exact) {
            parts.push(`预算变化的盈亏平衡点恰在 ${pct(budgetBe.delta)}`);
        } else if (budgetAllPositive) {
            parts.push(`预算 −50% 时累计利润仍为正（最低点 ${money(at(budgetPoints, -0.5)?.profit ?? 0)}），全区间不穿越盈亏平衡点`);
        } else if (budgetBe) {
            parts.push(
                `预算变化的盈亏平衡点为 ${pct(budgetBe.delta)}（由相邻两点线性插值得出），低于该点累计经营利润转负`,
            );
        }

        // curveA
        const curveZero = at(curvePoints, 0);
        if (curveBe && !curveAllPositive && curveZero && curveZero.profit > 0) {
            parts.push(
                `回收曲线 curveA 的盈亏平衡点在 ${pct(curveBe.delta)}（当前 0% 处累计利润 ${money(
                    curveZero.profit,
                )}；下调到该点以下将转为亏损）`,
            );
        } else if (curveAllPositive) {
            parts.push(
                `curveA 即使下调到 −30% 累计利润仍为正（${money(curvePoints[0].profit)}），全区间不穿越盈亏平衡点`,
            );
        } else if (curvePeak) {
            parts.push(
                `curveA 扫描区间内峰值在 ${pct(curvePeak.delta, 0)}（${money(curvePeak.profit)}）${
                    curveMonotonic ? '，且单调递增' : ''
                }`,
            );
        }

        // 两个因子的相对影响力（用区间跨度实测比较）
        const budgetSpan = Math.abs(budgetPoints[budgetPoints.length - 1].profit - budgetPoints[0].profit);
        const curveSpan = Math.abs(curvePoints[curvePoints.length - 1].profit - curvePoints[0].profit);
        const stronger = curveSpan >= budgetSpan ? 'curveA' : '投放预算';
        parts.push(
            `从区间跨度看，${stronger} 是更强的杠杆：预算区间累计利润跨度 ${money(budgetSpan)}，curveA 区间跨度 ${money(
                curveSpan,
            )}`,
        );

        parts.push(
            `其余假设固定在当前面板取值：窗口 ${params.window} 天、人工 ${pct(params.laborDelta, 0)}、${
                params.platformIds.length
            } 个平台 / ${params.gameIds.length} 个游戏、推演 ${params.horizon} 个月`,
        );
        return `${parts.join('；')}。`;
    }

    // ============================================================
    // 5. 文案与空态
    // ============================================================
    const filterRange = computed(() => `${filter.startMonth} ~ ${filter.endMonth}`);
    /** 推演起始月：取引擎返回的第一个推演月（与预估页同源），无数据时退回当月 */
    const nextMonthLabel = computed(() =>
        monthLabel(horizonMonths.value[0]?.month ?? store.currentMonth),
    );
    const recentMonthLabels = computed(() => recentPoints.value.map((p) => monthLabel(p.month)).join('、'));

    /** 人工成本四项（月均，仅用于口径展示） */
    const laborPartsText = computed(() => {
        const c = baseline.costParts;
        const wan = (v: number) => (v / 1e4).toFixed(1);
        return `工资 ${wan(c.salary)} / 社保 ${wan(c.socialInsurance)} / 个税 ${wan(c.individualTax)} / 奖金 ${wan(
            c.projectBonus,
        )} 万`;
    });

    /** 空态兜底：无基线消耗、或结构把投放清零、或引擎没有返回推演月 */
    const isEmpty = computed(
        () => baselineSpend.value <= 0 || !params.gameIds.length || !params.platformIds.length || !horizonMonths.value.length,
    );
    const emptyText = computed(() => {
        if (baselineSpend.value <= 0) return '当前筛选条件下近 3 个月无投放消耗，暂无可推演的基线';
        if (!params.platformIds.length) return '未选择任何平台，无投放可推演，请重置为基线';
        if (!params.gameIds.length) return '未选择任何游戏，无投放可推演，请重置为基线';
        return '当前筛选范围内没有可推演的投放组合，请调整结构或重置为基线';
    });
</script>

<style scoped lang="scss">
    .sim {
        display: flex;
        flex-direction: column;
        gap: var(--oa-gap);
        min-height: 0;
    }

    .sim__notice {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 12px;
        background: var(--oa-primary-soft);
        border: 1px solid #d6e6ff;
        border-radius: var(--oa-radius);
        font-size: var(--oa-fs-xs);
        line-height: 1.6;
        color: var(--oa-text-2);
    }

    .sim__notice-tag {
        flex: 0 0 auto;
        padding: 1px 7px;
        border-radius: 8px;
        background: var(--oa-primary);
        color: #fff;
        font-size: 11px;
        font-weight: 600;
    }

    .sim__notice-em {
        font-style: normal;
        color: var(--oa-text-3);
    }

    .sim__empty {
        min-height: 240px;
        background: var(--oa-card);
        border: 1px solid var(--oa-border);
        border-radius: var(--oa-radius);
    }

    .sim__grid {
        display: grid;
        grid-template-columns: 340px 1fr;
        gap: var(--oa-gap);
        align-items: start;
        min-height: 0;
    }

    .sim__left {
        display: flex;
        flex-direction: column;
        gap: var(--oa-gap);
        min-width: 0;
        min-height: 0;
    }

    .sim__right {
        display: flex;
        flex-direction: column;
        gap: var(--oa-gap);
        min-width: 0;
        min-height: 0;
    }

    .sim__kpis {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: var(--oa-gap);
    }

    .sim__base-list {
        margin: 0;
        padding: 0;
        list-style: none;

        li {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 8px;
            padding: 4px 0;
            border-bottom: 1px dashed var(--oa-border-light);
            font-size: var(--oa-fs-xs);

            &:last-child {
                border-bottom: 0;
            }
        }

        span {
            flex: 0 0 auto;
            color: var(--oa-text-4);
            white-space: nowrap;
        }

        b {
            color: var(--oa-text-1);
            font-weight: 600;
            text-align: right;
        }
    }

    .sim__base-note {
        margin: 6px 0 0;
        font-size: 11px;
        line-height: 1.6;
        color: var(--oa-text-4);
    }

    @media (max-width: 1280px) {
        .sim__grid {
            grid-template-columns: 1fr;
        }

        .sim__kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
    }

    @media (max-width: 720px) {
        .sim__kpis {
            grid-template-columns: 1fr;
        }
    }
</style>
