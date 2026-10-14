<template>
    <PanelCard
        title="收入三科目月度趋势"
        subtitle="堆叠柱 = 流量主 / 广告金 / 分成（万元）；折线 = 收入 / 消耗 比（右轴，1.0 = 当期收入与投放消耗持平）"
    >
        <PanelEmptyState v-if="!hasData" text="当前筛选条件下暂无月度收入数据" />

        <div v-else class="trend">
            <EChart :option="option" style="height: 320px" />
            <p class="trend__note">
                折线为「收入 / 消耗 比」= 当月应确认收入 ÷ 当月投放消耗。比值持续低于 1.0 说明当期回收跑不赢投放，
                需要靠后续月份的延迟回收补回；折线在 1.0 处有基准线。
            </p>
        </div>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import type { EChartsOption } from 'echarts';
    import EChart from '@/components/EChart.vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { store } from '@/domain/store';
    import { toWan } from '@/utils/format';
    import {
        REVENUE_SUBJECTS,
        hasRevenue,
        monthAxisLabels,
        ratioAxisLabel,
        ratioPoint,
        ratioTooltip,
        revenueColor,
        subjectAmount,
        token,
        wanAxisLabel,
        wanTooltip,
    } from './revenueTheme';

    /** 收入三科目月度趋势：堆叠柱看结构，双轴折线看投产比 */
    defineOptions({ name: 'RevenueTrendPanel' });

    const { filter } = useAnalysisFilter();

    /** 强制按月，不受顶部粒度切换影响（收入结构必须按月才看得清节奏） */
    const points = computed(() => store.queryMonthSeries(filter));

    const hasData = computed(() => points.value.some((p) => hasRevenue(p.metrics)));

    const labels = computed(() => monthAxisLabels(points.value.map((p) => p.month)));

    const option = computed<EChartsOption>(() => {
        const pts = points.value;
        return {
            grid: { left: 58, right: 56, top: 44, bottom: 26 },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
            },
            legend: {
                top: 0,
                itemWidth: 10,
                itemHeight: 10,
                textStyle: { color: token('--oa-text-3', '#6b7280'), fontSize: 11 },
            },
            xAxis: {
                type: 'category',
                data: labels.value,
                axisLine: { lineStyle: { color: token('--oa-border', '#e5e9f2') } },
                axisLabel: { color: token('--oa-text-4', '#9ca3af'), fontSize: 11 },
                axisTick: { show: false },
            },
            yAxis: [
                {
                    type: 'value',
                    name: '万元',
                    nameTextStyle: { color: token('--oa-text-4', '#9ca3af'), fontSize: 11 },
                    splitNumber: 5,
                    axisLabel: {
                        color: token('--oa-text-4', '#9ca3af'),
                        fontSize: 11,
                        formatter: wanAxisLabel,
                    },
                    splitLine: { lineStyle: { color: token('--oa-border-light', '#eef1f7') } },
                },
                {
                    type: 'value',
                    name: '收入/消耗 比',
                    nameTextStyle: { color: token('--oa-revenue', '#8b5cf6'), fontSize: 11 },
                    splitNumber: 5,
                    /** 强制包含 1.0，保证「持平线」始终可见（比值高于 1 时轴线不会把 1.0 裁掉） */
                    min: (extent: { min: number; max: number }) => Math.min(1, extent.min),
                    axisLabel: {
                        color: token('--oa-revenue', '#8b5cf6'),
                        fontSize: 11,
                        formatter: ratioAxisLabel,
                    },
                    splitLine: { show: false },
                },
            ],
            series: [
                ...REVENUE_SUBJECTS.map((subject) => ({
                    name: subject.name,
                    type: 'bar' as const,
                    stack: 'revenue',
                    barMaxWidth: 26,
                    itemStyle: { color: revenueColor(subject.key) },
                    data: pts.map((p) => toWan(subjectAmount(p.metrics.revenueByType, subject.key))),
                    tooltip: { valueFormatter: wanTooltip },
                })),
                {
                    name: '收入/消耗 比',
                    type: 'line' as const,
                    yAxisIndex: 1,
                    smooth: false,
                    symbolSize: 5,
                    lineStyle: { width: 2, color: token('--oa-revenue', '#8b5cf6') },
                    itemStyle: { color: token('--oa-revenue', '#8b5cf6') },
                    data: pts.map((p) => ratioPoint(p.metrics.accrualRevenue, p.metrics.spend)),
                    tooltip: { valueFormatter: ratioTooltip },
                    markLine: {
                        silent: true,
                        symbol: 'none',
                        label: { formatter: '1.0 持平线', color: token('--oa-text-4', '#9ca3af'), fontSize: 10 },
                        lineStyle: { type: 'dashed', color: token('--oa-text-4', '#9ca3af') },
                        data: [{ yAxis: 1 }],
                    },
                },
            ],
        };
    });
</script>

<style scoped lang="scss">
    .trend {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
    }

    .trend__note {
        margin: 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.6;
        color: var(--oa-text-4);
    }
</style>
