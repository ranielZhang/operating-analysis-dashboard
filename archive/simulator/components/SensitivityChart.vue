<template>
    <PanelCard
        title="敏感度分析"
        subtitle="单因子扫描：只动一个假设，看推演期累计经营利润怎么变"
    >
        <PanelEmptyState v-if="!budgetPoints.length" text="暂无可扫描的推演区间" />
        <template v-else>
            <EChart :option="option" style="height: 320px" />

            <div class="sens__foot">
                <div class="sens__legend">
                    <span><i class="sens__line sens__line--budget" />投放预算变化（−50% ~ +100%）</span>
                    <span><i class="sens__line sens__line--curve" />curveA 变化（−30% ~ +30%）</span>
                    <span><i class="sens__ml" />markLine = 当前点 / 盈亏平衡点</span>
                    <span class="sens__tip">两条线共用左轴（同为推演期累计经营利润），因此可直接比较量级</span>
                </div>
                <p class="sens__conclusion" :class="{ 'sens__conclusion--warn': noPositiveSolution }">
                    <b>{{ noPositiveSolution ? '结论（本次扫描全区间无正收益解）：' : '结论（由本次扫描实测得出）：' }}</b>
                    {{ conclusion }}
                </p>
            </div>
        </template>
    </PanelCard>
</template>

<script setup lang="ts">
    import EChart from '@/components/EChart.vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { money, toWan } from '@/utils/format';
    import type { EChartsOption } from 'echarts';
    import type { SweepPoint } from './simulatorEngine';
    import { computed } from 'vue';

    /** 敏感度分析：投放预算 × curveA 两条单因子曲线，标注当前点与盈亏平衡点 */
    defineOptions({ name: 'SimulatorSensitivityChart' });

    const props = defineProps<{
        /** 投放预算扫描（−50% ~ +100%，步长 10%） */
        budgetPoints: SweepPoint[];
        /** curveA 扫描（−30% ~ +30%，步长 5%） */
        curvePoints: SweepPoint[];
        /** 投放预算的盈亏平衡点 */
        budgetBreakEven: { delta: number; exact: boolean } | null;
        /** curveA 的盈亏平衡点 */
        curveBreakEven: { delta: number; exact: boolean } | null;
        /** 边际收益转负的分界（投放预算扫描内的利润最高点） */
        budgetPeak: SweepPoint | null;
        /** 两条扫描曲线是否都无正收益解 */
        noPositiveSolution: boolean;
        /** 由实测数据生成的结论句 */
        conclusion: string;
    }>();

    function fmtDelta(d: number): string {
        return `${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}%`;
    }

    /** 构造 markLine：当前点（0%）单列一条，盈亏平衡点一条 */
    function markLines(points: SweepPoint[], be: { delta: number } | null, color: string) {
        const cats = points.map((p) => fmtDelta(p.delta));
        const data: Array<Record<string, unknown>> = [];
        const zeroIdx = points.findIndex((p) => Math.abs(p.delta) < 1e-6);
        if (zeroIdx >= 0) {
            data.push({
                xAxis: cats[zeroIdx],
                label: { formatter: '当前点 0%', color: '#64748b' },
                lineStyle: { type: 'dashed', width: 1, color: '#94a3b8' },
            });
        }
        if (be) {
            // 插值结果可能落在两点之间，用数值轴表达更准确
            data.push({
                xAxis: be.delta * 100,
                label: { formatter: `盈亏平衡 ${fmtDelta(be.delta)}`, color },
                lineStyle: { type: 'solid', width: 1.4, color },
            });
        }
        return {
            silent: true,
            symbol: 'none',
            lineStyle: { color },
            label: { fontSize: 10, position: 'insideEndTop' as const },
            data,
        };
    }

    const option = computed<EChartsOption>(() => {
        const cats = props.budgetPoints.map((p) => fmtDelta(p.delta));
        return {
            grid: { left: 62, right: 62, top: 34, bottom: 30 },
            tooltip: {
                trigger: 'axis',
                valueFormatter: (v) => money(Number(v) * 1e4),
            },
            legend: {
                top: 0,
                itemWidth: 10,
                itemHeight: 10,
                textStyle: { color: '#64748b', fontSize: 11 },
                data: ['投放预算变化 → 累计经营利润', 'curveA 变化 → 累计经营利润'],
            },
            xAxis: {
                type: 'category',
                name: '假设变化',
                nameTextStyle: { color: '#94a3b8', fontSize: 10 },
                data: cats,
                boundaryGap: false,
                axisLine: { lineStyle: { color: '#e2e8f0' } },
                axisLabel: { color: '#94a3b8', fontSize: 11, interval: 1 },
                axisTick: { show: false },
            },
            yAxis: [
                {
                    type: 'value',
                    name: '累计经营利润（万）',
                    nameTextStyle: { color: '#94a3b8', fontSize: 10, align: 'left' },
                    splitNumber: 5,
                    axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v: number) => `${v.toFixed(0)}万` },
                    splitLine: { lineStyle: { color: '#f1f5f9' } },
                },
            ],
            series: [
                {
                    name: '投放预算变化 → 累计经营利润',
                    type: 'line',
                    yAxisIndex: 0,
                    data: props.budgetPoints.map((p) => toWan(p.profit)),
                    smooth: false,
                    symbolSize: 6,
                    lineStyle: { width: 2.4, color: 'var(--oa-operating)' },
                    itemStyle: { color: 'var(--oa-operating)' },
                    markLine: markLines(props.budgetPoints, props.budgetBreakEven, '#12b566'),
                    markPoint: props.budgetPeak
                        ? {
                              symbol: 'pin',
                              symbolSize: 34,
                              itemStyle: { color: 'var(--oa-warning)' },
                              label: { fontSize: 9, color: '#fff', formatter: '峰值' },
                              data: [
                                  {
                                      name: '边际收益峰值',
                                      coord: [fmtDelta(props.budgetPeak.delta), toWan(props.budgetPeak.profit)],
                                  },
                              ],
                          }
                        : undefined,
                },
                {
                    name: 'curveA 变化 → 累计经营利润',
                    type: 'line',
                    yAxisIndex: 0,
                    data: props.curvePoints.map((p) => toWan(p.profit)),
                    smooth: false,
                    symbolSize: 5,
                    lineStyle: { width: 2, type: 'dashed', color: 'var(--oa-gap)' },
                    itemStyle: { color: 'var(--oa-gap)' },
                    markLine: markLines(props.curvePoints, props.curveBreakEven, '#ff9140'),
                },
            ],
        };
    });
</script>

<style scoped lang="scss">
    .sens__foot {
        margin-top: 6px;
        padding-top: 8px;
        border-top: 1px dashed var(--oa-border-light);
    }

    .sens__legend {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        font-size: 11px;
        color: var(--oa-text-3);
    }

    .sens__line {
        display: inline-block;
        width: 14px;
        height: 0;
        margin-right: 5px;
        vertical-align: middle;
        border-top-width: 2px;
        border-top-style: solid;

        &--budget {
            border-color: var(--oa-operating);
        }

        &--curve {
            border-color: var(--oa-gap);
            border-top-style: dashed;
        }
    }

    .sens__ml {
        display: inline-block;
        width: 2px;
        height: 10px;
        margin-right: 5px;
        vertical-align: middle;
        background: var(--oa-text-3);
    }

    .sens__tip {
        color: var(--oa-text-4);
    }

    .sens__conclusion {
        margin: 6px 0 0;
        padding: 8px 10px;
        background: var(--oa-primary-soft);
        border-left: 3px solid var(--oa-primary);
        border-radius: var(--oa-radius-sm);
        font-size: var(--oa-fs-xs);
        line-height: 1.6;
        color: var(--oa-text-2);

        b {
            color: var(--oa-primary-deep);
        }

        &--warn {
            background: var(--oa-warning-soft);
            border-left-color: var(--oa-warning);

            b {
                color: #c96a1c;
            }
        }
    }
</style>
