<template>
    <PanelCard
        title="人效四象限"
        subtitle="X 轴 投放消耗（万）· Y 轴 经营利润（万）· 点大小 = |人效比| · 分割线 = 团队消耗中位数 / 盈亏平衡线"
    >
        <template v-if="hasPitchers">
            <!-- 图例：四象限的定义与人数（业务含义写在这里，图内只留角标） -->
            <div class="quad__legend">
                <el-tooltip v-for="q in quadrantStats" :key="q.key" :content="q.desc" placement="top">
                    <span class="quad__legend-item">
                        <i class="quad__dot" :style="{ background: q.color }" />
                        <span class="quad__legend-name" :style="{ color: q.color }">{{ q.name }}</span>
                        <span class="quad__legend-num oa-num">{{ q.count }} 人</span>
                        <span class="quad__legend-num oa-num" :class="trendClass(q.profit)">{{ money(q.profit) }}</span>
                    </span>
                </el-tooltip>
            </div>

            <EChart :option="option" style="height: 400px" />

            <p class="quad__note">
                横轴分割线 = 团队消耗中位数 <b class="oa-num">{{ ratio(toWan(medianSpend), 0) }} 万</b>；纵轴分割线 = 经营利润 0（盈亏平衡）。
                点色按人效比分档：<b style="color: #0e9455">&gt; 2</b> /
                <b style="color: #12b566">1~2</b> /
                <b style="color: #ff9140">0~1</b> /
                <b style="color: #fd6464">&lt; 0</b>，阈值 1.00 = 覆盖自身人力成本。
            </p>
        </template>

        <PanelEmptyState v-else text="当前筛选范围内没有投手，无法绘制人效四象限" />
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import type { EChartsOption } from 'echarts';
    import EChart from '@/components/EChart.vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { ORG_MAP } from '@/domain/dimensions';
    import type { MetricRow } from '@/domain/types';
    import { comma, money, percent, ratio, toWan, trendClass } from '@/utils/format';
    import { QUADRANTS, efficiencyColor, quadrantOf, usePitcherData, type QuadrantKey, type QuadrantMeta } from './usePitcherData';

    /**
     * 区块 2 · 人效四象限散点图（本页核心图表）
     * 回答「谁在赚钱、谁在烧钱」：横轴规模、纵轴结果、点大小与颜色是人效。
     */
    defineOptions({ name: 'PitcherEfficiencyQuadrant' });

    const { pitcherRows, hasPitchers, medianSpend } = usePitcherData();

    /** 一个散点：ECharts data item（value + 悬浮所需的全部原始指标） */
    interface QuadrantPoint {
        name: string;
        value: [number, number];
        groupName: string;
        quadrant: string;
        spend: number;
        operatingProfit: number;
        forecastRoi: number;
        recoveryRate: number;
        efficiencyRatio: number;
        laborCost: number;
        symbolSize: number;
        itemStyle: { color: string; borderColor: string; borderWidth: number };
    }

    const groupNameOf = (row: MetricRow): string => (row.parentId ? ORG_MAP.get(row.parentId)?.name ?? '—' : '—');

    /** markArea 角标位置（四象限四个角） */
    type MarkAreaPosition = 'insideTopRight' | 'insideTopLeft' | 'insideBottomRight' | 'insideBottomLeft';
    /** markArea 的一个角点：坐标 + 可选浅色底 / 角标文字 */
    interface MarkAreaCorner {
        xAxis: number;
        yAxis: number;
        itemStyle?: { color: string; opacity: number };
        label?: {
            show: boolean;
            position: MarkAreaPosition;
            formatter: string;
            color: string;
            fontSize: number;
            fontWeight: 'bold';
            distance: number;
        };
    }

    const points = computed<QuadrantPoint[]>(() =>
        pitcherRows.value.map((row) => {
            const key = quadrantOf(row, medianSpend.value);
            const color = efficiencyColor(row.efficiencyRatio);
            return {
                name: row.name,
                // 图表单位统一为「万」，保持与全站金额轴一致
                value: [toWan(row.spend), toWan(row.operatingProfit)],
                groupName: groupNameOf(row),
                quadrant: QUADRANTS[key].name,
                spend: row.spend,
                operatingProfit: row.operatingProfit,
                forecastRoi: row.forecastRoi,
                recoveryRate: row.recoveryRate,
                efficiencyRatio: row.efficiencyRatio,
                laborCost: row.laborCost,
                // 点大小 = |人效比| 缩放，上限 22px，避免高杠杆点撑爆画面
                symbolSize: 8 + Math.min(14, Math.abs(row.efficiencyRatio) * 6),
                itemStyle: { color, borderColor: '#ffffff', borderWidth: 1 },
            };
        }),
    );

    /** 四象限人数 / 利润小结（图例条用） */
    const quadrantStats = computed<Array<QuadrantMeta & { count: number; profit: number }>>(() => {
        const buckets: Record<QuadrantKey, MetricRow[]> = { core: [], efficient: [], risk: [], watch: [] };
        for (const row of pitcherRows.value) buckets[quadrantOf(row, medianSpend.value)].push(row);
        return (['core', 'efficient', 'risk', 'watch'] as QuadrantKey[]).map((k) => ({
            ...QUADRANTS[k],
            count: buckets[k].length,
            profit: buckets[k].reduce((s, r) => s + r.operatingProfit, 0),
        }));
    });

    /** ECharts 回传的 params 类型过宽，这里做一次显式收窄（不使用 any） */
    function datumOf(params: unknown): QuadrantPoint | null {
        const data = (params as unknown as { data?: unknown }).data;
        if (!data || typeof data !== 'object') return null;
        const point = data as QuadrantPoint;
        return Array.isArray(point.value) ? point : null;
    }

    const tipLine = (label: string, value: string, color = '#1f2937'): string =>
        `<div style="display:flex;align-items:center;justify-content:space-between;gap:18px;line-height:19px">` +
        `<span style="color:#9ca3af">${label}</span><b style="color:${color}">${value}</b></div>`;

    const option = computed<EChartsOption>(() => {
        const pts = points.value;
        const xs = pts.map((p) => p.value[0]);
        const ys = pts.map((p) => p.value[1]);
        // 坐标范围留 18% 余量，让四象限角标与姓名标签有落点
        const xMax = Math.max(1, ...xs) * 1.18;
        const yTop = Math.max(0, ...ys) * 1.18 + 1;
        const yBottom = Math.min(0, ...ys) * 1.18 - 1;
        const med = toWan(medianSpend.value);

        /** 四象限浅色底 + 角标文字（返回 markArea 的一对角点）；分割线 = 消耗中位数 / 经营利润 0 */
        const area = (
            key: QuadrantKey,
            x0: number,
            y0: number,
            x1: number,
            y1: number,
        ): [MarkAreaCorner, MarkAreaCorner] => {
            const meta = QUADRANTS[key];
            const position = `${y0 >= 0 ? 'insideTop' : 'insideBottom'}${
                x0 >= med ? 'Right' : 'Left'
            }` as MarkAreaPosition;
            return [
                { xAxis: x0, yAxis: y0, itemStyle: { color: meta.bg, opacity: 1 } },
                {
                    xAxis: x1,
                    yAxis: y1,
                    label: {
                        show: true,
                        position,
                        formatter: meta.name,
                        color: meta.color,
                        fontSize: 12,
                        fontWeight: 'bold',
                        distance: 14,
                    },
                },
            ];
        };

        return {
            grid: { left: 56, right: 28, top: 28, bottom: 54 },
            tooltip: {
                trigger: 'item',
                borderWidth: 0,
                padding: [8, 10],
                backgroundColor: 'rgba(255,255,255,0.97)',
                extraCssText: 'box-shadow:0 4px 16px rgba(31,41,55,0.14);border-radius:8px;',
                formatter: (params: unknown): string => {
                    const d = datumOf(params);
                    if (!d) return '';
                    const qColor = Object.values(QUADRANTS).find((q) => q.name === d.quadrant)?.color ?? '#6b7280';
                    return (
                        `<div style="font-weight:600;margin-bottom:5px;color:#1f2937">${d.name}` +
                        `<span style="color:#9ca3af;font-weight:400"> · ${d.groupName}</span>` +
                        `<span style="margin-left:8px;font-size:11px;color:${qColor}">${d.quadrant}</span></div>` +
                        tipLine('投放消耗', money(d.spend)) +
                        tipLine('经营利润', money(d.operatingProfit), d.operatingProfit >= 0 ? '#12b566' : '#fd6464') +
                        tipLine('累计预估 ROI', `${ratio(d.forecastRoi)} 倍`, d.forecastRoi >= 1 ? '#12b566' : '#fd6464') +
                        tipLine('人效比', ratio(d.efficiencyRatio), efficiencyColor(d.efficiencyRatio)) +
                        tipLine('人力成本', money(d.laborCost)) +
                        tipLine('累计回收完成度', d.recoveryRate > 0 ? percent(d.recoveryRate, 0) : '—')
                    );
                },
            },
            xAxis: {
                type: 'value',
                name: '投放消耗（万）',
                nameLocation: 'middle',
                nameGap: 28,
                nameTextStyle: { color: '#94a3b8', fontSize: 11 },
                min: 0,
                max: xMax,
                axisLine: { show: true, lineStyle: { color: '#e2e8f0' } },
                axisTick: { show: false },
                axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v: number) => `${v.toFixed(0)}万` },
                splitLine: { lineStyle: { color: '#f1f5f9' } },
            },
            yAxis: {
                type: 'value',
                name: '经营利润（万）',
                nameGap: 14,
                nameTextStyle: { color: '#94a3b8', fontSize: 11, align: 'left' },
                min: yBottom,
                max: yTop,
                axisLine: { show: true, lineStyle: { color: '#e2e8f0' } },
                axisTick: { show: false },
                axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v: number) => `${v.toFixed(0)}万` },
                splitLine: { lineStyle: { color: '#f1f5f9' } },
            },
            series: [
                {
                    name: '投手',
                    type: 'scatter',
                    data: pts,
                    // 姓名直接标在点旁：页面的核心诉求是「哪个投手最能赚钱」，先看人再看数
                    label: { show: true, position: 'right', fontSize: 10, color: '#6b7280' },
                    emphasis: {
                        scale: 1.15,
                        label: { show: true, fontSize: 11, fontWeight: 'bold', color: '#1f2937' },
                        itemStyle: { shadowBlur: 8, shadowColor: 'rgba(31,41,55,0.28)' },
                    },
                    markLine: {
                        silent: true,
                        symbol: 'none',
                        lineStyle: { color: '#cbd5e1', type: 'dashed', width: 1 },
                        // 竖向 = 团队消耗中位数；横向 = 经营利润 0（盈亏平衡）
                        data: [
                            {
                                xAxis: med,
                                label: {
                                    formatter: `中位消耗 ${comma(med)} 万`,
                                    position: 'end' as const,
                                    color: '#94a3b8',
                                    fontSize: 10,
                                },
                            },
                            { yAxis: 0 },
                        ],
                    },
                    markArea: {
                        silent: true,
                        data: [
                            area('core', med, 0, xMax, yTop),
                            area('efficient', 0, 0, med, yTop),
                            area('risk', med, yBottom, xMax, 0),
                            area('watch', 0, yBottom, med, 0),
                        ],
                    },
                },
            ],
        };
    });
</script>

<style scoped lang="scss">
    .quad__legend {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 16px;
        margin-bottom: 4px;
    }

    .quad__legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-3);
        cursor: default;
    }

    .quad__dot {
        width: 8px;
        height: 8px;
        border-radius: 2px;
    }

    .quad__legend-name {
        font-weight: 600;
    }

    .quad__legend-num {
        color: var(--oa-text-4);
    }

    .quad__note {
        margin: 6px 0 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.7;
        color: var(--oa-text-4);

        b {
            font-weight: 600;
        }
    }
</style>
