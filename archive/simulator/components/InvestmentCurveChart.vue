<template>
    <PanelCard
        title="推演曲线"
        :subtitle="`${months.length} 期 · 经营利润（基线 vs 推演）+ 投放消耗 + 累计经营利润`"
    >
        <PanelEmptyState v-if="!months.length" text="推演窗口不足，请调整推演期数或基线期间" />
        <EChart v-else :option="option" style="height: 340px" />
    </PanelCard>
</template>

<script setup lang="ts">
    import EChart from '@/components/EChart.vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { money, toWan } from '@/utils/format';
    import type { EChartsOption } from 'echarts';
    import type { MonthProjection } from './simulatorEngine';
    import { computed } from 'vue';

    /** 推演曲线：基线情景（灰虚线） / 推演情景（经营绿实线） / 推演消耗柱（次轴） / 累计经营利润 */
    defineOptions({ name: 'SimulatorInvestmentCurve' });

    const props = defineProps<{
        /** 基线情景（参数全 0） */
        base: MonthProjection[];
        /** 推演情景（当前参数） */
        sim: MonthProjection[];
    }>();

    const months = computed(() => props.sim.map((m) => m.label));

    const option = computed<EChartsOption>(() => {
        const baseProfit = props.base.map((m) => toWan(m.profit));
        const simProfit = props.sim.map((m) => toWan(m.profit));
        const spend = props.sim.map((m) => toWan(m.spend));
        let cb = 0;
        const baseCum = props.base.map((m) => {
            cb += m.profit;
            return toWan(cb);
        });
        let cs = 0;
        const simCum = props.sim.map((m) => {
            cs += m.profit;
            return toWan(cs);
        });

        return {
            grid: { left: 62, right: 62, top: 38, bottom: 26 },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                valueFormatter: (v) => money(Number(v) * 1e4),
            },
            legend: {
                top: 0,
                itemWidth: 10,
                itemHeight: 10,
                textStyle: { color: '#64748b', fontSize: 11 },
                data: ['基线情景·经营利润', '推演情景·经营利润', '推演投放消耗', '累计经营利润（推演）'],
            },
            xAxis: {
                type: 'category',
                data: months.value,
                axisLine: { lineStyle: { color: '#e2e8f0' } },
                axisLabel: { color: '#94a3b8', fontSize: 11 },
                axisTick: { show: false },
            },
            yAxis: [
                {
                    type: 'value',
                    name: '利润 / 消耗（万）',
                    nameTextStyle: { color: '#94a3b8', fontSize: 10, align: 'left' },
                    splitNumber: 5,
                    axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v: number) => `${v.toFixed(0)}万` },
                    splitLine: { lineStyle: { color: '#f1f5f9' } },
                },
                {
                    type: 'value',
                    name: '累计（万）',
                    nameTextStyle: { color: '#94a3b8', fontSize: 10, align: 'right' },
                    splitNumber: 5,
                    axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v: number) => `${v.toFixed(0)}万` },
                    splitLine: { show: false },
                },
            ],
            series: [
                {
                    name: '推演投放消耗',
                    type: 'bar',
                    yAxisIndex: 0,
                    data: spend,
                    barMaxWidth: 20,
                    itemStyle: { color: 'rgba(77, 148, 250, 0.42)' },
                },
                {
                    name: '基线情景·经营利润',
                    type: 'line',
                    yAxisIndex: 0,
                    data: baseProfit,
                    smooth: false,
                    symbolSize: 5,
                    lineStyle: { width: 2, type: 'dashed', color: '#94a3b8' },
                    itemStyle: { color: '#94a3b8' },
                },
                {
                    name: '推演情景·经营利润',
                    type: 'line',
                    yAxisIndex: 0,
                    data: simProfit,
                    smooth: false,
                    symbolSize: 5,
                    lineStyle: { width: 2, color: 'var(--oa-operating)' },
                    itemStyle: { color: 'var(--oa-operating)' },
                    markLine: {
                        silent: true,
                        symbol: 'none',
                        lineStyle: { color: '#cbd5e1', type: 'dashed' },
                        label: { show: false },
                        data: [{ yAxis: 0 }],
                    },
                },
                {
                    name: '累计经营利润（推演）',
                    type: 'line',
                    yAxisIndex: 1,
                    data: simCum,
                    smooth: false,
                    symbolSize: 4,
                    lineStyle: { width: 2, type: 'dotted', color: 'var(--oa-revenue)' },
                    itemStyle: { color: 'var(--oa-revenue)' },
                },
                {
                    name: '累计经营利润（基线）',
                    type: 'line',
                    yAxisIndex: 1,
                    data: baseCum,
                    smooth: false,
                    symbolSize: 0,
                    showSymbol: false,
                    silent: true,
                    tooltip: { show: false },
                    lineStyle: { width: 1, type: 'dotted', color: '#cbd5e1' },
                    itemStyle: { color: '#cbd5e1' },
                },
            ],
        };
    });
</script>
