<template>
    <PanelCard title="成本月度趋势" :subtitle="subtitle">
        <template #actions>
            <el-radio-group v-model="stackMode" size="small">
                <el-radio-button value="group">按大类堆叠</el-radio-button>
                <el-radio-button value="item">按 8 科目堆叠</el-radio-button>
            </el-radio-group>
        </template>

        <PanelEmptyState v-if="isEmpty" text="当前筛选条件下暂无成本数据" />

        <template v-else>
            <EChart :option="option" style="height: 300px" />
            <p class="trend__note">
                柱：{{ stackMode === 'group' ? '业务成本 / 人工成本 / 管理费用 3 大类' : '8 个成本科目' }}按月堆叠（真实发生额口径，
                投放消耗与充值额分列，不随筛选口径切换）；折线（右轴）：结构口径成本合计 ÷ 应确认收入。
                注意该比值含<b>充值额</b>（预付款），因此会明显高于指标卡按当前口径算出的成本收入比（账面口径含充值、经营口径只含消耗）。
            </p>
        </template>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed, ref } from 'vue';
    import type { EChartsOption } from 'echarts';
    import EChart from '@/components/EChart.vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { store } from '@/domain/store';
    import type { CostBreakdown } from '@/domain/types';
    import { money, percent } from '@/utils/format';
    import {
        COST_GROUPS,
        COST_LEAVES,
        groupColor,
        groupValue,
        leafColor,
        leafValue,
        shortMonth,
        structTotal,
        tokenValue,
    } from './costModel';

    /**
     * 区块 3 · 成本月度趋势（堆叠柱 + 成本收入比折线）
     * 逐月取 metrics.costByType，堆叠 4 大类或 8 科目；预付与投放分开堆叠，避免把「充值」和「消耗」混成一个数。
     */
    defineOptions({ name: 'CostMonthlyTrend' });

    const { filter } = useAnalysisFilter();

    /** 堆叠模式：大类 / 8 科目 */
    const stackMode = ref<'group' | 'item'>('group');

    const points = computed(() =>
        store.queryMonthSeries(filter).map((p) => ({
            key: p.month,
            label: shortMonth(p.month),
            cb: p.metrics.costByType as CostBreakdown,
            costTotal: structTotal(p.metrics.costByType),
            revenue: p.metrics.accrualRevenue,
        })),
    );

    const isEmpty = computed(
        () => points.value.length === 0 || points.value.every((p) => p.costTotal === 0 && p.revenue === 0),
    );

    const subtitle = computed(() => {
        const period = points.value.length ? `${points.value[0].key} ~ ${points.value[points.value.length - 1].key}` : '';
        return `${period} · 共 ${points.value.length} 个月`;
    });

    /** 堆叠项（金额单位：元，Y 轴按「万」展示） */
    const stackItems = computed(() => {
        if (stackMode.value === 'group') {
            return COST_GROUPS.map((g) => ({
                name: g.name,
                color: groupColor(g.key),
                values: points.value.map((p) => groupValue(p.cb, g.key)),
            }));
        }
        return COST_LEAVES.map((l) => ({
            name: l.name,
            color: leafColor(l.key),
            values: points.value.map((p) => leafValue(p.cb, l.key)),
        }));
    });

    /** 成本收入比折线（分母为 0 时断开，不画 0 造成误读） */
    const ratioValues = computed<(number | null)[]>(() =>
        points.value.map((p) => (p.revenue > 0 ? p.costTotal / p.revenue : null)),
    );

    const option = computed<EChartsOption>(() => {
        const warning = tokenValue('--oa-warning', '#ff9140');
        const bars = stackItems.value.map((s) => ({
            name: s.name,
            type: 'bar' as const,
            stack: 'cost',
            barMaxWidth: 24,
            itemStyle: { color: s.color },
            emphasis: { focus: 'series' as const },
            data: s.values,
        }));

        const line = {
            name: '成本收入比',
            type: 'line' as const,
            yAxisIndex: 1,
            smooth: false,
            symbolSize: 5,
            lineStyle: { width: 2, color: warning },
            itemStyle: { color: warning },
            connectNulls: false,
            data: ratioValues.value,
        };

        return {
            grid: { left: 60, right: 56, top: 42, bottom: 28 },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                confine: true,
                formatter: (params: unknown) => {
                    const list = params as Array<{
                        seriesName?: string;
                        value?: number | null;
                        marker?: string;
                        axisValueLabel?: string;
                    }>;
                    if (!list.length) return '';
                    const head = list[0].axisValueLabel ?? '';
                    const rows = list.map((it) => {
                        const isRatio = it.seriesName === '成本收入比';
                        const v = it.value;
                        const text = v === null || v === undefined ? '—' : isRatio ? percent(v) : money(v);
                        return `${it.marker ?? ''}${it.seriesName}：<b>${text}</b>`;
                    });
                    return `<div style="font-size:12px;line-height:19px">${head}<br/>${rows.join('<br/>')}</div>`;
                },
            },
            legend: {
                type: 'scroll',
                top: 0,
                itemWidth: 10,
                itemHeight: 10,
                textStyle: { color: '#64748b', fontSize: 11 },
            },
            xAxis: {
                type: 'category',
                data: points.value.map((p) => p.label),
                axisLine: { lineStyle: { color: '#e2e8f0' } },
                axisLabel: { color: '#94a3b8', fontSize: 11, hideOverlap: true },
                axisTick: { show: false },
            },
            yAxis: [
                {
                    type: 'value',
                    name: '成本',
                    nameTextStyle: { color: '#94a3b8', fontSize: 11 },
                    splitNumber: 5,
                    axisLabel: {
                        color: '#94a3b8',
                        fontSize: 11,
                        formatter: (v: number) => `${(v / 1e4).toFixed(0)}万`,
                    },
                    splitLine: { lineStyle: { color: '#f1f5f9' } },
                },
                {
                    type: 'value',
                    name: '成本收入比',
                    nameTextStyle: { color: '#94a3b8', fontSize: 11 },
                    splitNumber: 5,
                    axisLabel: {
                        color: '#94a3b8',
                        fontSize: 11,
                        formatter: (v: number) => percent(v, 0),
                    },
                    splitLine: { show: false },
                },
            ],
            series: [...bars, line],
        };
    });
</script>

<style scoped lang="scss">
    .trend__note {
        margin: 8px 0 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.7;
        color: var(--oa-text-4);
    }
</style>
