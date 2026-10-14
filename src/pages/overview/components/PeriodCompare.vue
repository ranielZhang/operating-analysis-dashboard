<template>
    <PanelCard title="年 / 季 / 月 经营对比" :subtitle="subtitle" plain>
        <template #actions>
            <el-radio-group v-model="mode" size="small">
                <el-radio-button v-for="opt in MODE_OPTIONS" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                </el-radio-button>
            </el-radio-group>
        </template>

        <div class="pc">
            <PanelEmptyState v-if="!hasData" text="当前筛选条件下暂无可用数据（试试放宽组织 / 业务范围，或切换期间）" />

            <template v-else>
                <!-- ============================ 区块 1：三档对比表 ============================ -->
                <section class="pc__block">
                    <div class="pc__block-head">
                        <h4 class="pc__block-title">三档经营对比 · {{ modeLabel }}</h4>
                        <span class="pc__block-hint">{{ rangeHint }}</span>
                    </div>

                    <el-table :data="rows" size="small" show-overflow-tooltip :row-class-name="rowClassName">
                        <el-table-column label="期间" min-width="142" fixed :show-overflow-tooltip="false">
                            <template #default="{ row }">
                                <el-tooltip :disabled="!row.open" :content="OPEN_TIP" placement="top">
                                    <div class="pc__period">
                                        <span class="pc__period-label">{{ row.label }}</span>
                                        <el-tag v-if="row.open" size="small" type="warning" class="pc__tag">进行中</el-tag>
                                    </div>
                                </el-tooltip>
                                <span class="pc__period-sub">{{ row.rangeText }}</span>
                            </template>
                        </el-table-column>

                        <el-table-column label="应确认收入" align="right" min-width="104">
                            <template #default="{ row }">
                                <el-tooltip :disabled="!row.open" :content="OPEN_TIP" placement="top">
                                    <span class="oa-num">{{ money(row.metrics.accrualRevenue) }}</span>
                                </el-tooltip>
                            </template>
                        </el-table-column>

                        <el-table-column label="已到账收入" align="right" min-width="104">
                            <template #default="{ row }">
                                <el-tooltip :disabled="!row.open" :content="OPEN_TIP" placement="top">
                                    <span class="oa-num">{{ money(row.metrics.cashRevenue) }}</span>
                                </el-tooltip>
                            </template>
                        </el-table-column>

                        <el-table-column label="投放消耗" align="right" min-width="100">
                            <template #default="{ row }">
                                <el-tooltip :disabled="!row.open" :content="OPEN_TIP" placement="top">
                                    <span class="oa-num">{{ money(row.metrics.spend) }}</span>
                                </el-tooltip>
                            </template>
                        </el-table-column>

                        <el-table-column label="人工+管理费用" align="right" min-width="112">
                            <template #default="{ row }">
                                <el-tooltip :disabled="!row.open" :content="OPEN_TIP" placement="top">
                                    <span class="oa-num">{{ money(row.metrics.laborCost + row.metrics.adminCost) }}</span>
                                </el-tooltip>
                            </template>
                        </el-table-column>

                        <!-- 账面利润 = 已到账收入 − 充值支出 − 人工 − 管理（银行流水口径） -->
                        <el-table-column label="账面利润" align="right" min-width="102">
                            <template #default="{ row }">
                                <el-tooltip :disabled="!row.open" :content="OPEN_TIP" placement="top">
                                    <span class="oa-num pc__book" :class="trendClass(row.metrics.bookProfit)">
                                        {{ money(row.metrics.bookProfit) }}
                                    </span>
                                </el-tooltip>
                            </template>
                        </el-table-column>

                        <!-- 经营利润 = 应确认收入 − 投放消耗 − 人工 − 管理（权责发生制口径） -->
                        <el-table-column label="经营利润" align="right" min-width="108">
                            <template #default="{ row }">
                                <el-tooltip :disabled="!row.open" :content="OPEN_TIP" placement="top">
                                    <span class="oa-num pc__operating" :class="trendClass(row.metrics.operatingProfit)">
                                        {{ money(row.metrics.operatingProfit) }}
                                    </span>
                                </el-tooltip>
                            </template>
                        </el-table-column>

                        <el-table-column label="经营利润率" align="right" min-width="98">
                            <template #default="{ row }">
                                <el-tooltip :disabled="!row.open" :content="OPEN_TIP" placement="top">
                                    <span class="oa-num" :class="trendClass(row.metrics.operatingProfit)">
                                        {{ percent(row.metrics.operatingMargin) }}
                                    </span>
                                </el-tooltip>
                            </template>
                        </el-table-column>

                        <!-- 口径差额 = 经营利润 − 账面利润，反映「已投放未回收 / 未确认」的规模 -->
                        <el-table-column label="口径差额" align="right" min-width="100">
                            <template #default="{ row }">
                                <el-tooltip :disabled="!row.open" :content="OPEN_TIP" placement="top">
                                    <span class="oa-num pc__gap">{{ money(row.metrics.profitGap) }}</span>
                                </el-tooltip>
                            </template>
                        </el-table-column>

                        <!-- 累计口径：自数据起点累计，非本期口径 -->
                        <el-table-column label="累计预估ROI" align="right" min-width="112">
                            <template #default="{ row }">
                                <el-tooltip :disabled="!row.open" :content="OPEN_TIP" placement="top">
                                    <span class="oa-num">{{ ratio(row.metrics.forecastRoi) }}</span>
                                </el-tooltip>
                            </template>
                        </el-table-column>

                        <el-table-column align="right" min-width="100">
                            <template #header>
                                <el-tooltip content="累计口径：累计已回收 ÷ 累计预估总回收（自数据起点累计，不是本期口径）" placement="top">
                                    <span>回收完成度</span>
                                </el-tooltip>
                            </template>
                            <template #default="{ row }">
                                <el-tooltip :disabled="!row.open" :content="OPEN_TIP" placement="top">
                                    <span class="oa-num">{{ percent(row.metrics.recoveryRate) }}</span>
                                </el-tooltip>
                            </template>
                        </el-table-column>

                        <el-table-column label="环比" align="right" min-width="92">
                            <template #default="{ row }">
                                <span v-if="row.mom === null" class="oa-num pc__flat">—</span>
                                <span v-else class="oa-num" :class="trendClass(row.mom)">
                                    {{ trendArrow(row.mom) }} {{ changeText(row.mom) }}
                                </span>
                            </template>
                        </el-table-column>
                    </el-table>

                    <p class="pc__foot">
                        按时间正序排列，<strong>环比</strong>为「经营利润」与上一期间相比的变化率（首个期间无环比）。带
                        <strong>「进行中」</strong>标记的期间尚未结束，其数值为区间累计值，与完整期间不可直接比较；
                        累计预估ROI / 回收完成度是<strong>自数据起点累计</strong>口径，不是本期口径。
                    </p>
                </section>

                <!-- ==================== 区块 2：双口径利润 + 收入 分组柱线图 ==================== -->
                <section class="pc__block">
                    <div class="pc__block-head">
                        <h4 class="pc__block-title">双口径利润 × 应确认收入</h4>
                        <span class="pc__block-hint">柱 = 利润（左轴） / 折线 = 应确认收入（右轴），单位「万」</span>
                    </div>
                    <EChart :option="compareOption" style="height: 300px" />
                </section>

                <!-- ==================== 区块 3：年度视角专属（仅「按年」） ==================== -->
                <section v-if="mode === 'year'" class="pc__block">
                    <div class="pc__block-head">
                        <h4 class="pc__block-title">年度达成与增长</h4>
                        <span class="pc__block-hint">当前年度尚未结束，为 1 月至今的累计口径</span>
                    </div>

                    <div class="pc__metrics">
                        <MetricCard
                            :label="`${curYearKey} 年至今经营利润`"
                            :value="curYearProfit"
                            format="moneyAuto"
                            tone="operating"
                            colored
                            :badge="`${monthCountOfCurYear} 个月`"
                            badge-tone="success"
                            hint="权责发生制口径（含预估回收）"
                        />
                        <MetricCard
                            :label="`${prevYearKey} 全年经营利润`"
                            :value="prevYearProfit"
                            format="moneyAuto"
                            tone="book"
                            colored
                            badge="全年"
                            hint="完整年度，口径可比"
                        />
                        <MetricCard
                            label="经营利润同比"
                            :value="yoy ?? 0"
                            format="percent"
                            :tone="yoyTone"
                            :compare="yoy"
                            compare-label="同比上一年度"
                            compare-mode="up-good"
                            :hint="yoy === null ? '上一年度无可比基数，暂不计算同比' : '当前年度至今 vs 上一年度全年'"
                        />
                    </div>

                    <EChart :option="yearOption" style="height: 220px" />
                    <p class="pc__foot">
                        柱顶 ROI = 该期间「经营利润 ÷ 投放消耗」（期间盈利倍率，&gt; 1 表示期间盈利；它<strong>不是</strong>
                        上面的累计回收 ROI）。当前年度柱顶数值为进行中区间的累计值。
                    </p>
                </section>

                <!-- ============================ 区块 4：一句话结论 ============================ -->
                <p class="pc__conclusion">{{ conclusion }}</p>
            </template>
        </div>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed, ref, watch } from 'vue';
    import type { EChartsOption } from 'echarts';
    import { store } from '@/domain/store';
    import type { AnalysisFilter, Granularity, Metrics, MonthlyPoint } from '@/domain/types';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { changeText, money, percent, ratio, trendArrow, trendClass } from '@/utils/format';
    import EChart from '@/components/EChart.vue';
    import MetricCard from '@/components/MetricCard.vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';

    /** M-需求2 年 / 季 / 月 三档经营对比：同一份筛选范围下的三种时间视角 */
    defineOptions({ name: 'OverviewPeriodCompare' });

    const { filter } = useAnalysisFilter();

    // ------------------------------------------------------------------
    // 画布配色：ECharts 走 canvas，canvas 不解析 CSS 变量，
    // 因此这里用与 theme.scss 设计令牌等值的字面色值（改令牌时需同步）：
    //   --oa-book       #4d94fa   账面利润
    //   --oa-operating  #12b566   经营利润
    //   --oa-revenue    #8b5cf6   应确认收入
    //   --oa-cost       #fd6464   投放消耗
    // ------------------------------------------------------------------
    const COLOR_BOOK = '#4d94fa';
    const COLOR_OPERATING = '#12b566';
    const COLOR_REVENUE = '#8b5cf6';
    const COLOR_COST = '#fd6464';
    const COLOR_ZERO_LINE = '#cbd5e1';

    const OPEN_TIP = '该期间尚未结束，数值为区间累计值，与完整期间不可直接比较';

    const MODE_OPTIONS: Array<{ value: Granularity; label: string }> = [
        { value: 'year', label: '按年' },
        { value: 'quarter', label: '按季度' },
        { value: 'month', label: '按月' },
    ];

    /** 组件内时间视角；跟随全局筛选栏的粒度联动（单向：全局 → 本模块） */
    const mode = ref<Granularity>(filter.granularity);
    watch(
        () => filter.granularity,
        (g) => {
            mode.value = g;
        },
    );

    // ============================================================
    // 时间轴工具：季度起点必须算出来，不许硬编码 '2024Q3' 这类字面量
    // ============================================================
    /** 把 'YYYY-MM' 往前推 n 个季度（n > 0 = 更早），返回目标季度的首月 */
    function shiftQuarter(month: string, n: number): string {
        const y = Number(month.slice(0, 4));
        const m = Number(month.slice(5, 7));
        const totalQuarter = y * 4 + Math.floor((m - 1) / 3) - n;
        const qy = Math.floor(totalQuarter / 4);
        const qm = (((totalQuarter % 4) + 4) % 4) * 3 + 1;
        return `${qy}-${String(qm).padStart(2, '0')}`;
    }

    /** 起点不早于数据起点 */
    function clampStart(month: string): string {
        return month < store.months[0] ? store.months[0] : month;
    }

    /**
     * 沿用当前筛选的「范围」（组织 / 平台 / 项目 / 游戏 / 口径 / 预估窗口），
     * 只覆盖时间区间与粒度，这样年度 / 季度视角不会被默认 12 个月的区间截断。
     */
    const scopeOf = (startMonth: string, endMonth: string, granularity: Granularity): AnalysisFilter => ({
        ...filter,
        startMonth,
        endMonth,
        granularity,
    });

    const DATA_START = store.months[0];
    /** 季度视角固定看近 8 个季度（含当前未结束季度） */
    const QUARTER_SPAN = 8;

    const yearFilter = computed(() => scopeOf(DATA_START, store.currentMonth, 'year'));
    const quarterFilter = computed(() =>
        scopeOf(clampStart(shiftQuarter(store.currentMonth, QUARTER_SPAN - 1)), store.currentMonth, 'quarter'),
    );
    /** 月度视角沿用用户自己选的期间，尊重其在筛选栏的选择 */
    const monthFilter = computed(() => scopeOf(filter.startMonth, filter.endMonth, 'month'));

    // ============================================================
    // 行模型
    // ============================================================
    interface PeriodRow {
        /** 桶 key：年 = '2026'；季 = '2026Q2'；月 = '2026-06' */
        key: string;
        label: string;
        /** 该期间是否尚未结束（桶结束月 ≥ 当前月） */
        open: boolean;
        /** 期间覆盖范围文案 */
        rangeText: string;
        metrics: Metrics;
        /** 经营利润环比（与上一行比，无则为 null） */
        mom: number | null;
    }

    function bucketStart(key: string, g: Granularity): string {
        if (g === 'year') return `${key}-01`;
        if (g === 'quarter') {
            const q = Number(key.slice(5)) || 1;
            return `${key.slice(0, 4)}-${String((q - 1) * 3 + 1).padStart(2, '0')}`;
        }
        return key;
    }
    function bucketEnd(key: string, g: Granularity): string {
        if (g === 'year') return `${key}-12`;
        if (g === 'quarter') {
            const q = Number(key.slice(5)) || 1;
            return `${key.slice(0, 4)}-${String(q * 3).padStart(2, '0')}`;
        }
        return key;
    }
    /** 变化率（分母取绝对值，负数基数也能得到方向正确的百分比） */
    function growth(cur: number, base: number | null | undefined): number | null {
        if (base === null || base === undefined || !Number.isFinite(base) || base === 0) return null;
        return (cur - base) / Math.abs(base);
    }

    function toRows(points: MonthlyPoint[], g: Granularity): PeriodRow[] {
        const cur = store.currentMonth;
        return points.map((p, i) => {
            const start = bucketStart(p.month, g);
            const end = bucketEnd(p.month, g);
            const open = end >= cur;
            const prev = points[i - 1];
            return {
                key: p.month,
                label: p.label,
                open,
                rangeText: open ? `${start} ~ 数据截至 ${cur}` : `${start} ~ ${end}`,
                metrics: p.metrics,
                mom: prev ? growth(p.metrics.operatingProfit, prev.metrics.operatingProfit) : null,
            };
        });
    }

    // ============================================================
    // 取数：三档序列全部来自 store，筛选条件变化自动重算
    // ============================================================
    /** ① 年度：2024 / 2025 / 2026 至今 */
    const yearRows = computed<PeriodRow[]>(() => toRows(store.querySeries(yearFilter.value), 'year'));
    /** ② 季度：近 8 个季度 */
    const quarterRows = computed<PeriodRow[]>(() => toRows(store.querySeries(quarterFilter.value), 'quarter'));
    /** ③ 月度：用户所选期间 */
    const monthRows = computed<PeriodRow[]>(() => toRows(store.querySeries(monthFilter.value), 'month'));

    const rows = computed<PeriodRow[]>(() =>
        mode.value === 'year' ? yearRows.value : mode.value === 'quarter' ? quarterRows.value : monthRows.value,
    );

    /** 三档口径一致：只要有一个桶有金额（收入 / 消耗 / 人力）就算有数据 */
    const hasData = computed(() =>
        rows.value.some(
            (r) =>
                r.metrics.accrualRevenue !== 0 ||
                r.metrics.cashRevenue !== 0 ||
                r.metrics.spend !== 0 ||
                r.metrics.laborCost !== 0 ||
                r.metrics.adminCost !== 0,
        ),
    );

    const modeLabel = computed(() => MODE_OPTIONS.find((o) => o.value === mode.value)?.label ?? '');
    const subtitle = computed(() => `沿用当前筛选范围，按 ${modeLabel.value.replace('按', '')} 分桶对比账面 / 经营双口径`);
    const rangeHint = computed(() => {
        const list = rows.value;
        if (!list.length) return '';
        return `${list[0].label} ~ ${list[list.length - 1].label}，共 ${list.length} 个期间；期间未结束时数值为区间累计值`;
    });
    const rowClassName = (data: { row: PeriodRow }): string => (data.row.open ? 'pc__row--open' : '');

    // ============================================================
    // 区块 2：分组柱状图（账面 / 经营 双柱 + 应确认收入折线）
    // ============================================================
    const compareOption = computed<EChartsOption>(() => {
        const list = rows.value;
        const labels = list.map((r) => r.label);
        const book = list.map((r) => r.metrics.bookProfit);
        const operating = list.map((r) => r.metrics.operatingProfit);
        const revenue = list.map((r) => r.metrics.accrualRevenue);
        const hasNegative = book.some((v) => v < 0) || operating.some((v) => v < 0);
        const zeroLine = {
            silent: true,
            symbol: 'none',
            lineStyle: { color: COLOR_ZERO_LINE, type: 'dashed' as const, width: 1 },
            label: { show: false },
            data: [{ yAxis: 0 }],
        };

        return {
            grid: { left: 62, right: 62, top: 36, bottom: 28 },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                valueFormatter: (v) => money(Number(v)),
            },
            legend: { top: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: '#64748b', fontSize: 11 } },
            xAxis: {
                type: 'category',
                data: labels,
                axisLine: { lineStyle: { color: '#e2e8f0' } },
                axisLabel: { color: '#94a3b8', fontSize: 11 },
                axisTick: { show: false },
            },
            yAxis: [
                {
                    type: 'value',
                    name: '利润',
                    nameTextStyle: { color: '#94a3b8', fontSize: 10 },
                    splitNumber: 5,
                    axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v: number) => `${(v / 1e4).toFixed(0)}万` },
                    splitLine: { lineStyle: { color: '#f1f5f9' } },
                },
                {
                    type: 'value',
                    name: '收入',
                    nameTextStyle: { color: '#94a3b8', fontSize: 10 },
                    splitNumber: 5,
                    axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v: number) => `${(v / 1e4).toFixed(0)}万` },
                    splitLine: { show: false },
                },
            ],
            series: [
                {
                    name: '账面利润',
                    type: 'bar',
                    yAxisIndex: 0,
                    barMaxWidth: 18,
                    itemStyle: { color: COLOR_BOOK, borderRadius: [3, 3, 0, 0] },
                    data: book,
                    ...(hasNegative ? { markLine: zeroLine } : {}),
                },
                {
                    name: '经营利润',
                    type: 'bar',
                    yAxisIndex: 0,
                    barMaxWidth: 18,
                    itemStyle: { color: COLOR_OPERATING, borderRadius: [3, 3, 0, 0] },
                    data: operating,
                },
                {
                    name: '应确认收入',
                    type: 'line',
                    yAxisIndex: 1,
                    smooth: false,
                    symbolSize: 5,
                    lineStyle: { width: 2, color: COLOR_REVENUE },
                    itemStyle: { color: COLOR_REVENUE },
                    data: revenue,
                },
            ],
        };
    });

    // ============================================================
    // 区块 3：年度达成与增长（仅「按年」档）
    // ============================================================
    const curYearKey = computed(() => store.currentMonth.slice(0, 4));
    const prevYearKey = computed(() => String(Number(curYearKey.value) - 1));
    const curYearRow = computed<PeriodRow | null>(() => yearRows.value.find((r) => r.key === curYearKey.value) ?? null);
    const prevYearRow = computed<PeriodRow | null>(() => yearRows.value.find((r) => r.key === prevYearKey.value) ?? null);
    const curYearProfit = computed(() => curYearRow.value?.metrics.operatingProfit ?? 0);
    const prevYearProfit = computed(() => prevYearRow.value?.metrics.operatingProfit ?? 0);
    const yoy = computed(() => growth(curYearProfit.value, prevYearRow.value?.metrics.operatingProfit));
    const yoyTone = computed<'success' | 'warn'>(() => (yoy.value === null || yoy.value >= 0 ? 'success' : 'warn'));
    /** 当前年度已发生的月份数（1 月 ~ 当前月） */
    const monthCountOfCurYear = computed(() => Number(store.currentMonth.slice(5, 7)));

    const yearOption = computed<EChartsOption>(() => {
        const list = yearRows.value;
        const labels = list.map((r) => r.label);
        const profit = list.map((r) => r.metrics.operatingProfit);
        const spend = list.map((r) => r.metrics.spend);
        /** 柱顶标注的期间 ROI = 经营利润 / 投放消耗 */
        const roiText = list.map((r) =>
            r.metrics.spend > 0 ? `ROI ${ratio(r.metrics.operatingProfit / r.metrics.spend)}` : 'ROI —',
        );
        const hasNegative = profit.some((v) => v < 0);

        return {
            grid: { left: 62, right: 24, top: 34, bottom: 26 },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                valueFormatter: (v) => money(Number(v)),
            },
            legend: { top: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: '#64748b', fontSize: 11 } },
            xAxis: {
                type: 'category',
                data: labels,
                axisLine: { lineStyle: { color: '#e2e8f0' } },
                axisLabel: { color: '#94a3b8', fontSize: 11 },
                axisTick: { show: false },
            },
            yAxis: {
                type: 'value',
                splitNumber: 4,
                axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v: number) => `${(v / 1e4).toFixed(0)}万` },
                splitLine: { lineStyle: { color: '#f1f5f9' } },
            },
            series: [
                {
                    name: '经营利润',
                    type: 'bar',
                    barMaxWidth: 26,
                    itemStyle: { color: COLOR_OPERATING, borderRadius: [3, 3, 0, 0] },
                    label: {
                        show: true,
                        position: 'top',
                        fontSize: 10,
                        color: '#0e9455',
                        formatter: (p: { dataIndex: number }) => roiText[p.dataIndex] ?? '',
                    },
                    data: profit,
                    ...(hasNegative
                        ? {
                              markLine: {
                                  silent: true,
                                  symbol: 'none',
                                  lineStyle: { color: COLOR_ZERO_LINE, type: 'dashed' as const, width: 1 },
                                  label: { show: false },
                                  data: [{ yAxis: 0 }],
                              },
                          }
                        : {}),
                },
                {
                    name: '投放消耗',
                    type: 'bar',
                    barMaxWidth: 26,
                    itemStyle: { color: COLOR_COST, borderRadius: [3, 3, 0, 0] },
                    data: spend,
                },
            ],
        };
    });

    // ============================================================
    // 区块 4：一句话结论（全部由数据推导，无硬编码结论）
    // ============================================================
    const conclusion = computed(() => {
        const parts: string[] = [];

        // 年度：完整年度做主句，当前年度做进展句
        const prev = prevYearRow.value;
        const cur = curYearRow.value;
        if (prev) {
            let s = `${prev.key} 全年经营利润 ${money(prev.metrics.operatingProfit)}（利润率 ${percent(prev.metrics.operatingMargin)}）`;
            if (cur) {
                const yoyLocal = growth(cur.metrics.operatingProfit, prev.metrics.operatingProfit);
                s += `，${cur.key} 年至今 ${money(cur.metrics.operatingProfit)}`;
                if (yoyLocal !== null) {
                    s += `（同比${yoyLocal >= 0 ? '增长' : '下降'} ${percent(Math.abs(yoyLocal))}）`;
                }
            }
            parts.push(`${s}。`);
        } else if (cur) {
            parts.push(
                `${cur.key} 年至今经营利润 ${money(cur.metrics.operatingProfit)}（利润率 ${percent(
                    cur.metrics.operatingMargin,
                )}），当年为进行中区间，暂无完整上一年度可比数据。`,
            );
        }

        // 季度：最近一个已结束季度 + 当前进行中季度
        const q = quarterRows.value;
        const lastClosed = [...q].reverse().find((r) => !r.open);
        const openQuarter = q.find((r) => r.open);
        if (lastClosed) {
            const idx = q.indexOf(lastClosed);
            const prevQ = idx > 0 ? q[idx - 1] : undefined;
            const mom = prevQ ? growth(lastClosed.metrics.operatingProfit, prevQ.metrics.operatingProfit) : null;
            let s = `按季度看，${lastClosed.label} 经营利润 ${money(lastClosed.metrics.operatingProfit)}`;
            if (mom !== null) {
                s += `，环比${mom >= 0 ? '增长' : '下降'} ${percent(Math.abs(mom))}`;
            }
            if (openQuarter) {
                s += `；${openQuarter.label} 尚未结束，当前累计经营利润 ${money(openQuarter.metrics.operatingProfit)}。`;
            } else {
                s += '。';
            }
            parts.push(s);
        }

        // 口径差额拆解：经营利润 − 账面利润 = 应确认与已到账的收入差 + 期间充值未消耗
        const latest = rows.value[rows.value.length - 1];
        if (latest) {
            const m = latest.metrics;
            parts.push(
                `${latest.label} 账面利润 ${money(m.bookProfit)}、经营利润 ${money(m.operatingProfit)}，口径差额 ${money(
                    m.profitGap,
                )} = 「应确认与已到账的收入差 ${money(m.accrualRevenue - m.cashRevenue)}」+「期间充值未消耗 ${money(
                    m.prepay - m.spend,
                )}」，即经营口径多出的利润来自尚未回款与尚未消耗的部分。`,
            );
        }

        return parts.length ? parts.join('') : '当前筛选条件下暂无可用于结论的数据。';
    });
</script>

<style scoped lang="scss">
    .pc {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-height: 0;
        padding: 12px 14px;
    }

    .pc__block {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-height: 0;
    }

    .pc__block-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
    }

    .pc__block-title {
        margin: 0;
        font-size: var(--oa-fs-sm);
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .pc__block-hint {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
    }

    /* ---------- 表格 ---------- */
    .pc__period {
        display: flex;
        align-items: center;
        gap: 5px;
        min-width: 0;
    }

    .pc__period-label {
        color: var(--oa-text-1);
        font-weight: 600;
    }

    .pc__tag {
        transform: scale(0.9);
        transform-origin: left center;
    }

    .pc__period-sub {
        display: block;
        font-size: 11px;
        color: var(--oa-text-4);
    }

    .pc__book {
        color: var(--oa-book);
    }

    .pc__operating {
        font-weight: 700;
    }

    .pc__gap {
        color: var(--oa-gap-color);
    }

    .pc__flat {
        color: var(--oa-text-4);
    }

    .pc__foot {
        margin: 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.6;
        color: var(--oa-text-4);

        strong {
            color: var(--oa-text-3);
            font-weight: 600;
        }
    }

    /* 进行中期间整行浅底提示（el-table 内部 tr 不在 scoped 作用域，需 :deep） */
    :deep(.pc__row--open) > td.el-table__cell {
        background: var(--oa-warning-soft);
    }

    :deep(.el-table) {
        font-size: var(--oa-fs-xs);
    }

    :deep(.el-table th.el-table__cell) {
        padding: 5px 0;
        background: var(--oa-hover);
        color: var(--oa-text-3);
        font-weight: 600;
    }

    :deep(.el-table td.el-table__cell) {
        padding: 4px 0;
    }

    :deep(.el-table .cell) {
        padding: 0 8px;
    }

    /* ---------- 年度指标卡 ---------- */
    .pc__metrics {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--oa-gap);
        min-height: 0;
    }

    /* ---------- 一句话结论 ---------- */
    .pc__conclusion {
        margin: 0;
        padding: 8px 10px;
        font-size: var(--oa-fs-xs);
        line-height: 1.7;
        color: var(--oa-text-2);
        background: var(--oa-primary-soft);
        border-left: 3px solid var(--oa-primary);
        border-radius: var(--oa-radius-sm);
    }
</style>
