<template>
    <PanelCard title="账面利润 vs 经营利润" subtitle="按自然月 · 双口径利润与差额演化">
        <template #actions>
            <el-radio-group v-model="mode" size="small">
                <el-radio-button value="month">单月</el-radio-button>
                <el-radio-button value="cum">累计</el-radio-button>
            </el-radio-group>
        </template>

        <PanelEmptyState v-if="!points.length" text="当前筛选条件下暂无月度数据" />

        <div v-else class="pbt">
            <!-- 单月：双柱 + 差额折线（300px）；累计：三条累计折线（220px） -->
            <EChart :option="option" :style="{ height: mode === 'cum' ? '220px' : '300px' }" />

            <p class="pbt__conclusion" :class="`pbt__conclusion--${conclusion.tone}`">
                <i class="pbt__dot" />
                <span>{{ conclusion.text }}</span>
            </p>

            <section class="pbt__attr">
                <header class="pbt__attr-head">
                    <h4 class="pbt__attr-title">口径差异归因</h4>
                    <span class="pbt__attr-sub">{{ rangeLabel }}</span>
                </header>

                <template v-if="attr">
                    <div class="pbt__rows">
                        <div
                            v-for="it in attr.items"
                            :key="it.key"
                            class="pbt__row"
                            :class="[`pbt__row--${it.key}`, { 'pbt__row--neg': it.value < 0 }]"
                        >
                            <span class="pbt__row-name">
                                {{ it.name }}
                                <em>{{ it.sub }}</em>
                            </span>
                            <div class="pbt__track">
                                <i class="pbt__zero" />
                                <i class="pbt__bar" :style="barStyle(it.value, attr.scale)" />
                            </div>
                            <span class="pbt__row-val oa-num">{{ moneySigned(it.value) }}</span>
                        </div>

                        <div class="pbt__row pbt__row--total">
                            <span class="pbt__row-name">
                                合计
                                <em>＝ 口径差额</em>
                            </span>
                            <div class="pbt__track">
                                <i class="pbt__zero" />
                                <i class="pbt__bar" :style="barStyle(attr.gap, attr.scale)" />
                            </div>
                            <span class="pbt__row-val oa-num">{{ moneySigned(attr.gap) }}</span>
                        </div>
                    </div>

                    <p class="pbt__formula">{{ attr.formula }}</p>
                    <p class="pbt__note">{{ attr.note }}</p>
                </template>
            </section>
        </div>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed, ref } from 'vue';
    import type { EChartsOption } from 'echarts';
    import EChart from '@/components/EChart.vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { store } from '@/domain/store';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { money, moneySigned, percent, ratio } from '@/utils/format';

    defineOptions({ name: 'OverviewProfitBasisTrend' });

    const { filter } = useAnalysisFilter();

    type ViewMode = 'month' | 'cum';
    const mode = ref<ViewMode>('month');

    // ---------- 数据：强制按月，不受 granularity 影响 ----------
    const points = computed(() => store.queryMonthSeries(filter));
    const labels = computed(() => points.value.map((p) => p.label));
    const bookSeries = computed(() => points.value.map((p) => p.metrics.bookProfit));
    const operatingSeries = computed(() => points.value.map((p) => p.metrics.operatingProfit));
    const gapSeries = computed(() => points.value.map((p) => p.metrics.profitGap));

    function prefixSum(list: number[]): number[] {
        let acc = 0;
        return list.map((v) => (acc += v));
    }

    const cumBook = computed(() => prefixSum(bookSeries.value));
    const cumOperating = computed(() => prefixSum(operatingSeries.value));
    const cumGap = computed(() => prefixSum(gapSeries.value));

    // ---------- 颜色 ----------
    // ECharts 用 canvas 渲染，无法解析 CSS 变量（zrender 不做 var() 解析，非法色值会被 canvas 静默忽略成黑色）；
    // 因此这里把设计令牌读成真实色值，读不到时回退到 theme.scss 里的同色值。
    interface ChartColors {
        book: string;
        operating: string;
        gap: string;
    }
    let colorCache: ChartColors | null = null;
    function tokenColor(token: string, fallback: string): string {
        if (typeof document === 'undefined') return fallback;
        const name = token.replace(/^var\(/, '').replace(/\)$/, '').trim();
        const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return /^(#|rgb|hsl)/i.test(v) ? v : fallback;
    }
    function chartColors(): ChartColors {
        if (!colorCache) {
            colorCache = {
                book: tokenColor('var(--oa-book)', '#4d94fa'),
                operating: tokenColor('var(--oa-operating)', '#12b566'),
                gap: tokenColor('var(--oa-gap-color)', '#ff9140'),
            };
        }
        return colorCache;
    }

    // ---------- 图表 ----------
    const LEGEND = { top: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: '#64748b', fontSize: 11 } };
    const TOOLTIP = {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        valueFormatter: (v: unknown) => money(Number(v)),
    };
    const AXIS_LINE = { lineStyle: { color: '#e2e8f0' } };

    /** 金额轴统一以「万」为单位展示（数据本身仍是元，tooltip 用 money() 保证与实际值一致） */
    function wanAxis(name: string, showSplitLine: boolean) {
        return {
            type: 'value' as const,
            name,
            nameTextStyle: { color: '#9ca3af', fontSize: 11 },
            splitNumber: 5,
            axisLabel: {
                color: '#94a3b8',
                fontSize: 11,
                formatter: (v: number) => `${(v / 1e4).toFixed(0)}万`,
            },
            splitLine: showSplitLine ? { lineStyle: { color: '#f1f5f9' } } : { show: false },
        };
    }

    function categoryAxis(data: string[]) {
        return {
            type: 'category' as const,
            data,
            axisLine: AXIS_LINE,
            axisLabel: { color: '#94a3b8', fontSize: 11 },
            axisTick: { show: false },
        };
    }

    function zeroLine(hasNegative: boolean) {
        return {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#cbd5e1', type: 'dashed' as const },
            data: hasNegative ? [{ yAxis: 0 }] : [],
        };
    }

    const hasNegative = computed(() => [...bookSeries.value, ...operatingSeries.value, ...gapSeries.value].some((v) => v < 0));

    /** 单月：账面/经营双柱 + 口径差额折线（右轴） */
    function singleOption(): EChartsOption {
        const c = chartColors();
        return {
            grid: { left: 62, right: 66, top: 34, bottom: 26 },
            tooltip: TOOLTIP,
            legend: { ...LEGEND, data: ['账面利润', '经营利润', '口径差额'] },
            xAxis: categoryAxis(labels.value),
            yAxis: [wanAxis('利润', true), wanAxis('差额', false)],
            series: [
                {
                    name: '账面利润',
                    type: 'bar',
                    data: bookSeries.value,
                    barMaxWidth: 14,
                    barGap: '12%',
                    itemStyle: { color: c.book, borderRadius: [3, 3, 0, 0] },
                    markLine: zeroLine(hasNegative.value),
                },
                {
                    name: '经营利润',
                    type: 'bar',
                    data: operatingSeries.value,
                    barMaxWidth: 14,
                    itemStyle: { color: c.operating, borderRadius: [3, 3, 0, 0] },
                },
                {
                    name: '口径差额',
                    type: 'line',
                    yAxisIndex: 1,
                    data: gapSeries.value,
                    smooth: false,
                    symbolSize: 5,
                    lineStyle: { width: 2 },
                    itemStyle: { color: c.gap },
                },
            ],
        };
    }

    /** 累计：累计账面 / 累计经营 / 累计差额（对月度序列做前缀和） */
    function cumOption(): EChartsOption {
        const c = chartColors();
        return {
            grid: { left: 62, right: 30, top: 34, bottom: 26 },
            tooltip: TOOLTIP,
            legend: { ...LEGEND, data: ['累计账面利润', '累计经营利润', '累计差额'] },
            xAxis: categoryAxis(labels.value),
            yAxis: [wanAxis('累计金额', true)],
            series: [
                {
                    name: '累计账面利润',
                    type: 'line',
                    data: cumBook.value,
                    smooth: false,
                    symbolSize: 5,
                    lineStyle: { width: 2 },
                    itemStyle: { color: c.book },
                    markLine: zeroLine(hasNegative.value),
                },
                {
                    name: '累计经营利润',
                    type: 'line',
                    data: cumOperating.value,
                    smooth: false,
                    symbolSize: 5,
                    lineStyle: { width: 2 },
                    itemStyle: { color: c.operating },
                },
                {
                    name: '累计差额',
                    type: 'line',
                    data: cumGap.value,
                    smooth: false,
                    symbolSize: 5,
                    lineStyle: { width: 2 },
                    itemStyle: { color: c.gap },
                },
            ],
        };
    }

    const option = computed<EChartsOption>(() => (mode.value === 'cum' ? cumOption() : singleOption()));

    // ---------- 结论条：按近 3 个月口径差额的演化方向自动判断 ----------
    const conclusion = computed<{ tone: 'expand' | 'narrow' | 'flat'; text: string }>(() => {
        const g = gapSeries.value;
        if (g.length < 3) {
            return { tone: 'flat', text: '区间不足 3 个月，暂无足够月度点判断口径差额的演化方向。' };
        }
        const win = g.slice(-3);
        const head = win[0];
        const tail = win[2];
        const diff = tail - head;
        const span = `近 3 个月口径差额由 ${money(head)} 变化为 ${money(tail)}（${moneySigned(diff)}）`;

        // 两端都为负且绝对值扩大：经营口径持续低于账面，属于回收进度问题而非投入期
        if (head < 0 && tail < 0 && Math.abs(tail) > Math.abs(head)) {
            return { tone: 'expand', text: `${span}，口径差额为负且持续扩大，经营利润低于账面利润，需关注回收进度` };
        }
        if (win[1] > win[0] && win[2] > win[1]) {
            return { tone: 'expand', text: `${span}，口径差额持续扩大，处于加速投入期，需关注现金流` };
        }
        if (win[1] < win[0] && win[2] < win[1]) {
            return { tone: 'narrow', text: `${span}，口径差额收窄，回收正在兑现` };
        }
        if (Math.abs(diff) <= Math.max(1, Math.abs(head) * 0.05)) {
            return { tone: 'flat', text: `${span}，口径差额基本持平，双口径差异稳定` };
        }
        return diff > 0
            ? { tone: 'expand', text: `${span}，口径差额虽有波动但整体扩大，处于加速投入期，需关注现金流` }
            : { tone: 'narrow', text: `${span}，口径差额虽有波动但整体收窄，回收正在兑现` };
    });

    // ---------- 口径差异归因：把 profitGap 拆成 应收未收 / 预付余额 / 期间错配 ----------
    const company = computed(() => store.metricsOf(filter, 'company', 'company'));
    const rangeLabel = computed(() => `${filter.startMonth} ~ ${filter.endMonth}（区间合计，余额取区间末）`);

    interface AttrItem {
        key: 'receivable' | 'prepay' | 'residual';
        name: string;
        sub: string;
        value: number;
    }
    interface Attribution {
        items: AttrItem[];
        gap: number;
        scale: number;
        formula: string;
        note: string;
    }

    function plusMinus(v: number, text: string): string {
        return v < 0 ? `− ${text}` : `+ ${text}`;
    }

    const attr = computed<Attribution | null>(() => {
        const m = company.value;
        if (!m) return null;

        const gap = m.profitGap;
        const receivable = m.receivable;
        const prepayBalance = m.prepayBalance;
        // 应收未收抬升差额（账面少收），预付余额压低差额（账面多花），余额无法解释的部分归入期间错配
        const net = receivable - prepayBalance;
        const residual = gap - net;

        const items: AttrItem[] = [
            { key: 'receivable', name: '应收未收', sub: '账面少收', value: receivable },
            { key: 'prepay', name: '预付余额', sub: '账面多花', value: -prepayBalance },
            { key: 'residual', name: '期间错配', sub: '结算滞后 / 时点差', value: residual },
        ];
        const scale = Math.max(...items.map((i) => Math.abs(i.value)), Math.abs(gap), 1);

        const formula =
            `经营利润 − 账面利润 = 应收未收 − 预付余额 ± 期间错配 = ${money(receivable)} − ${money(prepayBalance)} ` +
            `${plusMinus(residual, money(Math.abs(residual)))} = ${moneySigned(gap)}`;

        // 时点余额与期间差额量级可能相差很远，按解释度分档给文案，避免出现「解释度 159945%」这类读数
        const netText = moneySigned(net);
        const gapAbs = Math.abs(gap);
        const netAbs = Math.abs(net);
        const coverage = gapAbs > 0 ? netAbs / gapAbs : 0;
        const residualText = moneySigned(residual);
        let note: string;
        if (gapAbs < Math.max(1e4, netAbs * 0.1)) {
            note =
                `区间口径差额仅 ${moneySigned(gap)}，应收未收 − 预付余额 = ${netText} 与期间错配 ${residualText} 基本相互抵消，` +
                `双口径当期结果接近，不宜按两项余额归因。`;
        } else if (coverage < 0.5) {
            note =
                `口径差额 ${moneySigned(gap)}，应收未收 − 预付余额 = ${netText} 仅解释 ${percent(coverage)}，` +
                `主要来自 平台结算滞后、时点余额与期间流量的错配（其余 ${residualText}）；两项之和不必然精确等于差额。`;
        } else if (coverage <= 1.5) {
            note =
                `口径差额 ${moneySigned(gap)}，主要来自 应收未收 − 预付余额 = ${netText}（解释度 ${percent(coverage)}）；` +
                `其余 ${residualText} 为平台结算滞后与期间错配，两项之和不必然精确等于差额。`;
        } else {
            note =
                `口径差额 ${moneySigned(gap)}，而 应收未收 − 预付余额 = ${netText}（为差额的 ${ratio(coverage)} 倍），` +
                `主要来自 期间流量与结算滞后（其余 ${residualText}），时点两项不宜按比例解释当期差额。`;
        }

        return { items, gap, scale, formula, note };
    });

    /** 以轨道中点为 0 轴的双向条：向右为正贡献，向左为负贡献 */
    function barStyle(value: number, scale: number): Record<string, string> {
        const width = `${(Math.min(Math.abs(value) / scale, 1) * 50).toFixed(2)}%`;
        return value >= 0 ? { left: '50%', width } : { right: '50%', width };
    }
</script>

<style scoped lang="scss">
    // 口径差额色：走 --oa-gap-color（--oa-gap 现为「栅格间距 12px」，不能当颜色用）
    $gap-color: var(--oa-gap-color);

    .pbt {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-height: 0;
    }

    .pbt__conclusion {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 0;
        padding: 6px 10px;
        border-radius: var(--oa-radius-sm);
        background: var(--oa-hover);
        font-size: var(--oa-fs-xs);
        line-height: 1.5;
        color: var(--oa-text-2);
    }

    .pbt__dot {
        flex: 0 0 auto;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--oa-text-4);
    }

    .pbt__conclusion--expand {
        background: var(--oa-warning-soft);
        color: #c96a1c;

        .pbt__dot {
            background: $gap-color;
        }
    }

    .pbt__conclusion--narrow {
        background: var(--oa-success-soft);
        color: #0e9455;

        .pbt__dot {
            background: var(--oa-success);
        }
    }

    .pbt__attr {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px 12px;
        border: 1px solid var(--oa-border-light);
        border-radius: var(--oa-radius);
        background: var(--oa-hover);
        min-height: 0;
    }

    .pbt__attr-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
    }

    .pbt__attr-title {
        margin: 0;
        font-size: var(--oa-fs-sm);
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .pbt__attr-sub {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
    }

    .pbt__rows {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .pbt__row {
        display: grid;
        grid-template-columns: 122px 1fr 96px;
        align-items: center;
        gap: 8px;
    }

    .pbt__row-name {
        display: flex;
        align-items: baseline;
        gap: 6px;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-2);
        white-space: nowrap;

        em {
            font-style: normal;
            color: var(--oa-text-4);
            font-size: var(--oa-fs-xs);
        }
    }

    .pbt__track {
        position: relative;
        height: 14px;
        border-radius: var(--oa-radius-sm);
        background: var(--oa-border-light);
    }

    .pbt__zero {
        position: absolute;
        left: 50%;
        top: -2px;
        bottom: -2px;
        width: 1px;
        background: var(--oa-border);
    }

    .pbt__bar {
        position: absolute;
        top: 2px;
        bottom: 2px;
        border-radius: 2px;
        transition: width 0.2s ease;
    }

    .pbt__row-val {
        text-align: right;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-1);
    }

    .pbt__row--receivable {
        .pbt__bar {
            background: var(--oa-operating);
        }

        .pbt__row-val {
            color: #0e9455;
        }
    }

    .pbt__row--prepay {
        .pbt__bar {
            background: var(--oa-book);
        }

        .pbt__row-val {
            color: #2f7ce8;
        }
    }

    .pbt__row--residual {
        .pbt__bar {
            background: $gap-color;
        }

        .pbt__row-val {
            color: #c96a1c;
        }
    }

    .pbt__row--total {
        padding-top: 6px;
        border-top: 1px dashed var(--oa-border);

        .pbt__row-name {
            color: var(--oa-text-1);
            font-weight: 600;
        }

        .pbt__bar {
            background: $gap-color;
            opacity: 0.45;
        }

        .pbt__row-val {
            font-weight: 600;
            color: var(--oa-text-1);
        }
    }

    .pbt__formula {
        margin: 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.6;
        color: var(--oa-text-3);
        word-break: break-all;
    }

    .pbt__note {
        margin: 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.6;
        color: var(--oa-text-4);
    }
</style>
