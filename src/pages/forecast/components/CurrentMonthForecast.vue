<template>
    <PanelCard title="当月实时预估">
        <PanelEmptyState v-if="!current" text="当前筛选条件下没有当月预估数据（请确认分析期间包含当月）" />

        <div v-else class="cmf">
            <!-- ============ 区块 1 · 当月进度条 ============ -->
            <section class="block">
                <div class="block__head">
                    <span class="block__title">当月经营进度</span>
                    <span class="block__note">{{ monthText }} · 已过 {{ store.daysElapsed }} 天 / 共 {{ store.daysInMonth }} 天</span>
                </div>

                <div class="bar">
                    <div class="bar__track">
                        <div class="bar__fill" :style="{ width: pct(timeProgress) }" />
                    </div>
                    <span
                        class="bar__pin bar__pin--time"
                        :style="{ left: pct(timeProgress) }"
                        :title="`时间进度 ${percent(timeProgress)}（已过 ${store.daysElapsed} 天）`"
                    />
                    <span
                        class="bar__pin bar__pin--profit"
                        :style="{ left: pct(profitCompletionPos) }"
                        :title="`经营利润完成度 ${percent(profitCompletion)}（已实现 ${money(realizedProfit)} / 全月预估 ${money(current.profit)}）`"
                    />
                </div>

                <div class="legend">
                    <span class="legend__item">
                        <i class="legend__swatch legend__swatch--fill" />
                        已过 {{ store.daysElapsed }} 天 · 时间进度 <b class="oa-num">{{ percent(timeProgress) }}</b>
                    </span>
                    <span class="legend__item">
                        <i class="legend__swatch legend__swatch--rest" />
                        剩余 {{ daysRemaining }} 天 · 外推区间 <b class="oa-num">{{ percent(1 - timeProgress) }}</b>
                    </span>
                    <span class="legend__item">
                        <i class="legend__swatch legend__swatch--profit" />
                        经营利润完成度 <b class="oa-num" :class="completionTone">{{ percent(profitCompletion) }}</b>
                    </span>
                    <span class="legend__item">
                        预算达成
                        <b class="oa-num">{{ budgetText }}</b>
                    </span>
                </div>
            </section>

            <!-- ============ 区块 2 · 当月预估结论卡 ============ -->
            <section class="cmf__cards">
                <MetricCard
                    label="当月预估经营利润"
                    :value="current.profit"
                    format="moneyAuto"
                    tone="operating"
                    :colored="true"
                    :hint="profitRangeHint"
                />
                <MetricCard
                    label="当月预估收入"
                    :value="current.revenue"
                    format="moneyAuto"
                    tone="revenue"
                    :hint="revenueHint"
                />
                <MetricCard
                    label="预估置信度"
                    :value="current.confidence"
                    format="percent"
                />
            </section>
        </div>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed, ref } from 'vue';
    import { store } from '@/domain/store';
    import type { AnalysisFilter, ForecastPoint } from '@/domain/types';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import MetricCard from '@/components/MetricCard.vue';
    import { changeText, money, monthLabel, percent, ratio, trendArrow, trendClass } from '@/utils/format';

    /**
     * 需求 3 · 当月实时预估（M8 核心）
     * 只聚焦「当月」一件事：当月时间进度 vs 利润完成度、当月预估结论、与上月对比、预估推导过程。
     * 全部取数来自 store.forecast / store.metricsOf，无 props，随全局筛选条件实时重算。
     */
    defineOptions({ name: 'ForecastCurrentMonth' });

    const { filter } = useAnalysisFilter();

    // ---------- 取数 ----------
    const points = computed<ForecastPoint[]>(() => store.forecast(filter, 6));
    /** 当月那一条（store.currentMonth，actual = false，属「实时预估」） */
    const current = computed<ForecastPoint | undefined>(() => points.value.find((p) => p.month === store.currentMonth));
    /** 最近一个已发生月份（当月之前的最后一个 actual 点） */
    const lastActual = computed<ForecastPoint | undefined>(() => [...points.value].reverse().find((p) => p.actual));

    /** 当月已实现指标：仅当月区间 + 公司口径，与引擎 buildForecast 的当月基准完全同口径 */
    const realized = computed(() => {
        const f: AnalysisFilter = { ...filter, startMonth: store.currentMonth, endMonth: store.currentMonth };
        return store.metricsOf(f, 'company', 'company');
    });

    const realizedRevenue = computed(() => realized.value?.accrualRevenue ?? 0);
    const realizedSpend = computed(() => realized.value?.spend ?? 0);
    const realizedLaborAdmin = computed(() => (realized.value ? realized.value.laborCost + realized.value.adminCost : 0));
    const realizedProfit = computed(() => realized.value?.operatingProfit ?? 0);
    const budgetText = computed(() => {
        const row = realized.value;
        if (!row || row.budgetProfit <= 0) return '—';
        return percent(row.operatingProfit / row.budgetProfit);
    });

    // ---------- 时间与进度 ----------
    const daysRemaining = computed(() => Math.max(0, store.daysInMonth - store.daysElapsed));
    /** 时间进度：已过天数 / 当月天数 */
    const timeProgress = computed(() => (store.daysInMonth > 0 ? store.daysElapsed / store.daysInMonth : 0));
    /** 经营利润完成度：本月已实现经营利润 / 本月预估经营利润 */
    const profitCompletion = computed(() => {
        const c = current.value;
        if (!c || !Number.isFinite(c.profit) || c.profit === 0) return 0;
        if (!Number.isFinite(realizedProfit.value)) return 0;
        return realizedProfit.value / c.profit;
    });
    const profitCompletionPos = computed(() => Math.min(1, Math.max(0, profitCompletion.value)));

    /** 月中完成度相对时间进度的形态：领先 / 常规（低于时间进度） / 当月尚未盈利 */
    const completionState = computed<'ahead' | 'normal' | 'loss'>(() => {
        const c = current.value;
        if (!c) return 'normal';
        if (!realized.value) return 'normal';
        if (realizedProfit.value < 0 || c.profit < 0) return 'loss';
        return profitCompletion.value >= timeProgress.value ? 'ahead' : 'normal';
    });

    const asOfDate = computed(() => `${store.currentMonth}-${String(store.daysElapsed).padStart(2, '0')}`);

    /** 完成度涨跌色：当月尚未盈利时不下「绿色=好」的判断，统一置中性灰 */
    const completionTone = computed(() => (completionState.value === 'loss' ? 'oa-flat' : trendClass(profitCompletion.value)));
    const monthText = computed(() => monthLabel(store.currentMonth));
    const subtitle = computed(
        () => `数据截至 ${asOfDate.value}（当月已过 ${store.daysElapsed}/${store.daysInMonth} 天）`,
    );

    // ---------- 区块 2 文案 ----------
    const profitRangeHint = computed(() =>
        current.value ? `悲观 ${money(current.value.pessimistic)} ~ 乐观 ${money(current.value.optimistic)}` : '',
    );
    const revenueHint = computed(() =>
        current.value ? `已实现 ${money(realizedRevenue.value)} + 预估补足 ${money(current.value.revenue - realizedRevenue.value)}` : '',
    );

    // ---------- 区块 3 环比 ----------
    /** 环比变化率（分母取绝对值，避免上月为负时符号反转） */
    function rate(cur: number | undefined, prev: number | undefined): number | null {
        if (cur === undefined || prev === undefined) return null;
        if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return null;
        return (cur - prev) / Math.abs(prev);
    }

    const profitChange = computed(() => rate(current.value?.profit, lastActual.value?.profit));
    const revenueChange = computed(() => rate(current.value?.revenue, lastActual.value?.revenue));
    const costChange = computed(() => rate(current.value?.cost, lastActual.value?.cost));

    const compareItems = computed(() => [
        { label: '经营利润', cur: current.value?.profit ?? 0, change: profitChange.value, invert: false },
        { label: '收入', cur: current.value?.revenue ?? 0, change: revenueChange.value, invert: false },
        { label: '总成本', cur: current.value?.cost ?? 0, change: costChange.value, invert: true },
    ]);

    /** 成本上升 = 负向，故用 trendClass(−change) 反向着色 */
    function chipClass(change: number | null, invert = false): string {
        if (change === null || !Number.isFinite(change)) return 'oa-flat';
        return invert ? trendClass(-change) : trendClass(change);
    }

    /** 变化率文案：复用 format.changeText，去掉正号以配合「增长 / 下降 X%」句式 */
    function rateWord(n: number | null): string {
        if (n === null || !Number.isFinite(n)) return '—';
        return changeText(Math.abs(n)).replace(/^\+/, '');
    }

    /** 结论句里变化率的涨跌色（无可比数据时为中性灰） */
    const profitChangeTone = computed(() => trendClass(profitChange.value ?? 0));

    const profitDirection = computed(() => {
        const n = profitChange.value;
        if (n === null || !Number.isFinite(n) || n === 0) return '持平';
        return n > 0 ? '增长' : '下降';
    });

    /** 主要驱动端：比较收入 / 成本的相对变化幅度绝对值 */
    const driverSide = computed(() => {
        const r = revenueChange.value;
        const c = costChange.value;
        if (r === null && c === null) return '收入端';
        if (r === null) return '成本端';
        if (c === null) return '收入端';
        return Math.abs(r) >= Math.abs(c) ? '收入端' : '成本端';
    });

    const revenueDriverText = computed(() =>
        revenueChange.value === null
            ? '收入端无可比口径'
            : `收入 ${changeText(revenueChange.value)}（${money(lastActual.value?.revenue ?? 0)} → ${money(current.value?.revenue ?? 0)}）`,
    );
    const costDriverText = computed(() =>
        costChange.value === null
            ? '成本端无可比口径'
            : `成本 ${changeText(costChange.value)}（${money(lastActual.value?.cost ?? 0)} → ${money(current.value?.cost ?? 0)}）`,
    );

    // ---------- 区块 4 推导 ----------
    const activePanels = ref<string[]>([]);

    /** 成本外推倍数：引擎对「已实现成本基准（消耗 + 人工 + 管理）」统一放大到全月。
     *  基准为 0（无投放期 / 纯成本中心）时返回 null —— 此时倍数不可计算，宁可显示「不可外推」也不写一个假的 1.00×。 */
    const costFactor = computed(() => {
        const base = realizedSpend.value + realizedLaborAdmin.value;
        const c = current.value;
        if (!c || base <= 0) return null;
        return c.cost / base;
    });
    /** 收入外推倍数：全月预估收入 ÷ 已实现应计收入（已实现收入为 0 时不可计算） */
    const revenueFactor = computed(() => {
        const c = current.value;
        if (!c || realizedRevenue.value <= 0) return null;
        return c.revenue / realizedRevenue.value;
    });

    interface DeriveRow {
        name: string;
        /** 已实现（当月已过天数） */
        realized: number;
        /** 预估补足（剩余天数外推增量） */
        extra: number;
        /** 全月预估 */
        full: number;
        /** 是否利润类行（需按正负着色） */
        profitLike?: boolean;
    }

    function rowOf(name: string, realizedVal: number, fullVal: number, profitLike = false): DeriveRow {
        return { name, realized: realizedVal, extra: fullVal - realizedVal, full: fullVal, profitLike };
    }

    const deriveRows = computed<DeriveRow[]>(() => {
        const c = current.value;
        if (!c) return [];
        // 外推倍数不可计算（基准为 0）时按 1 处理，仅用于「已实现 = 全月」的兜底展示；文案侧会显式说明不可外推
        const k = costFactor.value ?? 1;
        return [
            rowOf('应计确认收入', realizedRevenue.value, c.revenue),
            rowOf('投放消耗', realizedSpend.value, realizedSpend.value * k),
            rowOf('人工 + 管理费用（整月口径）', realizedLaborAdmin.value, realizedLaborAdmin.value * k),
            rowOf('经营利润', realizedProfit.value, c.profit, true),
        ];
    });

    const stepSpend = computed(() => deriveRows.value[1] ?? { extra: 0, full: 0, realized: 0, name: '' });
    const stepRevenue = computed(() => deriveRows.value[0] ?? { extra: 0, full: 0, realized: 0, name: '' });

    // ---------- 工具 ----------
    /** 百分比定位（0~1 → CSS 百分比，越界钳制）；仅用于 CSS 定位值，展示格式一律走 @/utils/format */
    function pct(v: number): string {
        const t = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
        return `${(t * 100).toFixed(2)}%`;
    }
</script>

<style scoped lang="scss">
    .cmf {
        display: grid;
        gap: var(--oa-gap);
        min-height: 0;
    }

    .block {
        min-height: 0;
    }

    .block__head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--oa-gap);
        margin-bottom: 8px;
    }

    .block__title {
        font-size: var(--oa-fs-sm);
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .block__note {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
    }

    // ---------- 区块 1 · 进度条 ----------
    .bar {
        position: relative;
        height: 36px;
        margin: 2px 8px 0;
    }

    .bar__track {
        position: absolute;
        left: 0;
        right: 0;
        top: 8px;
        height: 20px;
        border: 1px solid var(--oa-border);
        border-radius: var(--oa-radius-sm);
        overflow: hidden;
        // 剩余区间：条纹浅色，表示「尚未发生、由外推补足」
        background: repeating-linear-gradient(135deg, #eef1f7 0 6px, #f8fafe 6px 12px);
    }

    .bar__fill {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        background: var(--oa-primary);
        border-radius: var(--oa-radius-sm) 0 0 var(--oa-radius-sm);
        transition: width 0.3s ease;
    }

    .bar__pin {
        position: absolute;
        transform: translateX(-50%);
        pointer-events: none;
    }

    .bar__pin--time {
        top: 2px;
        height: 32px;
        width: 2px;
        background: rgba(31, 41, 55, 0.55);
        z-index: 3;
    }

    .bar__pin--profit {
        top: 23px;
        width: 10px;
        height: 10px;
        background: var(--oa-operating);
        border: 2px solid var(--oa-card);
        box-shadow: 0 0 0 1px var(--oa-operating);
        transform: translateX(-50%) rotate(45deg);
        z-index: 4;
    }

    .legend {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 18px;
        margin-top: 6px;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-3);

        b {
            color: var(--oa-text-1);
        }
    }

    .legend__item {
        display: inline-flex;
        align-items: center;
        gap: 5px;
    }

    .legend__swatch {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 2px;
        flex: 0 0 auto;

        &--fill {
            background: var(--oa-primary);
        }

        &--rest {
            background: repeating-linear-gradient(135deg, #eef1f7 0 3px, #f8fafe 3px 6px);
            border: 1px solid var(--oa-border);
        }

        &--profit {
            background: var(--oa-operating);
            transform: rotate(45deg);
        }
    }

    .insight {
        margin: 10px 0 0;
        padding: 8px 10px;
        border-radius: var(--oa-radius-sm);
        background: var(--oa-primary-soft);
        border-left: 3px solid var(--oa-primary);
        font-size: var(--oa-fs-xs);
        line-height: 1.7;
        color: var(--oa-text-2);

        b {
            color: var(--oa-text-1);
        }

        &--warn {
            background: var(--oa-warning-soft);
            border-left-color: var(--oa-warning);
        }
    }

    // ---------- 区块 2 · 结论卡 ----------
    .cmf__cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: var(--oa-gap);
        min-height: 0;
    }

    // ---------- 区块 3 · 环比 ----------
    .chips {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: var(--oa-gap);
    }

    .chip {
        display: flex;
        align-items: baseline;
        gap: 8px;
        padding: 8px 10px;
        border: 1px solid var(--oa-border-light);
        border-radius: var(--oa-radius-sm);
        background: var(--oa-hover);
        font-size: var(--oa-fs-xs);
        min-width: 0;
    }

    .chip__label {
        color: var(--oa-text-3);
        white-space: nowrap;
    }

    .chip__value {
        font-size: var(--oa-fs-lg);
        font-weight: 700;
        color: var(--oa-text-1);
        white-space: nowrap;
    }

    .chip__change {
        margin-left: auto;
        font-weight: 600;
        white-space: nowrap;
    }

    .conclusion {
        margin: 10px 0 0;
        font-size: var(--oa-fs-sm);
        line-height: 1.7;
        color: var(--oa-text-2);

        b {
            color: var(--oa-text-1);
            font-weight: 600;
        }
    }

    // ---------- 区块 4 · 推导 ----------
    .derive {
        border-top: 1px solid var(--oa-border-light);
        border-bottom: none;

        :deep(.el-collapse-item__header) {
            height: 38px;
            line-height: 38px;
            padding: 0 4px;
            font-size: var(--oa-fs-sm);
            color: var(--oa-text-1);
            border-bottom: none;
        }

        :deep(.el-collapse-item__wrap) {
            border-bottom: none;
        }

        :deep(.el-collapse-item__content) {
            padding: 4px 4px 0;
        }
    }

    .derive__title {
        font-weight: 600;
        margin-right: 10px;
    }

    .derive__sub {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
    }

    .steps {
        margin: 0 0 10px;
        padding-left: 20px;
        font-size: var(--oa-fs-xs);
        line-height: 1.9;
        color: var(--oa-text-2);

        b {
            color: var(--oa-text-1);
        }

        li + li {
            margin-top: 2px;
        }
    }

    .derive__table {
        width: 100%;
        font-size: var(--oa-fs-xs);
    }

    .derive__foot {
        margin: 8px 0 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.7;
        color: var(--oa-text-4);

        b {
            color: var(--oa-text-3);
        }
    }
</style>
