<template>
    <PanelCard
        title="小组维度人效对比"
        subtitle="只保留当期有投放的小组 · 按所选指标降序 · 柱旁标注小组人数与人均经营利润"
    >
        <template #actions>
            <el-radio-group v-model="metric" size="small">
                <el-radio-button v-for="opt in METRIC_OPTIONS" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                </el-radio-button>
            </el-radio-group>
        </template>

        <template v-if="hasGroups">
            <EChart :option="option" :style="{ height: chartHeight }" />

            <p class="grp__note">
                <span class="grp__note-key">结论</span>
                最赚钱小组：<b>{{ topProfitGroup?.name ?? '—' }}</b>
                （经营利润 <b class="oa-num">{{ money(topProfitGroup?.operatingProfit ?? 0) }}</b>，人均
                <b class="oa-num">{{ money(topProfitGroup?.perCapitaProfit ?? 0) }}</b>）；
                人效比最高小组：<b>{{ topEffGroup?.name ?? '—' }}</b>
                （<b class="oa-num">{{ ratio(topEffGroup?.efficiencyRatio ?? 0) }}</b>，人力成本
                <b class="oa-num">{{ money(topEffGroup?.laborCost ?? 0) }}</b>）。
                <span class="grp__note-sub">人效比 = 小组经营利润 ÷ 小组人力成本；人均经营利润 = 经营利润 ÷ 期末人数。</span>
            </p>
        </template>

        <PanelEmptyState v-else text="当前筛选范围内没有发生投放的小组" />
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed, ref } from 'vue';
    import type { EChartsOption } from 'echarts';
    import EChart from '@/components/EChart.vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import type { MetricRow } from '@/domain/types';
    import { money, ratio, toWan } from '@/utils/format';
    import { efficiencyColor, usePitcherData } from './usePitcherData';

    /**
     * 区块 4 · 小组维度人效对比
     * 从「投手个人」上升一层看「小组」：判断人效差异是个人能力问题还是小组盘面问题。
     */
    defineOptions({ name: 'PitcherGroupCompare' });

    const { groupRows } = usePitcherData();

    /** 可切换的对比指标（金额列走「万」，比率列走倍数/百分比） */
    type GroupMetric = 'operatingProfit' | 'efficiencyRatio' | 'spend' | 'forecastRoi';
    const METRIC_OPTIONS: Array<{ value: GroupMetric; label: string }> = [
        { value: 'operatingProfit', label: '经营利润' },
        { value: 'efficiencyRatio', label: '人效比' },
        { value: 'spend', label: '投放消耗' },
        { value: 'forecastRoi', label: '累计预估ROI' },
    ];

    const metric = ref<GroupMetric>('operatingProfit');
    const metricLabel = computed(() => METRIC_OPTIONS.find((o) => o.value === metric.value)?.label ?? '');

    const hasGroups = computed(() => groupRows.value.length > 0);

    const valueOf = (row: MetricRow, m: GroupMetric): number => {
        switch (m) {
            case 'efficiencyRatio':
                return row.efficiencyRatio;
            case 'spend':
                return row.spend;
            case 'forecastRoi':
                return row.forecastRoi;
            default:
                return row.operatingProfit;
        }
    };

    /**
     * 柱子配色（同一指标内保持语义一致）：
     *   经营利润  正绿负红（利润语义）
     *   人效比    沿用全页人效分档（深绿 / 绿 / 橙 / 红）
     *   投放消耗  成本语义红（--oa-cost-ad #fd6464）
     *   累计预估 ROI  ≥ 1 回本绿、< 1 未回本红（1.00 = 回本线）
     */
    const colorOf = (row: MetricRow, m: GroupMetric): string => {
        if (m === 'spend') return '#fd6464';
        if (m === 'efficiencyRatio') return efficiencyColor(row.efficiencyRatio);
        if (m === 'forecastRoi') return row.forecastRoi >= 1 ? '#12b566' : '#fd6464';
        return row.operatingProfit >= 0 ? '#12b566' : '#fd6464';
    };

    /** 柱旁文字：指标值 + 人数 + 人均经营利润 */
    const labelOf = (row: MetricRow, m: GroupMetric): string => {
        const value =
            m === 'efficiencyRatio'
                ? `人效 ${ratio(row.efficiencyRatio)}`
                : m === 'forecastRoi'
                  ? `累计ROI ${ratio(row.forecastRoi)}`
                  : m === 'spend'
                    ? `消耗 ${money(row.spend)}`
                    : `${money(row.operatingProfit)}`;
        return `${value} ｜ ${row.headcount} 人 · 人均 ${money(row.perCapitaProfit)}`;
    };

    /** 按当前指标降序（横向柱图从上到下递减，所以画图时再反转一次） */
    const sortedRows = computed<MetricRow[]>(() =>
        [...groupRows.value].sort((a, b) => valueOf(b, metric.value) - valueOf(a, metric.value)),
    );

    /** 横向柱图从下往上排，反转后最大的小组落在顶部 */
    const chartRows = computed<MetricRow[]>(() => [...sortedRows.value].reverse());

    /** 柱图高度随小组数量增长（3 个小组 ≈ 220px） */
    const chartHeight = computed(() => `${Math.max(220, chartRows.value.length * 46 + 66)}px`);

    const topProfitGroup = computed<MetricRow | undefined>(() =>
        [...groupRows.value].sort((a, b) => b.operatingProfit - a.operatingProfit)[0],
    );
    const topEffGroup = computed<MetricRow | undefined>(() =>
        [...groupRows.value].sort((a, b) => b.efficiencyRatio - a.efficiencyRatio)[0],
    );

    /** ECharts 回传的 params 类型过宽，这里收窄到我们自己塞进去的 datum */
    function rowOf(params: unknown): MetricRow | null {
        const data = (params as unknown as { data?: unknown }).data;
        if (!data || typeof data !== 'object') return null;
        const row = (data as { row?: unknown }).row;
        return row && typeof row === 'object' ? (row as MetricRow) : null;
    }

    const tipLine = (label: string, value: string, color = '#1f2937'): string =>
        `<div style="display:flex;align-items:center;justify-content:space-between;gap:18px;line-height:19px">` +
        `<span style="color:#9ca3af">${label}</span><b style="color:${color}">${value}</b></div>`;

    const option = computed<EChartsOption>(() => {
        const rows = chartRows.value;
        const m = metric.value;
        const isMoney = m === 'operatingProfit' || m === 'spend';
        return {
            grid: { left: 82, right: 210, top: 10, bottom: 30 },
            tooltip: {
                trigger: 'item',
                borderWidth: 0,
                padding: [8, 10],
                backgroundColor: 'rgba(255,255,255,0.97)',
                extraCssText: 'box-shadow:0 4px 16px rgba(31,41,55,0.14);border-radius:8px;',
                formatter: (params: unknown): string => {
                    const row = rowOf(params);
                    if (!row) return '';
                    return (
                        `<div style="font-weight:600;margin-bottom:5px;color:#1f2937">${row.name}` +
                        `<span style="color:#9ca3af;font-weight:400"> · ${row.headcount} 人</span></div>` +
                        tipLine('投放消耗', money(row.spend)) +
                        tipLine('经营利润', money(row.operatingProfit), row.operatingProfit >= 0 ? '#12b566' : '#fd6464') +
                        tipLine('人均经营利润', money(row.perCapitaProfit)) +
                        tipLine('人效比', ratio(row.efficiencyRatio), efficiencyColor(row.efficiencyRatio)) +
                        tipLine('累计预估 ROI', `${ratio(row.forecastRoi)} 倍`, row.forecastRoi >= 1 ? '#12b566' : '#fd6464') +
                        tipLine('人力成本', money(row.laborCost))
                    );
                },
            },
            xAxis: {
                type: 'value',
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: {
                    color: '#94a3b8',
                    fontSize: 11,
                    formatter: (v: number) => (isMoney ? `${toWan(v).toFixed(0)}万` : v.toFixed(1)),
                },
                splitLine: { lineStyle: { color: '#f1f5f9' } },
            },
            yAxis: {
                type: 'category',
                data: rows.map((r) => r.name),
                axisLine: { lineStyle: { color: '#e2e8f0' } },
                axisTick: { show: false },
                axisLabel: { color: '#4b5563', fontSize: 12 },
            },
            series: [
                {
                    name: metricLabel.value,
                    type: 'bar',
                    barMaxWidth: 22,
                    data: rows.map((row) => {
                        const value = valueOf(row, m);
                        const color = colorOf(row, m);
                        return {
                            value,
                            row,
                            itemStyle: { color, borderRadius: value >= 0 ? [0, 3, 3, 0] : [3, 0, 0, 3] },
                            // 负值柱向左延伸，标签要跟着换边，否则会压在柱子上
                            label: {
                                show: true,
                                position: value >= 0 ? 'right' : 'left',
                                distance: 6,
                                fontSize: 10,
                                color: '#6b7280',
                                formatter: labelOf(row, m),
                            },
                        };
                    }),
                },
            ],
        };
    });
</script>

<style scoped lang="scss">
    .grp__note {
        margin: 8px 0 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.8;
        color: var(--oa-text-3);

        b {
            color: var(--oa-text-1);
        }
    }

    .grp__note-key {
        display: inline-block;
        margin-right: 6px;
        padding: 0 6px;
        border-radius: var(--oa-radius-sm);
        background: var(--oa-primary-soft);
        color: var(--oa-primary-deep);
        font-weight: 600;
    }

    .grp__note-sub {
        color: var(--oa-text-4);
    }
</style>
