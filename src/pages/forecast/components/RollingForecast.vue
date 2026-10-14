<template>
    <PanelCard title="未来滚动预估" subtitle="中性 / 乐观 / 悲观三档情景">
        <template #actions>
            <el-tag size="small" type="info" effect="plain" disable-transitions>口径：{{ profitLabel }}</el-tag>
        </template>

        <div v-if="!hasData" class="rf__empty">
            <PanelEmptyState text="当前筛选条件下暂无滚动预估数据" />
        </div>

        <div v-else class="rf">
            <!-- ① 主图：实际 + 预估拼接曲线 -->
            <section class="rf__blk">
                <header class="rf__blk-head">
                    <h4 class="rf__blk-title">实际 + 预估拼接曲线</h4>
                    <span class="rf__blk-hint">
                        实线 + 圆点 = 已发生实际值｜虚线 = 预估值（自最后一个实际月开始连接，不断开）
                    </span>
                </header>
                <EChart :option="mainOption" style="height: 320px" />
                <p v-if="timelineGap" class="rf__warn">
                    ⚠ 筛选区间内的已发生月份与预估月份之间存在时间断层（曲线跨越了未纳入的月份），仅作趋势参考。
                </p>
                <p v-if="futureCount === 0" class="rf__note">
                    ⓘ 数据源的月份日历只到 {{ store.currentMonth }}，预估引擎未返回当月之后的月份，因此「未来滚动」区间暂为空，
                    预估期仅含当月预估；待数据推进 / 引擎补齐未来月份后，本区会自动展开未来 N 个月。
                </p>
            </section>

            <!-- ② 置信度衰减 -->
            <section class="rf__blk">
                <header class="rf__blk-head">
                    <h4 class="rf__blk-title">预估置信度衰减</h4>
                    <span class="rf__blk-hint">随预测期拉长，置信度按 6%/月 递减，最低 42%</span>
                </header>
                <EChart v-if="forecastPoints.length" :option="confidenceOption" style="height: 200px" />
                <PanelEmptyState v-else text="当前筛选条件下没有预估月份" />
            </section>

            <!-- ③ 滚动预估明细 -->
            <section class="rf__blk">
                <header class="rf__blk-head">
                    <h4 class="rf__blk-title">滚动预估明细</h4>
                    <span class="rf__blk-hint">
                        表尾按预估月份合计（{{ periodText }}）；实际月份灰色标注，三档情景 / 置信度只对预估月份有意义
                    </span>
                </header>

                <el-table
                    class="rf__table"
                    :data="points"
                    size="small"
                    :max-height="420"
                    show-summary
                    :summary-method="summaryMethod"
                    show-overflow-tooltip
                >
                    <el-table-column prop="month" label="月份" width="142" fixed>
                        <template #default="{ row }">
                            <div class="mcell">
                                <span class="mcell__txt oa-num">{{ row.label }}</span>
                                <el-tag v-if="!row.actual" size="small" type="warning" effect="plain" disable-transitions>
                                    预估
                                </el-tag>
                                <span v-else class="mcell__actual">实际</span>
                            </div>
                        </template>
                    </el-table-column>

                    <el-table-column prop="revenue" :label="revenueLabel" min-width="126" align="right">
                        <template #default="{ row }">
                            <span class="oa-num">{{ money(row.revenue) }}</span>
                        </template>
                    </el-table-column>

                    <el-table-column prop="cost" label="总成本" min-width="118" align="right">
                        <template #default="{ row }">
                            <span class="oa-num">{{ money(row.cost) }}</span>
                        </template>
                    </el-table-column>

                    <el-table-column prop="profit" :label="profitLabel" min-width="132" align="right">
                        <template #default="{ row }">
                            <span class="oa-num cell--strong" :class="trendClass(row.profit)">{{ money(row.profit) }}</span>
                        </template>
                    </el-table-column>

                    <el-table-column prop="margin" label="利润率" min-width="104" align="right">
                        <template #default="{ row }">
                            <span
                                class="oa-num"
                                :class="trendClass(row.revenue > 0 ? row.profit / row.revenue : 0)"
                            >
                                {{ row.revenue > 0 ? percent(row.profit / row.revenue) : '—' }}
                            </span>
                        </template>
                    </el-table-column>

                    <el-table-column prop="pessimistic" label="悲观" min-width="118" align="right">
                        <template #default="{ row }">
                            <span v-if="row.actual" class="oa-num cell--actual" title="已发生月份无情景区间，此处等于实际值">
                                {{ money(row.pessimistic) }}
                            </span>
                            <span v-else class="oa-num cell--pess" :title="flipHint(row)">
                                {{ money(row.pessimistic) }}<span v-if="flipHint(row)" class="cell__flip">⚠</span>
                            </span>
                        </template>
                    </el-table-column>

                    <el-table-column prop="optimistic" label="乐观" min-width="118" align="right">
                        <template #default="{ row }">
                            <span v-if="row.actual" class="oa-num cell--actual" title="已发生月份无情景区间，此处等于实际值">
                                {{ money(row.optimistic) }}
                            </span>
                            <span v-else class="oa-num cell--opt" :title="flipHint(row)">
                                {{ money(row.optimistic) }}<span v-if="flipHint(row)" class="cell__flip">⚠</span>
                            </span>
                        </template>
                    </el-table-column>

                    <el-table-column prop="confidence" label="置信度" min-width="156">
                        <template #default="{ row }">
                            <div class="conf">
                                <el-progress
                                    class="conf__bar"
                                    :percentage="Math.round(row.confidence * 100)"
                                    :stroke-width="6"
                                    :show-text="false"
                                    :color="confidenceColor(row.confidence)"
                                />
                                <span class="oa-num conf__txt" :class="{ 'cell--actual': row.actual }">
                                    {{ percent(row.confidence) }}
                                </span>
                            </div>
                        </template>
                    </el-table-column>
                </el-table>
            </section>

            <!-- ④ 预估期合计结论 -->
            <section class="rf__blk">
                <header class="rf__blk-head">
                    <h4 class="rf__blk-title">预估期合计结论</h4>
                    <span class="rf__blk-hint">区间 = 悲观 ~ 乐观｜{{ periodText }}｜置信度按月份等权平均</span>
                </header>

                <div class="rf__kpis">
                    <!-- 三档情景并排 -->
                    <div class="scen">
                        <div class="scen__label">预估期合计{{ profitLabel }}</div>
                        <div class="scen__row">
                            <div class="scen__cell scen__cell--pess">
                                <span class="scen__k">悲观</span>
                                <b class="scen__v oa-num">{{ money(totals.pessimistic) }}</b>
                            </div>
                            <div class="scen__cell scen__cell--mid">
                                <span class="scen__k">中性</span>
                                <b class="scen__v oa-num" :class="trendClass(totals.profit)">{{ money(totals.profit) }}</b>
                            </div>
                            <div class="scen__cell scen__cell--opt">
                                <span class="scen__k">乐观</span>
                                <b class="scen__v oa-num">{{ money(totals.optimistic) }}</b>
                            </div>
                        </div>
                        <div class="scen__foot">区间 {{ money(bandLow) }} ~ {{ money(bandHigh) }}</div>
                    </div>

                    <MetricCard
                        :label="`预估期${revenueLabel}合计`"
                        :value="totals.revenue"
                        tone="revenue"
                        :hint="periodText"
                    />

                    <MetricCard
                        label="当前累计现金缺口（起点）"
                        :value="cashGap"
                        tone="warn"
                        hint="预付余额 + 应收未收 · 时点值，不作未来余额外推"
                    />
                </div>

                <p v-if="scenarioInverted" class="rf__warn">
                    ⚠ 预估期合计区间上下界倒挂：预估月利润为负时，引擎给出的乐观 / 悲观两端方向相反，
                    三档值按字段原样展示，区间请按数值大小解读（{{ money(bandLow) }} ~ {{ money(bandHigh) }}）。
                </p>

                <p class="rf__conclusion">
                    <span class="rf__conclusion-badge">结论</span>
                    <span class="rf__conclusion-text">
                        预估期（{{ periodText }}）中性预估合计{{ profitLabel }}
                        <b class="oa-num">{{ money(totals.profit) }}</b>
                        （区间 {{ money(bandLow) }} ~ {{ money(bandHigh) }}）<template v-if="compare">，较最近
                        {{ compare.months }} 个月实际 <b class="oa-num">{{ money(compare.actual) }}</b>
                        <template v-if="compare.delta !== null">
                            <b class="oa-num" :class="trendClass(compare.delta)">
                                {{ trendArrow(compare.delta) }}{{ changeText(compare.delta) }}
                            </b>
                        </template>
                        <template v-else>（基期利润为 0，无法计算变化率）</template>。</template><template v-else
                            >；当前筛选区间内没有已发生的实际月份，暂无对比基期。</template
                        >
                    </span>
                </p>
            </section>
        </div>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import type { EChartsOption } from 'echarts';

    import { store } from '@/domain/store';
    import type { ForecastPoint } from '@/domain/types';
    import { basisLabel, useAnalysisFilter } from '@/composables/useAnalysisFilter';

    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import MetricCard from '@/components/MetricCard.vue';
    import EChart from '@/components/EChart.vue';

    import { changeText, money, monthLabel, percent, trendArrow, trendClass } from '@/utils/format';

    defineOptions({ name: 'ForecastRollingForecast' });

    /**
     * 未来滚动预估 + 三档情景（M8）
     * 数据全部来自 store.forecast(filter, 6)：实际月份 + 当月预估 + 未来 6 个月。
     */
    const { filter } = useAnalysisFilter();

    /**
     * ECharts 画在 canvas 上，`ctx.fillStyle = 'var(--oa-x)'` 是无效颜色（浏览器会忽略），
     * 所以图表内部的颜色必须用设计令牌的字面值；DOM / scoped 样式仍统一用 var(--oa-*)。
     * 取值与 src/styles/theme.scss 一致，改令牌需同步这里。
     */
    const C = {
        operating: '#12b566', // var(--oa-operating)
        revenue: '#8b5cf6', // var(--oa-revenue)
        optimistic: '#8fd6ae', // 乐观情景（任务指定）
        pessimistic: '#ffb0b0', // 悲观情景（任务指定）
        axisLine: '#e2e8f0',
        axisText: '#94a3b8',
        splitLine: '#f1f5f9',
        legendText: '#64748b',
        gridLineWarm: '#cbd5e1',
    };

    /** 区间带系列（不进图例、不参与 tooltip） */
    const BAND_BASE = '__rfBandBase';
    const BAND_SPAN = '__rfBandSpan';
    const BAND_NAMES = [BAND_BASE, BAND_SPAN];

    // ---------- 数据 ----------
    const points = computed<ForecastPoint[]>(() => store.forecast(filter, 6));

    const hasData = computed(() => points.value.length > 0);

    /** 实际 / 预估的分界：最后一个实际月份的下标（无实际月份时为 -1） */
    const splitIdx = computed(() => {
        let idx = -1;
        points.value.forEach((p, i) => {
            if (p.actual) idx = i;
        });
        return idx;
    });

    /** 预估段起点（含最后一个实际点，保证线段相连） */
    const anchorIdx = computed(() => (splitIdx.value >= 0 ? splitIdx.value : 0));

    /** 预估月份（当月预估 + 未来月份） */
    const forecastPoints = computed(() => points.value.filter((p) => !p.actual));

    /** 未来月份数（不含当月） */
    const futureCount = computed(() => forecastPoints.value.filter((p) => p.month > store.currentMonth).length);

    const periodText = computed(() => {
        const n = forecastPoints.value.length;
        const f = futureCount.value;
        if (f > 0) return `当月 + 未来 ${f} 个月，共 ${n} 个月`;
        if (n === 1) return '仅当月预估，共 1 个月';
        return `共 ${n} 个月`;
    });

    /** X 轴标签：跨年时补全年份，避免 12月 / 1月 混淆 */
    const axisLabels = computed(() =>
        points.value.map((p, i) => {
            const prev = points.value[i - 1];
            if (prev && prev.month.slice(0, 4) !== p.month.slice(0, 4)) return monthLabel(p.month);
            return p.label;
        }),
    );

    /** 实际月份与预估月份之间存在时间断层（筛选区间不含中间月份） */
    const timelineGap = computed(() =>
        points.value.some((p, i) => {
            const prev = points.value[i - 1];
            if (!prev) return false;
            const [py, pm] = prev.month.split('-').map(Number);
            const [cy, cm] = p.month.split('-').map(Number);
            return cy * 12 + cm - (py * 12 + pm) !== 1;
        }),
    );

    // ---------- 口径文案 ----------
    const profitLabel = computed(() => basisLabel(filter.basis));
    const revenueLabel = computed(() => (filter.basis === 'operating' ? '应确认收入' : '已到账收入'));

    // ---------- 合计 ----------
    function sumForecast(list: ForecastPoint[]) {
        const acc = { revenue: 0, cost: 0, profit: 0, optimistic: 0, pessimistic: 0, confidence: 0 };
        for (const p of list) {
            acc.revenue += p.revenue;
            acc.cost += p.cost;
            acc.profit += p.profit;
            acc.optimistic += p.optimistic;
            acc.pessimistic += p.pessimistic;
            acc.confidence += p.confidence;
        }
        if (list.length) acc.confidence /= list.length;
        return acc;
    }

    const totals = computed(() => sumForecast(forecastPoints.value));

    /** 区间两端按数值大小取 */
    const bandLow = computed(() => Math.min(totals.value.pessimistic, totals.value.optimistic));
    const bandHigh = computed(() => Math.max(totals.value.pessimistic, totals.value.optimistic));
    /** 合计区间倒挂：利润为负时，引擎的「乐观 / 悲观」两端方向会反转（乐观值低于悲观值） */
    const scenarioInverted = computed(() => totals.value.pessimistic > totals.value.optimistic);

    /** 起点：当前时点累计现金缺口（不推算未来余额） */
    const cashGap = computed(() => store.metricsOf(filter, 'company', 'company')?.cashGap ?? 0);

    /** 对比基期：最近 6 个已发生月份的实际值（与预估同口径） */
    const compare = computed(() => {
        const list = store
            .queryMonthSeries(filter)
            .filter((p) => p.month < store.currentMonth)
            .slice(-6);
        if (!list.length) return null;
        const actual = list.reduce((s, p) => s + p.metrics.profit, 0);
        return {
            months: list.length,
            actual,
            delta: actual !== 0 ? (totals.value.profit - actual) / Math.abs(actual) : null,
        };
    });

    // ---------- tooltip ----------
    interface TtRow {
        seriesName?: string;
        value?: unknown;
        marker?: string;
        axisValueLabel?: string;
        dataIndex?: number;
    }

    function tooltipHtml(raw: unknown, format: (v: number) => string, skip: string[], footer?: (idx: number) => string) {
        const rows = (Array.isArray(raw) ? raw : [raw]) as TtRow[];
        const head = rows[0]?.axisValueLabel ?? '';
        const body = rows
            .filter(
                (r) =>
                    r.seriesName &&
                    !skip.includes(r.seriesName) &&
                    r.value !== null &&
                    r.value !== undefined &&
                    Number.isFinite(Number(r.value)),
            )
            .map(
                (r) =>
                    `<div style="display:flex;align-items:center;gap:14px;justify-content:space-between"><span>${
                        r.marker ?? ''
                    }${r.seriesName}</span><b style="font-variant-numeric:tabular-nums">${format(
                        Number(r.value),
                    )}</b></div>`,
            )
            .join('');
        const idx = rows[0]?.dataIndex ?? 0;
        const tail = body ? footer?.(idx) ?? '' : '<div style="color:#94a3b8">已发生月份 · 无预估数据</div>';
        return `<div style="font-weight:600;margin-bottom:3px">${head}</div>${body}${tail}`;
    }

    // ---------- 主图 ----------
    const mainOption = computed<EChartsOption>(() => {
        const pts = points.value;
        const anchor = anchorIdx.value;
        const labels = axisLabels.value;
        const splitLabel = labels[anchor] ?? '';
        const lastLabel = labels[labels.length - 1] ?? '';

        const actualName = `${profitLabel.value}（实际）`;
        const forecastName = `${profitLabel.value}（中性预估）`;
        const optimisticName = '乐观预估';
        const pessimisticName = '悲观预估';
        const revenueName = revenueLabel.value;

        // 实际段：只有已发生月份有值
        const actualProfit = pts.map((p) => (p.actual ? p.profit : null));
        // 预估段：从最后一个实际点起（补 null 直到拼接点），使虚线与实际段相连
        const forecastProfit = pts.map((p, i) => (i >= anchor ? p.profit : null));
        const forecastOptimistic = pts.map((p, i) => (i >= anchor ? p.optimistic : null));
        const forecastPessimistic = pts.map((p, i) => (i >= anchor ? p.pessimistic : null));
        // 情景区间带（悲观 / 乐观 取小者为底 + 绝对差为跨度，堆叠成带状；亏损月两端方向反转也不会画错）
        const bandBase = pts.map((p, i) => (i >= anchor ? Math.min(p.pessimistic, p.optimistic) : null));
        const bandSpan = pts.map((p, i) => (i >= anchor ? Math.abs(p.optimistic - p.pessimistic) : null));

        const series: NonNullable<EChartsOption['series']> = [
            {
                name: BAND_BASE,
                type: 'line',
                stack: 'rfBand',
                symbol: 'none',
                silent: true,
                lineStyle: { opacity: 0 },
                data: bandBase,
                z: 1,
            },
            {
                name: BAND_SPAN,
                type: 'line',
                stack: 'rfBand',
                symbol: 'none',
                silent: true,
                lineStyle: { opacity: 0 },
                areaStyle: { color: 'rgba(18, 181, 102, 0.10)' },
                data: bandSpan,
                z: 1,
            },
            {
                name: revenueName,
                type: 'bar',
                yAxisIndex: 1,
                data: pts.map((p) => p.revenue),
                barMaxWidth: 18,
                itemStyle: { color: C.revenue, opacity: 0.9, borderRadius: [3, 3, 0, 0] },
                z: 2,
            },
        ];

        // 实际段：实线 + 圆点
        if (splitIdx.value >= 0) {
            series.push({
                name: actualName,
                type: 'line',
                data: actualProfit,
                smooth: false,
                symbol: 'circle',
                symbolSize: 6,
                lineStyle: { width: 2, color: C.operating },
                itemStyle: { color: C.operating },
                z: 6,
            });
        }

        // 中性预估：虚线（从最后一个实际点连出）+ 零线 / 今日分界 markLine + 预估区 markArea
        series.push({
            name: forecastName,
            type: 'line',
            data: forecastProfit,
            smooth: false,
            symbol: 'circle',
            symbolSize: 4,
            lineStyle: { width: 2, type: 'dashed', color: C.operating },
            itemStyle: { color: C.operating },
            z: 5,
            markArea: {
                silent: true,
                itemStyle: { color: 'rgba(77, 148, 250, 0.05)' },
                data: [[{ xAxis: splitLabel }, { xAxis: lastLabel }]],
            },
            markLine: {
                silent: true,
                symbol: 'none',
                data: [
                    {
                        yAxis: 0,
                        lineStyle: { color: C.gridLineWarm, width: 1, type: 'solid' },
                        label: { show: true, position: 'end', formatter: '0', color: C.axisText, fontSize: 10 },
                    },
                    {
                        xAxis: splitLabel,
                        lineStyle: { color: C.axisText, width: 1, type: 'dashed' },
                        label: {
                            show: true,
                            position: 'insideEndTop',
                            formatter: splitIdx.value >= 0 ? '今日 · 实际｜预估分界' : '今日 · 预估起点',
                            color: C.axisText,
                            fontSize: 10,
                        },
                    },
                ],
            },
        });

        // 乐观 / 悲观：虚线情景边界
        series.push(
            {
                name: optimisticName,
                type: 'line',
                data: forecastOptimistic,
                smooth: false,
                symbol: 'none',
                lineStyle: { width: 2, type: 'dashed', color: C.optimistic },
                itemStyle: { color: C.optimistic },
                z: 4,
            },
            {
                name: pessimisticName,
                type: 'line',
                data: forecastPessimistic,
                smooth: false,
                symbol: 'none',
                lineStyle: { width: 2, type: 'dashed', color: C.pessimistic },
                itemStyle: { color: C.pessimistic },
                z: 4,
            },
        );

        const legendData = [actualName, forecastName, optimisticName, pessimisticName, revenueName].filter((n) =>
            splitIdx.value >= 0 ? true : n !== actualName,
        );

        return {
            grid: { left: 58, right: 62, top: 40, bottom: 26 },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' },
                formatter: (raw: unknown) => {
                    const rows = (Array.isArray(raw) ? raw : [raw]) as TtRow[];
                    const idx = rows[0]?.dataIndex ?? 0;
                    const p = pts[idx];
                    // 拼接点上实际值与预估起点同值，避免 tooltip 出现 4 行重复数字
                    const skip =
                        p?.actual && idx === anchor
                            ? [...BAND_NAMES, forecastName, optimisticName, pessimisticName]
                            : BAND_NAMES;
                    return tooltipHtml(raw, (v) => money(v), skip, (i) => {
                        const q = pts[i];
                        if (!q || q.actual) return '';
                        const flip = q.optimistic < q.pessimistic ? ' · ⚠ 亏损月：乐观值低于悲观值' : '';
                        return `<div style="margin-top:4px;color:#94a3b8">预估 · 置信度 ${percent(
                            q.confidence,
                        )}${flip}</div>`;
                    });
                },
            },
            legend: {
                top: 0,
                itemWidth: 10,
                itemHeight: 10,
                textStyle: { color: C.legendText, fontSize: 11 },
                data: legendData,
            },
            xAxis: {
                type: 'category',
                data: labels,
                axisLine: { lineStyle: { color: C.axisLine } },
                axisLabel: { color: C.axisText, fontSize: 11 },
                axisTick: { show: false },
            },
            yAxis: [
                {
                    type: 'value',
                    name: '利润 / 万',
                    nameTextStyle: { color: C.axisText, fontSize: 10 },
                    splitNumber: 5,
                    axisLabel: {
                        color: C.axisText,
                        fontSize: 11,
                        formatter: (v: number) => `${(v / 1e4).toFixed(0)}万`,
                    },
                    splitLine: { lineStyle: { color: C.splitLine } },
                },
                {
                    type: 'value',
                    name: '收入 / 万',
                    nameTextStyle: { color: C.axisText, fontSize: 10 },
                    splitNumber: 5,
                    axisLabel: {
                        color: C.axisText,
                        fontSize: 11,
                        formatter: (v: number) => `${(v / 1e4).toFixed(0)}万`,
                    },
                    splitLine: { show: false },
                },
            ],
            series,
        };
    });

    // ---------- 置信度衰减图 ----------
    const confidenceOption = computed<EChartsOption>(() => {
        const pts = points.value;
        const labels = axisLabels.value;
        const anchor = anchorIdx.value;

        return {
            grid: { left: 58, right: 24, top: 26, bottom: 24 },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: (raw: unknown) => tooltipHtml(raw, (v) => percent(v), []),
            },
            xAxis: {
                type: 'category',
                data: labels,
                axisLine: { lineStyle: { color: C.axisLine } },
                axisLabel: { color: C.axisText, fontSize: 11 },
                axisTick: { show: false },
            },
            yAxis: {
                type: 'value',
                min: 0,
                max: 1,
                interval: 0.25,
                axisLabel: { color: C.axisText, fontSize: 11, formatter: (v: number) => `${Math.round(v * 100)}%` },
                splitLine: { lineStyle: { color: C.splitLine } },
            },
            series: [
                {
                    name: '预估置信度',
                    type: 'bar',
                    barMaxWidth: 26,
                    // 实际月份不参与置信度衰减，留空
                    data: pts.map((p) => (p.actual ? null : p.confidence)),
                    itemStyle: {
                        color: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 0,
                            y2: 1,
                            colorStops: [
                                { offset: 0, color: '#4d94fa' },
                                { offset: 1, color: '#cbd5e1' },
                            ],
                        },
                        borderRadius: [3, 3, 0, 0],
                    },
                    label: {
                        show: true,
                        position: 'top',
                        formatter: (p: { value?: unknown }) => percent(Number(p.value ?? 0)),
                        color: C.axisText,
                        fontSize: 10,
                    },
                    markArea: {
                        silent: true,
                        itemStyle: { color: 'rgba(77, 148, 250, 0.05)' },
                        data: [[{ xAxis: labels[anchor] ?? '' }, { xAxis: labels[labels.length - 1] ?? '' }]],
                    },
                    markLine: {
                        silent: true,
                        symbol: 'none',
                        data: [
                            {
                                yAxis: 0.42,
                                lineStyle: { color: '#f0a3a3', width: 1, type: 'dashed' },
                                label: {
                                    show: true,
                                    position: 'insideEndTop',
                                    formatter: '置信度下限 42%',
                                    color: C.axisText,
                                    fontSize: 10,
                                },
                            },
                        ],
                    },
                },
            ],
        };
    });

    // ---------- 表格 ----------
    function confidenceColor(c: number): string {
        if (c >= 0.8) return 'var(--oa-primary)';
        if (c >= 0.6) return 'var(--oa-text-4)';
        return 'var(--oa-warning)';
    }

    /** 亏损月的乐观值会低于悲观值（引擎场景公式对负利润方向反转）——单元格给出提示，不篡改数值 */
    function flipHint(row: ForecastPoint): string {
        return !row.actual && row.optimistic < row.pessimistic
            ? '该月利润为负：引擎给出的乐观值低于悲观值，请按数值大小解读区间'
            : '';
    }

    function summaryMethod(param: { columns: Array<{ property?: string }>; data: ForecastPoint[] }): string[] {
        const rows = param.data.filter((p) => !p.actual);
        const t = sumForecast(rows);
        const map: Record<string, string> = {
            month: `预估期合计（${rows.length} 个月）`,
            revenue: money(t.revenue),
            cost: money(t.cost),
            profit: money(t.profit),
            margin: t.revenue > 0 ? percent(t.profit / t.revenue) : '—',
            pessimistic: money(t.pessimistic),
            optimistic: money(t.optimistic),
            confidence: rows.length ? percent(t.confidence) : '—',
        };
        return param.columns.map((c) => map[String(c.property ?? '')] ?? '');
    }
</script>

<style scoped lang="scss">
    .rf__empty {
        min-height: 200px;
    }

    .rf {
        display: flex;
        flex-direction: column;
        gap: 14px;
        min-height: 0;
    }

    .rf__blk {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
        min-height: 0;
    }

    .rf__blk + .rf__blk {
        padding-top: 12px;
        border-top: 1px dashed var(--oa-border-light);
    }

    .rf__blk-head {
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 8px;
        min-width: 0;
    }

    .rf__blk-title {
        margin: 0;
        font-size: var(--oa-fs-sm);
        font-weight: 600;
        color: var(--oa-text-1);
        white-space: nowrap;
    }

    .rf__blk-hint {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
    }

    .rf__warn {
        margin: 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.6;
        color: var(--oa-warning);
    }

    .rf__note {
        margin: 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.6;
        color: var(--oa-text-4);
    }

    /* ---------- 明细表 ---------- */
    .rf__table {
        width: 100%;
    }

    .rf__table :deep(.el-table__footer .cell) {
        font-weight: 600;
    }

    .mcell {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
    }

    .mcell__txt {
        color: var(--oa-text-1);
    }

    .mcell__actual {
        padding: 0 5px;
        font-size: 11px;
        line-height: 18px;
        color: var(--oa-text-4);
        background: var(--oa-hover);
        border-radius: var(--oa-radius-sm);
    }

    .cell--strong {
        font-weight: 700;
    }

    .cell--pess {
        color: var(--oa-danger);
    }

    .cell--opt {
        color: var(--oa-success);
    }

    .cell--actual {
        color: var(--oa-text-4);
    }

    .cell__flip {
        margin-left: 4px;
        font-size: 10px;
        color: var(--oa-warning);
    }

    .conf {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
    }

    .conf__bar {
        flex: 0 0 auto;
        width: 66px;
    }

    .conf__txt {
        color: var(--oa-text-2);
    }

    /* ---------- 合计卡 ---------- */
    .rf__kpis {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(228px, 1fr));
        gap: var(--oa-gap);
        align-items: stretch;
    }

    .scen {
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 6px;
        padding: 12px 14px 12px 16px;
        background: var(--oa-card);
        border: 1px solid var(--oa-border);
        border-radius: var(--oa-radius);
        box-shadow: var(--oa-shadow);
        overflow: hidden;

        &::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 3px;
            background: var(--oa-operating);
        }
    }

    .scen__label {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-3);
    }

    .scen__row {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
    }

    .scen__cell {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }

    .scen__k {
        font-size: 11px;
        color: var(--oa-text-4);
    }

    .scen__v {
        font-size: var(--oa-fs-lg);
        font-weight: 700;
        line-height: 1.2;
        white-space: nowrap;
        color: var(--oa-text-1);
    }

    .scen__cell--pess .scen__v {
        color: var(--oa-danger);
    }

    .scen__cell--opt .scen__v {
        color: var(--oa-success);
    }

    .scen__cell--mid .scen__v.oa-up {
        color: var(--oa-success);
    }

    .scen__cell--mid .scen__v.oa-down {
        color: var(--oa-danger);
    }

    .scen__foot {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
    }

    /* ---------- 一句话结论 ---------- */
    .rf__conclusion {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin: 0;
        padding: 10px 12px;
        font-size: var(--oa-fs-sm);
        line-height: 1.75;
        color: var(--oa-text-2);
        background: var(--oa-primary-soft);
        border: 1px solid var(--oa-border-light);
        border-left: 3px solid var(--oa-primary);
        border-radius: var(--oa-radius-sm);
    }

    .rf__conclusion-badge {
        flex: 0 0 auto;
        padding: 1px 6px;
        margin-top: 2px;
        font-size: 11px;
        line-height: 16px;
        color: var(--oa-primary-deep);
        background: var(--oa-card);
        border-radius: 8px;
    }

    .rf__conclusion-text {
        min-width: 0;
        word-break: break-word;

        b {
            font-weight: 700;
            color: var(--oa-text-1);
        }

        b.oa-up {
            color: var(--oa-success);
        }

        b.oa-down {
            color: var(--oa-danger);
        }
    }
</style>
